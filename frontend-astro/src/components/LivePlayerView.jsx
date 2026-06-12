import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import UnifiedPlayer from './UnifiedPlayer';
import LegacyPlayer from './LegacyPlayer';
import { resolveProxyPlaybackUrl } from '../lib/playbackUrl';

const API_BASE = '/api';

function canUseDirectUrl(url) {
  if (!url || typeof window === 'undefined') return false;
  try {
    const parsed = new URL(url, window.location.href);
    return window.location.protocol !== 'https:' || parsed.protocol === 'https:' || parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

function isUnsupportedAppleDrmBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  return isIOS || isSafari;
}

export default function LivePlayerView({ channelId, streamParam }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [fallbackUrls, setFallbackUrls] = useState([]);
  const [clearKey, setClearKey] = useState(null);
  const [isMpd, setIsMpd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [playerType, setPlayerType] = useState('shaka');
  const heartbeatIntervalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let loadingTimeoutId = null;

    const startHeartbeat = () => {
      if (!channelId) return;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        fetch(`${API_BASE}/stream/heartbeat/${channelId}`, { method: 'POST' }).catch(() => {});
      }, 30000);
    };

    fetch('/api/admin/system/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.data) {
          setPlayerType(data.data.playerType || 'shaka');
        }
      })
      .catch(err => console.error('Failed to load system settings:', err));

    const useDirectWithProxyFallback = (rawUrl, proxyUrl) => {
      if (canUseDirectUrl(rawUrl)) {
        setStreamUrl(rawUrl);
        setFallbackUrls(proxyUrl && proxyUrl !== rawUrl ? [proxyUrl] : []);
      } else {
        setStreamUrl(proxyUrl || rawUrl);
        setFallbackUrls([]);
      }
    };

    const startStream = async () => {
      try {
        setLoading(true);
        setError(null);
        setClearKey(null);

        if (streamParam && !channelId) {
          const proxyUrl = await resolveProxyPlaybackUrl(streamParam);
          const mpd = streamParam.toLowerCase().includes('.mpd');
          useDirectWithProxyFallback(streamParam, proxyUrl);
          setIsMpd(mpd);
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/stream/start/${encodeURIComponent(channelId)}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Không thể khởi tạo luồng phát');

        const proxyUrl = data.data.proxyUrl || data.data.hlsUrl;
        const rawUrl = data.data.rawUrl;
        const cKey = data.data.clearKey;
        const mpdFlag = Boolean(data.data.isMpd);

        if (mpdFlag && cKey && isUnsupportedAppleDrmBrowser()) {
          throw new Error('Kênh DRM MPD này chưa hỗ trợ iOS, iPadOS hoặc Safari. Vui lòng dùng Chrome/Edge trên Windows hoặc Android.');
        }

        if (data.data.isDirect) {
          useDirectWithProxyFallback(rawUrl, proxyUrl);
          setIsMpd(mpdFlag);
          setClearKey(cKey || null);
          setLoading(false);
          startHeartbeat();
          return;
        }

        const checkStatus = async () => {
          if (!isMounted) return;
          try {
            const statusRes = await fetch(`${API_BASE}/stream/status/${encodeURIComponent(channelId)}`);
            const statusData = await statusRes.json();
            if (statusData.ready) {
              setStreamUrl(data.data.hlsUrl);
              setFallbackUrls([]);
              setIsMpd(false);
              setClearKey(cKey || null);
              setLoading(false);
              startHeartbeat();
            } else {
              loadingTimeoutId = setTimeout(checkStatus, 2000);
            }
          } catch {
            loadingTimeoutId = setTimeout(checkStatus, 2000);
          }
        };
        checkStatus();
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    startStream();
    return () => {
      isMounted = false;
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [channelId, streamParam]);

  useEffect(() => {
    if (!channelId && !streamParam) return undefined;
    const currentId = channelId || streamParam;
    const socket = io({ path: '/socket.io' });
    socket.emit('join_channel', currentId);
    socket.on('viewer_count', data => {
      if (data.channelId === currentId) setViewers(data.count);
    });
    return () => {
      socket.emit('leave_channel', currentId);
      socket.disconnect();
    };
  }, [channelId, streamParam]);

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-white/10 bg-black p-6 text-center text-white">
        <p className="mb-2 font-bold text-red-500">Lỗi phát kênh</p>
        <p className="max-w-xl text-sm text-white/65">{error}</p>
      </div>
    );
  }

  if (loading || !streamUrl) {
    return (
      <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black text-white">
        <Loader2 className="relative z-20 mb-4 h-10 w-10 animate-spin text-[#ED2C25]" />
        <h3 className="relative z-20 text-lg font-bold">Đang khởi tạo luồng phát</h3>
        <p className="relative z-20 mt-2 text-sm text-white/60">Vui lòng chờ trong giây lát...</p>
      </div>
    );
  }

  const lowerUrl = String(streamUrl || '').toLowerCase();
  const isMpegTs = !isMpd && !lowerUrl.includes('.m3u8') && !lowerUrl.includes('.mpd') && !lowerUrl.includes('.mp4');

  const PlayerComponent = (playerType === 'legacy' && !isMpegTs) ? LegacyPlayer : UnifiedPlayer;

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl">
      <PlayerComponent
        key={`${streamUrl}-${fallbackUrls.join('|')}-${playerType}`}
        url={streamUrl}
        autoplay={true}
        muted={false}
        clearKey={clearKey}
        isMpd={isMpd}
        className="w-full h-full"
        title={channelId || streamParam}
        subTitle="Live TV"
      />
      <div className="pointer-events-none absolute right-4 top-4 z-50 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
          <Users size={14} className="text-blue-400" />
          <span>{viewers} <span className="font-normal text-white/60">đang xem</span></span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold tracking-wide text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          TRỰC TIẾP
        </div>
      </div>
    </div>
  );
}
