const { loadHTML, loadApp } = require('../helpers/loadApp');

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const rail = () => document.getElementById('explain-rail');
const button = (label, container = rail()) =>
  [...container.querySelectorAll('button')].find(
    (node) => node.textContent === label
  );
const sendQuestion = (text) => {
  const input = document.getElementById('explain-question');
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.form.dispatchEvent(new Event('submit', { cancelable: true }));
};

describe('Explain rail', () => {
  let reader, range, toggle;
  const originalMatch = window.matchMedia;
  let compact;
  beforeEach(() => {
    localStorage.setItem('visualTheme', 'default');
    loadHTML(document);
    loadApp(document);
    reader = document.getElementById('markdown-content');
    document.getElementById('content-area').style.display = 'flex';
    reader.innerHTML =
      '<h2>Retries</h2><p>A client <em>retries twice</em> after timeout.</p><h2>Permissions</h2><p>Permission errors are final.</p>';
    range = document.createRange();
    range.selectNodeContents(reader.querySelector('em'));
    toggle = document.getElementById('overflow-toggle');
    toggle.focus();
    compact = false;
    window.matchMedia = jest.fn(() => ({
      get matches() {
        return compact;
      },
      addEventListener() {},
      removeEventListener() {},
    }));
    global.explainAvailable = jest.fn(async () => true);
    global.explainUnavailableReason = jest.fn(() => '');
    global.askExplain = jest.fn(async ({ excerpts }) => ({
      text: 'It retries <twice>.',
      sourceIds: [excerpts[0].id],
    }));
    global.readAloudListen = jest.fn();
  });
  afterEach(() => {
    resetExplainRail();
    if (originalMatch) window.matchMedia = originalMatch;
    else delete window.matchMedia;
  });

  it('keeps the selected passage, citations, prior turns and answer narration together', async () => {
    openExplainRail(range);
    await settle();
    const first = askExplain.mock.calls[0][0];
    expect(first.excerpts).toEqual([
      { id: expect.any(String), text: 'retries twice' },
    ]);
    expect(rail().textContent).toContain('It retries <twice>.');
    expect(rail().querySelector('twice')).toBeNull();
    button('Source 1').click();
    expect(window.getSelection().toString()).toBe('retries twice');
    button('Listen').click();
    expect(readAloudListen).toHaveBeenCalledWith('It retries <twice>.');
    sendQuestion('Does that apply to permission errors?');
    sendQuestion('Duplicate');
    await settle();
    expect(askExplain).toHaveBeenCalledTimes(2);
    const followup = askExplain.mock.calls[1][0];
    expect(followup.history).toEqual([
      { role: 'assistant', text: 'It retries <twice>.' },
    ]);
    expect(followup.excerpts).toEqual(first.excerpts);
    expect(rail().querySelectorAll('.explain-turn')).toHaveLength(2);
    button('Close').click();
    expect(document.activeElement).toBe(toggle);
    openExplainRail(range);
    await settle();
    expect(rail().textContent).toContain(followup.question);
    expect(askExplain).toHaveBeenCalledTimes(2);
  });

  it('sends only the six most recent entries and caps history text at the provider limit', async () => {
    global.askExplain.mockImplementation(async ({ excerpts }) => ({
      text: 'a'.repeat(1200),
      sourceIds: [excerpts[0].id],
    }));
    openExplainRail(range);
    await settle();
    for (let index = 1; index <= 4; index++) {
      sendQuestion('Question ' + index);
      await settle();
    }
    const history = askExplain.mock.lastCall[0].history;
    expect(history.map(({ role }) => role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(history[0].text).toBe('Question 1');
    expect(history.every(({ text }) => text.length <= 1000)).toBe(true);
  });

  it('requires explicit scope expansion, cancels the previous turn and ignores stale replies after reset', async () => {
    const replies = [];
    global.askExplain.mockImplementation(
      () => new Promise((resolve) => replies.push(resolve))
    );
    openExplainRail(range);
    await settle();
    button('Use whole document').click();
    const [[first, firstSignal], [whole, wholeSignal]] = askExplain.mock.calls;
    expect(firstSignal.aborted).toBe(true);
    expect(whole.history).toEqual([]);
    expect(whole.excerpts.map((e) => e.text).join(' ')).toContain(
      'Permission errors are final.'
    );
    replies[0]({
      text: 'Late selection answer',
      sourceIds: [first.excerpts[0].id],
    });
    await settle();
    expect(rail().textContent).not.toContain('Late selection answer');
    resetExplainRail();
    expect(wholeSignal.aborted).toBe(true);
    replies[1]({ text: 'Late full answer', sourceIds: [whole.excerpts[0].id] });
    openExplainRail(range);
    await settle();
    expect(rail().textContent).not.toContain('Late full answer');
    expect(askExplain.mock.calls[2][0].history).toEqual([]);
  });

  it('supports Stop and Retry and withholds uncited or mismatched answers', async () => {
    let finish;
    global.askExplain
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce({
        text: 'Wrong source',
        sourceIds: ['unrecognized'],
      })
      .mockResolvedValueOnce({ text: 'Made-up retry', sourceIds: [] });
    openExplainRail(range);
    await settle();
    button('Stop').focus();
    button('Stop').click();
    expect(askExplain.mock.calls[0][1].aborted).toBe(true);
    expect(document.activeElement).toBe(button('Retry'));
    finish({
      text: 'Outdated answer',
      sourceIds: [askExplain.mock.calls[0][0].excerpts[0].id],
    });
    await settle();
    button('Retry').click();
    await settle();
    expect(rail().textContent).not.toMatch(/Wrong source|Outdated answer/);
    expect(rail().textContent).toContain('could not be linked');
    button('Retry').click();
    await settle();
    expect(rail().textContent).not.toContain('Made-up retry');
    expect(rail().textContent).toContain('does not provide enough information');
    expect(button('Use whole document').hidden).toBe(false);
  });

  it('returns from a compact citation and restores selection, scroll and focus on Escape', async () => {
    compact = true;
    reader.scrollTop = 57;
    openExplainRail(range);
    await settle();
    expect(rail().getAttribute('aria-modal')).toBe('true');
    expect(reader.closest('[inert]')).not.toBeNull();
    const citation = button('Source 1');
    citation.click();
    expect(reader.closest('[inert]')).toBeNull();
    expect(rail().hidden).toBe(true);
    expect(document.activeElement.textContent).toBe('Back to explanation');
    document.activeElement.click();
    expect(document.activeElement).toBe(citation);
    window.getSelection().removeAllRanges();
    reader.scrollTop = 100;
    citation.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
    expect(window.getSelection().toString()).toBe('retries twice');
    expect(reader.scrollTop).toBe(57);
    expect(document.activeElement).toBe(toggle);
  });

  it('keeps source steps, listening and fallback available without a model', async () => {
    global.explainAvailable.mockResolvedValue(false);
    global.explainUnavailableReason.mockReturnValue(
      'Apple Intelligence is turned off.'
    );
    reader.innerHTML =
      '<pre><code class="language-mermaid">sequenceDiagram\n    C-&gt;&gt;A: Submit job\n    A--&gt;&gt;C: Accepted</code></pre>';
    openExplainRail(null, reader.querySelector('pre'));
    await settle();
    expect(rail().textContent).toContain('Apple Intelligence is turned off.');
    expect(rail().querySelector('form').hidden).toBe(true);
    const steps = [...rail().querySelectorAll('ol button')];
    expect(steps).toHaveLength(2);
    expect(steps[1].textContent).toContain('Accepted');
    steps[1].click();
    expect(window.getSelection().toString()).toContain('Accepted');
    button('Listen to walkthrough').click();
    expect(readAloudListen).toHaveBeenCalledWith(
      steps.map((step) => step.textContent).join('\n')
    );
    expect(askExplain).not.toHaveBeenCalled();
  });
});
