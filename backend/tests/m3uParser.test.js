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

test('M3U ClearKey parser accepts Kodi/TiviMate style metadata', () => {
  const channels = M3UParser.parseString(`#EXTM3U
#EXTINF:-1 tvg-id="drm-demo" group-title="Sự Kiện TV360",DRM Demo
#KODIPROP:inputstream.adaptive.license_type=org.w3.clearkey
#KODIPROP:inputstream.adaptive.stream_headers=User-Agent=OTT Navigator&Referer=https%3A%2F%2Ftv360.vn%2F&Origin=https%3A%2F%2Ftv360.vn
#KODIPROP:inputstream.adaptive.license_key=0123456789abcdef0123456789abcdef:fedcba9876543210fedcba9876543210|00112233445566778899aabbccddeeff:ffeeddccbbaa99887766554433221100
https://example.com/live.mpd|User-Agent=TiviMate/5.0
`);

  assert.equal(channels.length, 1);
  assert.equal(channels[0].licenseType, 'org.w3.clearkey');
  assert.equal(channels[0].userAgent, 'TiviMate/5.0');
  assert.equal(channels[0].referer, 'https://tv360.vn/');
  assert.equal(channels[0].origin, 'https://tv360.vn');
  assert.deepEqual(channels[0].clearKey, {
    '0123456789abcdef0123456789abcdef': 'fedcba9876543210fedcba9876543210',
    '00112233445566778899aabbccddeeff': 'ffeeddccbbaa99887766554433221100',
  });
});
