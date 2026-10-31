const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('the service worker ignores documents, sibling sites and query-bearing requests', () => {
  const events = {};
  const source = fs.readFileSync(
    path.join(__dirname, '../../markdown-viewer/public/sw.js'),
    'utf8'
  );
  const context = {
    URL,
    self: {
      location: new URL('https://example.com/specdown/sw.js'),
      addEventListener: (name, fn) => {
        events[name] = fn;
      },
    },
  };
  vm.runInNewContext(source, context);
  for (const url of [
    'https://example.com/private.md',
    'https://example.com/specdown/private.md',
    'https://example.com/specdown/?token=secret',
    'https://other.com/specdown/assets/index-abc.js',
  ]) {
    const respondWith = jest.fn();
    events.fetch({
      request: { url, method: 'GET', mode: 'cors' },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  }
});
