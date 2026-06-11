export const EPG_URL = 'https://vnepg.site/epg.xml';

let epgPromise = null;

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getAliasKeys(value) {
  const key = normalizeKey(value);
  if (!key) return [];

  const keys = new Set([key]);
  const withoutQuality = key.replace(/(?:fullhd|fhd|hd|sd)$/i, '');
  if (withoutQuality) keys.add(withoutQuality);

  const withoutChannel = withoutQuality.replace(/(?:channel|kenh)$/i, '');
  if (withoutChannel) keys.add(withoutChannel);
  return [...keys];
}

function parseEpgTime(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return 0;

  const [, year, month, day, hour, minute, second, timezone] = match;
  const offset = timezone ? `${timezone.slice(0, 3)}:${timezone.slice(3)}` : '+07:00';
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`).getTime();
}

function addAlias(aliases, value, channelId) {
  for (const key of getAliasKeys(value)) {
    if (!aliases.has(key)) aliases.set(key, channelId);
  }
}

function parseXmlTv(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || document.documentElement?.tagName !== 'tv') {
    throw new Error('Nguồn EPG trả về XMLTV không hợp lệ');
  }

  const channels = new Map();
  const programs = new Map();
  const aliases = new Map();
  const channelIds = new Map();

  document.querySelectorAll('channel').forEach(channel => {
    const id = channel.getAttribute('id');
    if (!id) return;
    const name = channel.querySelector('display-name')?.textContent?.trim() || id;
    channels.set(id, { id, name, icon: channel.querySelector('icon')?.getAttribute('src') || '' });
    channelIds.set(id.trim().toLowerCase(), id);
    addAlias(aliases, id, id);
    addAlias(aliases, name, id);
  });

  document.querySelectorAll('programme').forEach(programme => {
    const channelId = programme.getAttribute('channel');
    const start = parseEpgTime(programme.getAttribute('start'));
    const stop = parseEpgTime(programme.getAttribute('stop'));
    if (!channelId || !start || !stop || stop <= start) return;

    if (!programs.has(channelId)) programs.set(channelId, []);
    programs.get(channelId).push({
      start,
      stop,
      title: programme.querySelector('title')?.textContent?.trim() || '',
      desc: programme.querySelector('desc')?.textContent?.trim() || '',
      icon: programme.querySelector('icon')?.getAttribute('src') || '',
    });
    addAlias(aliases, channelId, channelId);
  });

  programs.forEach(items => items.sort((a, b) => a.start - b.start));
  if (!programs.size) throw new Error('Nguồn EPG không có chương trình hợp lệ');
  return { channels, programs, aliases, channelIds };
}

async function loadEpg() {
  if (!epgPromise) {
    epgPromise = fetch(EPG_URL, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/xml,text/xml' },
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(parseXmlTv)
      .catch(error => {
        epgPromise = null;
        throw error;
      });
  }
  return epgPromise;
}

function resolveChannelId(epg, channelId, channelName) {
  for (const candidate of [channelId, channelName].filter(Boolean)) {
    if (epg.programs.has(candidate)) return candidate;
    const lower = String(candidate).trim().toLowerCase();
    if (epg.programs.has(lower)) return lower;
    const exactId = epg.channelIds.get(lower);
    if (exactId) return exactId;
    for (const key of getAliasKeys(candidate)) {
      const alias = epg.aliases.get(key);
      if (alias && epg.programs.has(alias)) return alias;
    }
  }
  return channelId;
}

export async function getBrowserEpgSchedule(channelId, channelName, limit = 18) {
  const epg = await loadEpg();
  const resolvedId = resolveChannelId(epg, channelId, channelName);
  const now = Date.now();
  const programs = (epg.programs.get(resolvedId) || [])
    .filter(program => program.stop > now - 2 * 60 * 60 * 1000 && program.start < now + 30 * 60 * 60 * 1000)
    .slice(0, Math.max(1, Math.min(Number(limit) || 18, 80)));

  return {
    channel: epg.channels.get(resolvedId) || { id: resolvedId || channelId, name: channelName || resolvedId || channelId },
    programs,
    source: EPG_URL,
    transport: 'browser',
    updatedAt: new Date().toISOString(),
  };
}
