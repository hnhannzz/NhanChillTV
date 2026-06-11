import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { ANIMAL_AVATARS } from '../lib/avatarPacks';

export default function AvatarPicker({ user, onClose, onSaved }) {
  const [selected, setSelected] = useState(user.avatar || ANIMAL_AVATARS[30].src);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/user/profile/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ avatar: selected }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      localStorage.setItem('userAvatar', data.data.avatar);
      onSaved(data.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[calc(var(--app-height,100dvh)-12px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#151515] shadow-2xl sm:max-h-[88vh] sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0"><h2 className="font-bold">Chọn avatar</h2><p className="truncate text-xs text-white/45">Chọn hình đại diện hiển thị trong chat</p></div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" title="Đóng"><X size={19} /></button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto overscroll-contain p-3 sm:grid-cols-6 sm:gap-3 sm:p-4 md:grid-cols-7">
          {ANIMAL_AVATARS.map(avatar => (
            <button key={avatar.src} onClick={() => setSelected(avatar.src)} className={`relative aspect-square min-h-14 rounded-xl border bg-white p-2 transition-transform active:scale-95 ${selected === avatar.src ? 'border-[#ED2C25] ring-2 ring-[#ED2C25]/35' : 'border-transparent hover:border-white/30'}`} title={avatar.name}>
              <img src={avatar.src} alt={avatar.name} className="h-full w-full object-contain" />
              {selected === avatar.src && <span className="absolute right-1 top-1 rounded-full bg-[#ED2C25] p-0.5 text-white"><Check size={12} /></span>}
            </button>
          ))}
        </div>
        {error && <div className="px-5 pb-2 text-sm text-red-400">{error}</div>}
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:flex sm:justify-end sm:px-5 sm:py-4">
          <button onClick={onClose} className="rounded-md bg-white/5 px-5 py-2.5 text-sm font-bold hover:bg-white/10">Hủy</button>
          <button disabled={saving} onClick={save} className="rounded-md bg-[#ED2C25] px-5 py-2.5 text-sm font-bold disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu avatar'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
