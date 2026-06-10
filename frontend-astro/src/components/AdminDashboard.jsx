import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarDays, ChevronDown, ChevronUp, CircleStop, Eye, EyeOff,
  Gauge, ListVideo, LogOut, Pencil, Plus, Radio, RefreshCw, RotateCcw,
  KeyRound, Save, Server, Settings, Trash2, X,
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
  const [status, setStatus] = useState(null);
  const [streams, setStreams] = useState([]);
  const [health, setHealth] = useState(null);
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
      throw new Error('Phiên quản trị đã hết hạn.');
    }
    if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }, [logout, token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    const requests = await Promise.allSettled([
      fetch(`${API_BASE}/admin/events`).then(response => response.json()),
      adminRequest('/admin/m3u-sources'),
      adminRequest('/admin/iptv-settings'),
      adminRequest('/admin/iptv-channels'),
      adminRequest('/admin/status'),
      fetch(`${API_BASE}/stream/active`).then(response => response.json()),
      fetch(`${API_BASE}/health`).then(response => response.json()),
    ]);
    if (requests[0].status === 'fulfilled') setEvents(requests[0].value.data || []);
    if (requests[1].status === 'fulfilled') setSources(requests[1].value.data || []);
    if (requests[2].status === 'fulfilled' && !settingsDirty) setSettings(requests[2].value.data || { hiddenGroups: [], hiddenChannels: [], groupOrder: [] });
    if (requests[3].status === 'fulfilled') setChannels(requests[3].value.data || []);
    if (requests[4].status === 'fulfilled') setStatus(requests[4].value.data || null);
    if (requests[5].status === 'fulfilled') setStreams(requests[5].value.data || []);
    if (requests[6].status === 'fulfilled') setHealth(requests[6].value || null);
  }, [adminRequest, settingsDirty, token]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, [loadData, token]);

  const login = async event => {
    event.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Sai mật khẩu');
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
      setNotice(`Lỗi: ${err.message}`);
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
      setNotice('Đã đổi mật khẩu quản trị.');
    } catch (err) {
      setNotice(`Lỗi: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909] p-4 text-white">
        <form onSubmit={login} className="w-full max-w-sm rounded-lg border border-white/10 bg-[#151515] p-6">
          <h1 className="text-xl font-bold">Quản trị NhanChillTV</h1>
          <p className="mt-1 text-sm text-white/50">Đăng nhập để quản lý hệ thống.</p>
          <input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mật khẩu quản trị" className="mt-5 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[#ED2C25]" />
          {loginError && <p className="mt-2 text-sm text-red-400">{loginError}</p>}
          <button className="mt-4 w-full rounded-md bg-[#ED2C25] py-2.5 font-bold hover:bg-red-700">Đăng nhập</button>
        </form>
      </div>
    );
  }

  const tabs = [
    ['dashboard', 'Tổng quan', Gauge], ['events', 'Sự kiện', CalendarDays], ['m3u', 'Nguồn M3U', Radio],
    ['channels', 'Kênh IPTV', ListVideo], ['streams', 'Luồng phát', Activity], ['security', 'Mật khẩu', KeyRound],
  ];

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#111] px-4 md:px-6">
        <div><div className="font-black">NhanChillTV Admin</div><div className="text-xs text-white/40">Điều khiển hệ thống</div></div>
        <button onClick={logout} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"><LogOut size={17} /> Đăng xuất</button>
      </header>

      <div className="flex min-h-[calc(100vh-64px)] flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-[#111] p-2 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
          {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium ${activeTab === id ? 'bg-[#ED2C25] text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon size={17} /> {label}</button>)}
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          {notice && <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${notice.startsWith('Lỗi:') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>{notice}</div>}
          {activeTab === 'dashboard' && <DashboardTab health={health} status={status} sources={sources} events={events} streams={streams} busy={busy} onRefresh={() => runAction(() => adminRequest('/admin/m3u-sources/refresh', { method: 'POST' }), 'Đã cập nhật danh sách M3U.')} onRestart={() => {
            if (window.confirm('Khởi động lại dịch vụ backend và reload Nginx?')) runAction(() => adminRequest('/admin/system/restart', { method: 'POST' }), 'Đã gửi lệnh khởi động lại.');
          }} />}
          {activeTab === 'events' && <EventsTab events={events} onAdd={() => setEventModal({ mode: 'create', event: null })} onEdit={event => setEventModal({ mode: 'edit', event })} onDelete={event => {
            if (window.confirm(`Xóa sự kiện "${event.title}"?`)) runAction(() => adminRequest(`/admin/events/${event.id}`, { method: 'DELETE' }), 'Đã xóa sự kiện.');
          }} />}
          {activeTab === 'm3u' && <M3uTab sources={sources} sourceForm={sourceForm} setSourceForm={setSourceForm} busy={busy} onAdd={event => {
            event.preventDefault();
            runAction(async () => {
              await adminRequest('/admin/m3u-sources', { method: 'POST', body: JSON.stringify(sourceForm) });
              setSourceForm({ name: '', url: '', type: 'url' });
            }, 'Đã thêm nguồn M3U.');
          }} onToggle={source => runAction(() => adminRequest(`/admin/m3u-sources/${source.id}`, { method: 'PUT', body: JSON.stringify({ active: !source.active }) }), 'Đã cập nhật trạng thái nguồn.')} onDelete={source => {
            if (window.confirm(`Xóa nguồn "${source.name}"?`)) runAction(() => adminRequest(`/admin/m3u-sources/${source.id}`, { method: 'DELETE' }), 'Đã xóa nguồn M3U.');
          }} onRefresh={() => runAction(() => adminRequest('/admin/m3u-sources/refresh', { method: 'POST' }), 'Đã cập nhật danh sách M3U.')} />}
          {activeTab === 'channels' && <ChannelsTab channels={channels} settings={settings} setSettings={updater => { setSettings(updater); setSettingsDirty(true); }} search={channelSearch} setSearch={setChannelSearch} busy={busy} onSave={() => runAction(async () => { await adminRequest('/admin/iptv-settings', { method: 'POST', body: JSON.stringify(settings) }); setSettingsDirty(false); }, 'Đã lưu cấu hình IPTV.')} />}
          {activeTab === 'streams' && <StreamsTab streams={streams} onStop={stream => runAction(() => fetch(`${API_BASE}/stream/stop/${encodeURIComponent(stream.channelId)}`, { method: 'POST' }).then(response => response.json()), 'Đã dừng luồng phát.')} />}
          {activeTab === 'security' && <PasswordTab busy={busy} onChange={changeAdminPassword} />}
        </main>
      </div>

      {eventModal && <EventModal event={eventModal.event} channels={channels} token={token} onClose={() => setEventModal(null)} onSaved={() => { setEventModal(null); loadData(); setNotice('Đã lưu sự kiện.'); }} />}
    </div>
  );
}

function DashboardTab({ health, status, sources, events, streams, busy, onRefresh, onRestart }) {
  const cards = [
    ['Kênh IPTV', status?.channelsCount ?? 0, ListVideo], ['Nguồn đang bật', sources.filter(source => source.active).length, Server],
    ['Sự kiện', events.length, CalendarDays], ['Luồng FFmpeg', streams.length, Activity],
  ];
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Tổng quan</h1><p className="text-sm text-white/45">Trạng thái backend và dữ liệu IPTV.</p></div><div className="flex gap-2"><button disabled={busy} onClick={onRefresh} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Cập nhật M3U</button><button onClick={onRestart} className="flex items-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"><RotateCcw size={16} /> Khởi động lại</button></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-white/8 bg-[#151515] p-4"><Icon size={19} className="mb-3 text-[#ED2C25]" /><div className="text-2xl font-black">{value}</div><div className="text-xs text-white/45">{label}</div></div>)}</div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Tài nguyên máy chủ"><InfoRow label="CPU" value={`${Number(health?.cpuLoad?.currentLoad || 0).toFixed(1)}%`} /><InfoRow label="Bộ nhớ trống" value={formatBytes(health?.memory?.free)} /><InfoRow label="Chế độ" value={health?.mode || '--'} /><InfoRow label="FFmpeg" value={health?.ffmpegAvailable ? 'Sẵn sàng' : 'Không tìm thấy'} /></Panel>
        <Panel title="Cập nhật M3U"><InfoRow label="Lần cập nhật" value={status?.lastRefreshAt ? new Date(status.lastRefreshAt).toLocaleString('vi-VN') : 'Chưa có'} /><InfoRow label="Trạng thái" value={status?.isRefreshing ? 'Đang cập nhật' : 'Sẵn sàng'} /><InfoRow label="Chu kỳ" value="1 giờ/lần" />{status?.lastError && <div className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-300">{status.lastError}</div>}</Panel>
      </div>
    </section>
  );
}

function EventsTab({ events, onAdd, onEdit, onDelete }) {
  return <section><SectionHeader title="Sự kiện" subtitle="Quản lý nguồn phát và Cbox trên trang sự kiện" action={<button onClick={onAdd} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-3 py-2 text-sm font-bold"><Plus size={16} /> Thêm sự kiện</button>} />
    <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">{events.length ? events.map(event => <div key={event.id} className="flex flex-col gap-3 border-b border-white/5 p-4 last:border-0 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="truncate font-bold">{event.title}</div><div className="mt-1 text-xs text-white/45">{event.time ? new Date(event.time).toLocaleString('vi-VN') : 'Chưa đặt thời gian'} · {event.sourceType || 'iptv'} · {event.status || 'upcoming'}</div></div><div className="flex gap-2"><button onClick={() => onEdit(event)} className="rounded-md bg-white/5 p-2 hover:bg-white/10" title="Sửa"><Pencil size={16} /></button><button onClick={() => onDelete(event)} className="rounded-md bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20" title="Xóa"><Trash2 size={16} /></button></div></div>) : <Empty text="Chưa có sự kiện." />}</div>
  </section>;
}

function M3uTab({ sources, sourceForm, setSourceForm, busy, onAdd, onToggle, onDelete, onRefresh }) {
  return <section><SectionHeader title="Nguồn M3U" subtitle="Danh sách được tải lại tự động mỗi giờ" action={<button disabled={busy} onClick={onRefresh} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Tải lại</button>} />
    <form onSubmit={onAdd} className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 md:grid-cols-[1fr_2fr_auto]"><input required value={sourceForm.name} onChange={event => setSourceForm({ ...sourceForm, name: event.target.value })} placeholder="Tên nguồn" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 outline-none focus:border-[#ED2C25]" /><input required value={sourceForm.url} onChange={event => setSourceForm({ ...sourceForm, url: event.target.value })} placeholder="https://.../list.m3u" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 outline-none focus:border-[#ED2C25]" /><button disabled={busy} className="flex items-center justify-center gap-2 rounded-md bg-[#ED2C25] px-4 py-2 font-bold"><Plus size={16} /> Thêm</button></form>
    <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">{sources.length ? sources.map(source => <div key={source.id} className="flex flex-col gap-3 border-b border-white/5 p-4 last:border-0 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-bold"><span className={`h-2 w-2 rounded-full ${source.active ? 'bg-green-400' : 'bg-white/25'}`} />{source.name}</div><div className="mt-1 truncate text-xs text-white/40">{source.url}</div></div><button onClick={() => onToggle(source)} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm">{source.active ? <Eye size={16} /> : <EyeOff size={16} />}{source.active ? 'Đang bật' : 'Đang tắt'}</button><button onClick={() => onDelete(source)} className="rounded-md bg-red-500/10 p-2 text-red-300" title="Xóa"><Trash2 size={16} /></button></div>) : <Empty text="Chưa có nguồn M3U." />}</div>
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
  return <section><SectionHeader title="Kênh IPTV" subtitle={`${channels.length} kênh đã nạp`} action={<button disabled={busy} onClick={onSave} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-3 py-2 text-sm font-bold"><Save size={16} /> Lưu cấu hình</button>} />
    <div className="mt-5 grid gap-4 xl:grid-cols-[310px_1fr]"><Panel title="Thứ tự nhóm"><div className="max-h-[460px] overflow-y-auto pr-1">{orderedGroups.map((group, index) => <div key={group} className="flex h-9 items-center gap-1 border-b border-white/5 last:border-0"><span className="w-6 text-center text-[10px] text-white/30">{index + 1}</span><button onClick={() => toggle('hiddenGroups', group)} className={`rounded p-1 ${settings.hiddenGroups.includes(group) ? 'text-white/30' : 'text-green-400'}`}>{settings.hiddenGroups.includes(group) ? <EyeOff size={15} /> : <Eye size={15} />}</button><span className="min-w-0 flex-1 truncate text-xs">{group}</span><button disabled={index === 0} onClick={() => moveGroup(index, -1)} className="rounded p-1 hover:bg-white/5 disabled:opacity-20"><ChevronUp size={14} /></button><button disabled={index === orderedGroups.length - 1} onClick={() => moveGroup(index, 1)} className="rounded p-1 hover:bg-white/5 disabled:opacity-20"><ChevronDown size={14} /></button></div>)}</div></Panel>
      <Panel title="Kênh"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kênh..." className="mb-3 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-[#ED2C25]" /><div className="max-h-[560px] overflow-y-auto">{visibleChannels.map(channel => <label key={channel.id} className="flex cursor-pointer items-center gap-3 border-b border-white/5 py-2 text-sm"><input type="checkbox" checked={!settings.hiddenChannels.includes(channel.id)} onChange={() => toggle('hiddenChannels', channel.id)} /><img src={channel.logo || '/poster.jpg'} className="h-7 w-10 object-contain" alt="" /><span className="min-w-0 flex-1 truncate">{channel.name}</span><span className="text-xs text-white/35">{channel.group}</span></label>)}</div></Panel></div>
  </section>;
}

function StreamsTab({ streams, onStop }) {
  return <section><SectionHeader title="Luồng phát" subtitle="Các tiến trình FFmpeg đang hoạt động" />
    <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#151515]">{streams.length ? streams.map(stream => <div key={stream.channelId} className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0"><Activity size={18} className="text-green-400" /><div className="min-w-0 flex-1"><div className="truncate font-bold">{stream.channelId}</div><div className="text-xs text-white/40">PID {stream.pid || '--'}</div></div><button onClick={() => onStop(stream)} className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300"><CircleStop size={16} /> Dừng</button></div>) : <Empty text="Không có luồng FFmpeg đang chạy. Các kênh phát trực tiếp/proxy không tạo tiến trình FFmpeg." />}</div>
  </section>;
}

function PasswordTab({ busy, onChange }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const submit = event => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return alert('Mật khẩu xác nhận không khớp.');
    if (newPassword.length < 8) return alert('Mật khẩu mới phải có ít nhất 8 ký tự.');
    onChange(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };
  return <section><SectionHeader title="Đổi mật khẩu admin" subtitle="Phiên đăng nhập cũ sẽ bị vô hiệu hóa sau khi đổi mật khẩu" />
    <form onSubmit={submit} className="mt-5 max-w-lg space-y-4 rounded-lg border border-white/10 bg-[#151515] p-5">
      <Field label="Mật khẩu hiện tại"><input required type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="input-admin" /></Field>
      <Field label="Mật khẩu mới"><input required minLength="8" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="input-admin" /></Field>
      <Field label="Nhập lại mật khẩu mới"><input required minLength="8" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="input-admin" /></Field>
      <button disabled={busy} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-4 py-2 font-bold disabled:opacity-50"><KeyRound size={16} /> Đổi mật khẩu</button>
    </form>
  </section>;
}

function EventModal({ event, channels, token, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ title: '', description: '', time: new Date().toISOString(), status: 'upcoming', sourceType: 'iptv', sourceChannelId: '', stream: '', streamKey: '', thumbnailBase64: '', isPinned: false, ...(event || {}) }));
  const [saving, setSaving] = useState(false);
  const localTime = value => { const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
  const submit = async submitEvent => {
    submitEvent.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(event ? `${API_BASE}/admin/events/${event.id}` : `${API_BASE}/admin/events`, { method: event ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      onSaved();
    } catch (err) { alert(`Không thể lưu sự kiện: ${err.message}`); } finally { setSaving(false); }
  };
  const upload = uploadEvent => { const file = uploadEvent.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setForm(current => ({ ...current, thumbnailBase64: reader.result })); reader.readAsDataURL(file); };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"><form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151515]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="font-bold">{event ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h2><button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10"><X size={19} /></button></div><div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
    <Field label="Tên sự kiện"><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-admin" /></Field>
    <Field label="Thời gian"><input required type="datetime-local" value={localTime(form.time)} onChange={e => setForm({ ...form, time: new Date(e.target.value).toISOString() })} className="input-admin [color-scheme:dark]" /></Field>
    <Field label="Trạng thái"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-admin"><option value="upcoming">Sắp diễn ra</option><option value="live">Đang trực tiếp</option><option value="ended">Đã kết thúc</option></select></Field>
    <Field label="Loại nguồn"><select value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value })} className="input-admin"><option value="iptv">Kênh IPTV</option><option value="obs">OBS / vMix</option><option value="custom">URL tùy chọn</option></select></Field>
    {form.sourceType === 'iptv' && <Field label="Kênh IPTV"><select required value={form.sourceChannelId || ''} onChange={e => setForm({ ...form, sourceChannelId: e.target.value })} className="input-admin"><option value="">Chọn kênh</option>{channels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></Field>}
    {form.sourceType === 'custom' && <Field label="URL M3U8 / MPD"><input required value={form.stream || ''} onChange={e => setForm({ ...form, stream: e.target.value })} className="input-admin" placeholder="https://..." /></Field>}
    {form.sourceType === 'obs' && <Field label="Stream key"><input value={form.streamKey || ''} onChange={e => setForm({ ...form, streamKey: e.target.value })} className="input-admin" placeholder="Tự tạo nếu để trống" /></Field>}
    <Field label="Ảnh 16:9"><input type="file" accept="image/*" onChange={upload} className="block w-full text-sm text-white/55" /></Field>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.isPinned)} onChange={e => setForm({ ...form, isPinned: e.target.checked })} /> Ghim sự kiện</label>
    <div className="md:col-span-2"><Field label="Mô tả"><textarea rows="3" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="input-admin resize-none" /></Field></div>
    {(form.thumbnailBase64 || form.thumbnailUrl) && <img src={form.thumbnailBase64 || form.thumbnailUrl} alt="Xem trước" className="aspect-video w-full rounded-md object-cover md:col-span-2" />}
  </div><div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={onClose} className="rounded-md px-4 py-2 hover:bg-white/5">Hủy</button><button disabled={saving} className="rounded-md bg-[#ED2C25] px-5 py-2 font-bold disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu sự kiện'}</button></div></form></div>;
}

function SectionHeader({ title, subtitle, action }) { return <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-white/45">{subtitle}</p></div>{action}</div>; }
function Panel({ title, children }) { return <div className="rounded-lg border border-white/10 bg-[#151515] p-4"><h2 className="mb-3 font-bold">{title}</h2>{children}</div>; }
function InfoRow({ label, value }) { return <div className="flex justify-between border-b border-white/5 py-2 text-sm last:border-0"><span className="text-white/45">{label}</span><span>{value}</span></div>; }
function Empty({ text }) { return <div className="p-10 text-center text-sm text-white/45">{text}</div>; }
function Field({ label, children }) { return <label className="block text-sm"><span className="mb-1.5 block text-white/55">{label}</span>{children}</label>; }
function formatBytes(value) { const bytes = Number(value || 0); if (!bytes) return '--'; return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`; }
