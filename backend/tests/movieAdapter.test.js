const test = require('node:test');
const assert = require('node:assert/strict');
const moviesRouter = require('../routes/movies');

const {
  normalizeListPayload,
  normalizeDetailPayload,
  normalizeImageUrl,
  resolveKkphimRequest,
} = moviesRouter._internal;

test('KKPhim search endpoint maps to phimapi v1 search with query intact', () => {
  const resolved = resolveKkphimRequest('/films/search', {
    keyword: 'one',
    page: '2',
    limit: '10',
    sort_lang: 'vietsub',
  });

  assert.equal(resolved.upstreamPath, '/v1/api/tim-kiem');
  assert.equal(resolved.kind, 'list');
  assert.deepEqual(resolved.query, {
    keyword: 'one',
    page: '2',
    limit: '10',
    sort_lang: 'vietsub',
  });
});

test('KKPhim list payload normalizes items and pagination for current frontend', () => {
  const payload = {
    status: true,
    items: [
      {
        name: 'Bí Ẩn',
        slug: 'bi-an',
        origin_name: 'Mystery',
        type: 'series',
        episode_current: 'Tập 1',
      },
    ],
    pagination: {
      totalItems: 24,
      totalItemsPerPage: 24,
      currentPage: 1,
      totalPages: 1,
    },
  };

  const normalized = normalizeListPayload(payload, 'kkphim');
  assert.equal(normalized.status, 'success');
  assert.equal(normalized.provider, 'kkphim');
  assert.equal(normalized.items[0].original_name, 'Mystery');
  assert.equal(normalized.items[0].current_episode, 'Tập 1');
  assert.equal(normalized.data.items.length, 1);
  assert.equal(normalized.paginate.total_page, 1);
});

test('KKPhim detail payload attaches episodes to movie and keeps m3u8 stream', () => {
  const payload = {
    status: true,
    movie: {
      name: 'Ngôi Trường Xác Sống',
      slug: 'ngoi-truong-xac-song',
      origin_name: 'All of Us Are Dead',
      tmdb: { id: 999, type: 'tv' },
    },
    episodes: [
      {
        server_name: '#Hà Nội',
        server_data: [
          { name: 'Tập 01', slug: 'tap-01', link_m3u8: 'https://example.com/index.m3u8' },
        ],
      },
    ],
  };

  const normalized = normalizeDetailPayload(payload, 'kkphim');
  assert.equal(normalized.status, 'success');
  assert.equal(normalized.movie.original_name, 'All of Us Are Dead');
  assert.equal(normalized.movie.episodes.length, 1);
  assert.equal(normalized.movie.episodes[0].server_data[0].link_m3u8, 'https://example.com/index.m3u8');
  assert.equal(normalized.data.item.slug, 'ngoi-truong-xac-song');
});

test('KKPhim image helper resolves relative images and preserves legacy OPhim images', () => {
  assert.equal(
    normalizeImageUrl('upload/vod/poster.jpg'),
    'https://phimimg.com/upload/vod/poster.jpg'
  );
  assert.equal(
    normalizeImageUrl('uploads/movies/legacy.jpg'),
    'https://img.ophim.live/uploads/movies/legacy.jpg'
  );
});
