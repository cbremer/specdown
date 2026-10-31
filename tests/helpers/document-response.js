const { TextEncoder, TextDecoder } = require('node:util');

/** A one-chunk fetch body: exercise streaming reads rather than an unbounded text() stub. */
function documentResponseBody(text) {
  global.TextDecoder = TextDecoder;
  return {
    getReader() {
      let finished = false;
      return {
        async read() {
          if (finished) return { done: true };
          finished = true;
          return { done: false, value: new TextEncoder().encode(text) };
        },
        async cancel() {
          finished = true;
        },
        releaseLock() {},
      };
    },
  };
}

module.exports = { documentResponseBody };
