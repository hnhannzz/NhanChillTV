# NhanChillTV Linux Build

This is a clean Linux-native rebuild from `old_source code build`.

Main entry points:

- Frontend source: `frontend-astro`
- Backend source: `backend`
- Linux Nginx config: `nginx/nhanchilltv.conf`
- Systemd unit: `systemd/nhanchilltv.service`
- Build script: `scripts/build-linux.sh`
- Debian deploy guide: `docs/DEPLOY-DEBIAN-13.md`

Local build:

```sh
sh scripts/build-linux.sh
```

Run backend directly:

```sh
sh scripts/start-linux.sh
```

Use only streams and movie sources that the deployment has legal rights to access. This build does not implement DRM bypass or unauthorized key retrieval.
