import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, CalendarDays, ChevronDown, ChevronUp, CircleStop, Eye, EyeOff,
  Copy, Gauge, ListVideo, LogOut, Pencil, Plus, Radio, RefreshCw, RotateCcw,
  KeyRound, Save, Server, Settings, Trash2, Trophy, UploadCloud, X, Cpu
} from 'lucide-react';

const API_BASE = '/api';

export default function AdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [events, setEvents] = useState([]);
  const [sources, setSources] = useState([]);
  const [channels, setChannels] = useState([]);
  const [settings, setSettings] = useState({ hiddenGroups: [], hiddenChannels: [], groupOrder: [] });
  const [systemSettings, setSystemSettings] = useState({ playerType: 'shaka', maintenanceMode: false });
  const [status, setStatus] = useState(null);
  const [streams, setStreams] = useState([]);
  const [health, setHealth] = useState(null);
  const [worldCupData, setWorldCupData] = useState(null);
  const [worldCupStreams, setWorldCupStreams] = useState({ matchStreams: {} });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [eventModal, setEventModal] = useState(null);
  const [sourceForm, setSourceForm] = useState({ name: '', url: '', type: 'url' });
  const [channelSearch, setChannelSearch] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken');
    setToken(null);
  }, []);

  const adminRequest = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      logout();
      throw new Error('PhiÃªn quáº£n trá»‹ Ä‘Ã£ háº¿t háº¡n.');
    }
    if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }, [logout, token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    const requests = await Promise.allSettled([
      adminRequest('/admin/events'),
      adminRequest('/admin/m3u-sources'),
      adminRequest('/admin/iptv-settings'),
      adminRequest('/admin/iptv-channels'),
      adminRequest('/admin/status'),
      adminRequest('/admin/active-streams'),
      adminRequest('/admin/system-settings'),
      fetch(`${API_BASE}/health`).then(response => response.json()),
      adminRequest('/admin/worldcup-streams'),
      fetch(`${API_BASE}/worldcup/summary`).then(response => response.json()),
    ]);
    if (requests[0].status === 'fulfilled') setEvents(requests[0].value.data || []);
    if (requests[1].status === 'fulfilled') setSources(requests[1].value.data || []);
    if (requests[2].status === 'fulfilled' && !settingsDirty) setSettings(requests[2].value.data || { hiddenGroups: [], hiddenChannels: [], groupOrder: [] });
    if (requests[3].status === 'fulfilled') setChannels(requests[3].value.data || []);
    if (requests[4].status === 'fulfilled') setStatus(requests[4].value.data || null);
    if (requests[5].status === 'fulfilled') setStreams(requests[5].value.data || []);
    if (requests[6].status === 'fulfilled') setSystemSettings(requests[6].value.data || { playerType: 'shaka', maintenanceMode: false });
    if (requests[7].status === 'fulfilled') setHealth(requests[7].value || null);
    if (requests[8].status === 'fulfilled') setWorldCupStreams(requests[8].value.data || { matchStreams: {} });
    if (requests[9].status === 'fulfilled' && requests[9].value.success) setWorldCupData(requests[9].value);
  }, [adminRequest, settingsDirty, token]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, [loadData, token]);
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const loadHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        if (!cancelled && data.success) setHealth(data);
      } catch (err) {}
    };
    loadHealth();
    const timer = setInterval(loadHealth, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  const login = async event => {
    event.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Sai máº­t kháº©u');
      localStorage.setItem('adminToken', data.token);
      setToken(data.token);
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await loadData();
    } catch (err) {
      setNotice(`Lá»—i: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const changeAdminPassword = async (currentPassword, newPassword) => {
    setBusy(true);
    setNotice('');
    try {
      const data = await adminRequest('/admin/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      localStorage.setItem('adminToken', data.token);
      setToken(data.token);
      setNotice('ÄÃ£ Ä‘á»•i máº­t kháº©u quáº£n trá»‹.');
    } catch (err) {
      setNotice(`Lá»—i: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909] p-4 text-white">
        <form onSubmit={login} className="w-full max-w-sm rounded-lg border border-white/10 bg-[#151515] p-6">
          <h1 className="text-xl font-bold">Quáº£n trá»‹ NhanChillTV</h1>
          <p className="mt-1 text-sm text-white/50">ÄÄƒng nháº­p Ä‘á»ƒ quáº£n lÃ½ há»‡ thá»‘ng.</p>
          <input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Máº­t kháº©u quáº£n trá»‹" className="mt-5 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[#ED2C25]" />
          {loginError && <p className="mt-2 text-sm text-red-400">{loginError}</p>}
          <button className="mt-4 w-full rounded-md bg-[#ED2C25] py-2.5 font-bold hover:bg-red-700">ÄÄƒng nháº­p</button>
        </form>
      </div>
    );
  }

  const tabs = [
    ['dashboard', 'Tá»•ng quan', Gauge], ['events', 'Sá»± kiá»‡n', CalendarDays], ['m3u', 'Nguá»“n M3U', Radio],
    ['channels', 'KÃªnh IPTV', ListVideo], ['transcode247', 'Chuyá»ƒn mÃ£ 24/7', Cpu], ['streams', 'Luá»“ng phÃ¡t', Activity], ['system', 'Há»‡ thá»‘ng', Settings], ['security', 'Máº­t kháº©u', KeyRound],
  ];

  tabs.splice(4, 0, ['worldcup', 'World Cup', Trophy]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#090909] text-white">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[#111] px-3 md:h-16 md:px-6">
        <div className="min-w-0"><div className="truncate text-sm font-black sm:text-base">NhanChillTV Admin</div><div className="text-[11px] text-white/40 sm:text-xs">Äiá»u khiá»ƒn há»‡ thá»‘ng</div></div>
        <button onClick={logout} className="flex items-center gap-2 rounded-md p-2 text-sm text-white/60 hover:bg-white/5 hover:text-white sm:px-3" title="ÄÄƒng xuáº¥t"><LogOut size={18} /> <span className="hidden sm:inline">ÄÄƒng xuáº¥t</span></button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100vh-64px)] md:flex-row">
        <nav className="hide-scrollbar sticky top-14 z-30 flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-[#111] px-2 py-1.5 md:static md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
          {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setActiveTab(id)} className={`flex min-w-[80px] shrink-0 flex-col items-center gap-1.5 rounded-md px-3 py-2.5 text-center text-xs font-medium md:min-w-0 md:flex-row md:gap-2 md:px-3 md:py-2.5 md:text-left md:text-sm ${activeTab === id ? 'bg-[#ED2C25] text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon size={17} /> {label}</button>)}
        </nav>

        <main className="admin-scroll min-h-0 min-w-0 flex-1 overflow-y-auto p-3 pb-8 sm:p-4 md:p-6">
          {notice && <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${notice.startsWith('Lá»—i:') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>{notice}</div>}
          {activeTab === 'dashboard' && <DashboardTab health={health} status={status} sources={sources} events={events} streams={streams} busy={busy} onRefresh={() => runAction(() => adminRequest('/admin/m3u-sources/refresh', { method: 'POST' }), 'ÄÃ£ cáº­p nháº­t danh sÃ¡ch M3U.')} onRestart={() => {
            if (window.confirm('Khá»Ÿi Ä‘á»™ng láº¡i dá»‹ch vá»¥ backend vÃ  reload Nginx?')) runAction(() => adminRequest('/admin/system/restart', { method: 'POST' }), 'ÄÃ£ gá»­i lá»‡nh khá»Ÿi Ä‘á»™ng láº¡i.');
          }} />}
          {activeTab === 'events' && <EventsTab events={events} onAdd={() => setEventModal({ mode: 'create', event: null })} onEdit={event => setEventModal({ mode: 'edit', event })} onDelete={event => {
            if (window.confirm(`XÃ³a sá»± kiá»‡n "${event.title}"?`)) runAction(() => adminRequest(`/admin/events/${event.id}`, { method: 'DELETE' }), 'ÄÃ£ xÃ³a sá»± kiá»‡n.');
          }} />}
          {activeTab === 'm3u' && <M3uTab sources={sources} sourceForm={sourceForm} setSourceForm={setSourceForm} busy={busy} onAdd={event => {
            event.preventDefault();
            runAction(async () => {
              await adminRequest('/admin/m3u-sources', { method: 'POST', body: JSON.stringify(sourceForm) });
              setSourceForm({ name: '', url: '', type: 'url' });
            }, 'ÄÃ£ thÃªm nguá»“n M3U.');
          }} onToggle={source => runAction(() => adminRequest(`/admin/m3u-sources/${source.id}`, { method: 'PUT', body: JSON.stringify({ active: !source.active }) }), 'ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i nguá»“n.')} onDelete={source => {
            if (window.confirm(`XÃ³a nguá»“n "${source.name}"?`)) runAction(() => adminRequest(`/admin/m3u-sources/${source.id}`, { method: 'DELETE' }), 'ÄÃ£ xÃ³a nguá»“n M3U.');
          }} onRefresh={() => runAction(() => adminRequest('/admin/m3u-sources/refresh', { method: 'POST' }), 'ÄÃ£ cáº­p nháº­t danh sÃ¡ch M3U.')} />}
          {activeTab === 'channels' && <ChannelsTab channels={channels} settings={settings} setSettings={updater => { setSettings(updater); setSettingsDirty(true); }} search={channelSearch} setSearch={setChannelSearch} busy={busy} onSave={() => runAction(async () => { await adminRequest('/admin/iptv-settings', { method: 'POST', body: JSON.stringify(settings) }); setSettingsDirty(false); }, 'ÄÃ£ lÆ°u cáº¥u hÃ¬nh IPTV.')} />}
          {activeTab === 'worldcup' && <WorldCupStreamsTab matches={worldCupData?.games || []} channels={channels} streamsConfig={worldCupStreams} busy={busy} adminRequest={adminRequest} runAction={runAction} />}
          {activeTab === 'transcode247' && <Transcode247Tab channels={channels} settings={settings} setSettings={setSettings} busy={busy} adminRequest={adminRequest} runAction={runAction} streams={streams} />}
          {activeTab === 'streams' && <StreamsTab streams={streams} onStop={stream => runAction(() => adminRequest('/admin/active-streams/kill', { method: 'POST', body: JSON.stringify({ id: stream.id }) }), 'ÄÃ£ dá»«ng luá»“ng phÃ¡t.')} />}
          {activeTab === 'system' && <SystemTab settings={systemSettings} setSettings={setSystemSettings} busy={busy} onSave={() => runAction(async () => { await adminRequest('/admin/system-settings', { method: 'POST', body: JSON.stringify(systemSettings) }); }, 'ÄÃ£ lÆ°u cáº¥u hÃ¬nh há»‡ thá»‘ng.')} />}
          {activeTab === 'security' && <PasswordTab busy={busy} onChange={changeAdminPassword} />}
        </main>
      </div>

      {eventModal && <EventModal event={eventModal.event} channels={channels} token={token} onClose={() => setEventModal(null)} onSaved={() => { setEventModal(null); loadData(); setNotice('ÄÃ£ lÆ°u sá»± kiá»‡n.'); }} />}
    </div>
  );
}

function DashboardTab({ health, status, sources, events, streams, busy, onRefresh, onRestart }) {
  const cpuPercent = Number(health?.cpuLoad?.currentLoad || 0);
  const memoryPercent = Number(health?.memory?.usedPercent || 0);
  const cards = [
    ['KÃªnh IPTV', status?.channelsCount ?? 0, ListVideo], ['Nguá»“n Ä‘ang báº­t', sources.filter(source => source.active).length, Server],
    ['Sá»± kiá»‡n', events.length, CalendarDays], ['Luá»“ng FFmpeg', streams.length, Activity],
  ];
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold sm:text-2xl">Tá»•ng quan</h1><p className="text-xs text-white/45 sm:text-sm">Tráº¡ng thÃ¡i backend vÃ  dá»¯ liá»‡u IPTV.</p></div><div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><button disabled={busy} onClick={onRefresh} className="flex items-center justify-center gap-2 rounded-md bg-white/10 px-2 py-2 text-xs hover:bg-white/15 sm:px-3 sm:text-sm"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Cáº­p nháº­t M3U</button><button onClick={onRestart} className="flex items-center justify-center gap-2 rounded-md border border-red-500/30 px-2 py-2 text-xs text-red-300 hover:bg-red-500/10 sm:px-3 sm:text-sm"><RotateCcw size={16} /> Khá»Ÿi Ä‘á»™ng láº¡i</button></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-white/8 bg-[#151515] p-3 sm:p-4"><Icon size={18} className="mb-2 text-[#ED2C25] sm:mb-3" /><div className="text-xl font-black sm:text-2xl">{value}</div><div className="truncate text-[11px] text-white/45 sm:text-xs">{label}</div></div>)}</div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Tài nguyên realtime">
          <MetricBar label="CPU" value={cpuPercent} detail={`${cpuPercent.toFixed(1)}%`} />
          <MetricBar label="RAM" value={memoryPercent} detail={`${memoryPercent.toFixed(1)}% · ${formatBytes(health?.memory?.used)} / ${formatBytes(health?.memory?.total)}`} />
          <InfoRow label="Bộ nhớ trống" value={formatBytes(health?.memory?.free)} />
          <InfoRow label="Chế độ" value={health?.mode || '--'} />
          <InfoRow label="FFmpeg" value={health?.ffmpegAvailable ? 'Sẵn sàng' : 'Không tìm thấy'} />
        </Panel>
        <Panel title="Cập nhật M3U"><InfoRow label="Lần cập nhật" value={status?.lastRefreshAt ? new Date(status.lastRefreshAt).toLocaleString('vi-VN') : 'Chưa có'} /><InfoRow label="Trạng thái" value={status?.isRefreshing ? 'Đang cập nhật' : 'Sẵn sàng'} /><InfoRow label="Chu kỳ" value="1 giờ/lần" />{status?.lastError && <div className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-300">{status.lastError}</div>}</Panel>
      </div>
    </section>
  );
}

function EventsTab({ events, onAdd, onEdit, onDelete }) {
  return <section><SectionHeader title="Sá»± kiá»‡n" subtitle="Quáº£n lÃ½ nguá»“n phÃ¡t vÃ  Cbox trÃªn trang sá»± kiá»‡n" action={<button onClick={onAdd} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-3 py-2 text-sm font-bold"><Plus size={16} /> ThÃªm sá»± kiá»‡n</button>} />
    <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">{events.length ? events.map(event => <div key={event.id} className="flex flex-col gap-3 border-b border-white/5 p-4 last:border-0 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="truncate font-bold">{event.title}</div><div className="mt-1 text-xs text-white/45">{event.startAt || event.time ? new Date(event.startAt || event.time).toLocaleString('vi-VN') : 'ChÆ°a Ä‘áº·t thá»i gian'}{event.endAt ? ` â†’ ${new Date(event.endAt).toLocaleString('vi-VN')}` : ''} Â· {(event.streams?.length || 1)} luá»“ng Â· {event.status || 'upcoming'}</div></div><div className="flex gap-2"><button onClick={() => onEdit(event)} className="rounded-md bg-white/5 p-2 hover:bg-white/10" title="Sá»­a"><Pencil size={16} /></button><button onClick={() => onDelete(event)} className="rounded-md bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20" title="XÃ³a"><Trash2 size={16} /></button></div></div>) : <Empty text="ChÆ°a cÃ³ sá»± kiá»‡n." />}</div>
  </section>;
}

function M3uTab({ sources, sourceForm, setSourceForm, busy, onAdd, onToggle, onDelete, onRefresh }) {
  return <section><SectionHeader title="Nguá»“n M3U" subtitle="Danh sÃ¡ch Ä‘Æ°á»£c táº£i láº¡i tá»± Ä‘á»™ng má»—i giá»" action={<button disabled={busy} onClick={onRefresh} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Táº£i láº¡i</button>} />
    <form onSubmit={onAdd} className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 md:grid-cols-[1fr_2fr_auto]"><input required value={sourceForm.name} onChange={event => setSourceForm({ ...sourceForm, name: event.target.value })} placeholder="TÃªn nguá»“n" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 outline-none focus:border-[#ED2C25]" /><input required value={sourceForm.url} onChange={event => setSourceForm({ ...sourceForm, url: event.target.value })} placeholder="https://.../list.m3u" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 outline-none focus:border-[#ED2C25]" /><button disabled={busy} className="flex items-center justify-center gap-2 rounded-md bg-[#ED2C25] px-4 py-2 font-bold"><Plus size={16} /> ThÃªm</button></form>
    <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">{sources.length ? sources.map(source => <div key={source.id} className="flex flex-col gap-3 border-b border-white/5 p-4 last:border-0 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-bold"><span className={`h-2 w-2 rounded-full ${source.active ? 'bg-green-400' : 'bg-white/25'}`} />{source.name}</div><div className="mt-1 truncate text-xs text-white/40">{source.url}</div></div><button onClick={() => onToggle(source)} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm">{source.active ? <Eye size={16} /> : <EyeOff size={16} />}{source.active ? 'Äang báº­t' : 'Äang táº¯t'}</button><button onClick={() => onDelete(source)} className="rounded-md bg-red-500/10 p-2 text-red-300" title="XÃ³a"><Trash2 size={16} /></button></div>) : <Empty text="ChÆ°a cÃ³ nguá»“n M3U." />}</div>
  </section>;
}

function ChannelsTab({ channels, settings, setSettings, search, setSearch, busy, onSave }) {
  const groups = [...new Set(channels.map(channel => channel.group).filter(Boolean))];
  const orderedGroups = [...settings.groupOrder.filter(group => groups.includes(group)), ...groups.filter(group => !settings.groupOrder.includes(group))];
  const visibleChannels = channels.filter(channel => `${channel.name} ${channel.group}`.toLowerCase().includes(search.toLowerCase())).slice(0, 300);
  const toggle = (key, value) => setSettings(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
  const moveGroup = (index, direction) => {
    const next = [...orderedGroups];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSettings(current => ({ ...current, groupOrder: next }));
  };
  const updateCustomLogo = (channelId, logoUrl) => {
    setSettings(current => {
      const nextLogos = { ...(current.customLogos || {}) };
      if (logoUrl.trim()) {
        nextLogos[channelId] = logoUrl.trim();
      } else {
        delete nextLogos[channelId];
      }
      return { ...current, customLogos: nextLogos };
    });
  };
  return <section><SectionHeader title="KÃªnh IPTV" subtitle={`${channels.length} kÃªnh Ä‘Ã£ náº¡p`} action={<button disabled={busy} onClick={onSave} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-3 py-2 text-sm font-bold"><Save size={16} /> LÆ°u cáº¥u hÃ¬nh</button>} />
    <div className="mt-5 grid gap-4 xl:grid-cols-[310px_1fr]"><Panel title="Thá»© tá»± nhÃ³m"><div className="max-h-[460px] overflow-y-auto pr-1">{orderedGroups.map((group, index) => <div key={group} className="flex h-9 items-center gap-1 border-b border-white/5 last:border-0"><span className="w-6 text-center text-[10px] text-white/30">{index + 1}</span><button onClick={() => toggle('hiddenGroups', group)} className={`rounded p-1 ${settings.hiddenGroups.includes(group) ? 'text-white/30' : 'text-green-400'}`}>{settings.hiddenGroups.includes(group) ? <EyeOff size={15} /> : <Eye size={15} />}</button><span className="min-w-0 flex-1 truncate text-xs">{group}</span><button disabled={index === 0} onClick={() => moveGroup(index, -1)} className="rounded p-1 hover:bg-white/5 disabled:opacity-20"><ChevronUp size={14} /></button><button disabled={index === orderedGroups.length - 1} onClick={() => moveGroup(index, 1)} className="rounded p-1 hover:bg-white/5 disabled:opacity-20"><ChevronDown size={14} /></button></div>)}</div></Panel>
      <Panel title="KÃªnh"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="TÃ¬m kÃªnh..." className="mb-3 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-[#ED2C25]" /><div className="max-h-[560px] overflow-y-auto flex flex-col gap-2">{visibleChannels.map(channel => {
        const customLogoVal = settings.customLogos?.[channel.id] || '';
        return (
          <div key={channel.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm gap-2 sm:gap-3">
            <label className="flex cursor-pointer items-center gap-2 min-w-0 flex-1">
              <input type="checkbox" checked={!settings.hiddenChannels.includes(channel.id)} onChange={() => toggle('hiddenChannels', channel.id)} className="shrink-0" />
              <img src={channel.logo || '/poster.jpg'} className="h-7 w-10 object-contain bg-black/20 rounded shrink-0" alt="" />
              <span className="min-w-0 flex-1 truncate">{channel.name}</span>
              <span className="hidden text-xs text-white/35 sm:block shrink-0">{channel.group}</span>
            </label>
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                placeholder="Custom Logo URL"
                value={customLogoVal}
                onChange={(e) => updateCustomLogo(channel.id, e.target.value)}
                className="rounded border border-white/10 bg-black/35 px-2 py-1 text-xs outline-none focus:border-[#ED2C25] w-24 sm:w-48"
              />
            </div>
          </div>
        );
      })}</div></Panel></div>
  </section>;
}

function StreamsTab({ streams, onStop }) {
  return <section><SectionHeader title="Quáº£n lÃ½ Stream" subtitle="CÃ¡c luá»“ng phÃ¡t IPTV vÃ  OBS Ä‘ang hoáº¡t Ä‘á»™ng trÃªn há»‡ thá»‘ng" />
    <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">{streams.length ? streams.map(stream => <div key={stream.id} className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0"><Activity size={18} className={stream.type === 'obs' ? "text-[#ED2C25]" : "text-green-400"} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{stream.name}</div><div className="text-xs text-white/40">ID: {stream.id} {stream.pid ? `Â· PID: ${stream.pid}` : ''} Â· Hoáº¡t Ä‘á»™ng: {new Date(stream.lastActive).toLocaleTimeString('vi-VN')}</div></div><button onClick={() => onStop(stream)} className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"><CircleStop size={16} /> Dá»«ng</button></div>) : <Empty text="KhÃ´ng cÃ³ luá»“ng phÃ¡t nÃ o Ä‘ang hoáº¡t Ä‘á»™ng." />}</div>
  </section>;
}

function SystemTab({ settings, setSettings, busy, onSave }) {
  return <section><SectionHeader title="Cáº¥u hÃ¬nh há»‡ thá»‘ng" subtitle="CÃ i Ä‘áº·t chung cho toÃ n bá»™ website" action={<button disabled={busy} onClick={onSave} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-3 py-2 text-sm font-bold"><Save size={16} /> LÆ°u cáº¥u hÃ¬nh</button>} />
    <div className="mt-5 max-w-2xl space-y-4 rounded-lg border border-white/10 bg-[#151515] p-5">
      <Field label="Cháº¿ Ä‘á»™ báº£o trÃ¬">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-[#ED2C25]" checked={settings.maintenanceMode || false} onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })} />
          <span>Báº­t cháº¿ Ä‘á»™ báº£o trÃ¬ (Cháº·n ngÆ°á»i dÃ¹ng truy cáº­p website)</span>
        </label>
      </Field>
      <div className="border-t border-white/10 my-4"></div>
      <Field label="TrÃ¬nh phÃ¡t máº·c Ä‘á»‹nh">
        <select value={settings.playerType || 'shaka'} onChange={e => setSettings({ ...settings, playerType: e.target.value })} className="input-admin mt-1">
          <option value="shaka">Unified Player (Shaka Player - Máº·c Ä‘á»‹nh)</option>
          <option value="legacy">Legacy Player (Video.js - Dá»± phÃ²ng lá»—i Shaka)</option>
        </select>
        <p className="text-xs text-white/50 mt-2">Chá»n Legacy Player náº¿u nhiá»u phim OPhim hoáº·c kÃªnh TV bÃ¡o lá»—i Shaka 6012.</p>
      </Field>
    </div>
  </section>;
}

function PasswordTab({ busy, onChange }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const submit = event => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return alert('Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.');
    if (newPassword.length < 8) return alert('Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 8 kÃ½ tá»±.');
    onChange(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };
  return <section><SectionHeader title="Äá»•i máº­t kháº©u admin" subtitle="PhiÃªn Ä‘Äƒng nháº­p cÅ© sáº½ bá»‹ vÃ´ hiá»‡u hÃ³a sau khi Ä‘á»•i máº­t kháº©u" />
    <form onSubmit={submit} className="mt-5 max-w-lg space-y-4 rounded-lg border border-white/10 bg-[#151515] p-5">
      <Field label="Máº­t kháº©u hiá»‡n táº¡i"><input required type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="input-admin" /></Field>
      <Field label="Máº­t kháº©u má»›i"><input required minLength="8" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="input-admin" /></Field>
      <Field label="Nháº­p láº¡i máº­t kháº©u má»›i"><input required minLength="8" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="input-admin" /></Field>
      <button disabled={busy} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-4 py-2 font-bold disabled:opacity-50"><KeyRound size={16} /> Äá»•i máº­t kháº©u</button>
    </form>
  </section>;
}

function EventModal({ event, channels, token, onClose, onSaved }) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(() => {
    const startAt = event?.startAt || event?.time || new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endAt = event?.endAt || new Date(new Date(startAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
    const legacyStream = {
      id: 'primary', name: event?.streamName || 'Luá»“ng chÃ­nh', sourceType: event?.sourceType || 'iptv',
      sourceChannelId: event?.sourceChannelId || '', stream: event?.stream || '', streamKey: event?.streamKey || '',
    };
    return {
      title: '', description: '', startAt, endAt, thumbnailBase64: '', isPinned: false,
      ...(event || {}), streams: event?.streams?.length ? event.streams : [legacyStream],
    };
  });
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const readImage = useCallback(file => {
    if (!file?.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Compress to WebP format with 0.8 quality
        const webpBase64 = canvas.toDataURL('image/webp', 0.8);
        setForm(current => ({ ...current, thumbnailBase64: webpBase64 }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    const paste = pasteEvent => {
      const file = [...(pasteEvent.clipboardData?.files || [])].find(item => item.type.startsWith('image/'));
      if (file) readImage(file);
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [readImage]);

  const localParts = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: '', time: '' };
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
    return { date: local.slice(0, 10), time: local.slice(11, 16) };
  };
  const updateSchedule = (key, part, value) => {
    const current = localParts(form[key]);
    const nextDate = part === 'date' ? value : current.date;
    const nextTime = part === 'time' ? value : current.time;
    if (nextDate && nextTime) setForm(previous => ({ ...previous, [key]: new Date(`${nextDate}T${nextTime}:00`).toISOString() }));
  };
  const updateStream = (index, changes) => setForm(current => ({ ...current, streams: current.streams.map((stream, streamIndex) => streamIndex === index ? { ...stream, ...changes } : stream) }));
  const addStream = () => setForm(current => ({ ...current, streams: [...current.streams, { id: `stream_${Date.now()}`, name: `Luá»“ng ${current.streams.length + 1}`, sourceType: 'obs', sourceChannelId: '', stream: '', streamKey: '' }] }));
  const removeStream = index => setForm(current => ({ ...current, streams: current.streams.filter((_, streamIndex) => streamIndex !== index) }));

  const submit = async submitEvent => {
    submitEvent.preventDefault();
    if (!form.streams.length) return alert('Sá»± kiá»‡n pháº£i cÃ³ Ã­t nháº¥t má»™t luá»“ng.');
    if (new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) return alert('Giá» káº¿t thÃºc pháº£i sau giá» báº¯t Ä‘áº§u.');
    setSaving(true);
    try {
      const response = await fetch(event ? `${API_BASE}/admin/events/${event.id}` : `${API_BASE}/admin/events`, { method: event ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      onSaved();
    } catch (err) { alert(`KhÃ´ng thá»ƒ lÆ°u sá»± kiá»‡n: ${err.message}`); } finally { setSaving(false); }
  };
  const start = localParts(form.startAt);
  const end = localParts(form.endAt);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 sm:p-3 md:p-5"><form onSubmit={submit} className="flex h-[100dvh] max-h-none w-full max-w-4xl flex-col overflow-hidden bg-[#151515] sm:h-auto sm:max-h-[94vh] sm:rounded-lg sm:border sm:border-white/10"><div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4"><div className="min-w-0 pr-3"><h2 className="truncate font-bold">{event ? 'Sá»­a sá»± kiá»‡n' : 'ThÃªm sá»± kiá»‡n'}</h2><p className="truncate text-[11px] text-white/40 sm:text-xs">Tráº¡ng thÃ¡i tá»± chuyá»ƒn theo giá» báº¯t Ä‘áº§u vÃ  káº¿t thÃºc</p></div><button type="button" onClick={onClose} className="rounded p-2 hover:bg-white/10"><X size={19} /></button></div><div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2 md:gap-5 md:p-5">
    <Field label="TÃªn sá»± kiá»‡n"><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-admin" /></Field>
    <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={Boolean(form.isPinned)} onChange={e => setForm({ ...form, isPinned: e.target.checked })} /> Ghim sá»± kiá»‡n lÃªn hero</label>
    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-[1fr_120px]"><Field label="NgÃ y báº¯t Ä‘áº§u"><input required type="date" value={start.date} onChange={e => updateSchedule('startAt', 'date', e.target.value)} className="input-admin [color-scheme:dark]" /></Field><Field label="Giá» báº¯t Ä‘áº§u"><input required type="time" value={start.time} onChange={e => updateSchedule('startAt', 'time', e.target.value)} className="input-admin [color-scheme:dark]" /></Field></div>
    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-[1fr_120px]"><Field label="NgÃ y káº¿t thÃºc"><input required type="date" value={end.date} onChange={e => updateSchedule('endAt', 'date', e.target.value)} className="input-admin [color-scheme:dark]" /></Field><Field label="Giá» káº¿t thÃºc"><input required type="time" value={end.time} onChange={e => updateSchedule('endAt', 'time', e.target.value)} className="input-admin [color-scheme:dark]" /></Field></div>
    <div className="md:col-span-2"><Field label="MÃ´ táº£"><textarea rows="3" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="input-admin resize-none" /></Field></div>
    <div className="md:col-span-2"><input ref={fileInputRef} type="file" accept="image/*" onChange={e => readImage(e.target.files?.[0])} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragOver={e => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); readImage(e.dataTransfer.files?.[0]); }} className={`flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center sm:min-h-32 sm:flex-row sm:gap-4 sm:text-left ${dragging ? 'border-[#ED2C25] bg-[#ED2C25]/10' : 'border-white/20 bg-black/20 hover:border-white/40'}`}>{form.thumbnailBase64 || form.thumbnailUrl ? <img src={form.thumbnailBase64 || form.thumbnailUrl} alt="Thumbnail" className="aspect-video h-20 rounded object-cover sm:h-24" /> : <UploadCloud size={30} className="text-[#ED2C25]" />}<span><strong className="block text-sm">Thumbnail sá»± kiá»‡n</strong><span className="text-xs text-white/45">Báº¥m chá»n, kÃ©o áº£nh vÃ o Ä‘Ã¢y hoáº·c Ctrl + V</span></span></button></div>
    <div className="md:col-span-2"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold">CÃ¡c luá»“ng phÃ¡t</h3><p className="text-xs text-white/45">NgÆ°á»i xem cÃ³ thá»ƒ chuyá»ƒn giá»¯a cÃ¡c luá»“ng nÃ y</p></div><button type="button" onClick={addStream} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm"><Plus size={15} /> ThÃªm luá»“ng</button></div><div className="space-y-3">{form.streams.map((stream, index) => <div key={stream.id || index} className="rounded-lg border border-white/10 bg-black/20 p-4"><div className="grid gap-3 md:grid-cols-[1fr_170px_auto]"><Field label="TÃªn hiá»ƒn thá»‹"><input required value={stream.name || ''} onChange={e => updateStream(index, { name: e.target.value })} className="input-admin" placeholder="Luá»“ng tiáº¿ng gá»‘c" /></Field><Field label="Loáº¡i nguá»“n"><select value={stream.sourceType} onChange={e => updateStream(index, { sourceType: e.target.value })} className="input-admin"><option value="obs">OBS / vMix</option><option value="iptv">KÃªnh IPTV</option><option value="custom">URL tÃ¹y chá»n</option></select></Field><button type="button" disabled={form.streams.length === 1} onClick={() => removeStream(index)} className="mt-2 md:mt-6 flex items-center justify-center gap-2 w-full md:w-auto rounded-md bg-red-500/10 p-2.5 text-red-300 hover:bg-red-500/20 disabled:opacity-20" title="XÃ³a luá»“ng"><Trash2 size={17} /><span className="md:hidden text-xs">XÃ³a luá»“ng</span></button></div>{stream.sourceType === 'iptv' && <div className="mt-3"><Field label="KÃªnh IPTV"><select required value={stream.sourceChannelId || ''} onChange={e => updateStream(index, { sourceChannelId: e.target.value })} className="input-admin"><option value="">Chá»n kÃªnh</option>{channels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></Field></div>}{stream.sourceType === 'custom' && <div className="mt-3"><Field label="URL M3U8 / MPD"><input required value={stream.stream || ''} onChange={e => updateStream(index, { stream: e.target.value })} className="input-admin" placeholder="https://..." /></Field></div>}{stream.sourceType === 'obs' && <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><Field label="Stream key"><input value={stream.streamKey || ''} onChange={e => updateStream(index, { streamKey: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} className="input-admin" placeholder="Äá»ƒ trá»‘ng Ä‘á»ƒ server tá»± táº¡o" /></Field>{stream.streamKey && <button type="button" onClick={() => navigator.clipboard?.writeText(stream.streamKey)} className="mt-6 flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs"><Copy size={14} /> Copy</button>}</div>}</div>)}</div></div>
  </div><div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 px-4 py-3 sm:flex sm:justify-end sm:px-5 sm:py-4"><button type="button" onClick={onClose} className="rounded-md px-4 py-2 hover:bg-white/5">Há»§y</button><button disabled={saving} className="rounded-md bg-[#ED2C25] px-5 py-2 font-bold disabled:opacity-50">{saving ? 'Äang lÆ°u...' : 'LÆ°u sá»± kiá»‡n'}</button></div></form></div>;
}

function WorldCupStreamsTab({ matches, channels, streamsConfig, busy, adminRequest, runAction }) {
  const sortedMatches = useMemo(() => [...matches].sort((a, b) => new Date(a.kickoffAt || 0) - new Date(b.kickoffAt || 0)), [matches]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [form, setForm] = useState({ name: '', sourceType: 'iptv', sourceChannelId: '', stream: '' });

  useEffect(() => {
    if (!selectedMatchId && sortedMatches[0]?.id) setSelectedMatchId(String(sortedMatches[0].id));
  }, [selectedMatchId, sortedMatches]);

  const hlsChannels = useMemo(() => channels.filter(channel => String(channel.url || '').toLowerCase().includes('.m3u8')), [channels]);
  const selectedMatch = sortedMatches.find(match => String(match.id) === String(selectedMatchId));
  const customStreams = streamsConfig?.matchStreams?.[String(selectedMatchId)] || [];
  const submit = event => {
    event.preventDefault();
    runAction(async () => {
      await adminRequest(`/admin/worldcup-streams/${encodeURIComponent(selectedMatchId)}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ name: '', sourceType: 'iptv', sourceChannelId: '', stream: '' });
    }, 'ÄÃ£ thÃªm luá»“ng World Cup.');
  };

  return (
    <section>
      <SectionHeader title="World Cup" subtitle="Luá»“ng máº·c Ä‘á»‹nh: VTV3, VTV6, VTV9, VTV10 tá»« M3U vÃ  chá»‰ nháº­n nguá»“n M3U8." />
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(280px,380px)_1fr]">
        <Panel title="Chá»n tráº­n">
          <select value={selectedMatchId} onChange={event => setSelectedMatchId(event.target.value)} className="input-admin">
            {sortedMatches.map(match => (
              <option key={match.id} value={match.id}>
                #{match.id} {match.home_team_display} vs {match.away_team_display} - {match.kickoffAtVN || 'GMT+7'}
              </option>
            ))}
          </select>
          {selectedMatch && (
            <div className="mt-4 rounded-md bg-black/25 p-3 text-sm text-white/60">
              <div className="font-bold text-white">{selectedMatch.home_team_display} vs {selectedMatch.away_team_display}</div>
              <div className="mt-1 text-xs">{selectedMatch.stage_vi}{selectedMatch.group ? ` - Báº£ng ${selectedMatch.group}` : ''}</div>
              <div className="mt-1 text-xs">{selectedMatch.kickoffAtVN || 'Äang cáº­p nháº­t giá» Viá»‡t Nam'}</div>
              <a href={`/tv/?matchId=${encodeURIComponent(selectedMatch.id)}`} className="mt-3 inline-flex rounded-md bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">Má»Ÿ trang tráº­n Ä‘áº¥u</a>
            </div>
          )}
        </Panel>

        <Panel title="ThÃªm luá»“ng bá»• sung">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_160px]">
            <Field label="TÃªn luá»“ng"><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="input-admin" placeholder="Luá»“ng bÃ¬nh luáº­n riÃªng" /></Field>
            <Field label="Loáº¡i nguá»“n"><select value={form.sourceType} onChange={event => setForm({ ...form, sourceType: event.target.value })} className="input-admin"><option value="iptv">KÃªnh IPTV</option><option value="custom">URL M3U8</option></select></Field>
            {form.sourceType === 'iptv' ? (
              <div className="md:col-span-2"><Field label="KÃªnh IPTV M3U8"><select required value={form.sourceChannelId} onChange={event => setForm({ ...form, sourceChannelId: event.target.value })} className="input-admin"><option value="">Chá»n kÃªnh</option>{hlsChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.name} ({channel.id})</option>)}</select></Field></div>
            ) : (
              <div className="md:col-span-2"><Field label="URL M3U8"><input required value={form.stream} onChange={event => setForm({ ...form, stream: event.target.value })} className="input-admin" placeholder="https://.../index.m3u8" /></Field></div>
            )}
            <button disabled={busy || !selectedMatchId} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ED2C25] px-4 py-2 font-bold disabled:opacity-50 md:col-span-2"><Plus size={16} /> ThÃªm luá»“ng</button>
          </form>
        </Panel>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">
        {customStreams.length ? customStreams.map(stream => (
          <div key={stream.id} className="flex flex-col gap-3 border-b border-white/5 p-4 last:border-0 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{stream.name}</div>
              <div className="mt-1 truncate text-xs text-white/40">{stream.sourceType === 'iptv' ? `IPTV: ${stream.sourceChannelId}` : stream.stream}</div>
            </div>
            <button onClick={() => runAction(() => adminRequest(`/admin/worldcup-streams/${encodeURIComponent(selectedMatchId)}/${encodeURIComponent(stream.id)}`, { method: 'DELETE' }), 'ÄÃ£ xÃ³a luá»“ng World Cup.')} className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"><Trash2 size={16} /> XÃ³a</button>
          </div>
        )) : <Empty text="ChÆ°a cÃ³ luá»“ng bá»• sung cho tráº­n nÃ y. Bá»‘n luá»“ng VTV máº·c Ä‘á»‹nh váº«n tá»± Ã¡p dá»¥ng náº¿u M3U cÃ³ nguá»“n M3U8." />}
      </div>
    </section>
  );
}

