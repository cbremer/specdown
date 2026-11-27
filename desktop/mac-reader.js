// One helper per trusted viewer page. Disposing the page kills both the speech
// synthesizer and local inference, including outstanding replies to old frames.
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

const validId = (id) =>
  typeof id === 'string' &&
  id.length > 0 &&
  id.length <= 128 &&
  !/[^A-Za-z0-9_.:-]/.test(id);
const boundedText = (text, limit) =>
  typeof text === 'string' && text.length <= limit;
const unavailable = () => ({
  available: false,
  reason: 'The local Mac reader is unavailable.',
});

function explanationData(input) {
  if (
    !validId(input?.requestId) ||
    !Array.isArray(input.excerpts) ||
    input.excerpts.length < 1 ||
    input.excerpts.length > 24
  )
    return null;
  const excerpts = [];
  const ids = new Set();
  let total = 0;
  for (const entry of input.excerpts) {
    if (
      !validId(entry?.id) ||
      ids.has(entry.id) ||
      !boundedText(entry.text, 1000) ||
      !entry.text.trim()
    )
      return null;
    total += entry.text.length;
    if (total > 6000) return null;
    ids.add(entry.id);
    excerpts.push({ id: entry.id, text: entry.text });
  }
  const question = input.question ?? '';
  const history = input.history ?? [];
  if (
    !boundedText(question, 1000) ||
    !Array.isArray(history) ||
    history.length > 6 ||
    !history.every(
      (turn) =>
        ['user', 'assistant'].includes(turn?.role) &&
        boundedText(turn.text, 1000)
    )
  )
    return null;
  return {
    excerpts,
    question,
    history: history.map(({ role, text }) => ({ role, text })),
  };
}

