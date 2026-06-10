# Final Report

## 1. Project Architecture

See `docs/ARCHITECTURE.md`.

Summary:

- Nginx serves the Astro static build from `nginx/html`.
- Nginx reverse-proxies `/api/*` and `/socket.io/*` to the Node.js backend on port `3000`.
- Express handles IPTV, stream startup, proxying, admin, user, comments, and EPG APIs.
- JSON files in `backend/db` are the database layer.
- IPTV sources are loaded by `backend/services/m3uManager.js`.
- Streaming defaults to direct/proxy mode to stay light on a 2 vCPU / 1 GB VPS. FFmpeg HLS transcode mode remains available.
- HLS/M3U8 playback uses Video.js. MPD/ClearKey playback uses the JW Player embed pattern from KratosRepo/drm-player.

## 2. Technologies Found

- Frontend: Astro 6, React 19, Tailwind via `@tailwindcss/vite`, Video.js, JW Player embed loader, Socket.IO client.
- Backend: Node.js, Express, Socket.IO, Axios, JSON file database, `fast-xml-parser`, `systeminformation`, `pidusage`.
- Streaming: Nginx static/proxy/HLS serving, optional Linux FFmpeg/FFprobe, optional Nginx RTMP module for OBS ingest.
- Database: JSON files under `backend/db`.
- Cache/temp: HLS and event assets under `nginx/temp`.

## 3. Files Modified

- `backend/config.js`
- `backend/routes/admin.js`
- `backend/routes/iptv.js`
- `backend/routes/proxy.js`
- `backend/services/m3uManager.js`
- `ffmpeg-core/wrapper.js`
- `frontend-astro/src/components/AdminDashboard.jsx`
- `frontend-astro/src/components/Header.jsx`
- `frontend-astro/src/components/HeroBanner.jsx`
- `frontend-astro/src/components/HomeMovies.jsx`
- `frontend-astro/src/components/LivePlayerView.jsx`
- `frontend-astro/src/components/MovieDetailContainer.jsx`
- `frontend-astro/src/components/MovieModal.jsx`
- `frontend-astro/src/components/MoviesContainer.jsx`
- `frontend-astro/src/components/Sidebar.jsx`

## 4. Files Created

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOY-DEBIAN-13.md`
- `docs/FINAL-REPORT.md`
- `docs/WINDOWS-AUDIT.md`
- `frontend-astro/src/lib/nguoncApi.js`
- `nginx/nhanchilltv.conf`
- `nginx/nginx-rtmp.conf`
- `scripts/build-linux.sh`
- `scripts/start-linux.sh`
- `scripts/stop-linux.sh`
- `systemd/nhanchilltv.service`

## 5. Linux Migration Changes

- Replaced Windows `ffmpeg.exe` / `ffprobe.exe` assumptions with `FFMPEG_BIN` and `FFPROBE_BIN`, defaulting to Linux `ffmpeg` and `ffprobe`.
- Replaced Windows Nginx reload command with platform-aware `nginx -s reload`.
- Omitted Windows Nginx/PHP binaries from Linux runtime config.
- Added Debian-style Nginx config using `/opt/nhanchilltv` paths and `/var/log/nginx`.
- Added systemd unit with `www-data`, restart policy, writable data/temp paths, proxy socket tuning, and `MemoryMax=800M`.
- Added shell scripts for build/start/stop.
- Fixed IPTV route runtime import bug for `M3UParser`.
- Prevented admin auto-refresh from overwriting unsaved IPTV settings.
- Routed MPD/ClearKey playback to the KratosRepo/drm-player JW embed pattern.
- Replaced ArtPlayer HLS playback with Video.js for live TV and movie playback.
- Changed Nguonc movie detail playback to prefer `episodes[].items[].m3u8` through the internal proxy, falling back to iframe embed only when no manifest is available.
- Added defensive handling for `phim.nguonc.com` non-JSON/rate-limit responses.
- Added movie filters for danh mục, quốc gia, and năm phát hành endpoint families.

## 6. Build Result

Frontend production build:

- `npm.cmd ci`: passed, 0 vulnerabilities.
- `ASTRO_TELEMETRY_DISABLED=1 npm.cmd run build`: passed.
- Astro generated 6 pages: `/`, `/tv/`, `/movies/`, `/movie-detail/`, `/events/`, `/admin/`.
- Final build output copied to `nginx/html`.

Remaining build advisory:

- Vite reports large chunks, mainly from TV/player bundles. This is not a runtime build failure.

Backend install:

- `npm.cmd ci --omit=dev`: passed, 0 vulnerabilities.

## 7. Test Result

Passed:

- Backend syntax checks for `server.js`, migrated routes, proxy, and FFmpeg wrapper.
- Backend startup smoke test on port `3100`.
- Remote M3U startup refresh parsed 376 channels.
- EPG fetch parsed successfully.
- IPTV channel API returned 264 visible channels after hidden-group/channel settings; first visible channel was `VTV1`.
- API health endpoint returned success and FFmpeg availability.
- Static output exists for Home, Movies, Movie Detail, IPTV, Events, and Admin.
- `https://phim.nguonc.com/api/films/phim-moi-cap-nhat` returned JSON success with 10 items during testing.

Limited:

- Further `phim.nguonc.com` probes for search/category/country/year hit HTTP 429 rate limiting from the remote service during automated testing. The UI now handles that failure mode cleanly.
- Desktop/tablet/mobile visual QA could not be automated in this session because no browser automation tool is available.
- Debian-native `nginx -t` and systemd startup were not run because this workspace is Windows, not Debian 13.

## 8. Debian 13 Deploy

Use `docs/DEPLOY-DEBIAN-13.md`.

Short version:

```sh
apt update
apt install -y nginx ffmpeg nodejs npm
mkdir -p /opt/nhanchilltv
rsync -a --delete ./ /opt/nhanchilltv/
cd /opt/nhanchilltv
sh scripts/build-linux.sh
chown -R www-data:www-data /opt/nhanchilltv/backend/db /opt/nhanchilltv/nginx/temp
cp nginx/nhanchilltv.conf /etc/nginx/conf.d/nhanchilltv.conf
cp systemd/nhanchilltv.service /etc/systemd/system/nhanchilltv.service
systemctl daemon-reload
systemctl enable --now nhanchilltv
nginx -t
systemctl reload nginx
```

Before production, set:

- `ADMIN_PASSWORD`
- `JWT_SECRET`
- any required licensed IPTV/Movie source URLs.
