# NhanChillTV Linux Build

## Linux target

Recommended VPS OS: **Debian 13 trixie minimal x86_64**.

Reason: Debian 13 is the current stable Debian release, it is lighter than Ubuntu Server for a 2 vCPU / 1 GB RAM VPS, and it has nginx, ffmpeg, Node.js/npm, systemd, and nginx RTMP packages available through apt.

This build runs:

- nginx on port `80`
- Node/Express backend on `127.0.0.1:3000`
- optional RTMP ingest on port `1935`
- static Astro frontend from `/opt/nhanchilltv/app/public`
- HLS temp files in `/opt/nhanchilltv/app/temp/hls_temp`

## VPS preparation

Install Debian 13 minimal, then SSH as root or a sudo user.

Add swap on a 1 GB RAM VPS:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Open firewall ports if you use a firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 1935/tcp
sudo ufw enable
```

Port `1935` is only needed for RTMP/OBS live ingest.

## Upload and install

Upload the whole `NhanChillLinuxBuild` folder to the VPS, for example:

```bash
scp -r NhanChillLinuxBuild root@YOUR_SERVER_IP:/root/
```

Then install:

```bash
ssh root@YOUR_SERVER_IP
cd /root/NhanChillLinuxBuild
sudo bash scripts/install-debian13.sh
```

If you deploy with a domain:

```bash
sudo SERVER_NAME=tv.example.com bash scripts/install-debian13.sh
```

The installer generates an admin password and stores it in:

```bash
sudo cat /etc/nhanchilltv/nhanchilltv.env
```

Do not use the placeholder values from `config/nhanchilltv.env.example` in production.

## Check service

```bash
sudo bash /root/NhanChillLinuxBuild/scripts/healthcheck.sh
sudo journalctl -u nhanchilltv -f
```

Open:

```text
http://YOUR_SERVER_IP/
http://YOUR_SERVER_IP/tv/
http://YOUR_SERVER_IP/admin/
```

## Resource settings for 2 vCPU / 1 GB RAM

Default build uses `DIRECT_MODE=true`, so normal IPTV playback goes through the proxy and avoids ffmpeg transcoding. This is the right default for a 1 GB VPS.

A clean GitHub clone starts without real IPTV sources. Add your own legally accessible M3U source in the admin page after deploying.

If you turn `DIRECT_MODE=false`, limit usage to about one active ffmpeg stream on this VPS size.

Runtime settings:

```bash
sudo nano /etc/nhanchilltv/nhanchilltv.env
sudo systemctl restart nhanchilltv
sudo nginx -t && sudo systemctl reload nginx
```

Important variables:

- `ADMIN_PASSWORD`: admin login password
- `JWT_SECRET`: stream token secret; installer also writes this into nginx config
- `DIRECT_MODE=true`: keep this for low RAM
- `NODE_OPTIONS=--max-old-space-size=256`: keeps Node memory bounded
- `METRICS_INTERVAL_MS=5000`: reduces dashboard polling overhead

If you change `JWT_SECRET` after install, rerun:

```bash
cd /root/NhanChillLinuxBuild
sudo bash scripts/install-debian13.sh
```

## OBS / RTMP ingest

RTMP is enabled by the installer through `libnginx-mod-rtmp`.

OBS server:

```text
rtmp://YOUR_SERVER_IP/live
```

OBS stream key should match the event stream key in admin. Output HLS will be:

```text
/hls/STREAM_KEY/index.m3u8
```

## Backup

```bash
sudo bash /root/NhanChillLinuxBuild/scripts/backup-data.sh
```

The installer also backs up existing database and event thumbnails before every redeploy under:

```text
/opt/nhanchilltv/backups/
```
