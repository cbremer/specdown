const { EventEmitter } = require('events');
const {
  createOpenRecovery,
  MAX_OPEN_FAILURES,
} = require('../../desktop/open-recovery');

function recoveryFixture() {
  const a = {
    filePath: '/synthetic/missing.md',
    filename: 'same.md',
    future: 'keep',
  };
  const b = { filePath: '/synthetic/other.md', filename: 'same.md' };
  let state = {
    session: { tabs: [a, b], future: 'keep-session' },
    recentFiles: ['unchanged'],
    grants: { untouched: true },
  };
  const store = {
    get: (key, fallback) => state[key] ?? fallback,
    set: jest.fn((key, value) => {
      state = { ...state, [key]: value };
      return true;
    }),
  };
  const wc = new EventEmitter();
  wc.isDestroyed = () => false;
  wc.isLoadingMainFrame = () => false;
  wc.mainFrame = { url: 'app://trusted', detached: false, send: jest.fn() };
  const locate = jest.fn(async () => false);
  const manager = createOpenRecovery({
    isAppPage: (url) => url === 'app://trusted',
    getStore: () => store,
    locate,
  });
  manager.bind(wc);
  manager.beginRestore();
  const event = () => ({ sender: wc, senderFrame: wc.mainFrame });
  const failed = (entry = a) => {
    manager.report(entry.filePath, 'Unavailable', entry);
    return wc.mainFrame.send.mock.calls
      .filter(([name]) => name === 'file-open-failed')
      .at(-1)[1];
  };
  const token = () =>
    wc.mainFrame.send.mock.calls
      .filter(([name]) => name === 'session-save-ready')
      .at(-1)[1].token;
  const save = (tabs, value = token(), origin = event()) =>
    manager.save(origin, tabs, value);
  return {
    a,
    b,
    store,
    wc,
    manager,
    locate,
    event,
    failed,
    token,
    save,
    state: () => state,
  };
}

