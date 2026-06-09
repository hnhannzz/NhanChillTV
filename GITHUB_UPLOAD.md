# Upload to GitHub

This folder is ready to be used as a standalone GitHub repository.

## From this folder

```bash
cd NhanChillLinuxBuild
git init
git add .
git commit -m "Initial Linux server build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## What is intentionally ignored

The repo ignores runtime data and secrets:

- `app/backend/db/*.json`
- `app/m3u_iptv/*.m3u`
- `app/temp/**`
- `.env`, `.env.*`

Only `.example` files are meant to be committed for those paths.

## Before making the repo public

Check that you are not committing:

- real IPTV playlist URLs that you do not have permission to redistribute
- generated admin passwords
- real user data
- logs or HLS temporary files
