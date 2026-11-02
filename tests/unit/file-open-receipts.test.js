const { EventEmitter } = require('events');
const {
  createFileOpenReceipts,
  MAX_PENDING_OPENS,
  OPEN_RECEIPT_TTL_MS,
} = require('../../desktop/file-open-receipts');

function receiptWindow() {
  const wc = new EventEmitter();
  wc.mainFrame = {
    url: 'file:///synthetic/index.html',
    detached: false,
    send: jest.fn(),
  };
  wc.isDestroyed = () => false;
  wc.isLoadingMainFrame = () => false;
  return wc;
}
const receiptFile = {
  filePath: '/synthetic/A.md',
  filename: 'A.md',
  content: '# A',
};
let receiptNow;
let receiptCommit;
let receiptController;
let receiptWc;
beforeEach(() => {
  receiptNow = 0;
  receiptCommit = jest.fn();
  receiptController = createFileOpenReceipts({
    isAppPage: (url) => url === 'file:///synthetic/index.html',
    onAccepted: receiptCommit,
    now: () => receiptNow,
  });
  receiptWc = receiptWindow();
  receiptController.bind(receiptWc);
});
const latestReceipt = () =>
  receiptWc.mainFrame.send.mock.calls.at(-1)[1].openReceipt;
const resultFor = (receipt, accepted = true, sender = receiptWc) =>
  receiptController.acknowledge(
    { sender, senderFrame: sender.mainFrame },
    { receipt, accepted }
  );

test('expiry rejects the old receipt without an OS or store callback', () => {
  receiptController.deliver(receiptFile);
  const id = latestReceipt();
  receiptNow = OPEN_RECEIPT_TTL_MS;
  expect(resultFor(id)).toBe(false);
  expect(receiptCommit).not.toHaveBeenCalled();
});

test('the pending map is bounded, and expiry recovers delivery capacity', () => {
  for (let i = 0; i < MAX_PENDING_OPENS; i++)
    expect(receiptController.deliver(receiptFile)).toBe(true);
  const expired = latestReceipt();
  expect(receiptController.deliver(receiptFile)).toBe(false);
  expect(receiptWc.mainFrame.send).toHaveBeenCalledTimes(MAX_PENDING_OPENS);
  receiptNow = OPEN_RECEIPT_TTL_MS;
  expect(receiptController.deliver(receiptFile)).toBe(true);
  expect(resultFor(expired)).toBe(false);
  expect(resultFor(latestReceipt())).toBe(true);
  expect(receiptCommit).toHaveBeenCalledTimes(1);
});

test('rebinding a new window invalidates old receipts and removes old listeners', () => {
  receiptController.deliver(receiptFile);
  const old = receiptWc;
  const id = latestReceipt();
  receiptWc = receiptWindow();
  receiptController.bind(receiptWc);
  expect(old.listenerCount('did-start-navigation')).toBe(0);
  expect(resultFor(id, true, old)).toBe(false);
  expect(resultFor(id)).toBe(false);
  old.emit('destroyed');
  receiptController.forget(old);
  expect(receiptController.deliver(receiptFile)).toBe(true);
  expect(resultFor(latestReceipt())).toBe(true);
});

test('a receipt delivered to the previous document is invalid even when its frame object survives', () => {
  receiptController.deliver(receiptFile);
  const old = latestReceipt();
  receiptWc.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: false,
  });
  receiptController.deliver(receiptFile);
  expect(resultFor(old)).toBe(false);
  expect(resultFor(latestReceipt())).toBe(true);
});

test.each([
  null,
  {},
  [],
  { receipt: 1, accepted: true },
  { receipt: 'fake', accepted: true },
  { receipt: 'x'.repeat(36), accepted: true },
])('malformed or forged result %p cannot commit', (result) => {
  receiptController.deliver(receiptFile);
  expect(
    receiptController.acknowledge(
      { sender: receiptWc, senderFrame: receiptWc.mainFrame },
      result
    )
  ).toBe(false);
  expect(receiptCommit).not.toHaveBeenCalled();
});

test('two independently accepted opens survive reordered acknowledgments', () => {
  receiptController.deliver(receiptFile);
  const a = latestReceipt();
  receiptController.deliver({ ...receiptFile, filePath: '/synthetic/B.md' });
  expect(resultFor(latestReceipt())).toBe(true);
  expect(resultFor(a)).toBe(true);
  expect(receiptCommit.mock.calls).toEqual([
    ['/synthetic/B.md'],
    ['/synthetic/A.md'],
  ]);
});

test('response receipts require the exact requesting bound frame and do not push an extra open', () => {
  const event = { sender: receiptWc, senderFrame: receiptWc.mainFrame };
  expect(
    receiptController.prepare(
      receiptFile,
      {},
      { ...event, sender: receiptWindow() }
    )
  ).toBeNull();
  expect(
    receiptController.prepare(receiptFile, {}, { ...event, senderFrame: {} })
  ).toBeNull();
  const prepared = receiptController.prepare(receiptFile, {}, event);
  expect(prepared).toMatchObject({
    ...receiptFile,
    openReceipt: expect.any(String),
  });
  expect(receiptWc.mainFrame.send).not.toHaveBeenCalled();
  expect(resultFor(prepared.openReceipt)).toBe(true);
  expect(receiptCommit).toHaveBeenCalledWith(receiptFile.filePath);
});

test('response receipt result uses only main-held context and consumes rejection once', () => {
  const onResult = jest.fn();
  const controller = createFileOpenReceipts({
    isAppPage: () => true,
    onAccepted: receiptCommit,
    onResult,
  });
  controller.bind(receiptWc);
  const event = { sender: receiptWc, senderFrame: receiptWc.mainFrame };
  const context = { requestedPath: '/synthetic/original.md' };
  const prepared = controller.prepare(receiptFile, context, event);
  expect(
    controller.acknowledge(event, {
      receipt: prepared.openReceipt,
      accepted: false,
      context: { requestedPath: '/forged.md' },
    })
  ).toBe(true);
  expect(onResult.mock.calls).toEqual([[receiptFile.filePath, false, context]]);
  expect(receiptCommit).not.toHaveBeenCalled();
  expect(
    controller.acknowledge(event, {
      receipt: prepared.openReceipt,
      accepted: true,
    })
  ).toBe(false);
});
