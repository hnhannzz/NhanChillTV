#!/usr/bin/env sh
set -eu

if command -v systemctl >/dev/null 2>&1; then
  systemctl stop nhanchilltv.service
else
  pkill -f "backend/server.js" || true
fi
