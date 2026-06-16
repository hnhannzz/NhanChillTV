const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyFromUrl, classifyPlaybackResponse } = require('../services/streamTypeDetector');

test('dynamic ClearKey URL can be detected as HLS when response is an M3U8 playlist', () => {
  const fallback = classifyFromUrl('https://example.com/tv360.php?id=1', true);
  const detected = classifyPlaybackResponse({
    url: 'https://example.com/tv360.php?id=1',
    finalUrl: 'https://cdn.example.com/live/index.m3u8?token=abc',
    contentType: 'application/vnd.apple.mpegurl',
    body: '#EXTM3U\n#EXT-X-VERSION:3\nsegment.ts',
  });

  assert.equal(fallback.kind, 'mpd');
  assert.equal(detected.kind, 'hls');
  assert.equal(detected.isMpd, false);
  assert.equal(detected.isHls, true);
});

test('dynamic URL can be detected as DASH MPD by manifest body', () => {
  const detected = classifyPlaybackResponse({
    url: 'https://example.com/tv360.php?id=2',
    finalUrl: 'https://cdn.example.com/live/manifest',
    contentType: 'application/xml',
    body: '<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011"></MPD>',
  });

  assert.equal(detected.kind, 'mpd');
  assert.equal(detected.isMpd, true);
  assert.equal(detected.isHls, false);
});

test('manifest body wins over misleading file extension', () => {
  const detected = classifyPlaybackResponse({
    url: 'https://example.com/live.m3u8',
    finalUrl: 'https://cdn.example.com/live.m3u8',
    contentType: 'application/octet-stream',
    body: '<MPD><Period /></MPD>',
  });

  assert.equal(detected.kind, 'mpd');
});
