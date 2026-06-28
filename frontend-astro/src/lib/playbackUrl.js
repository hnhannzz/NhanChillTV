export function inferPlaybackType(url, explicitType) {
  if (explicitType) return explicitType;

  const cleanUrl = String(url || '').split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.mpd')) return 'dash';
  if (cleanUrl.endsWith('.m3u8')) return 'hls';
  if (cleanUrl.endsWith('.mp4')) return 'mp4';
  return 'hls';
}

export function getMimeType(type) {
  switch (type) {
    case 'dash':
      return 'application/dash+xml';
    case 'mp4':
      return 'video/mp4';
    case 'hls':
    default:
      return 'application/x-mpegURL';
  }
}

export async function resolveProxyPlaybackUrl(url, options = {}) {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return url;

  const params = new URLSearchParams({ url });
  if (options.userAgent) params.set('ua', options.userAgent);
  if (options.referer) params.set('ref', options.referer);
  if (options.origin) params.set('origin', options.origin);
  if (options.playbackType) params.set('pt', options.playbackType);

  try {
    const response = await fetch(`/api/proxy/resolve?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      if (data?.success && data.url) return data.url;
    }
  } catch (error) {
    console.warn('[Playback] proxy resolver failed:', error);
  }

  const fallback = `/api/proxy/${url}`;
  const fallbackParams = new URLSearchParams();
  if (options.userAgent) fallbackParams.set('ua', options.userAgent);
  if (options.referer) fallbackParams.set('ref', options.referer);
  if (options.origin) fallbackParams.set('origin', options.origin);
  if (options.playbackType) fallbackParams.set('pt', options.playbackType);
  const query = fallbackParams.toString();
  if (!query) return fallback;
  return `${fallback}${fallback.includes('?') ? '&' : '?'}${query}`;
}
