# Windows Dependency Audit

Removed or replaced in the Linux build:

- `start.bat`, `stop.bat`, `nginx/*.bat`: replaced by `scripts/*.sh` and `systemd/nhanchilltv.service`.
- `nginx/nginx.exe`: replaced by Debian Nginx package.
- `nginx/PHP/php-cgi.exe` and `nginx/PHP/ext/*.dll`: not used by the app and omitted from Linux configs.
- `backend/config.js` `ffmpeg.exe` path: replaced by `FFMPEG_BIN` / `FFPROBE_BIN`, defaulting to Linux `ffmpeg` and `ffprobe`.
- `ffmpeg-core/wrapper.js` `ffprobe.exe` derivation: replaced by explicit `config.ffprobeBin`.
- `backend/routes/admin.js` `nginx.exe -s reload`: replaced by platform-aware `nginx -s reload`.
- Windows Nginx relative paths (`temp/...`, `html`, `logs/...`): replaced by `/opt/nhanchilltv/...` and `/var/log/nginx/...` in `nginx/nhanchilltv.conf`.

Kept intentionally:

- Browser user-agent strings containing `Windows NT`; these are source compatibility headers for upstream streams, not OS dependencies.
- The old Windows source remains untouched under `old_source code build` for traceability.
