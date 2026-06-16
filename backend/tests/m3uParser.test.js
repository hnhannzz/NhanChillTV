const assert = require('node:assert/strict');
const test = require('node:test');
const M3UParser = require('../controllers/m3u-parser');

test('M3U ClearKey kid:key pairs stay in Shaka hex format', () => {
  const channels = M3UParser.parseString(`#EXTM3U
#EXTINF:-1 tvg-id="demo" group-title="Test",Demo
#KODIPROP:inputstream.adaptive.license_key=0123456789abcdef0123456789abcdef:fedcba9876543210fedcba9876543210
https://example.com/live.mpd
`);

  assert.equal(channels.length, 1);
  assert.deepEqual(channels[0].clearKey, {
    '0123456789abcdef0123456789abcdef': 'fedcba9876543210fedcba9876543210',
  });
});

test('M3U JSON ClearKey values are converted from base64url to hex', () => {
  const channels = M3UParser.parseString(`#EXTM3U
#EXTINF:-1 tvg-id="demo-json" group-title="Test",Demo JSON
#KODIPROP:inputstream.adaptive.license_key={"keys":[{"kid":"ASNFZ4mrze8BI0VniavN7w","k":"_ty6mHZUMhD-3LqYdlQyEA"}]}
https://example.com/live.mpd
`);

  assert.equal(channels.length, 1);
  assert.deepEqual(channels[0].clearKey, {
    '0123456789abcdef0123456789abcdef': 'fedcba9876543210fedcba9876543210',
  });
});
