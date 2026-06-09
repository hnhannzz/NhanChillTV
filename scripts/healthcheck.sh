#!/usr/bin/env bash
set -euo pipefail

echo "== systemd =="
systemctl --no-pager --full status nhanchilltv | sed -n '1,12p'

echo
echo "== backend health =="
curl -fsS http://127.0.0.1:3000/api/health

echo
echo
echo "== nginx local =="
curl -I -fsS http://127.0.0.1/ | sed -n '1,8p'

echo
echo "== ports =="
ss -lntp | grep -E ':(80|3000|1935)\b' || true