describe('main-held open recovery authority and preservation', () => {
  test('multiple same-named entries receive distinct opaque IDs with no path authority', () => {
    const f = recoveryFixture();
    const first = f.failed(f.a),
      second = f.failed(f.b);
    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({ filename: 'missing.md', canForget: true });
    expect(Object.keys(first).sort()).toEqual([
      'canForget',
      'filename',
      'id',
      'message',
    ]);
  });
  test('dismiss is one-use and changes no persisted state; relaunch still restores the entry', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    const before = JSON.stringify(f.state());
    expect(await f.manager.act(f.event(), { id, action: 'dismiss' })).toBe(
      true
    );
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
    expect(JSON.stringify(f.state())).toBe(before);
    f.manager.bind(f.wc);
    expect(f.manager.beginRestore()).toEqual([f.a, f.b]);
  });
  test('forget removes only the exact unavailable saved entry and survives relaunch', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(true);
    expect(f.state()).toEqual({
      session: { tabs: [f.b], future: 'keep-session' },
      recentFiles: ['unchanged'],
      grants: { untouched: true },
    });
    f.manager.bind(f.wc);
    expect(f.manager.beginRestore()).toEqual([f.b]);
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
  });
  test.each(['locate', 'forget', 'dismiss'])(
    'wrong frame/sender and extra path cannot %s',
    async (action) => {
      const f = recoveryFixture(),
        id = f.failed().id;
      const before = JSON.stringify(f.state());
      expect(
        await f.manager.act({ ...f.event(), sender: {} }, { id, action })
      ).toBe(false);
      expect(
        await f.manager.act({ ...f.event(), senderFrame: {} }, { id, action })
      ).toBe(false);
      expect(
        await f.manager.act(f.event(), { id, action, filePath: f.b.filePath })
      ).toBe(false);
      expect(await f.manager.act(f.event(), { id: 'forged', action })).toBe(
        false
      );
      expect(f.locate).not.toHaveBeenCalled();
      expect(JSON.stringify(f.state())).toBe(before);
    }
  );
  test.each([
    'navigation',
    'crash',
    'destroy',
    'replacement',
    'loading',
    'detached',
    'untrusted',
  ])('%s invalidates action authority', async (change) => {
    const f = recoveryFixture(),
      id = f.failed().id,
      event = f.event();
    if (change === 'navigation')
      f.wc.emit('did-start-navigation', {
        isMainFrame: true,
        isSameDocument: false,
      });
    if (change === 'crash') f.wc.emit('render-process-gone');
    if (change === 'destroy') f.wc.emit('destroyed');
    if (change === 'replacement') f.wc.mainFrame = { ...f.wc.mainFrame };
    if (change === 'loading') f.wc.isLoadingMainFrame = () => true;
    if (change === 'detached') f.wc.mainFrame.detached = true;
    if (change === 'untrusted') f.wc.mainFrame.url = 'https://remote.invalid';
    expect(await f.manager.act(event, { id, action: 'forget' })).toBe(false);
    expect(f.state().session.tabs).toEqual([f.a, f.b]);
  });
  test('subframe/same-document navigation preserves the current record', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.wc.emit('did-start-navigation', {
      isMainFrame: false,
      isSameDocument: false,
    });
    f.wc.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: true,
    });
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(true);
  });
  test('failed persistence keeps entry and permits retry', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.store.set.mockReturnValueOnce(false);
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
    expect(f.state().session.tabs).toEqual([f.a, f.b]);
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(true);
  });
  test('replaced session record cannot be forgotten through an older token', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.store.set('session', { tabs: [{ ...f.a }, f.b] });
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
  });
  test('successful admission removes stale actions while preserving unrelated missing entries', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.save([{ filePath: f.a.filePath, filename: 'accepted.md' }]);
    f.manager.admitted(f.a.filePath, true, { entry: f.a });
    expect(f.state().session.tabs).toEqual([
      { filePath: f.a.filePath, filename: 'accepted.md' },
      f.b,
    ]);
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
    expect(f.wc.mainFrame.send).toHaveBeenCalledWith(
      'file-open-recovery-resolved',
      { id }
    );
  });
  test('rejected admission or dismissed failure survives later session saves', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    await f.manager.act(f.event(), { id, action: 'dismiss' });
    f.save([{ filePath: '/synthetic/accepted.md', filename: 'accepted.md' }]);
    f.manager.admitted(f.a.filePath, false, { entry: f.a });
    expect(f.state().session.tabs).toEqual([
      { filePath: '/synthetic/accepted.md', filename: 'accepted.md' },
      f.a,
      f.b,
    ]);
  });
  test('Locate uses only main-held path, cancel keeps recovery, and concurrent attempts are bounded', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    let finish;
    f.locate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const pending = f.manager.act(f.event(), { id, action: 'locate' });
    expect(f.locate.mock.calls[0][0]).toBe(f.a.filePath);
    expect(await f.manager.act(f.event(), { id, action: 'locate' })).toBe(
      false
    );
    finish(false);
    expect(await pending).toBe(false);
    expect(f.state().session.tabs).toEqual([f.a, f.b]);
    expect(await f.manager.act(f.event(), { id, action: 'dismiss' })).toBe(
      true
    );
  });
  test.each(['dismiss', 'forget', 'navigation', 'admit'])(
    'pending Locate cannot mutate after %s invalidates its record',
    async (change) => {
      const f = recoveryFixture(),
        id = f.failed().id;
      let check, finish;
      f.locate.mockImplementation((_path, current) => {
        check = current;
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      const pending = f.manager.act(f.event(), { id, action: 'locate' });
      expect(check()).toBe(true);
      if (change === 'navigation')
        f.wc.emit('did-start-navigation', {
          isMainFrame: true,
          isSameDocument: false,
        });
      else if (change === 'admit')
        f.manager.admitted(f.a.filePath, true, { entry: f.a });
      else await f.manager.act(f.event(), { id, action: change });
      expect(check()).toBe(false);
      finish(false);
      await pending;
    }
  );
  test('a replacement Locate path removes the original saved entry only after accepted ACK', () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.save([
      { filePath: '/synthetic/replacement.md', filename: 'replacement.md' },
    ]);
    expect(f.state().session.tabs).toContain(f.a);
    f.manager.admitted('/synthetic/replacement.md', true, {
      entry: f.a,
      failureId: id,
    });
    expect(f.state().session.tabs).toEqual([
      { filePath: '/synthetic/replacement.md', filename: 'replacement.md' },
      f.b,
    ]);
  });
  test('non-session failure cannot delete saved entries', async () => {
    const f = recoveryFixture();
    f.manager.report(f.a.filePath, 'Read error');
    const info = f.wc.mainFrame.send.mock.calls.at(-1)[1];
    expect(info.canForget).toBe(false);
    expect(
      await f.manager.act(f.event(), { id: info.id, action: 'forget' })
    ).toBe(false);
  });
  test('failure records are bounded and overflow never removes persisted entries', () => {
    const f = recoveryFixture();
    for (let n = 0; n < MAX_OPEN_FAILURES; n++)
      expect(f.manager.report(`/synthetic/${n}.md`, 'error')).toBe(true);
    expect(f.manager.report('/synthetic/overflow.md', 'error')).toBe(false);
    expect(f.state().session.tabs).toEqual([f.a, f.b]);
  });
  test('accepted tabs retire old forget authority even if the subsequent save fails', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.save([
      { filePath: '/synthetic/replacement.md', filename: 'replacement.md' },
    ]);
    const before = JSON.stringify(f.state());
    f.store.set.mockReturnValueOnce(false);
    f.manager.admitted('/synthetic/replacement.md', true, {
      entry: f.a,
      failureId: id,
    });
    expect(JSON.stringify(f.state())).toBe(before);
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
    const failure = f.wc.mainFrame.send.mock.calls
      .filter(([name]) => name === 'file-open-failed')
      .at(-1)[1];
    expect(failure.canForget).toBe(false);
    expect(failure.message).toContain('startup list could not be saved');
    expect(
      f.save([
        { filePath: '/synthetic/replacement.md', filename: 'replacement.md' },
      ])
    ).toBe(true);
    expect(f.state().session.tabs).toEqual([
      { filePath: '/synthetic/replacement.md', filename: 'replacement.md' },
      f.b,
    ]);
  });
  test.each(['loading', 'navigation', 'crash', 'wrong-frame', 'wrong-sender'])(
    'queued save after %s cannot erase unresolved entries',
    (change) => {
      const f = recoveryFixture();
      const event = f.event();
      f.failed();
      const before = JSON.stringify(f.state());
      if (change === 'loading') f.wc.isLoadingMainFrame = () => true;
      if (change === 'navigation')
        f.wc.emit('did-start-navigation', {
          isMainFrame: true,
          isSameDocument: false,
        });
      if (change === 'crash') f.wc.emit('render-process-gone');
      if (change === 'wrong-frame') event.senderFrame = {};
      if (change === 'wrong-sender') event.sender = {};
      expect(f.save([], f.token(), event)).toBe(false);
      expect(JSON.stringify(f.state())).toBe(before);
      if (change === 'navigation' || change === 'crash') {
        // Even a frame object reused by a reload must finish and re-seed first.
        expect(f.save([])).toBe(false);
        f.manager.beginRestore();
        expect(f.save([])).toBe(true);
        expect(f.state().session.tabs).toEqual([f.a, f.b]);
      }
    }
  );
  test('old queued save is rejected even after a same-frame reload finishes', () => {
    const f = recoveryFixture(),
      oldToken = f.token(),
      oldEvent = f.event();
    f.wc.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: false,
    });
    f.manager.beginRestore();
    const before = JSON.stringify(f.state());
    expect(f.token()).not.toBe(oldToken);
    expect(f.manager.save(oldEvent, [], oldToken)).toBe(false);
    expect(f.manager.save(f.event(), [], undefined)).toBe(false);
    expect(f.manager.save(f.event(), [], 'forged')).toBe(false);
    expect(JSON.stringify(f.state())).toBe(before);
    expect(f.save([])).toBe(true);
    expect(f.state().session.tabs).toEqual([f.a, f.b]);
  });
  test('a moved authorized bookmark retires its original reference after admission', async () => {
    const f = recoveryFixture(),
      id = f.failed().id;
    f.save([{ filePath: '/synthetic/moved.md', filename: 'moved.md' }]);
    f.manager.admitted('/synthetic/moved.md', true, {
      requestedPath: f.a.filePath,
    });
    expect(f.state().session.tabs).toEqual([
      { filePath: '/synthetic/moved.md', filename: 'moved.md' },
      f.b,
    ]);
    expect(await f.manager.act(f.event(), { id, action: 'forget' })).toBe(
      false
    );
  });
});
