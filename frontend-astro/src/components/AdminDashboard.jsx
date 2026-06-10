import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Server, Cpu, Network, Video, Plus, Trash2, Edit2, Play, Square, RefreshCcw, MonitorPlay, Database, RefreshCw, Settings, EyeOff, LayoutList, ChevronUp, ChevronDown } from 'lucide-react';
import classNames from 'classnames';

const API_BASE = '/api';

export default function AdminDashboard() {
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adminToken');
    }
    return null;
  });
  const [passwordInput, setPasswordInput] = useState('');

  const [metrics, setMetrics] = useState({
    cpu: '0.00',
    memoryUsed: '0.00',
    networkRx: '0.00',
    networkTx: '0.00',
    activeStreams: 0
  });

  const [activeTab, setActiveTab] = useState('events');
  const [streams, setStreams] = useState([]);
  const [events, setEvents] = useState([]);
  const [m3uSources, setM3uSources] = useState([]);
  const [newSource, setNewSource] = useState({ name: '', url: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [iptvSettings, setIptvSettings] = useState({ hiddenGroups: [], hiddenChannels: [], groupOrder: [] });
  const [allChannels, setAllChannels] = useState([]);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socket.on('system_metrics', (data) => {
      setMetrics({
        cpu: data.cpu,
        memoryUsed: data.memoryUsed,
        networkRx: data.networkRx,
        networkTx: data.networkTx,
        activeStreams: data.activeStreams
      });
    });
    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const [eventsRes, m3uRes, settingsRes, channelsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/events`),
        fetch(`${API_BASE}/admin/m3u-sources`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/iptv-settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/iptv-channels`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const eventsData = await eventsRes.json();
      const m3uData = await m3uRes.json();
      const settingsData = await settingsRes.json();
      const channelsData = await channelsRes.json();
      
      if (eventsData.success) setEvents(eventsData.data);
      if (m3uData.success) setM3uSources(m3uData.data);
      if (settingsData.success) setIptvSettings(settingsData.data);
      if (channelsData.success) setAllChannels(channelsData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [activeTab, token]);

  const addM3uSource = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/m3u-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSource)
      });
      if (res.ok) {
        setNewSource({ name: '', url: '' });
        fetchData();
        alert('Đã thêm nguồn M3U thành công!');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi thêm nguồn M3U');
    }
  };

  const deleteM3uSource = async (id) => {
    if (confirm('Xóa nguồn này?')) {
      await fetch(`${API_BASE}/admin/m3u-sources/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    }
  };

  const refreshM3uSources = async () => {
    try {
      alert('Đang làm mới danh sách kênh từ tất cả các nguồn... Vui lòng chờ!');
      const res = await fetch(`${API_BASE}/admin/m3u-sources/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`Hoàn tất! Tổng số kênh hiện tại: ${data.channelsCount}`);
      }
    } catch (err) {
      alert('Lỗi refresh M3U');
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tổng quan', icon: Activity },
    { id: 'events', label: 'Sự kiện Live', icon: MonitorPlay },
    { id: 'm3u', label: 'Nguồn M3U', icon: Database },
    { id: 'settings', label: 'Cài đặt Kênh', icon: Settings },
    { id: 'streams', label: 'Luồng Stream', icon: Server },
  ];

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white overflow-hidden">
      {!token && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#121212] p-8 rounded-2xl border border-white/10 w-96 text-center shadow-2xl">
            <h2 className="text-2xl font-black text-[#ED2C25] mb-6 tracking-tighter">NhanChill<span className="text-white">TV</span> Admin</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch('/api/admin/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: passwordInput })
                });
                const data = await res.json();
                if (data.success) {
                  setToken(data.token);
                  localStorage.setItem('adminToken', data.token);
                } else {
                  alert('Sai mật khẩu!');
                }
              } catch(e) {
                alert('Lỗi đăng nhập');
              }
            }}>
              <input 
                type="password" 
                placeholder="Nhập mật khẩu..." 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl py-3 px-4 mb-4 text-white focus:border-[#ED2C25] focus:outline-none"
              />
              <button type="submit" className="w-full bg-[#ED2C25] text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors">
                Đăng nhập
              </button>
            </form>
          </div>
        </div>
      )}

      <aside className="w-[260px] bg-[#121212] border-r border-white/5 flex flex-col">
        <div className="h-[70px] flex items-center px-6 border-b border-white/5">
          <div className="text-2xl font-black text-[#ED2C25] tracking-tighter">
            Admin<span className="text-white text-sm font-normal ml-2 tracking-normal bg-[#ED2C25]/20 px-2 py-0.5 rounded text-[#ED2C25]">v1.65</span>
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                  activeTab === tab.id 
                    ? "bg-[#ED2C25] text-white shadow-lg shadow-[#ED2C25]/20" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/5">
          <a href="/" className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors">
            Quay lại Web
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold">Realtime Metrics</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard title="CPU Load" value={`${metrics.cpu}%`} icon={Cpu} color="text-blue-500" bg="bg-blue-500/10" />
              <MetricCard title="RAM Usage" value={`${metrics.memoryUsed}%`} icon={Server} color="text-purple-500" bg="bg-purple-500/10" />
              <MetricCard title="Network (Rx/Tx)" value={`${metrics.networkRx} / ${metrics.networkTx} MB/s`} icon={Network} color="text-emerald-500" bg="bg-emerald-500/10" />
              <MetricCard title="Active Streams" value={metrics.activeStreams} icon={Activity} color="text-[#ED2C25]" bg="bg-[#ED2C25]/10" />
            </div>
            
            <div className="mt-12 bg-[#121212] rounded-2xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-4">Điều khiển Server</h2>
              <button className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors px-6 py-3 rounded-xl font-bold">
                <RefreshCcw size={18} /> Khởi động lại Nginx
              </button>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Quản lý sự kiện</h1>
              <button 
                onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                className="flex items-center gap-2 bg-[#ED2C25] hover:bg-red-700 transition-colors px-4 py-2.5 rounded-xl font-bold text-sm"
              >
                <Plus size={18} /> Thêm sự kiện
              </button>
            </div>
            
            <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-white/60 text-sm">
                  <tr>
                    <th className="p-4 font-medium">Tên sự kiện</th>
                    <th className="p-4 font-medium">Trạng thái</th>
                    <th className="p-4 font-medium">Nguồn</th>
                    <th className="p-4 font-medium">Thời gian</th>
                    <th className="p-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {events.map(event => (
                    <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-medium">{event.title}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-500 uppercase">
                          {event.status}
                        </span>
                      </td>
                      <td className="p-4 text-white/60 text-sm uppercase">{event.sourceType}</td>
                      <td className="p-4 text-white/60 text-sm">{new Date(event.time).toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingEvent(event); setShowEventModal(true); }}
                            className="p-2 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Xóa sự kiện này?')) {
                                await fetch(`/api/admin/events/${event.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                                fetchData();
                              }
                            }}
                            className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-white/40">Chưa có sự kiện nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* M3U Sources Tab */}
        {activeTab === 'm3u' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#121212] p-4 rounded-xl border border-white/5">
              <div>
                <h3 className="font-bold text-lg text-white">Quản lý Nguồn M3U</h3>
                <p className="text-sm text-white/50 mt-1">Thêm các đường link M3U để hệ thống tự động tải và tổng hợp kênh IPTV.</p>
              </div>
              <button onClick={refreshM3uSources} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                <RefreshCw size={18} />
                Làm mới tất cả Kênh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-[#121212] rounded-xl border border-white/5 p-6">
                  <h3 className="font-bold text-lg text-white mb-4">Thêm nguồn mới</h3>
                  <form onSubmit={addM3uSource} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Tên Nguồn</label>
                      <input 
                        required 
                        value={newSource.name} 
                        onChange={e => setNewSource({...newSource, name: e.target.value})} 
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-2.5 text-white text-sm" 
                        placeholder="VD: TV360 VIP" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">URL M3U</label>
                      <input 
                        required 
                        type="url"
                        value={newSource.url} 
                        onChange={e => setNewSource({...newSource, url: e.target.value})} 
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-2.5 text-white text-sm" 
                        placeholder="https://..." 
                      />
                    </div>
                    <button type="submit" className="w-full flex justify-center items-center gap-2 bg-[#ED2C25] hover:bg-[#d02520] text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                      <Plus size={18} />
                      Thêm M3U
                    </button>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-[#121212] rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1A1A1A] text-white/70 text-xs uppercase border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3">Tên</th>
                        <th className="px-4 py-3">URL</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {m3uSources.map(src => (
                        <tr key={src.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{src.name}</td>
                          <td className="px-4 py-3 text-white/60 truncate max-w-[200px]" title={src.url}>{src.url}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/20">Hoạt động</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteM3uSource(src.id)} className="text-white/40 hover:text-red-500 transition-colors p-1">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {m3uSources.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-white/40">Chưa có nguồn M3U nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'streams' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold">Streams đang chạy</h1>
            {/* Stream logic here */}
          </div>
        )}
        {activeTab === 'settings' && (() => {
          const uniqueGroups = Array.from(new Set(allChannels.map(c => c.group))).sort();
          const sortedGroups = iptvSettings.groupOrder?.length > 0 
            ? [...new Set([...iptvSettings.groupOrder, ...uniqueGroups])] 
            : uniqueGroups;

          const moveGroup = (index, direction) => {
            let newOrder = [...sortedGroups];
            if (direction === -1 && index > 0) {
              const temp = newOrder[index - 1];
              newOrder[index - 1] = newOrder[index];
              newOrder[index] = temp;
            } else if (direction === 1 && index < newOrder.length - 1) {
              const temp = newOrder[index + 1];
              newOrder[index + 1] = newOrder[index];
              newOrder[index] = temp;
            }
            setIptvSettings({ ...iptvSettings, groupOrder: newOrder });
          };

          return (
            <div className="relative">
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Cài đặt Kênh & Thể loại</h1>
                  <p className="text-white/60">Quản lý hiển thị và độ ưu tiên của danh sách IPTV</p>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      // Ensure groupOrder contains all current groups before saving
                      const finalOrder = [...new Set([...(iptvSettings.groupOrder || []), ...uniqueGroups])];
                      const dataToSave = { ...iptvSettings, groupOrder: finalOrder };
                      
                      const res = await fetch(`${API_BASE}/admin/iptv-settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(dataToSave)
                      });
                      if (res.ok) alert('Đã lưu cấu hình thành công!');
                    } catch (e) { alert('Lỗi lưu cấu hình'); }
                  }}
                  className="bg-[#ED2C25] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                >
                  Lưu Thay Đổi
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cột 1: Quản lý Thể loại */}
                <div className="bg-[#121212] p-6 rounded-2xl border border-white/5 flex flex-col h-[700px]">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><LayoutList size={20} className="text-[#ED2C25]"/> Quản lý Thể loại</h3>
                  <p className="text-sm text-white/50 mb-4">Sử dụng nút mũi tên để thay đổi thứ tự ưu tiên. Bật/Tắt để điều khiển hiển thị trên trang chủ.</p>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {sortedGroups.map((g, index) => (
                      <div key={g} className="flex items-center justify-between p-2 bg-[#1A1A1A] rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <button disabled={index === 0} onClick={() => moveGroup(index, -1)} className="p-0.5 rounded text-white/30 hover:bg-white/10 hover:text-white disabled:opacity-30">
                              <ChevronUp size={16} />
                            </button>
                            <button disabled={index === sortedGroups.length - 1} onClick={() => moveGroup(index, 1)} className="p-0.5 rounded text-white/30 hover:bg-white/10 hover:text-white disabled:opacity-30">
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          <div className={`font-bold text-sm ${iptvSettings.hiddenGroups?.includes(g) ? 'text-white/40 line-through' : 'text-white/90'}`}>{g}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer mr-2">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={!(iptvSettings.hiddenGroups?.includes(g) || false)}
                            onChange={(e) => {
                              const cur = iptvSettings.hiddenGroups || [];
                              if (!e.target.checked) setIptvSettings({...iptvSettings, hiddenGroups: [...cur, g]});
                              else setIptvSettings({...iptvSettings, hiddenGroups: cur.filter(x => x !== g)});
                            }}
                          />
                          <div className="w-11 h-6 bg-red-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

              {/* Cột 2: Kênh */}
              <div className="bg-[#121212] p-6 rounded-2xl border border-white/5 flex flex-col h-[700px]">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><EyeOff size={20} className="text-[#ED2C25]"/> Bật / Tắt Kênh cụ thể</h3>
                <p className="text-sm text-white/50 mb-4">Tắt các kênh bạn không muốn hiển thị. Những kênh thuộc Thể loại bị ẩn sẽ luôn bị ẩn bất kể cài đặt này.</p>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {allChannels.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <img src={ch.logo || '/poster.jpg'} alt={ch.name} className="w-10 h-10 object-contain bg-black rounded" onError={(e) => { if(!e.currentTarget.src.includes('/poster.jpg')) { e.currentTarget.src = '/poster.jpg'; } }} />
                        <div>
                          <div className="font-medium text-sm">{ch.name}</div>
                          <div className="text-xs text-white/40">{ch.group}</div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={!(iptvSettings.hiddenChannels?.includes(ch.id) || false)}
                          onChange={(e) => {
                            const cur = iptvSettings.hiddenChannels || [];
                            if (!e.target.checked) setIptvSettings({...iptvSettings, hiddenChannels: [...cur, ch.id]});
                            else setIptvSettings({...iptvSettings, hiddenChannels: cur.filter(x => x !== ch.id)});
                          }}
                        />
                        <div className="w-11 h-6 bg-red-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
          );
        })()}
      </main>

      {showEventModal && (
        <EventModal 
          event={editingEvent}
          token={token}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
          onSave={async (savedEvent) => {
            fetchData();
            setShowEventModal(false);
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 w-24 h-24 ${bg} rounded-full blur-2xl opacity-50`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-white/60 font-medium">{title}</h3>
        <div className={`p-3 rounded-xl ${bg} ${color}`}>
          <Icon size={24} />
        </div>
      </div>
      <div className="text-3xl font-black relative z-10">{value}</div>
    </div>
  );
}

function EventModal({ event, token, onClose, onSave }) {
  const [formData, setFormData] = useState(event || {
    title: '',
    description: '',
    time: new Date().toISOString().slice(0, 16),
    status: 'upcoming',
    sourceType: 'iptv',
    sourceChannelId: '',
    streamKey: '',
    thumbnailBase64: '',
    isPinned: false
  });

  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    fetch('/api/iptv/channels')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChannels(data.data);
        }
      })
      .catch(console.error);
  }, []);

  const getLocalDatetimeString = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const submitData = { ...formData };
    if (submitData.sourceType === 'obs' && !submitData.streamKey) {
      submitData.streamKey = 'stream_' + Math.random().toString(36).substring(2, 10);
    }

    try {
      const url = event ? `/api/admin/events/${event.id}` : '/api/admin/events';
      const method = event ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });
      const data = await res.json();
      if (data.success) {
        onSave(data.data);
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch(err) {
      alert('Lỗi mạng');
    }
    setLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, thumbnailBase64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#121212] w-full max-w-2xl rounded-2xl border border-white/5 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1A1A1A]">
          <h2 className="text-xl font-bold">{event ? 'Sửa sự kiện' : 'Thêm sự kiện mới'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Square size={20} className="rotate-45" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Tên sự kiện</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Thời gian diễn ra</label>
                <input required type="datetime-local" value={getLocalDatetimeString(formData.time)} onChange={e => setFormData({...formData, time: new Date(e.target.value).toISOString()})} className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors [color-scheme:dark]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Trạng thái</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors appearance-none">
                  <option value="upcoming">Sắp diễn ra</option>
                  <option value="live">Đang Live</option>
                  <option value="ended">Đã kết thúc</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-[#1A1A1A] rounded-xl border border-white/5">
                  <input type="checkbox" checked={formData.isPinned} onChange={e => setFormData({...formData, isPinned: e.target.checked})} className="w-5 h-5 rounded border-white/20 text-[#ED2C25] focus:ring-[#ED2C25]" />
                  <span className="font-medium">Ghim lên Banner Trang chủ</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Nguồn phát (Source)</label>
                <select value={formData.sourceType} onChange={e => setFormData({...formData, sourceType: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors appearance-none">
                  <option value="iptv">Kênh IPTV (M3U)</option>
                  <option value="obs">Phần mềm ngoài (OBS/vMix)</option>
                  <option value="custom">URL Tự chọn</option>
                </select>
              </div>

              {formData.sourceType === 'iptv' && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Chọn kênh IPTV</label>
                  <select required value={formData.sourceChannelId} onChange={e => setFormData({...formData, sourceChannelId: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors appearance-none">
                    <option value="">-- Chọn một kênh --</option>
                    {channels.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.sourceType === 'obs' && (
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                  <p className="text-sm text-blue-400 font-medium mb-2">Thông số cấu hình OBS:</p>
                  <div className="space-y-2 text-sm text-white/80">
                    <p><strong>Server:</strong> rtmp://your-server-ip/live</p>
                    <p><strong>Stream Key:</strong> {formData.streamKey || '(Sẽ tạo ngẫu nhiên)'}</p>
                  </div>
                </div>
              )}

              {formData.sourceType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">URL M3U8/MPD</label>
                  <input required value={formData.stream} onChange={e => setFormData({...formData, stream: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors" placeholder="https://..." />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Ảnh Thumbnail (Tỷ lệ 16:9)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#ED2C25]/10 file:text-[#ED2C25] hover:file:bg-[#ED2C25]/20 cursor-pointer" />
                {(formData.thumbnailBase64 || formData.thumbnailUrl) && (
                  <img src={formData.thumbnailBase64 || formData.thumbnailUrl} alt="Preview" className="mt-4 rounded-xl border border-white/10 w-full aspect-video object-cover" />
                )}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Mô tả sự kiện</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ED2C25] transition-colors resize-none"></textarea>
          </div>
        </form>

        <div className="p-6 border-t border-white/5 bg-[#1A1A1A] flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold hover:bg-white/10 transition-colors">Hủy</button>
          <button onClick={handleSubmit} disabled={loading} className="px-8 py-2.5 bg-[#ED2C25] hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors shadow-lg shadow-[#ED2C25]/20 flex items-center gap-2">
            {loading ? 'Đang lưu...' : (event ? 'Cập nhật' : 'Thêm mới')}
          </button>
        </div>
      </div>
    </div>
  );
}
