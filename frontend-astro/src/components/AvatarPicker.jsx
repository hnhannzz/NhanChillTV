import React, { useState } from 'react';
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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151515]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div><h2 className="font-bold">Chọn avatar</h2><p className="text-xs text-white/45">Animal icon pack</p></div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" title="Đóng"><X size={19} /></button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 overflow-y-auto p-4 h-[280px] md:h-[400px]">
          {ANIMAL_AVATARS.map(avatar => (
            <button key={avatar.src} onClick={() => setSelected(avatar.src)} className={`relative aspect-square rounded-md border bg-white p-2 ${selected === avatar.src ? 'border-[#ED2C25] ring-2 ring-[#ED2C25]/35' : 'border-transparent hover:border-white/30'}`} title={avatar.name}>
              <img src={avatar.src} alt={avatar.name} className="h-full w-full object-contain" />
              {selected === avatar.src && <span className="absolute right-1 top-1 rounded-full bg-[#ED2C25] p-0.5 text-white"><Check size={12} /></span>}
            </button>
          ))}
        </div>
        {error && <div className="px-5 pb-2 text-sm text-red-400">{error}</div>}
        <div className="flex justify-end border-t border-white/10 px-5 py-4">
          <button disabled={saving} onClick={save} className="rounded-md bg-[#ED2C25] px-5 py-2 text-sm font-bold disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu avatar'}</button>
        </div>
      </div>
    </div>
  );
}
