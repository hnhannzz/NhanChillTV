import React, { useEffect, useState } from 'react';
import { Bell, CalendarClock, Info, MapPin, Play, Radio, Shield, Timer } from 'lucide-react';

function scoreText(match) {
  if (match.isUpcoming) return 'VS';
  if (match.has_score) return `${match.home_score_value} - ${match.away_score_value}`;
  return '--';
}

function statusLabel(match) {
  if (match.isLive) return match.time_elapsed && match.time_elapsed !== 'live' ? match.time_elapsed : 'Đang đá';
  if (match.isFinished) return 'Đã kết thúc';
  return 'Sắp diễn ra';
}

function streamHref(match) {
  return match?.id ? `/tv/?matchId=${encodeURIComponent(match.id)}` : null;
}

function TeamBlock({ name, flag, align = 'left' }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'left' && (
        flag ? <img src={flag} alt={name} loading="lazy" className="h-8 w-11 shrink-0 rounded object-cover ring-1 ring-white/10" /> : <Shield size={28} className="shrink-0 text-white/20" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-white md:text-base">{name}</div>
      </div>
      {align === 'right' && (
        flag ? <img src={flag} alt={name} loading="lazy" className="h-8 w-11 shrink-0 rounded object-cover ring-1 ring-white/10" /> : <Shield size={28} className="shrink-0 text-white/20" />
      )}
    </div>
  );
}

export default function WorldCupMatchCard({ match, compact = false }) {
  const href = streamHref(match);
  const hasHighlight = Boolean(match.highlight?.url);

  return (
    <article className={`overflow-hidden rounded-lg border bg-[#111111] transition-colors ${match.isLive ? 'border-[#ED2C25]/60 shadow-[0_0_0_1px_rgba(237,44,37,0.18)]' : 'border-white/8 hover:border-white/16'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-[#FFD166]/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#FFD166]">
            {match.stage_vi}{match.group ? ` - Bảng ${match.group}` : ''}
          </span>
          <span className="text-[10px] font-semibold text-white/35">#{match.id}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${match.isLive ? 'bg-[#ED2C25]/12 text-[#ff6b66]' : match.isFinished ? 'bg-white/8 text-white/50' : 'bg-emerald-400/10 text-emerald-300'}`}>
          {match.isLive && <span className="h-1.5 w-1.5 rounded-full bg-[#ED2C25]" />}
          {match.isLive ? <Radio size={11} /> : <Timer size={11} />}
          {statusLabel(match)}
        </span>
      </div>

      <div className={`grid items-center gap-3 px-3 ${compact ? 'py-3' : 'py-4'} grid-cols-[1fr_auto_1fr]`}>
        <TeamBlock name={match.home_team_display || match.home_team_name_vi} flag={match.home_team_flag} />
        <div className="flex min-w-[72px] flex-col items-center">
          <div className={`rounded-md border border-white/10 bg-black/35 px-3 py-2 text-center font-black tracking-wide text-white ${match.isUpcoming ? 'text-base text-white/45' : 'text-xl'}`}>
            {scoreText(match)}
          </div>
          {!compact && <div className="mt-1 text-[10px] font-medium text-white/35">GMT+7</div>}
        </div>
        <TeamBlock name={match.away_team_display || match.away_team_name_vi} flag={match.away_team_flag} align="right" />
      </div>

      {!compact && (match.home_scorers_list?.length > 0 || match.away_scorers_list?.length > 0) && (
        <div className="mx-3 mb-3 grid grid-cols-2 gap-3 rounded-md bg-white/5 px-3 py-2 text-[11px] text-white/55">
          <div className="truncate">{match.home_scorers_list?.join(', ')}</div>
          <div className="truncate text-right">{match.away_scorers_list?.join(', ')}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 px-3 py-2 text-[11px] text-white/45">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CalendarClock size={13} className="shrink-0" />
          <span className="truncate">{match.kickoffAtVN || 'Đang cập nhật giờ Việt Nam'}</span>
        </span>
        {!compact && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{match.stadium_name ? `${match.stadium_name}, ${match.stadium_country_vi}` : 'Đang cập nhật sân'}</span>
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {match.isUpcoming && <ReminderButton match={match} compact={compact} />}
          {href && (
            <a href={href} className="inline-flex items-center gap-1.5 rounded-md bg-[#ED2C25] px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-red-700">
              {match.isFinished && !hasHighlight ? <Info size={12} /> : <Play size={12} fill="currentColor" />}
              {match.isFinished ? (hasHighlight ? 'Xem highlight' : (compact ? 'Chi tiết' : 'Xem chi tiết trận đấu')) : 'Xem'}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ReminderButton({ match, compact }) {
  const storageKey = `worldcup_reminder_${match.id}`;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  const notify = () => {
    const title = `${match.home_team_display || match.home_team_name_vi} vs ${match.away_team_display || match.away_team_name_vi}`;
    const body = 'Trận đấu sắp bắt đầu sau 30 phút.';
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: storageKey });
    } else {
      alert(`${title}\n${body}`);
    }
  };

  const schedule = async () => {
    if (!match.kickoffAt) return;
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    localStorage.setItem(storageKey, '1');
    setEnabled(true);

    const remindAt = new Date(match.kickoffAt).getTime() - 30 * 60 * 1000;
    const delay = remindAt - Date.now();
    if (delay <= 0) {
      notify();
      return;
    }
    if (delay < 2147483647) {
      window.setTimeout(notify, delay);
    }
  };

  return (
    <button type="button" onClick={schedule} disabled={enabled} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-extrabold transition-colors ${enabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'}`}>
      <Bell size={12} />
      {enabled ? 'Đã nhắc' : compact ? 'Nhắc' : 'Nhắc tôi 30p'}
    </button>
  );
}
