# NhanChillTV Linux Build - Deployment Guide

## Recommended VPS OS

| OS | RAM idle | Notes |
|---|---|---|
| **Debian 12/13 minimal** | ~80 MB | Lightest, best for 1 GB VPS |
| Ubuntu 24.04 LTS minimal | ~120 MB | Good alternative, wider docs |

Your VPS: **2 vCPU / 1 GB RAM** → pick **Debian 12 minimal x86_64**.

**Why Debian 12**: uses ~40 MB less RAM than Ubuntu at idle, which matters more for your 1 GB VPS than for larger servers.

## Architecture

```
nginx :80  ──reverse-proxy──>  Node/Express :3000
  ├── static files (/opt/nhanchilltv/app/public)
  ├── HLS stream delivery (/opt/nhanchilltv/app/temp/hls_temp)
  └── RTMP ingest (port 1935, optional)
```

## VPS Preparation

### 1. Install Debian 12 minimal

Boot your VPS with **Debian 12 (Bookworm) minimal**. No desktop, no extra packages.

### 2. SSH in and add swap (critical for 1 GB RAM)

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# Verify
free -h
```

### 3. Open firewall ports

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 1935/tcp   # only if you need OBS/RTMP ingest
sudo ufw enable
```

## Deploy

### One-command install

```bash
# From your local machine:
scp -r NhanChillLinuxBuild root@YOUR_SERVER_IP:/root/

# On the server:
ssh root@YOUR_SERVER_IP
cd /root/NhanChillLinuxBuild
sudo bash scripts/install.sh
```

The installer will:
1. Install nginx, ffmpeg, Node.js 22, dependencies
2. Create `nhanchill` system user
3. Copy files to `/opt/nhanchilltv/`
4. Generate a random admin password and JWT secret
5. Install npm packages
6. Configure nginx site + RTMP module
7. Set up systemd service + enable at boot

### Custom domain

```bash
sudo SERVER_NAME=tv.example.com bash scripts/install.sh
```

## Post-deploy

### Check services

```bash
sudo systemctl status nhanchilltv
sudo systemctl status nginx
curl http://127.0.0.1/api/health
```

### Get admin password

```bash
sudo cat /etc/nhanchilltv/nhanchilltv.env | grep ADMIN_PASSWORD
```

### Open in browser

```
http://YOUR_SERVER_IP/
http://YOUR_SERVER_IP/tv/
http://YOUR_SERVER_IP/admin/
```

## Features

### IPTV Channels
- Default: DIRECT_MODE=true (proxy mode, no ffmpeg transcoding)
- Player auto-detects HLS (.m3u8) and DASH (.mpd)
- Add M3U sources from Admin → IPTV Sources (URL or file)
- Supports Clear Key DRM

### Events / Live Sports
- Create events from Admin → Quản lý sự kiện
- Source types: IPTV channel, OBS/RTMP, or custom URL
- OBS push: `rtmp://YOUR_SERVER_IP/live` with stream key

### Movies (beta)
- Browse and search movies from integrated sources
- User comments and favorites

## Resource Management (1 GB RAM)

Key env vars in `/etc/nhanchilltv/nhanchilltv.env`:

| Variable | Default | Tweak for low RAM |
|---|---|---|
| `DIRECT_MODE=true` | Proxy mode (no ffmpeg) | Keep `true` |
| `NODE_OPTIONS=--max-old-space-size=256` | Node heap cap | Lower to 192 if needed |
| `METRICS_INTERVAL_MS=5000` | Dashboard refresh | Increase to 10000 |
| `STREAM_TIMEOUT_MS=120000` | Stream idle timeout | Lower to 60000 |

If you must use ffmpeg transcoding (`DIRECT_MODE=false`):
- Maximum **1 concurrent stream** on this VPS
- Use `preset=ultrafast` and `tune=zerolatency` (already default)

## Maintenance

### View logs

```bash
sudo journalctl -u nhanchilltv -f
sudo tail -f /var/log/nginx/nhanchilltv.access.log
```

### Restart services

```bash
sudo systemctl restart nhanchilltv
sudo nginx -t && sudo systemctl reload nginx
```

### Backup

```bash
sudo bash /root/NhanChillLinuxBuild/scripts/backup-data.sh
```

Backups saved to `/opt/nhanchilltv/backups/`.

### Health check

```bash
sudo bash /root/NhanChillLinuxBuild/scripts/healthcheck.sh
```

## Troubleshooting

| Symptom | Check |
|---|---|
| 403 on stream | JWT_SECRET mismatch between backend and nginx config |
| 502 Bad Gateway | Node backend not running (`systemctl status nhanchilltv`) |
| No channels | Add M3U source in Admin page |
| nginx RTMP 404 | `libnginx-mod-rtmp` not installed (`apt install libnginx-mod-rtmp`) |
| High memory | Set `DIRECT_MODE=true` and reduce `NODE_OPTIONS` heap |

## Security Notes

- Change admin password after first login
- The real environment file is at `/etc/nhanchilltv/nhanchilltv.env` — not in git
- Keep `NODE_ENV=production` to disable debug info
- GitHub repo intentionally ignores `*.json`, `*.m3u`, and `temp/` files
