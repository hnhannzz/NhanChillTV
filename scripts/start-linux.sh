#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
export FFPROBE_BIN="${FFPROBE_BIN:-ffprobe}"

cd "$ROOT_DIR/backend"
exec node server.js
