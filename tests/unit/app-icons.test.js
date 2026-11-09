const {
  APP_ICONS,
  createAppIconController,
} = require('../../desktop/app-icons');

describe('native app icon switching', () => {
  let app, nativeImage, store, window, controller, onError, onChange;
  const make = (platform = 'darwin') =>
    createAppIconController({
      app,
      nativeImage,
      platform,
      getStore: () => store,
      getWindow: () => window,
      onError,
      onChange,
    });
  beforeEach(() => {
    app = { dock: { setIcon: jest.fn() } };
    nativeImage = { createFromPath: jest.fn(() => ({ isEmpty: () => false })) };
    store = { get: jest.fn(() => 'original'), set: jest.fn() };
    window = { setIcon: jest.fn(), isDestroyed: () => false };
    onError = jest.fn();
    onChange = jest.fn();
    controller = make();
  });
  it('offers every bundled choice and changes the real platform target before persisting', () => {
    for (const id of APP_ICONS) controller.apply(id);
    expect(app.dock.setIcon).toHaveBeenCalledTimes(8);
    expect(store.set).toHaveBeenLastCalledWith('appIcon', 'light');
    expect(
      controller.menu()[0].submenu.find((item) => item.label === 'Light')
        .checked
    ).toBe(true);
    expect(window.setIcon).not.toHaveBeenCalled();
  });
  it.each(['darwin', 'win32', 'linux'])(
    'persists Light across restart and resets to Original on %s',
    (platform) => {
      const settings = new Map();
      store = {
        get: (key, fallback) => settings.get(key) ?? fallback,
        set: (key, value) => settings.set(key, value),
      };
      controller = make(platform);
      const light = controller
        .menu()[0]
        .submenu.find((item) => item.label === 'Light');
      expect(light).toBeDefined();
      light.click();
      expect(settings.get('appIcon')).toBe('light');
      controller = make(platform);
      controller.restore();
      expect(controller.getSelected()).toBe('light');
      expect(
        controller.menu()[0].submenu.find((item) => item.label === 'Light')
          .checked
      ).toBe(true);
      controller
        .menu()[0]
        .submenu.find((item) => item.label === 'Original')
        .click();
      expect(settings.get('appIcon')).toBe('original');
      expect(controller.getSelected()).toBe('original');
      controller = make(platform);
      controller.restore();
      expect(controller.getSelected()).toBe('original');
    }
  );
  it('bundles PNG files for every selectable artwork', () => {
    const fs = require('fs');
    const path = require('path');
    expect(APP_ICONS).toEqual([
      'original',
      'flat',
      'glass',
      'ceramic',
      'metallic',
      'layered',
      'minimal',
      'light',
    ]);
    for (const id of APP_ICONS) {
      const bytes = fs.readFileSync(
        path.join(__dirname, '../../desktop/icons', `${id}.png`)
      );
      expect(bytes.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );
    }
  });
  it.each(APP_ICONS.filter((id) => id !== 'original'))(
    'restores saved %s on launch without rewriting settings',
    (saved) => {
      store.get.mockReturnValue(saved);
      controller.restore();
      expect(controller.getSelected()).toBe(saved);
      expect(store.set).not.toHaveBeenCalled();
      expect(app.dock.setIcon).toHaveBeenCalledTimes(1);
    }
  );
  it('leaves a fresh installation on its bundled primary icon', () => {
    controller.restore();
    expect(app.dock.setIcon).not.toHaveBeenCalled();
  });
  it('ignores unknown saved IDs and rejects arbitrary paths', () => {
    store.get.mockReturnValue('../../evil');
    controller.restore();
    expect(() => controller.apply('../../evil')).toThrow();
    expect(nativeImage.createFromPath).not.toHaveBeenCalled();
  });
  it('preserves the selected icon and settings if decoding fails', () => {
    controller.apply('flat');
    store.set.mockClear();
    nativeImage.createFromPath.mockReturnValue({ isEmpty: () => true });
    controller
      .menu()[0]
      .submenu.find((item) => item.label === 'Glass')
      .click();
    expect(onError).toHaveBeenCalled();
    expect(controller.getSelected()).toBe('flat');
    expect(store.set).not.toHaveBeenCalled();
  });
  it('preserves selection when the native API throws', () => {
    app.dock.setIcon.mockImplementation(() => {
      throw Error('OS error');
    });
    expect(() => controller.apply('glass')).toThrow('OS error');
    expect(store.set).not.toHaveBeenCalled();
    expect(controller.getSelected()).toBe('original');
  });
  it.each(['win32', 'linux'])(
    'changes running window icons on %s',
    (platform) => {
      make(platform).apply('ceramic');
      expect(window.setIcon).toHaveBeenCalled();
      expect(app.dock.setIcon).not.toHaveBeenCalled();
    }
  );
});
