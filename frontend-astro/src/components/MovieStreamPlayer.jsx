import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import VideoPlayerReact from './VideoPlayerReact';
import { resolveProxyPlaybackUrl } from '../lib/playbackUrl';

function isAppleWebKit() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isiOS = /iPad|iPhone|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  return isiOS || isSafari;
}

export default function MovieStreamPlayer({ episode }) {
  const embedUrl = episode?.embed || '';
  const streamUrl = useMemo(() => episode?.m3u8 || episode?.link_m3u8 || episode?.file || '', [episode]);
  const [proxyUrl, setProxyUrl] = useState('');
  const [useEmbed, setUseEmbed] = useState(!streamUrl);
  const [resolving, setResolving] = useState(Boolean(streamUrl));

  useEffect(() => {
    let cancelled = false;
    setProxyUrl('');
    setUseEmbed(!streamUrl);
    setResolving(Boolean(streamUrl));

    if (!streamUrl) return undefined;

    resolveProxyPlaybackUrl(streamUrl).then(resolved => {
      if (!cancelled && resolved !== streamUrl) setProxyUrl(resolved);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setResolving(false);
    });

    return () => { cancelled = true; };
  }, [streamUrl]);

  if (streamUrl && resolving) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white/60">
        <Loader2 className="h-8 w-8 animate-spin text-[#ED2C25]" />
      </div>
    );
  }

  if (streamUrl && !useEmbed) {
    const appleWebKit = isAppleWebKit();
    const primaryUrl = appleWebKit ? streamUrl : (proxyUrl || streamUrl);
    const fallbackUrls = [...new Set([
      appleWebKit ? proxyUrl : streamUrl,
    ].filter(url => url && url !== primaryUrl))];

    return (
      <VideoPlayerReact
        key={`${primaryUrl}-${fallbackUrls.join('|')}`}
        url={primaryUrl}
        fallbackUrls={fallbackUrls}
        type="hls"
        autoplay={false}
        muted={false}
        style={{ width: '100%', height: '100%' }}
        onError={() => {
          if (embedUrl) setUseEmbed(true);
        }}
      />
    );
  }

  if (embedUrl) {
    return (
      <div className="relative h-full w-full bg-black">
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={episode?.name || 'Nguonc embed player'}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          loading="eager"
          referrerPolicy="origin-when-cross-origin"
          className="movie-player-frame h-full w-full border-none bg-black"
        />
        {streamUrl && (
          <button
            type="button"
            onClick={() => setUseEmbed(false)}
            className="absolute right-2 top-2 z-20 rounded-md bg-black/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/90"
          >
            Thử nguồn HLS
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-white/50 bg-[#121212] px-4 text-center">
      Nguon embed cua tap nay chua kha dung.
    </div>
  );
}
