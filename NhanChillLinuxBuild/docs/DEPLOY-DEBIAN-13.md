# Deploy Debian 13

Install runtime packages:

```sh
apt update
apt install -y nginx ffmpeg nodejs npm
```

For OBS/RTMP ingest, install an Nginx build with the RTMP module:

```sh
apt install -y libnginx-mod-rtmp
```

Deploy the app:

```sh
mkdir -p /opt/nhanchilltv
rsync -a --delete ./ /opt/nhanchilltv/
cd /opt/nhanchilltv
sh scripts/build-linux.sh
chown -R www-data:www-data /opt/nhanchilltv/backend/db /opt/nhanchilltv/nginx/temp
cp nginx/nhanchilltv.conf /etc/nginx/conf.d/nhanchilltv.conf
cp systemd/nhanchilltv.service /etc/systemd/system/nhanchilltv.service
systemctl daemon-reload
systemctl enable --now nhanchilltv
nginx -t
systemctl reload nginx
```

If RTMP ingest is required, include `/opt/nhanchilltv/nginx/nginx-rtmp.conf` from the main `/etc/nginx/nginx.conf` top level, then run `nginx -t && systemctl reload nginx`.

Set production secrets in `/etc/systemd/system/nhanchilltv.service` before enabling:

```ini
Environment=ADMIN_PASSWORD=your-password
Environment=JWT_SECRET=your-random-secret
```

Runtime JSON databases are created automatically in `backend/db` on first start. The repository only ships `*.example.json` files.
