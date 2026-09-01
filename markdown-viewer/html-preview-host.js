(function htmlHostBoot() {
  'use strict';
  function htmlHostOnMessage(event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'specdown-load') return;
    if (typeof data.html !== 'string') return;
    document.open();
    document.write(data.html);
    document.close();
  }
  window.addEventListener('message', htmlHostOnMessage);
})();
