const assert = require('node:assert/strict');
const test = require('node:test');
const proxyRouter = require('../routes/proxy');
const { decryptUrl } = require('../utils/cryptoHelper');

function decryptProxiedAttribute(value) {
  const clean = String(value || '').replace(/^\/api\/proxy\//, '').split('?')[0];
  const [encryptedBase, ...rest] = clean.split('/');
  return `${decryptUrl(encryptedBase)}${rest.length ? `/${rest.join('/')}` : ''}`;
}

test('MPD SegmentTemplate relative paths are resolved from BaseURL', () => {
  const input = `<MPD>
    <Period>
      <BaseURL>dash/</BaseURL>
      <AdaptationSet>
        <Representation id="video_1080" />
        <SegmentTemplate initialization="198-$RepresentationID$.dash" media="198-$RepresentationID$-$Time$.dash" />
      </AdaptationSet>
    </Period>
  </MPD>`;

  const output = proxyRouter._private.rewriteMpd(
    input,
    'https://cdn.example.com/live/manifest.mpd',
    '/api/proxy/',
    'https://cdn.example.com',
    'Dalvik/2.1.0'
  );

  const init = (output.match(/initialization="([^"]+)"/) || [])[1];
  const media = (output.match(/media="([^"]+)"/) || [])[1];

  assert.match(decryptProxiedAttribute(init), /\/live\/dash\/198-\$RepresentationID\$\.dash$/);
  assert.match(decryptProxiedAttribute(media), /\/live\/dash\/198-\$RepresentationID\$-\$Time\$\.dash$/);
});
