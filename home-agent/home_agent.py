#!/usr/bin/env python3
import argparse
import base64
import gzip
import json
import os
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from shutil import disk_usage
from threading import Thread

VERSION = "1.1.0"
DEFAULT_HEADERS = {
    "User-Agent": "NhanChillTV-HomeAgent/1.0",
    "Accept": "*/*",
}


def env_int(name, default):
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def api_base():
    return os.getenv("NHANCHILL_API_BASE", "https://tv.nhanchill.lol/api").rstrip("/")


def agent_token():
    return os.getenv("HOME_AGENT_TOKEN", "").strip()


def request(url, timeout=20, headers=None, data=None, method=None, max_bytes=None):
    req_headers = {**DEFAULT_HEADERS, **(headers or {})}
    payload = None
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
        method = method or "POST"
    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    context = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
        body = response.read(max_bytes or -1)
        return response.status, dict(response.headers), body


def post_agent(path, payload):
    token = agent_token()
    if not token:
        raise RuntimeError("HOME_AGENT_TOKEN is missing")
    status, _, body = request(
        f"{api_base()}{path}",
        timeout=30,
        headers={"Authorization": f"Bearer {token}"},
        data=payload,
    )
    if status < 200 or status >= 300:
        raise RuntimeError(f"API {path} returned HTTP {status}: {body[:200]!r}")
    return json.loads(body.decode("utf-8") or "{}")


def get_agent(path, timeout=60):
    token = agent_token()
    if not token:
        raise RuntimeError("HOME_AGENT_TOKEN is missing")
    return request(
        f"{api_base()}{path}",
        timeout=timeout,
        headers={"Authorization": f"Bearer {token}"},
    )


def read_first(path, default=""):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except OSError:
        return default


def read_cpu_times():
    parts = read_first("/proc/stat").splitlines()[0].split()[1:]
    values = [int(value) for value in parts]
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    return sum(values), idle


def cpu_percent(sample_seconds=0.15):
    try:
        total_a, idle_a = read_cpu_times()
        time.sleep(sample_seconds)
        total_b, idle_b = read_cpu_times()
        total_delta = total_b - total_a
        idle_delta = idle_b - idle_a
        if total_delta <= 0:
            return 0
        return round((1 - idle_delta / total_delta) * 100, 1)
    except Exception:
        return 0


def collect_network():
    interfaces = {}
    root = "/sys/class/net"
    try:
        for name in os.listdir(root):
            if name == "lo":
                continue
            base = os.path.join(root, name)
            interfaces[name] = {
                "operstate": read_first(os.path.join(base, "operstate"), "unknown"),
                "speedMbps": int(read_first(os.path.join(base, "speed"), "0") or 0),
                "rxBytes": int(read_first(os.path.join(base, "statistics/rx_bytes"), "0") or 0),
                "txBytes": int(read_first(os.path.join(base, "statistics/tx_bytes"), "0") or 0),
            }
    except OSError:
        pass
    return interfaces


def collect_metrics():
    meminfo = {}
    for line in read_first("/proc/meminfo").splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            parts = value.strip().split()
            meminfo[key] = int(parts[0]) * 1024 if parts and parts[0].isdigit() else 0

    total, used, free = disk_usage("/")
    load = read_first("/proc/loadavg", "0 0 0").split()[:3]
    temp_raw = read_first("/sys/class/thermal/thermal_zone0/temp", "0")
    try:
        temp_c = round(int(temp_raw) / 1000, 1)
    except ValueError:
        temp_c = None

    return {
        "load": load,
        "cpuPercent": cpu_percent(),
        "memory": {
            "total": meminfo.get("MemTotal", 0),
            "available": meminfo.get("MemAvailable", 0),
        },
        "disk": {"total": total, "used": used, "free": free},
        "temperatureC": temp_c,
    }


def heartbeat():
    payload = {
        "id": os.getenv("AGENT_ID", "home-s905w"),
        "hostname": socket.gethostname(),
        "version": VERSION,
        "uptimeSeconds": float(read_first("/proc/uptime", "0").split()[0]),
        "metrics": collect_metrics(),
        "network": collect_network(),
        "capabilities": ["epg-fetch", "channel-health", "manifest-relay"],
    }
    return post_agent("/home-agent/heartbeat", payload)