function Transcode247Tab({ channels, settings, setSettings, busy, adminRequest, runAction, streams }) {
  const [search, setSearch] = useState('');
  const transcode247List = settings.transcode247 || [];

  const suggestedChannels = useMemo(() => {
    return channels.filter(ch => ch.isUdpxyMp2 || ch.audioCodec === 'mp2');
  }, [channels]);

  const otherChannels = useMemo(() => {
    return channels.filter(ch =>
      !ch.isUdpxyMp2 &&
      ch.audioCodec !== 'mp2' &&
      ch.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [channels, search]);

  const handleToggle247 = async (channelId) => {
    await runAction(async () => {
      const res = await adminRequest('/admin/iptv-settings/transcode247/toggle', {
        method: 'POST',
        body: JSON.stringify({ channelId })
      });
      if (res.success) {
        setSettings(prev => ({ ...prev, transcode247: res.data }));
      }
    }, 'ÄÃ£ cáº­p nháº­t cáº¥u hÃ¬nh chuyá»ƒn mÃ£ 24/7.');
  };

  return (
    <section>
      <SectionHeader
        title="Chuyá»ƒn mÃ£ 24/7"
        subtitle="Quáº£n lÃ½ cÃ¡c kÃªnh IPTV tá»± Ä‘á»™ng chuyá»ƒn mÃ£ liÃªn tá»¥c 24/7 (Äáº·c biá»‡t dÃ nh cho cÃ¡c kÃªnh Udpxy & MP2 audio)"
      />

      <div className="mt-5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
        <p className="font-semibold flex items-center gap-2">
          <Cpu size={16} /> LÆ°u Ã½ tá»‘i Æ°u hÃ³a VPS:
        </p>
        <p className="mt-1 text-white/70 text-xs">
          Há»‡ thá»‘ng cháº¡y chuyá»ƒn mÃ£ 24/7 trá»±c tiáº¿p trÃªn á»• cá»©ng vÃ  tá»± Ä‘á»™ng giá»›i háº¡n chá»‰ giá»¯ láº¡i tá»‘i Ä‘a 4 segment HLS (~8 giÃ¢y bá»™ Ä‘á»‡m, dung lÆ°á»£ng &lt; 5MB/kÃªnh).
          KhÃ´ng sá»­ dá»¥ng RAM Disk giÃºp tiáº¿t kiá»‡m tá»‘i Ä‘a tÃ i nguyÃªn cho VPS cÃ³ cáº¥u hÃ¬nh RAM tháº¥p (1GB).
        </p>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-green-400" />
          KÃªnh Udpxy & MP2 PhÃ¡t Hiá»‡n ÄÆ°á»£c ({suggestedChannels.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestedChannels.length > 0 ? (
            suggestedChannels.map(ch => {
              const isActive = transcode247List.includes(ch.id);
              const isRunning = streams.some(s => s.id === ch.id);
              return (
                <div key={ch.id} className="rounded-lg border border-white/10 bg-[#151515] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <img src={ch.logo || '/poster.jpg'} className="h-8 w-12 object-contain rounded bg-black/20" alt="" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-sm">{ch.name}</div>
                        <div className="text-xs text-white/40 truncate">{ch.group}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                        Codec: {ch.videoCodec || 'h264'} / {ch.audioCodec || 'mp2'}
                      </span>
                      {isRunning && (
                        <span className="rounded bg-green-500/20 px-2 py-0.5 text-[10px] text-green-300 font-medium animate-pulse">
                          Äang cháº¡y (Active)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-white/60">Chuyá»ƒn mÃ£ 24/7</span>
                    <button
                      disabled={busy}
                      onClick={() => handleToggle247(ch.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isActive ? 'bg-[#ED2C25]' : 'bg-white/10'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="sm:col-span-2 lg:col-span-3">
              <Empty text="KhÃ´ng phÃ¡t hiá»‡n kÃªnh udpxy/MP2 nÃ o cáº§n transcode." />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3">Táº¥t cáº£ cÃ¡c kÃªnh khÃ¡c</h2>
        <div className="rounded-lg border border-white/10 bg-[#151515] p-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="TÃ¬m kiáº¿m kÃªnh IPTV khÃ¡c Ä‘á»ƒ cáº¥u hÃ¬nh..."
            className="mb-4 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-[#ED2C25]"
          />
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
            {otherChannels.slice(0, 100).map(ch => {
              const isActive = transcode247List.includes(ch.id);
              const isRunning = streams.some(s => s.id === ch.id);
              return (
                <div key={ch.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={ch.logo || '/poster.jpg'} className="h-7 w-10 object-contain rounded" alt="" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-xs">{ch.name}</div>
                      <div className="text-[10px] text-white/45 truncate">{ch.group}</div>
                    </div>
                    {isRunning && (
                      <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] text-green-300 font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => handleToggle247(ch.id)}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      isActive
                        ? 'bg-[#ED2C25] text-white'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {isActive ? 'Táº¯t 24/7' : 'Báº­t 24/7'}
                  </button>
                </div>
              );
            })}
            {otherChannels.length === 0 && <Empty text="KhÃ´ng tÃ¬m tháº¥y kÃªnh nÃ o." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle, action }) { return <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">{title}</h1><p className="text-xs text-white/45 sm:text-sm">{subtitle}</p></div>{action && <div className="w-full sm:w-auto [&>button]:w-full [&>button]:justify-center sm:[&>button]:w-auto">{action}</div>}</div>; }
function Panel({ title, children }) { return <div className="rounded-lg border border-white/10 bg-[#151515] p-4"><h2 className="mb-3 font-bold">{title}</h2>{children}</div>; }
function MetricBar({ label, value, detail }) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  return <div className="mb-3"><div className="mb-1 flex items-center justify-between text-sm"><span className="text-white/55">{label}</span><span className="font-bold text-white">{detail}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ED2C25] transition-[width] duration-500" style={{ width: `${percent}%` }} /></div></div>;
}
function InfoRow({ label, value }) { return <div className="flex justify-between border-b border-white/5 py-2 text-sm last:border-0"><span className="text-white/45">{label}</span><span>{value}</span></div>; }
function Empty({ text }) { return <div className="p-10 text-center text-sm text-white/45">{text}</div>; }
function Field({ label, children }) { return <label className="block text-sm"><span className="mb-1.5 block text-white/55">{label}</span>{children}</label>; }
function formatBytes(value) { const bytes = Number(value || 0); if (!bytes) return '--'; return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`; }
