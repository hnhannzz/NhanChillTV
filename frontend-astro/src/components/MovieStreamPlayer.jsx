import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import VideoPlayerReact from './VideoPlayerReact';
import { resolveProxyPlaybackUrl } from '../lib/playbackUrl';

export default function MovieStreamPlayer({ episode }) {
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const streamUrl = useMemo(() => {
    return episode?.m3u8 || episode?.link_m3u8 || episode?.file || '';
  }, [episode]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setError(null);
      setPlaybackUrl('');

      if (!streamUrl) return;

      setLoading(true);
      try {
        const resolved = await resolveProxyPlaybackUrl(streamUrl);
        if (!cancelled) setPlaybackUrl(resolved);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Khong the tao proxy playback URL');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolve();

    return () => {
      cancelled = true;
    };
  }, [streamUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/60">
        <Loader2 className="w-8 h-8 animate-spin text-[#ED2C25]" />
      </div>
    );
  }

  if (playbackUrl) {
    return (
      <VideoPlayerReact
        key={playbackUrl}
        url={playbackUrl}
        type="hls"
        autoplay
        muted={false}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }

  if (episode?.embed) {
    return (
      <iframe
        src={episode.embed}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-full border-none"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-white/50 bg-[#121212] px-4 text-center">
      {error || 'Phim chua co tap nao duoc cap nhat'}
    </div>
  );
}