function createMacReader(executable, emit, spawnHelper = spawn) {
  let child;
  let activeSpeech;
  let inquiry;
  let availability;
  let disposed = false;

  function settle(request, result, error) {
    if (!request) return;
    clearTimeout(request.timer);
    if (request === inquiry) inquiry = null;
    if (request === availability) availability = null;
    if (error) request.reject(new Error(error));
    else request.resolve(result);
  }

  function closeHelper() {
    const previous = child;
    child = null;
    previous?.kill();
    if (activeSpeech) {
      const last = activeSpeech;
      activeSpeech = null;
      if (!disposed) emit({ ...last, type: 'error' });
    }
    settle(availability, unavailable());
    settle(inquiry, null, 'The local Mac reader is unavailable.');
  }

  function receive(message) {
    const event = message?.event;
    if (
      event &&
      activeSpeech &&
      activeSpeech.sessionId === event.sessionId &&
      activeSpeech?.sentenceId === event.sentenceId &&
      ['start', 'end', 'interrupted', 'error'].includes(event.type)
    ) {
      const current = activeSpeech;
      if (event.type !== 'start') activeSpeech = null;
      const noVoice = event.type === 'error' && event.reason === 'no-voice';
      emit({
        ...current,
        type: event.type,
        ...(noVoice ? { reason: 'no-voice' } : {}),
      });
    }
    const result = message?.result;
    if (!result || !validId(message.requestId)) return;
    if (message.requestId === availability?.id) {
      settle(availability, {
        available: result.available === true,
        ...(boundedText(result.reason, 500) ? { reason: result.reason } : {}),
      });
    } else if (message.requestId === inquiry?.id) {
      if (boundedText(result.error, 500) && result.error)
        settle(inquiry, null, result.error);
      else if (
        boundedText(result.text, 4000) &&
        result.text.trim() &&
        Array.isArray(result.sourceIds) &&
        result.sourceIds.length <= 24 &&
        result.sourceIds.every((id) => inquiry.sourceIds.has(id))
      ) {
        settle(inquiry, { text: result.text, sourceIds: result.sourceIds });
      } else settle(inquiry, null, 'The local answer could not be verified.');
    }
  }

  function openHelper() {
    if (disposed) throw new Error('The reader has closed.');
    if (child) return child;
    const proc = spawnHelper(executable, [], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    child = proc;
    // Broken stdin can emit a separate EPIPE after exit. A late error from an
    // old process must never clear a newer request or become an uncaught event.
    const failed = () => {
      if (child === proc) closeHelper();
    };
    proc.on('error', failed);
    proc.on('close', failed);
    proc.stdin.on('error', failed);
    proc.stdout.on('error', failed);
    let buffer = '';
    proc.stdout.setEncoding('utf8').on('data', (chunk) => {
      if (child !== proc) return;
      buffer += chunk;
      let end;
      try {
        while ((end = buffer.indexOf('\n')) !== -1) {
          if (end > 128 * 1024) throw new Error('Oversize response.');
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          receive(JSON.parse(line));
        }
        if (buffer.length > 128 * 1024) failed();
      } catch {
        failed();
      }
    });
    return proc;
  }

  function write(action, data) {
    const proc = openHelper();
    if (proc.stdin.writableLength > 128 * 1024)
      throw new Error('The local Mac reader is busy.');
    // Foundation's async lines parser also recognizes Unicode line separators.
    const line = JSON.stringify({ action, data }).replace(
      /[\u0085\u2028\u2029]/g,
      (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
    );
    proc.stdin.write(line + '\n');
  }

  function speech(input) {
    if (!validId(input?.sessionId) || !validId(input.sentenceId)) return false;
    const ids = { sessionId: input.sessionId, sentenceId: input.sentenceId };
    if (input.action === 'stop') {
      if (
        activeSpeech?.sessionId !== ids.sessionId ||
        activeSpeech.sentenceId !== ids.sentenceId
      )
        return true;
      activeSpeech = null;
      try {
        write('speech', { action: 'stop', ...ids });
      } catch {
        closeHelper();
      }
      return true;
    }
    const rate = input.rate ?? 1;
    if (
      input.action !== 'speak' ||
      !boundedText(input.text, 500) ||
      !input.text.trim() ||
      !Number.isFinite(rate) ||
      rate < 0.75 ||
      rate > 2
    )
      return false;
    activeSpeech = ids;
    try {
      write('speech', { action: 'speak', ...ids, text: input.text, rate });
      return true;
    } catch {
      closeHelper();
      return false;
    }
  }

  function request(action, data, clientId) {
    const id = randomUUID();
    const pending = {
      ...Promise.withResolvers(),
      id,
      clientId,
      sourceIds: new Set(data.excerpts?.map((e) => e.id)),
    };
    if (action === 'askExplain') inquiry = pending;
    else availability = pending;
    pending.timer = setTimeout(
      () => {
        if (pending === inquiry) {
          settle(pending, null, 'The local explanation timed out.');
          try {
            write('cancelExplain', { requestId: id });
          } catch {
            closeHelper();
          }
        } else settle(pending, unavailable());
      },
      action === 'askExplain' ? 120000 : 10000
    );
    try {
      write(action, { ...data, requestId: id });
    } catch {
      closeHelper();
    }
    return pending.promise;
  }

  return {
    speech,
    explainAvailable: () =>
      availability?.promise || request('explainAvailable', {}),
    askExplain(input) {
      const data = explanationData(input);
      if (!data)
        return Promise.reject(new Error('Invalid explanation request.'));
      if (inquiry)
        return Promise.reject(
          new Error('An explanation is already in progress.')
        );
      return request('askExplain', data, input.requestId);
    },
    cancelExplain(clientId) {
      if (!inquiry || inquiry.clientId !== clientId) return false;
      const id = inquiry.id;
      settle(inquiry, null, 'Explanation cancelled.');
      try {
        write('cancelExplain', { requestId: id });
      } catch {
        closeHelper();
      }
      return true;
    },
    dispose() {
      disposed = true;
      closeHelper();
    },
  };
}

module.exports = { createMacReader };
