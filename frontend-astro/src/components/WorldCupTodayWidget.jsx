import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronRight, RefreshCw, Trophy } from 'lucide-react';
import WorldCupMatchCard from './WorldCupMatchCard';

function formatUpdatedAt(value) {
  if (!value) return 'chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function formatDateKey(dateKey) {
  if (!dateKey) return '';
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export default function WorldCupTodayWidget() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/worldcup/today', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(data => {
        if (!data.success) throw new Error(data.error || 'World Cup API error');
        setPayload(data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError('Không tải được lịch World Cup hôm nay.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(item => <div key={item} className="h-36 animate-pulse rounded-lg bg-white/5" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#111111] p-5 text-sm text-white/55">
        <div className="flex items-center gap-2 text-white">
          <RefreshCw size={16} />
          {error}
        </div>
      </div>
    );
  }

  const todayMatches = payload?.matches || [];
  const tomorrowMatches = payload?.tomorrowMatches || [];
  const allTodayFinished = todayMatches.length > 0 && todayMatches.every(match => match.isFinished);
  const showTomorrow = allTodayFinished || (todayMatches.length === 0 && tomorrowMatches.length > 0);
  const visibleMatches = showTomorrow ? tomorrowMatches : todayMatches;
  const fallbackMatches = visibleMatches.length ? [] : (payload?.nextGames || []).slice(0, 3);
  const heading = showTomorrow ? 'Trận đấu ngày mai' : 'Trận đấu hôm nay';
  const dateText = showTomorrow ? payload?.tomorrowDate : payload?.date;
  const emptyText = showTomorrow ? 'Chưa có trận ngày mai' : 'Không có trận trong hôm nay';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-[#FFD166]/25 bg-[#FFD166]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#FFD166]">
            <Trophy size={14} />
            World Cup 2026
          </div>
          <h2 className="mt-2 text-xl font-black text-white md:text-3xl">{heading}</h2>
          <p className="mt-1 text-sm text-white/50">
            Theo ngày Việt Nam GMT+7: {formatDateKey(dateText) || dateText} · Dữ liệu cập nhật lần cuối: {formatUpdatedAt(payload?.updatedAt)}
          </p>
        </div>
        <a href="/worldcup/" className="inline-flex items-center gap-2 self-start rounded-md bg-[#ED2C25] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-red-700 md:self-auto">
          Lịch đầy đủ
          <ChevronRight size={16} />
        </a>
      </div>

      {visibleMatches.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMatches.slice(0, 6).map(match => <WorldCupMatchCard key={match.id} match={match} compact />)}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <CalendarDays size={16} />
            {emptyText}
          </div>
          {fallbackMatches.length > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fallbackMatches.map(match => <WorldCupMatchCard key={match.id} match={match} compact />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
