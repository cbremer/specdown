const { nativeAboutArguments } = require('../../desktop/native-about');

const app = {
  getPath: () => '/synthetic/SpecDown.app/Contents/MacOS/SpecDown',
};
const options = { mas: true, platform: 'darwin' };
const bundle = (
  CFBundleIdentifier,
  SpecDownChannel,
  CFBundleVersion = '235'
) => ({
  CFBundleIdentifier,
  SpecDownChannel,
  CFBundleVersion,
});

test.each([
  [bundle('com.mosaicpando.specdown.dev', 'development'), 'development'],
  [bundle('com.mosaicpando.specdown.beta', 'beta'), 'beta'],
  [bundle('com.mosaicpando.specdown', 'production'), 'production'],
  [bundle('com.mosaicpando.specdown', 'beta'), 'production'],
  [bundle('com.mosaicpando.specdown', 'development'), 'production'],
  [bundle('com.mosaicpando.specdown.dev', 'beta'), 'production'],
  [bundle('com.mosaicpando.specdown.dev', undefined), 'production'],
])(
  'native About metadata respects the signed bundle identity (%p)',
  (info, channel) => {
    expect(
      nativeAboutArguments(app, { ...options, readInfo: () => info })
    ).toEqual([
      '--specdown-app-build=235',
      `--specdown-app-channel=${channel}`,
    ]);
  }
);

test.each(['235\n', '235 --other=value', '', 235])(
  'a malformed native build %p is omitted',
  (build) => {
    expect(
      nativeAboutArguments(app, {
        ...options,
        readInfo: () => bundle('com.mosaicpando.specdown', 'production', build),
      })
    ).toEqual(['--specdown-app-channel=production']);
  }
);

test('an unrelated runtime bundle cannot claim a Dev or Beta identity', () => {
  expect(
    nativeAboutArguments(app, {
      ...options,
      readInfo: () => bundle('com.example.unrelated', 'development'),
    })
  ).toEqual([]);
});

test('missing bundle metadata retains the existing About fallback', () => {
  expect(
    nativeAboutArguments(app, {
      ...options,
      readInfo: () => {
        throw new Error('unavailable');
      },
    })
  ).toEqual([]);
});

test.each([
  { mas: false, platform: 'darwin' },
  { mas: true, platform: 'win32' },
])('other distributions do not get Store build metadata (%p)', (runtime) =>
  expect(
    nativeAboutArguments(app, {
      ...runtime,
      readInfo: () => bundle('com.mosaicpando.specdown.dev', 'development'),
    })
  ).toEqual([])
);
