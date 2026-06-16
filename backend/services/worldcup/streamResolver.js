const DEFAULT_WORLDCUP_STREAMS = [
  { id: 'vtv3hd', name: 'Luồng bình luận miền bắc', sourceType: 'iptv', sourceChannelId: 'vtv3hd' },
  { id: 'vtv6hd', name: 'Luồng bình luận miền bắc (dự phòng)', sourceType: 'iptv', sourceChannelId: 'vtv6hd' },
  { id: 'vtv9hd', name: 'Luồng bình luận nam bộ', sourceType: 'iptv', sourceChannelId: 'vtv9hd' },
  { id: 'vtv10hd', name: 'Luồng bình luận nam bộ (dự phòng)', sourceType: 'iptv', sourceChannelId: 'vtv10hd' },
];

function isM3u8Url(url) {
  return String(url || '').toLowerCase().includes('.m3u8');
}

function resolveIptvStream(stream, m3uManager) {
  const channel = stream.sourceChannelId ? m3uManager.getChannelById(stream.sourceChannelId) : null;
  if (!channel || !isM3u8Url(channel.url)) return null;
  return {
    ...stream,
    sourceType: 'iptv',
    stream: channel.url,
    channelName: channel.name,
    logo: channel.logo || null,
    available: true,
  };
}

function normalizeCustomWorldCupStream(stream, m3uManager) {
  const sourceType = ['iptv', 'custom'].includes(stream.sourceType) ? stream.sourceType : 'custom';
  const normalized = {
    id: String(stream.id || `wc_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_'),
    name: String(stream.name || 'Luồng bổ sung').trim(),
    sourceType,
    sourceChannelId: sourceType === 'iptv' ? String(stream.sourceChannelId || '').trim() : null,
    stream: sourceType === 'custom' ? String(stream.stream || '').trim() : null,
  };
  if (normalized.sourceType === 'iptv') return resolveIptvStream(normalized, m3uManager);
  if (normalized.sourceType === 'custom' && isM3u8Url(normalized.stream)) {
    return { ...normalized, available: true };
  }
  return null;
}

function getWorldCupStreams(matchId, { db, m3uManager }) {
  const defaults = DEFAULT_WORLDCUP_STREAMS
    .map(stream => resolveIptvStream(stream, m3uManager))
    .filter(Boolean);
  const custom = db.getWorldCupStreams(matchId)
    .map(stream => normalizeCustomWorldCupStream(stream, m3uManager))
    .filter(Boolean);
  return [...defaults, ...custom];
}

module.exports = {
  DEFAULT_WORLDCUP_STREAMS,
  isM3u8Url,
  resolveIptvStream,
  normalizeCustomWorldCupStream,
  getWorldCupStreams,
};
