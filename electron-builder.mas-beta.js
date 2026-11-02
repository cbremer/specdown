// TestFlight-only Store beta: .beta identity, separate app and data container.
module.exports = require('./scripts/mas-test-channel-config').makeTestChannel(
  'beta'
);
