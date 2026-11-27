const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createMacReader } = require('../../desktop/mac-reader');

const query = {
  requestId: 'thread.turn1',
  excerpts: [{ id: 'A:1', text: 'Retry twice.' }],
  question: 'How many retries?',
  history: [],
};
const ids = { sessionId: 'session-1', sentenceId: 's:1' };

function fixture() {
  const processes = [];
  const emit = jest.fn();
  const spawn = jest.fn(() => {
    const p = new EventEmitter();
    p.stdin = new PassThrough();
    p.stdout = new PassThrough();
    p.commands = [];
    p.stdin.on('data', (line) => p.commands.push(JSON.parse(line.toString())));
    p.reply = (value) => p.stdout.write(JSON.stringify(value) + '\n');
    p.kill = jest.fn();
    processes.push(p);
    return p;
  });
  return {
    reader: createMacReader(
      '/bundle/Contents/Helpers/SpecDownReader',
      emit,
      spawn
    ),
    processes,
    emit,
    spawn,
  };
}

test('coalesces model discovery and relays only evidence from the current request', async () => {
  const { reader, processes, spawn } = fixture();
  const availability = reader.explainAvailable();
  expect(reader.explainAvailable()).toBe(availability);
  const answer = reader.askExplain(query);
  await expect(reader.askExplain(query)).rejects.toThrow(/progress/);
  const [p] = processes;
  const [check, ask] = p.commands;
  expect(check.action).toBe('explainAvailable');
  expect(ask.data).toMatchObject({
    question: query.question,
    excerpts: query.excerpts,
  });
  expect(ask.data.requestId).not.toBe(query.requestId);
  expect(spawn).toHaveBeenCalledTimes(1);
  p.reply({
    requestId: check.data.requestId,
    result: { available: false, reason: 'Model is downloading.' },
  });
  await expect(availability).resolves.toEqual({
    available: false,
    reason: 'Model is downloading.',
  });
  const result = { text: 'Two retries.', sourceIds: ['A:1'] };
  p.reply({ requestId: ask.data.requestId, result });
  await expect(answer).resolves.toEqual(result);
  const invalidAnswer = reader.askExplain(query);
  p.reply({
    requestId: p.commands.at(-1).data.requestId,
    result: { text: 'Wrong.', sourceIds: ['unknown'] },
  });
  await expect(invalidAnswer).rejects.toThrow(/verified/);
  reader.dispose();
});

test('cancels a matching request, ignores its late reply when a client ID is reused', async () => {
  const { reader, processes } = fixture();
  const old = reader.askExplain(query);
  const [p] = processes;
  const oldId = p.commands[0].data.requestId;
  expect(reader.cancelExplain('other')).toBe(false);
  expect(reader.cancelExplain(query.requestId)).toBe(true);
  await expect(old).rejects.toThrow(/cancelled/);
  expect(p.commands[1]).toEqual({
    action: 'cancelExplain',
    data: { requestId: oldId },
  });
  const next = reader.askExplain(query);
  p.reply({ requestId: oldId, result: { text: 'OLD', sourceIds: ['A:1'] } });
  p.reply({
    requestId: p.commands[2].data.requestId,
    result: { text: 'NEW', sourceIds: ['A:1'] },
  });
  await expect(next).resolves.toMatchObject({ text: 'NEW' });
  reader.dispose();
});

test('validates data before the helper launches', async () => {
  const { reader, spawn } = fixture();
  for (const input of [
    { ...query, excerpts: [query.excerpts[0], query.excerpts[0]] },
    { ...query, question: 'a'.repeat(1001) },
    { ...query, history: [{ role: 'system', text: 'x' }] },
    { ...query, excerpts: [{ id: 'x\n', text: 'y' }] },
    {
      ...query,
      excerpts: Array.from({ length: 7 }, (_, i) => ({
        id: String(i),
        text: 'a'.repeat(1000),
      })),
    },
  ])
    await expect(reader.askExplain(input)).rejects.toThrow(/Invalid/);
  expect(
    reader.speech({ action: 'speak', ...ids, text: 'x'.repeat(501) })
  ).toBe(false);
  expect(reader.speech({ action: 'speak', ...ids, text: 'x', rate: NaN })).toBe(
    false
  );
  expect(spawn).not.toHaveBeenCalled();
});

test('speech replies and stops apply only to the active utterance; disposal ends the page', async () => {
  const { reader, processes, emit } = fixture();
  expect(reader.speech({ action: 'speak', ...ids, text: 'Read aloud.' })).toBe(
    true
  );
  const [p] = processes;
  const current = { ...ids, sentenceId: 's:2' };
  reader.speech({ action: 'speak', ...current, text: 'Another sentence.' });
  reader.speech({ action: 'stop', ...ids });
  expect(p.commands).toHaveLength(2);
  p.reply({ event: { ...ids, type: 'end' } });
  p.reply({ event: { ...current, type: 'start', extra: 'untrusted' } });
  expect(emit.mock.calls).toEqual([[{ ...current, type: 'start' }]]);
  reader.speech({ action: 'stop', ...current });
  expect(p.commands[2]).toMatchObject({
    action: 'speech',
    data: { action: 'stop', ...current },
  });
  p.reply({ event: { ...current, type: 'end' } });
  const pending = reader.askExplain(query);
  reader.dispose();
  await expect(pending).rejects.toThrow(/unavailable/);
  expect(p.kill).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledTimes(1);
});

test('relays only the specific missing-voice reason', () => {
  const { reader, processes, emit } = fixture();
  for (const reason of ['no-voice', 'other diagnostic']) {
    reader.speech({ action: 'speak', ...ids, text: 'Hello.' });
    processes[0].reply({ event: { ...ids, type: 'error', reason } });
  }
  expect(emit.mock.calls).toEqual([
    [{ ...ids, type: 'error', reason: 'no-voice' }],
    [{ ...ids, type: 'error' }],
  ]);
  reader.dispose();
});

test('a missing or broken helper reports failure and permits a fresh launch', async () => {
  const { reader, processes, emit } = fixture();
  const discovery = reader.explainAvailable();
  reader.speech({ action: 'speak', ...ids, text: 'Hello.' });
  processes[0].emit('error', new Error('ENOENT'));
  await expect(discovery).resolves.toMatchObject({ available: false });
  expect(emit).toHaveBeenCalledWith({ ...ids, type: 'error' });
  const next = reader.explainAvailable();
  processes[0].emit('close');
  const second = processes[1];
  second.reply({
    requestId: second.commands[0].data.requestId,
    result: { available: true },
  });
  await expect(next).resolves.toEqual({ available: true });
  reader.dispose();
});
