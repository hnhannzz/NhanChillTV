#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
export ASTRO_TELEMETRY_DISABLED="${ASTRO_TELEMETRY_DISABLED:-1}"
if [ -z "${NODE_OPTIONS:-}" ]; then
  export NODE_OPTIONS="--max-old-space-size=768"
fi

cd "$ROOT_DIR/backend"
npm ci --omit=dev

cd "$ROOT_DIR/frontend-astro"
npm ci
npm run build

rm -rf "$ROOT_DIR/nginx/html"
mkdir -p "$ROOT_DIR/nginx/html"
cp -R "$ROOT_DIR/frontend-astro/dist/." "$ROOT_DIR/nginx/html/"
mkdir -p "$ROOT_DIR/nginx/temp/hls_temp" "$ROOT_DIR/nginx/temp/event_temp" "$ROOT_DIR/nginx/temp/dash_temp"

echo "Linux build complete: $ROOT_DIR/nginx/html"
