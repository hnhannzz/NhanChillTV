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
    { userAgent: 'Dalvik/2.1.0' }
  );

  const init = (output.match(/initialization="([^"]+)"/) || [])[1];
  const media = (output.match(/media="([^"]+)"/) || [])[1];

  assert.match(decryptProxiedAttribute(init), /\/live\/dash\/198-\$RepresentationID\$\.dash$/);
  assert.match(decryptProxiedAttribute(media), /\/live\/dash\/198-\$RepresentationID\$-\$Time\$\.dash$/);
});

test('MPD rewrite keeps proxy query XML-safe and rewrites xlink hrefs', () => {
  const input = `<MPD xmlns:xlink="http://www.w3.org/1999/xlink">
    <Period xlink:href="periods/p1.xml?token=a&amp;b=2" />
    <Period>
      <BaseURL>dash/?token=a&amp;b=2</BaseURL>
      <AdaptationSet>
        <SegmentTemplate initialization="init.mp4?token=a&amp;b=2" media="chunk-$Number$.m4s?token=a&amp;b=2" />
      </AdaptationSet>
    </Period>
  </MPD>`;

  const output = proxyRouter._private.rewriteMpd(
    input,
    'https://cdn.example.com/live/manifest.mpd',
    '/api/proxy/',
    'https://cdn.example.com',
    { userAgent: 'OTT Navigator', referer: 'https://tv360.vn/' }
  );

  assert.doesNotMatch(output, /&(?!amp;|quot;|apos;|lt;|gt;)/);
  assert.match(output, /ua=OTT%20Navigator/);
  assert.match(output, /ref=https%3A%2F%2Ftv360\.vn%2F/);
  assert.match(output, /xlink:href="\/api\/proxy\//);
  assert.match(output, /initialization="\/api\/proxy\//);
  assert.match(output, /media="\/api\/proxy\//);
});
