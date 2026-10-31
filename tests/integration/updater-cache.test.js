// Exercise the installed dependency against real files: mocking this helper
// would miss a regression to the vulnerable cached-filename validation.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const {
  DownloadedUpdateHelper,
} = require('electron-updater/out/DownloadedUpdateHelper');

describe('electron-updater cached update containment', () => {
  let cacheDir;
  let pending;
  let helper;
  let logger;
  let readStream;
  const payload = Buffer.from('inert update fixture; never executed');
  const sha512 = createHash('sha512').update(payload).digest('base64');
  const fileInfo = { info: { sha512 } };

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-updater-test-'));
    pending = path.join(cacheDir, 'pending');
    fs.mkdirSync(pending);
    helper = new DownloadedUpdateHelper(cacheDir);
    logger = { info: jest.fn(), warn: jest.fn() };
    readStream = jest.spyOn(fs, 'createReadStream');
  });

  afterEach(() => {
    readStream.mockRestore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function saveCacheInfo(fileName) {
    fs.writeFileSync(
      path.join(pending, 'update-info.json'),
      JSON.stringify({ fileName, sha512 })
    );
  }

  it('rejects a traversal to a matching file outside pending without reading or deleting it', async () => {
    const outsideFile = path.join(cacheDir, 'outside.exe');
    fs.writeFileSync(outsideFile, payload);
    saveCacheInfo(path.join('..', 'outside.exe'));

    await expect(
      helper.getValidCachedUpdateFile(fileInfo, logger)
    ).resolves.toBeNull();

    expect(readStream).not.toHaveBeenCalled();
    expect(fs.readdirSync(pending)).toEqual([]);
    expect(fs.readFileSync(outsideFile)).toEqual(payload);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['non-string', 42],
    ['nested path', path.join('nested', 'update.exe')],
  ])(
    'clears a cache with a %s filename without throwing',
    async (_label, fileName) => {
      saveCacheInfo(fileName);

      await expect(
        helper.getValidCachedUpdateFile(fileInfo, logger)
      ).resolves.toBeNull();

      expect(readStream).not.toHaveBeenCalled();
      expect(fs.readdirSync(pending)).toEqual([]);
    }
  );

  it('rejects an absolute path in cached metadata', async () => {
    saveCacheInfo(path.join(cacheDir, 'outside.exe'));

    await expect(
      helper.getValidCachedUpdateFile(fileInfo, logger)
    ).resolves.toBeNull();

    expect(readStream).not.toHaveBeenCalled();
    expect(fs.readdirSync(pending)).toEqual([]);
  });

  it('reuses a matching cached installer with a plain basename', async () => {
    const updateFile = path.join(pending, 'Specdown-Desktop-Setup.exe');
    fs.writeFileSync(updateFile, payload);
    saveCacheInfo(path.basename(updateFile));

    await expect(
      helper.getValidCachedUpdateFile(fileInfo, logger)
    ).resolves.toBe(updateFile);

    expect(readStream).toHaveBeenCalledWith(updateFile, expect.any(Object));
    expect(fs.readFileSync(updateFile)).toEqual(payload);
    expect(fs.existsSync(path.join(pending, 'update-info.json'))).toBe(true);
  });
});
