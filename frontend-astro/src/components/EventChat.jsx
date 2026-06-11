import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

const API_BASE = '/api';
const REFRESH_INTERVAL_MS = 4000;

function getChatIdentity() {
  const userId = localStorage.getItem('userToken');
  const userName = localStorage.getItem('userName');
  if (userId && userName) return { userId, userName };

  let guestId = localStorage.getItem('eventChatGuestId');
  if (!guestId) {
    guestId = `guest_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    localStorage.setItem('eventChatGuestId', guestId);
  }
  return { userId: guestId, userName: `Khách ${guestId.slice(-4)}` };
}

export default function EventChat({ eventId }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const chatId = `event:${eventId}`;

  const loadMessages = async ({ quiet = false } = {}) => {
    try {
      const response = await fetch(`${API_BASE}/comments/${encodeURIComponent(chatId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      setMessages((data.data || []).slice().reverse());
      if (!quiet) setError('');
    } catch {
      if (!quiet) setError('Không thể tải tin nhắn lúc này.');
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = setInterval(() => loadMessages({ quiet: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [chatId]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const submitMessage = async event => {
    event.preventDefault();
    const message = content.trim();
    if (!message || sending) return;

    setSending(true);
    setError('');
    try {
      const identity = getChatIdentity();
      const response = await fetch(`${API_BASE}/comments/${encodeURIComponent(chatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': identity.userId },
        body: JSON.stringify({ content: message, username: identity.userName }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      setMessages(current => [...current, data.data]);
      setContent('');
    } catch {
      setError('Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="flex h-[430px] min-h-0 w-full flex-col overflow-hidden border-y border-white/10 bg-[#151515] lg:h-[480px] lg:rounded-lg lg:border">
      <div className="border-b border-white/10 bg-[#101010] px-4 py-3">
        <div className="font-bold text-white">Trò chuyện trực tiếp</div>
        <div className="text-xs text-white/45">Kênh chat sự kiện</div>
      </div>

      <div ref={listRef} className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length ? messages.map(message => (
          <div key={message.id} className="flex gap-2.5 rounded-lg bg-black/25 px-3 py-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white flex items-center justify-center">
              {message.avatar ? (
                <img src={message.avatar} alt="" className="h-full w-full object-contain p-0.5" />
              ) : (
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-xs font-bold text-[#ED2C25]">{message.username}</span>
                <time className="shrink-0 text-[10px] text-white/30">
                  {new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-white/80">{message.content}</p>
            </div>
          </div>
        )) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-white/35">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</div>
        )}
      </div>

      <form onSubmit={submitMessage} className="border-t border-white/10 bg-[#101010] p-3">
        {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={content}
            onChange={event => setContent(event.target.value.slice(0, 500))}
            placeholder="Nhập nội dung chat..."
            aria-label="Nội dung chat sự kiện"
            autoComplete="off"
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5 text-base text-white outline-none focus:border-[#ED2C25]"
          />
          <button type="submit" disabled={!content.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ED2C25] text-white disabled:cursor-not-allowed disabled:opacity-40" title="Gửi tin nhắn">
            <Send size={18} />
          </button>
        </div>
      </form>
    </aside>
  );
}
