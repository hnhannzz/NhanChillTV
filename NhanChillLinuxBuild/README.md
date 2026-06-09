# NhanChillTV Linux Server Build

NhanChillTV — IPTV streaming platform for small VPS servers.

**Target**: Debian 12/13, Ubuntu 24.04 — 2 vCPU / 1 GB RAM

## Quick deploy

```bash
# Upload to server
scp -r NhanChillLinuxBuild root@YOUR_SERVER_IP:/root/

# SSH and install
ssh root@YOUR_SERVER_IP
cd /root/NhanChillLinuxBuild
sudo bash scripts/install.sh
```

## Access

| Page | URL |
|---|---|
| Home | `http://YOUR_SERVER_IP/` |
| TV | `http://YOUR_SERVER_IP/tv/` |
| Admin | `http://YOUR_SERVER_IP/admin/` |

## Stack

| Component | Role |
|---|---|
| nginx :80 | Reverse proxy, HLS delivery, RTMP ingest |
| Node/Express :3000 | API, proxy, stream management |
| FFmpeg | Transcoding (optional, default off) |
| SQLite-less (JSON files) | Data persistence |

## Resource profile

- Idle RAM: ~150 MB (Debian 12)
- With 1 viewer (direct mode): ~180 MB
- With ffmpeg transcode: ~350 MB + stream overhead
- Swap: 1 GB recommended

Full deployment guide: [README_DEPLOY.md](README_DEPLOY.md).
