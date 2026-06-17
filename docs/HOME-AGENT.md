# NhanChillTV Home Agent

Home Agent is a small Python service for a low-power Armbian box in Vietnam.
It keeps Vietnam-only data close to a Vietnam residential IP and sends only
small validated metadata to the main VPS.

## What It Does

- Fetches `https://vnepg.site/epg.xml`, validates XMLTV, gzip-compresses it, and uploads it to the main VPS.
- Sends heartbeat and device metrics: load, RAM, disk, temperature.
- Checks a small IPTV sample list from the Vietnam IP and reports stream type: `hls`, `mpd`, `progressive`, `unknown`, `dead`.
- Can optionally expose a tiny allowlisted relay for manifest/metadata requests. Keep it behind VPN/tunnel and do not proxy full video.

## Server Environment

Set this on the main VPS service environment:

```bash
HOME_AGENT_TOKEN="change-this-long-random-token"
```

Restart the main service after changing the environment.

## Box Install

```bash
mkdir -p /opt/nhanchill-home-agent
cp home_agent.py /opt/nhanchill-home-agent/home_agent.py
cp env.example /etc/nhanchill-home-agent.env
nano /etc/nhanchill-home-agent.env
cp systemd/nhanchill-home-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nhanchill-home-agent
journalctl -u nhanchill-home-agent -f
```

Run one cycle before enabling the service:

```bash
set -a
. /etc/nhanchill-home-agent.env
set +a
python3 /opt/nhanchill-home-agent/home_agent.py --once
```

## Relay Notes

The relay is disabled by default with `RELAY_PORT=0`. If enabled, it:

- requires `x-home-agent-token`
- only fetches `RELAY_ALLOW_HOSTS`
- caps response size with `RELAY_MAX_BYTES`
- is intended for EPG/manifest/metadata, not video segments

For production, expose it through Tailscale, WireGuard, or a reverse SSH tunnel instead of opening the home router directly.