def fetch_epg():
    epg_url = os.getenv("EPG_URL", "https://vnepg.site/epg.xml")
    started = time.time()
    status, headers, body = request(
        epg_url,
        timeout=env_int("EPG_FETCH_TIMEOUT_SECONDS", 70),
        headers={
            "Accept": "application/xml,text/xml,application/gzip,*/*",
            "Referer": urllib.parse.urljoin(epg_url, "/"),
        },
    )
    raw = body
    if epg_url.lower().endswith(".gz") or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    xml = raw.decode("utf-8", "replace").lstrip("\ufeff")
    if not (xml.lstrip().startswith("<?xml") or xml.lstrip().startswith("<tv")):
        raise RuntimeError("EPG source did not return XMLTV")
    compressed = gzip.compress(xml.encode("utf-8"), compresslevel=6)
    payload = {
        "source": epg_url,
        "statusCode": status,
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "durationMs": int((time.time() - started) * 1000),
        "bytes": len(xml.encode("utf-8")),
        "gzipBytes": len(compressed),
        "gzipBase64": base64.b64encode(compressed).decode("ascii"),
    }
    return post_agent("/home-agent/epg", payload)


def infer_stream_type(url, content_type, body):
    sample = body[:4096].decode("utf-8", "ignore")
    lowered_url = url.lower().split("?", 1)[0]
    lowered_type = content_type.lower()
    if "#EXTM3U" in sample or lowered_url.endswith(".m3u8") or "mpegurl" in lowered_type:
        return "hls", False
    if "<MPD" in sample or lowered_url.endswith(".mpd") or "dash+xml" in lowered_type:
        return "mpd", "ContentProtection" in sample or "cenc:default_KID" in sample
    if lowered_url.endswith(".mp4") or "video/mp4" in lowered_type:
        return "progressive", False
    return "unknown", False


def check_channel(channel):
    url = channel.get("url") or ""
    result = {
        "id": channel.get("id"),
        "name": channel.get("name"),
        "group": channel.get("group"),
        "urlHost": "",
        "ok": False,
        "type": "dead",
        "drm": False,
        "status": 0,
        "latencyMs": 0,
        "error": None,
    }
    try:
        parsed = urllib.parse.urlparse(url)
        result["urlHost"] = parsed.netloc
        started = time.time()
        status, headers, body = request(
            url,
            timeout=env_int("CHANNEL_CHECK_TIMEOUT_SECONDS", 8),
            headers={"Range": "bytes=0-4095", "Accept-Encoding": "identity"},
            max_bytes=4096,
        )
        result["status"] = status
        result["latencyMs"] = int((time.time() - started) * 1000)
        stream_type, drm = infer_stream_type(url, headers.get("Content-Type", ""), body)
        result["type"] = stream_type
        result["drm"] = drm
        result["ok"] = 200 <= status < 400 and stream_type != "dead"
    except Exception as err:
        result["error"] = str(err)[:220]
    return result


def channel_health():
    status, _, body = request(f"{api_base()}/iptv/channels", timeout=30)
    if status < 200 or status >= 300:
        raise RuntimeError(f"channel list returned HTTP {status}")
    channels = json.loads(body.decode("utf-8")).get("data", [])
    group_filter = [item.strip().lower() for item in os.getenv("CHANNEL_HEALTH_GROUPS", "").split(",") if item.strip()]
    if group_filter:
        channels = [c for c in channels if any(g in str(c.get("group", "")).lower() for g in group_filter)]
    limit = env_int("CHANNEL_HEALTH_LIMIT", 80)
    channels = channels[:limit]
    started = time.time()
    results = [check_channel(channel) for channel in channels]
    return post_agent("/home-agent/channel-health", {
        "durationMs": int((time.time() - started) * 1000),
        "channels": results,
    })


