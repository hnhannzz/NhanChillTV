# Movie API Provider

NhanChillTV proxies movie metadata through `/api/movies` so the frontend does not depend directly on an upstream provider.

## Current Provider

Default provider: `kkphim`

Upstream:

- `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3`
- `https://phimapi.com/v1/api/tim-kiem`
- `https://phimapi.com/v1/api/danh-sach/{type}`
- `https://phimapi.com/v1/api/the-loai/{slug}`
- `https://phimapi.com/v1/api/quoc-gia/{slug}`
- `https://phimapi.com/v1/api/nam/{year}`
- `https://phimapi.com/phim/{slug}`
- `https://phimapi.com/tmdb/{type}/{id}`

## Environment

```env
MOVIE_PROVIDER=kkphim
MOVIE_API_BASE=https://phimapi.com
KKPHIM_IMAGE_BASE=https://phimimg.com
MOVIE_API_TIMEOUT_MS=12000
MOVIE_API_CACHE_TTL_MS=300000
MOVIE_API_MAX_CACHE_ENTRIES=200
```

Optional emergency fallback:

```env
MOVIE_API_FALLBACK_PROVIDER=ophim
OPHIM_API_BASE=https://ophim1.com/v1/api
```

## Notes

- Frontend helpers still export old `OPhim` aliases for compatibility, but the active backend source is KKPhim by default.
- Movie images go through `/api/movies/image?url=...`, which redirects to KKPhim's WebP image converter.
- Favorites and continue-watching entries now store `provider`, `tmdbId`, and `tmdbType` when available.
