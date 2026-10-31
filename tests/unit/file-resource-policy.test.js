const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  createFileResourcePolicy,
} = require('../../desktop/file-resource-policy');

describe('Electron file subresource boundary', () => {
  let root, bundle, docs, outside, policy;
  const request = (file, resourceType = 'image') => ({
    url: pathToFileURL(file).href,
    resourceType,
  });
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-file-resources-'));
    bundle = path.join(root, 'bundle');
    docs = path.join(root, 'docs');
    outside = path.join(root, 'outside');
    for (const dir of [bundle, docs, outside]) fs.mkdirSync(dir);
    fs.writeFileSync(path.join(bundle, 'index.html'), '<p>viewer</p>');
    fs.writeFileSync(path.join(bundle, 'main.js'), '');
    fs.writeFileSync(path.join(docs, 'image.png'), 'image');
    fs.writeFileSync(path.join(docs, 'readme.md'), '# Selected document');
    fs.writeFileSync(path.join(outside, 'secret.png'), 'secret');
    policy = createFileResourcePolicy(bundle);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('allows bundle resources while denying unselected file reads', () => {
    expect(policy.allows(request(path.join(bundle, 'main.js'), 'script'))).toBe(
      true
    );
    expect(policy.allows(request(path.join(outside, 'secret.png')))).toBe(
      false
    );
    expect(
      policy.allows({
        url: 'https://example.com/image.png',
        resourceType: 'image',
      })
    ).toBe(true);
  });
  it('permits only images contained in an opened document directory', () => {
    policy.noteDocument(path.join(docs, 'readme.md'));
    expect(policy.allows(request(path.join(docs, 'image.png')))).toBe(true);
    expect(policy.allows(request(path.join(docs, 'image.png'), 'xhr'))).toBe(
      false
    );
    expect(
      policy.allows(request(path.join(docs, '../outside/secret.png')))
    ).toBe(false);
    fs.symlinkSync(
      path.join(outside, 'secret.png'),
      path.join(docs, 'escape.png')
    );
    expect(policy.allows(request(path.join(docs, 'escape.png')))).toBe(false);
  });
  it('rejects ungranted local paths before any filesystem probe', () => {
    const probe = jest.spyOn(fs, 'realpathSync');
    expect(policy.allows(request(path.join(outside, 'secret.png')))).toBe(
      false
    );
    expect(probe).not.toHaveBeenCalled();
    probe.mockRestore();
  });
  it('revokes document images when the associated main-process grant is forgotten', () => {
    let granted = true;
    policy = createFileResourcePolicy(bundle, () => granted);
    policy.noteDocument(path.join(docs, 'readme.md'));
    expect(policy.allows(request(path.join(docs, 'image.png')))).toBe(true);
    granted = false;
    const probe = jest.spyOn(fs, 'realpathSync');
    expect(policy.allows(request(path.join(docs, 'image.png')))).toBe(false);
    expect(probe).not.toHaveBeenCalled();
    probe.mockRestore();
  });
  it('does not probe an ungranted MAS sibling image even when its document is selected', () => {
    const withImageAccess = jest.fn(() => ({ ok: false, reason: 'no-grant' }));
    policy = createFileResourcePolicy(bundle, () => true, withImageAccess);
    policy.noteDocument(path.join(docs, 'readme.md'));
    const probe = jest.spyOn(fs, 'realpathSync');
    const image = path.join(docs, 'image.png');
    expect(policy.allows(request(image))).toBe(false);
    expect(withImageAccess).toHaveBeenCalledWith(image, expect.any(Function));
    expect(probe).not.toHaveBeenCalled();
    probe.mockRestore();
  });

  it('rejects UNC/host URLs before any filesystem probe', () => {
    const probe = jest.spyOn(fs, 'realpathSync');
    expect(
      policy.allows({
        url: 'file://attacker.example/share/pixel.png',
        resourceType: 'image',
      })
    ).toBe(false);
    expect(probe).not.toHaveBeenCalled();
    probe.mockRestore();
  });
  it('allows only the active private print document then revokes it', () => {
    const print = path.join(root, 'document.html');
    policy.allowPrintFile(print);
    expect(policy.allows(request(print, 'mainFrame'))).toBe(true);
    expect(policy.allows(request(print, 'xhr'))).toBe(false);
    policy.forgetPrintFile(print);
    expect(policy.allows(request(print, 'mainFrame'))).toBe(false);
  });
  it('registers the actual cancellation callback once per session', () => {
    const session = { webRequest: { onBeforeRequest: jest.fn() } };
    policy.install(session);
    policy.install(session);
    expect(session.webRequest.onBeforeRequest).toHaveBeenCalledTimes(1);
    const callback = jest.fn();
    session.webRequest.onBeforeRequest.mock.calls[0][0](
      request(path.join(outside, 'secret.png')),
      callback
    );
    expect(callback).toHaveBeenCalledWith({ cancel: true });
  });
});
