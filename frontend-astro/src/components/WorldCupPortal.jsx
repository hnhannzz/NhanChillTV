import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarClock, MapPin, RefreshCw, Search, Shield, Trophy } from 'lucide-react';
import WorldCupMatchCard from './WorldCupMatchCard';

const tabs = [
  { id: 'schedule', label: 'Lịch thi đấu', icon: CalendarClock },
  { id: 'results', label: 'Kết quả', icon: CalendarDays },
  { id: 'standings', label: 'Bảng xếp hạng', icon: Trophy },
  { id: 'stadiums', label: 'Sân vận động', icon: MapPin },
];

function formatDateKey(dateKey) {
  if (!dateKey || dateKey === 'unknown') return 'Chưa xác định ngày';
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function filterMatches(matches, query) {
  const text = query.trim().toLowerCase();
  if (!text) return matches;
  return matches.filter(match => [
    match.id,
    match.group,
    match.stage_vi,
    match.home_team_display,
    match.away_team_display,
    match.home_team_name_en,
    match.away_team_name_en,
    match.stadium_name,
    match.stadium_city,
  ].some(value => String(value || '').toLowerCase().includes(text)));
}

function groupMatches(matches, newestFirst = false) {
  const grouped = matches.reduce((acc, match) => {
    const key = match.vnDateKey || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});
  return Object.entries(grouped).sort(([a], [b]) => newestFirst ? b.localeCompare(a) : a.localeCompare(b));
}

function StatItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#111111] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/45">
        <Icon size={15} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#111111] px-6 py-12 text-center">
      <Shield className="mx-auto text-white/25" size={36} />
      <h3 className="mt-3 font-extrabold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/50">{description}</p>
    </div>
  );
}

export default function WorldCupPortal() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/worldcup/summary${force ? '?refresh=1' : ''}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || `HTTP ${response.status}`);
      setData(payload);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu World Cup.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const scheduleMatches = useMemo(() => filterMatches(data?.upcomingGames || [], query), [data, query]);
  const resultMatches = useMemo(() => filterMatches(data?.finishedGames || [], query), [data, query]);
  const todayMatches = data?.todayGames || [];

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-lg bg-white/5" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(item => <div key={item} className="h-44 animate-pulse rounded-lg bg-white/5" />)}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-[#ED2C25]/25 bg-[#ED2C25]/10 p-6 text-center">
        <h2 className="text-xl font-black text-white">Không tải được World Cup</h2>
        <p className="mt-2 text-sm text-white/65">{error}</p>
        <button onClick={() => loadData(true)} className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#ED2C25] px-4 py-2 text-sm font-extrabold text-white hover:bg-red-700">
          <RefreshCw size={15} />
          Tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <section className="rounded-lg border border-white/8 bg-[#0f0f0f] p-4 md:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-[#FFD166]/25 bg-[#FFD166]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#FFD166]">
              <Trophy size={14} />
              FIFA World Cup 2026
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight text-white md:text-4xl">Lịch thi đấu và livescore</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Tất cả thời gian đã đổi sang giờ Việt Nam GMT+7. Lịch và kết quả được đồng bộ theo ngày thi đấu tại Việt Nam.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Tìm đội, sân hoặc mã trận"
                className="w-full rounded-md border border-white/10 bg-black/35 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ED2C25]"
              />
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-white/12 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Đồng bộ
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatItem icon={CalendarDays} label="Trận hôm nay" value={todayMatches.length} />
          <StatItem icon={RadioDot} label="Đang đá" value={data?.liveGames?.length || 0} />
          <StatItem icon={CalendarClock} label="Sắp diễn ra" value={data?.upcomingGames?.length || 0} />
          <StatItem icon={Trophy} label="Đã kết thúc" value={data?.finishedGames?.length || 0} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">Các trận hôm nay tại Việt Nam</h2>
          <span className="text-xs font-semibold text-white/40">{data?.todayDate}</span>
        </div>
        {todayMatches.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {todayMatches.map(match => <WorldCupMatchCard key={match.id} match={match} />)}
          </div>
        ) : (
          <EmptyState title="Không có trận trong hôm nay" description="Widget và lịch đang dùng mốc ngày Việt Nam GMT+7, nên một số trận theo giờ địa phương có thể chuyển sang ngày hôm sau tại Việt Nam." />
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-white/10">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition-colors whitespace-nowrap ${selected ? 'border-[#ED2C25] text-white' : 'border-transparent text-white/50 hover:text-white'}`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'schedule' && (
        <MatchSections
          matches={scheduleMatches}
          newestFirst={false}
          emptyTitle="Chưa có lịch phù hợp"
          emptyDescription="Lịch thi đấu chỉ hiển thị các trận chưa kết thúc và được sắp xếp theo trận gần đá nhất."
        />
      )}

      {activeTab === 'results' && (
        <MatchSections
          matches={resultMatches}
          newestFirst={true}
          emptyTitle="Chưa có kết quả phù hợp"
          emptyDescription="Kết quả chỉ gồm những trận đã kết thúc, tách riêng khỏi lịch thi đấu."
        />
      )}

      {activeTab === 'standings' && <Standings groups={data?.groups || []} />}
      {activeTab === 'stadiums' && <Stadiums stadiums={data?.stadiums || []} />}
    </div>
  );
}

