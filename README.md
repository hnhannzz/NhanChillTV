# NhanChillTV Linux Server Build

NhanChillTV Linux deployment package for small VPS servers.

Target server:

- Debian 13 trixie minimal x86_64
- 2 vCPU / 1 GB RAM
- nginx on port 80
- Node.js backend on 127.0.0.1:3000
- optional RTMP ingest on port 1935

## Quick deploy

```bash
scp -r NhanChillLinuxBuild root@YOUR_SERVER_IP:/root/
ssh root@YOUR_SERVER_IP
cd /root/NhanChillLinuxBuild
sudo bash scripts/install-debian13.sh
```

Open:

```text
http://YOUR_SERVER_IP/
http://YOUR_SERVER_IP/tv/
http://YOUR_SERVER_IP/admin/
```

Full deployment guide: [README_DEPLOY.md](README_DEPLOY.md).

## Repository layout

```text
app/backend/          Node/Express API
app/ffmpeg-core/      Linux-compatible ffmpeg wrapper
app/public/           Prebuilt Astro frontend
app/m3u_iptv/         Local playlist examples
config/nginx/         nginx templates
config/systemd/       systemd service
scripts/              install, healthcheck, backup scripts
```

## GitHub safety notes

Runtime files are ignored by `.gitignore`:

- `app/backend/db/*.json`
- `app/m3u_iptv/*.m3u`
- `app/temp/**`
- `.env` and generated env files

Use the `.example` files as templates. Add real IPTV sources from the admin UI or in `/etc/nhanchilltv/nhanchilltv.env` after deploying.

Only use playlist/content sources that you are allowed to access and redistribute.
