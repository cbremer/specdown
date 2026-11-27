const { loadApp, loadHTML } = require('../helpers/loadApp');

const input = {
  excerpts: [{ id: 'b1', text: 'The client retries twice.' }],
  question: 'How many retries?',
  history: [],
};

beforeEach(() => {
  loadHTML(document);
  loadApp(document);
});
afterEach(() => {
  delete window.iosNative;
  delete window.webkit;
  delete window.specdown;
  delete window.specdownExplainResult;
});

it('displays the Mac model availability reason and rejects an out-of-scope citation', async () => {
  window.specdown = {
    explainAvailable: async () => ({
      available: false,
      reason: 'The model is downloading.',
    }),
    askExplain: async () => ({ text: 'A claim.', sourceIds: ['wrong'] }),
  };
  expect(await explainAvailable()).toBe(false);
  expect(explainUnavailableReason()).toBe('The model is downloading.');
  await expect(askExplain(input, new AbortController().signal)).rejects.toThrow(
    'linked'
  );
});

it('discards ungrounded answer text for a zero-evidence response', async () => {
  window.specdown = {
    askExplain: async () => ({ text: 'Unknown claim', sourceIds: [] }),
  };
  const reply = await askExplain(input, new AbortController().signal);
  expect(reply.text).toMatch(/does not answer/);
  expect(reply.sourceIds).toEqual([]);
});

it('cancels a pending iOS request and ignores its late answer', async () => {
  window.iosNative = true;
  const postMessage = jest.fn();
  window.webkit = { messageHandlers: { specdown: { postMessage } } };
  const controller = new AbortController();
  const answer = askExplain(input, controller.signal);
  const id = postMessage.mock.calls[0][0].data.requestId;
  controller.abort();
  await expect(answer).rejects.toMatchObject({ name: 'AbortError' });
  expect(postMessage).toHaveBeenCalledWith({
    action: 'cancelExplain',
    data: { requestId: id },
  });
  const next = askExplain(input, new AbortController().signal);
  const nextId = postMessage.mock.lastCall[0].data.requestId;
  expect(id).not.toBe(nextId);
  window.specdownExplainResult(id, { text: 'Stale', sourceIds: ['b1'] });
  window.specdownExplainResult(nextId, { text: 'Twice.', sourceIds: ['b1'] });
  await expect(next).resolves.toEqual({ text: 'Twice.', sourceIds: ['b1'] });
});
