#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash scripts/install-debian13.sh"
  exit 1
fi

BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/nhanchilltv/app"
BACKUP_DIR="/opt/nhanchilltv/backups/$(date +%Y%m%d-%H%M%S)"
ENV_DIR="/etc/nhanchilltv"
ENV_FILE="${ENV_DIR}/nhanchilltv.env"
SERVER_NAME="${SERVER_NAME:-_}"
NGINX_PORT="${NGINX_PORT:-80}"

echo "[1/8] Installing Debian packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl openssl nginx ffmpeg nodejs npm logrotate libnginx-mod-rtmp

echo "[2/8] Creating service user and directories..."
id -u nhanchill >/dev/null 2>&1 || useradd --system --home /opt/nhanchilltv --shell /usr/sbin/nologin nhanchill
install -d -m 0755 /opt/nhanchilltv
install -d -m 0755 "${APP_DIR}"
install -d -m 0755 "${ENV_DIR}"

if [[ -d "${APP_DIR}/backend/db" || -d "${APP_DIR}/temp/event_temp" ]]; then
  echo "[3/8] Backing up mutable data to ${BACKUP_DIR}..."
  install -d -m 0750 "${BACKUP_DIR}"
  [[ -d "${APP_DIR}/backend/db" ]] && cp -a "${APP_DIR}/backend/db" "${BACKUP_DIR}/db"
  [[ -d "${APP_DIR}/temp/event_temp" ]] && cp -a "${APP_DIR}/temp/event_temp" "${BACKUP_DIR}/event_temp"
else
  echo "[3/8] No previous mutable data found."
fi

echo "[4/8] Copying application files..."
cp -a "${BUILD_DIR}/app/." "${APP_DIR}/"
install -d -m 0755 "${APP_DIR}/temp/hls_temp" "${APP_DIR}/temp/event_temp"

if [[ -d "${BACKUP_DIR}/db" ]]; then
  cp -a "${BACKUP_DIR}/db/." "${APP_DIR}/backend/db/"
fi
if [[ -d "${BACKUP_DIR}/event_temp" ]]; then
  cp -a "${BACKUP_DIR}/event_temp/." "${APP_DIR}/temp/event_temp/"
fi

echo "[5/8] Writing environment file..."
if [[ ! -f "${ENV_FILE}" ]]; then
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '=+/')"
  JWT_SECRET="$(openssl rand -hex 32)"
  sed \
    -e "s#ADMIN_PASSWORD=.*#ADMIN_PASSWORD=${ADMIN_PASSWORD}#" \
    -e "s#JWT_SECRET=.*#JWT_SECRET=${JWT_SECRET}#" \
    "${BUILD_DIR}/config/nhanchilltv.env.example" > "${ENV_FILE}"
  chmod 0640 "${ENV_FILE}"
  echo "Generated admin password: ${ADMIN_PASSWORD}"
else
  echo "Keeping existing ${ENV_FILE}"
fi

set -a
source "${ENV_FILE}"
set +a

echo "[6/8] Installing Node dependencies..."
cd "${APP_DIR}/backend"
npm ci --omit=dev --no-audit --no-fund

echo "[7/8] Configuring nginx and systemd..."
sed \
  -e "s#__APP_DIR__#${APP_DIR}#g" \
  -e "s#__API_PORT__#${PORT:-3000}#g" \
  -e "s#__NGINX_PORT__#${NGINX_PORT}#g" \
  -e "s#__SERVER_NAME__#${SERVER_NAME}#g" \
  -e "s#__JWT_SECRET__#${JWT_SECRET}#g" \
  "${BUILD_DIR}/config/nginx/nhanchilltv.conf.template" > /etc/nginx/sites-available/nhanchilltv.conf

ln -sfn /etc/nginx/sites-available/nhanchilltv.conf /etc/nginx/sites-enabled/nhanchilltv.conf
rm -f /etc/nginx/sites-enabled/default

sed -e "s#__APP_DIR__#${APP_DIR}#g" \
  "${BUILD_DIR}/config/nginx/nhanchilltv-rtmp.conf.template" > /etc/nginx/nhanchilltv-rtmp.conf

if ! grep -q "nhanchilltv-rtmp.conf" /etc/nginx/nginx.conf; then
  sed -i '/include \/etc\/nginx\/modules-enabled\/\*.conf;/a include /etc/nginx/nhanchilltv-rtmp.conf;' /etc/nginx/nginx.conf
fi

cp "${BUILD_DIR}/config/systemd/nhanchilltv.service" /etc/systemd/system/nhanchilltv.service
cp "${BUILD_DIR}/config/logrotate/nhanchilltv" /etc/logrotate.d/nhanchilltv

chown -R nhanchill:nhanchill /opt/nhanchilltv
chmod 0755 "${APP_DIR}"
chmod -R u+rwX,g+rX,o-rwx "${APP_DIR}/backend/db" "${APP_DIR}/temp"

nginx -t
systemctl daemon-reload
systemctl enable nhanchilltv
systemctl restart nhanchilltv
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

echo "[8/8] Done."
echo "Open: http://YOUR_SERVER_IP/"
echo "Health: curl http://127.0.0.1/api/health"
echo "Admin password is stored in ${ENV_FILE}"
