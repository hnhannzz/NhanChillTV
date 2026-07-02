export function shouldRenderWorldCupPlayer(match) {
  return Boolean(match && !match.isFinished);
}

export function isManualWorldCupStream(stream) {
  return Boolean(stream?.manual || stream?.custom || stream?.isCustom || stream?.sourceType === 'custom');
}

export function getWorldCupStreamPlaybackTarget(stream) {
  if (!stream) {
    return { channelId: null, streamParam: null, preferDirectStream: false };
  }

  if (isManualWorldCupStream(stream) && stream.stream) {
    return { channelId: null, streamParam: stream.stream, preferDirectStream: true };
  }

  if (stream.sourceType === 'iptv' && stream.sourceChannelId) {
    return { channelId: stream.sourceChannelId, streamParam: null, preferDirectStream: false };
  }

  if (stream.stream) {
    return {
      channelId: null,
      streamParam: stream.stream,
      preferDirectStream: isManualWorldCupStream(stream),
    };
  }

  return { channelId: null, streamParam: null, preferDirectStream: false };
}