function RadioDot(props) {
  return (
    <span className="relative inline-flex h-[15px] w-[15px] items-center justify-center" {...props}>
      <span className="h-2 w-2 rounded-full bg-[#ED2C25]" />
    </span>
  );
}

function MatchSections({ matches, newestFirst, emptyTitle, emptyDescription }) {
  if (!matches.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="space-y-6">
      {groupMatches(matches, newestFirst).map(([dateKey, dayMatches]) => (
        <section key={dateKey} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <h3 className="text-center text-sm font-black uppercase tracking-wide text-white/65">{formatDateKey(dateKey)}</h3>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {dayMatches.map(match => <WorldCupMatchCard key={match.id} match={match} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Standings({ groups }) {
  if (!groups.length) return <EmptyState title="Chưa có bảng xếp hạng" description="Dữ liệu bảng đấu sẽ xuất hiện khi API đồng bộ thành công." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {groups.map(group => (
        <section key={group.name} className="overflow-hidden rounded-lg border border-white/8 bg-[#111111]">
          <h3 className="border-b border-white/8 px-4 py-3 text-sm font-black text-white">Bảng {group.name}</h3>
          <div className="overflow-x-auto p-3">
            <table className="w-full text-left text-xs text-white/75">
              <thead className="text-[10px] uppercase text-white/35">
                <tr>
                  <th className="px-2 py-2">Đội</th>
                  <th className="px-2 py-2 text-center">Trận</th>
                  <th className="px-2 py-2 text-center">HS</th>
                  <th className="px-2 py-2 text-center">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {(group.teams || []).map((team, index) => (
                  <tr key={team.team_id} className="border-t border-white/6">
                    <td className="px-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="w-4 text-[10px] font-bold text-white/30">{index + 1}</span>
                        {team.team?.flag ? <img src={team.team.flag} alt={team.team_name_vi} loading="lazy" className="h-3.5 w-5 rounded-sm object-cover ring-1 ring-white/10" /> : <Shield size={14} className="text-white/25" />}
                        <span className="truncate font-bold text-white">{team.team_name_vi}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">{team.mp}</td>
                    <td className={`px-2 py-2.5 text-center ${Number(team.gd) > 0 ? 'text-emerald-300' : Number(team.gd) < 0 ? 'text-[#ff6b66]' : ''}`}>{Number(team.gd) > 0 ? `+${team.gd}` : team.gd}</td>
                    <td className="px-2 py-2.5 text-center font-black text-white">{team.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Stadiums({ stadiums }) {
  if (!stadiums.length) return <EmptyState title="Chưa có dữ liệu sân" description="Danh sách sân vận động sẽ được lấy lại ở lần đồng bộ tiếp theo." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stadiums.map(stadium => (
        <article key={stadium.id} className="rounded-lg border border-white/8 bg-[#111111] p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded bg-[#ED2C25]/10 px-2 py-1 text-[10px] font-black uppercase text-[#ff6b66]">Sân #{stadium.id}</span>
            <span className="text-[10px] font-semibold text-white/35">{stadium.region}</span>
          </div>
          <h3 className="mt-3 text-base font-black leading-snug text-white">{stadium.name_en}</h3>
          <p className="mt-1 text-xs font-medium text-white/45">{stadium.fifa_name}</p>
          <div className="mt-4 space-y-2 text-xs text-white/55">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="shrink-0 text-white/35" />
              <span>{stadium.city_en}, {stadium.country_vi}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={13} className="shrink-0 text-white/35" />
              <span>Sức chứa: <strong className="text-white">{Number(stadium.capacity || 0).toLocaleString('vi-VN')}</strong></span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
