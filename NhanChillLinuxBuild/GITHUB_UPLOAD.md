# Upload to GitHub

This folder is a standalone GitHub repository.

## Steps

```bash
cd NhanChillLinuxBuild
git init
git add .
git commit -m "Initial Linux server build - NhanChillTV v1.4"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Ignored at runtime

The `.gitignore` keeps secrets and user data out of git:

- `app/backend/db/*.json` — database files (passwords, user data)
- `app/m3u_iptv/*.m3u` — real IPTV playlists
- `app/temp/**` — HLS segments, event thumbnails
- `.env` / `.env.*` — environment secrets
- `*.exe`, `*.dll`, `*.bat` — Windows binaries

Only `.example` files (e.g. `data.example.json`) are tracked.

## Before making public

- Check you're not committing real IPTV URLs, passwords, or user data
- The example env file at `config/nhanchilltv.env.example` has placeholder values only
- Generated passwords live in `/etc/nhanchilltv/nhanchilltv.env` on the server