def pull_backup():
    status, headers, body = get_agent("/home-agent/backup", timeout=90)
    if status < 200 or status >= 300:
        raise RuntimeError(f"backup returned HTTP {status}")

    backup_dir = os.getenv("BACKUP_DIR", "/opt/nhanchill-home-agent/backups")
    os.makedirs(backup_dir, exist_ok=True)
    filename = time.strftime("nhanchill-backup-%Y%m%d-%H%M%S.json.gz", time.localtime())
    target = os.path.join(backup_dir, filename)
    with open(target, "wb") as handle:
        handle.write(body)
    os.chmod(target, 0o600)

    keep = env_int("BACKUP_KEEP", 7)
    backups = sorted(
        [os.path.join(backup_dir, name) for name in os.listdir(backup_dir) if name.startswith("nhanchill-backup-") and name.endswith(".json.gz")],
        key=lambda item: os.path.getmtime(item),
        reverse=True,
    )
    for old in backups[keep:]:
        try:
            os.remove(old)
        except OSError:
            pass
    return {"path": target, "bytes": len(body), "kept": min(len(backups), keep)}


class RelayHandler(BaseHTTPRequestHandler):
    def do_GET(self):
      try:
        token = self.headers.get("x-home-agent-token", "")
        if agent_token() and token != agent_token():
            self.send_error(401)
            return
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/relay":
            self.send_error(404)
            return
        params = urllib.parse.parse_qs(parsed.query)
        target = params.get("url", [""])[0]
        allowed = [d.strip().lower() for d in os.getenv("RELAY_ALLOW_HOSTS", "vnepg.site").split(",") if d.strip()]
        host = urllib.parse.urlparse(target).netloc.lower()
        if not target.startswith(("http://", "https://")) or not any(host == d or host.endswith("." + d) for d in allowed):
            self.send_error(403)
            return
        max_bytes = env_int("RELAY_MAX_BYTES", 2 * 1024 * 1024)
        status, headers, body = request(target, timeout=15, max_bytes=max_bytes)
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", headers.get("Content-Type", "application/octet-stream"))
        self.end_headers()
        self.wfile.write(body)
      except Exception as err:
        self.send_error(502, str(err)[:120])

    def log_message(self, fmt, *args):
        if os.getenv("RELAY_LOG", "0") == "1":
            super().log_message(fmt, *args)


def start_relay():
    port = env_int("RELAY_PORT", 0)
    if port <= 0:
        return
    server = ThreadingHTTPServer(("0.0.0.0", port), RelayHandler)
    Thread(target=server.serve_forever, daemon=True).start()
    print(f"[relay] listening on 0.0.0.0:{port}")


def run_once():
    print("[home-agent] heartbeat")
    print(json.dumps(heartbeat(), ensure_ascii=False))
    print("[home-agent] epg")
    print(json.dumps(fetch_epg(), ensure_ascii=False))
    print("[home-agent] channel health")
    print(json.dumps(channel_health(), ensure_ascii=False))
    print("[home-agent] backup")
    print(json.dumps(pull_backup(), ensure_ascii=False))


def run_loop():
    start_relay()
    epg_interval = env_int("EPG_INTERVAL_SECONDS", 30 * 60)
    health_interval = env_int("HEALTH_INTERVAL_SECONDS", 10 * 60)
    heartbeat_interval = env_int("HEARTBEAT_INTERVAL_SECONDS", 60)
    backup_interval = env_int("BACKUP_INTERVAL_SECONDS", 24 * 60 * 60)
    next_epg = 0
    next_health = 0
    next_backup = 0
    while True:
        now = time.time()
        try:
            heartbeat()
        except Exception as err:
            print(f"[heartbeat] {err}")
        if now >= next_epg:
            try:
                print("[epg] sync")
                fetch_epg()
                next_epg = now + epg_interval
            except Exception as err:
                print(f"[epg] {err}")
                next_epg = now + min(300, epg_interval)
        if now >= next_health:
            try:
                print("[health] check")
                channel_health()
                next_health = now + health_interval
            except Exception as err:
                print(f"[health] {err}")
                next_health = now + min(300, health_interval)
        if now >= next_backup:
            try:
                print("[backup] pull")
                pull_backup()
                next_backup = now + backup_interval
            except Exception as err:
                print(f"[backup] {err}")
                next_backup = now + min(1800, backup_interval)
        time.sleep(heartbeat_interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NhanChillTV home mini VPS agent")
    parser.add_argument("--once", action="store_true", help="run one sync cycle and exit")
    args = parser.parse_args()
    if args.once:
        run_once()
    else:
        run_loop()
