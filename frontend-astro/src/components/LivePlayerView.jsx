import React, { useState, useEffect, useRef } from 'react';
import VideoPlayerReact from './VideoPlayerReact';
import JWPlayerReact from './JWPlayerReact';
import { Loader2, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import { resolveProxyPlaybackUrl } from '../lib/playbackUrl';

const API_BASE = '/api';

export default function LivePlayerView({ channelId, streamParam }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [fallbackUrls, setFallbackUrls] = useState([]);
  const [clearKey, setClearKey] = useState(null);
  const [isMpd, setIsMpd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewers, setViewers] = useState(0);
  const heartbeatIntervalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let loadingTimeoutId = null;

    const startStream = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // If an explicit stream URL is passed via query (like custom HLS event), use it directly
        if (streamParam && !channelId) {
          const resolvedStreamUrl = await resolveProxyPlaybackUrl(streamParam);
          setStreamUrl(resolvedStreamUrl);
          setFallbackUrls(resolvedStreamUrl !== streamParam ? [streamParam] : []);
          setIsMpd(streamParam.toLowerCase().includes('.mpd'));
          setLoading(false);
          return;
        }

        // 1. Call start API
        const res = await fetch(`${API_BASE}/stream/start/${channelId}`, { method: 'POST' });
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to start stream');
        }

        const hlsUrl = data.data.hlsUrl;
        const rawUrl = data.data.rawUrl;
        const cKey = data.data.clearKey;
        const mpdFlag = data.data.isMpd || false;

        // Nếu chế độ Direct (phát trực tiếp link m3u), route qua RAM Proxy để lách CORS
        if (data.data.isDirect) {
          const baseUrl = window.location.origin; // e.g. http://localhost:8050
          const proxyUrl = hlsUrl.startsWith('/api/proxy') ? `${baseUrl}${hlsUrl}` : `${baseUrl}/api/proxy/${hlsUrl}`;
          if (mpdFlag && rawUrl && rawUrl.startsWith('http')) {
            setStreamUrl(proxyUrl);
            setFallbackUrls([rawUrl]);
          } else {
            setStreamUrl(proxyUrl);
            setFallbackUrls([]);
          }
          setIsMpd(mpdFlag);
          if (cKey) setClearKey(cKey);
          setLoading(false);
          startHeartbeat();
          return;
        }

        // 2. Poll for status (cho chế độ FFmpeg)
        const checkStatus = async () => {
          if (!isMounted) return;
          try {
            const statusRes = await fetch(`${API_BASE}/stream/status/${channelId}`);
            const statusData = await statusRes.json();
            
            if (statusData.ready) {
              setStreamUrl(hlsUrl);
              setFallbackUrls([]);
              setIsMpd(false); // FFmpeg mode always produces HLS m3u8
              if (cKey) setClearKey(cKey);
              setLoading(false);
              startHeartbeat();
            } else {
              loadingTimeoutId = setTimeout(checkStatus, 2000);
            }
          } catch (e) {
            console.error('Polling error:', e);
            loadingTimeoutId = setTimeout(checkStatus, 2000);
          }
        };

        checkStatus();

      } catch (err) {
        console.error('Stream init error:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    const startHeartbeat = () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        fetch(`${API_BASE}/stream/heartbeat/${channelId}`, { method: 'POST' }).catch(console.error);
      }, 30000);
    };

    startStream();

    return () => {
      isMounted = false;
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [channelId, streamParam]);

  useEffect(() => {
    if (!channelId && !streamParam) return;
    const currentId = channelId || streamParam;
    const socket = io({ path: '/socket.io' });
    
    socket.emit('join_channel', currentId);
    
    socket.on('viewer_count', (data) => {
      if (data.channelId === currentId) {
        setViewers(data.count);
      }
    });

    return () => {
      socket.emit('leave_channel', currentId);
      socket.disconnect();
    };
  }, [channelId, streamParam]);

  if (error) {
    return (
      <div className="w-full aspect-video bg-black rounded-xl border border-white/10 flex flex-col items-center justify-center text-white p-6 text-center">
        <p className="text-red-500 font-bold mb-2">Lỗi Khởi Tạo Luồng</p>
        <p className="text-white/60 text-sm">{error}</p>
      </div>
    );
  }

  if (loading || !streamUrl) {
    return (
      <div className="w-full aspect-video bg-black rounded-xl border border-white/10 flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
        <Loader2 className="w-12 h-12 text-[#ED2C25] animate-spin mb-4 relative z-20" />
        <h3 className="text-xl font-bold text-[#ED2C25] relative z-20">Khởi tạo luồng phát</h3>
        <p className="text-white/60 mt-2 text-sm relative z-20">Hệ thống đang khởi tạo kênh, vui lòng chờ trong giây lát...</p>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black relative group">
      {!isMpd ? (
        <VideoPlayerReact
          key={streamUrl}
          url={streamUrl}
          type="hls"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <JWPlayerReact
          key={streamUrl}
          url={streamUrl}
          fallbackUrls={fallbackUrls}
          isMpd
          clearKey={clearKey}
          style={{ width: '100%', height: '100%' }}
        />
      )}
      <div className="absolute top-4 right-4 flex gap-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg border border-white/10">
          <Users size={14} className="text-blue-400" />
          <span>{viewers} <span className="font-normal text-white/60">đang xem</span></span>
        </div>
        <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/20">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          TRỰC TIẾP
        </div>
      </div>
    </div>
  );
}
