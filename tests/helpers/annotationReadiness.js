// Wait for observable state while allowing WebCrypto and storage event-loop turns.
// Keep real asynchronous work intact; a fixed sleep or microtask count is not readiness.
async function waitForAnnotationState(predicate) {
  const deadline = Date.now() + 4000;
  while (!predicate() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 0));
  expect(predicate()).toBe(true);
}
async function waitForAnnotationContext() {
  const target = global.captureDocumentContext();
  await waitForAnnotationState(() => {
    const current = global.annDocumentContext?.document;
    return (
      global.isDocumentContextCurrent(current) &&
      current.generation === target.generation &&
      current.tabId === target.tabId &&
      current.root === target.root
    );
  });
}
module.exports = { waitForAnnotationState, waitForAnnotationContext };
