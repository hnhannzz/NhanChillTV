#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/opt/nhanchilltv/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_ROOT}/manual-${STAMP}.tar.gz"

mkdir -p "${BACKUP_ROOT}"
tar -czf "${OUT}" \
  -C /opt/nhanchilltv/app backend/db temp/event_temp m3u_iptv

echo "${OUT}"
