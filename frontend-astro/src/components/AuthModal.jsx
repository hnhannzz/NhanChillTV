import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const endpoint = isLogin ? '/api/user/login' : '/api/user/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        // Save user session
        localStorage.setItem('userToken', data.user.id);
        localStorage.setItem('userName', data.user.username);
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-[#121212] p-8 rounded-2xl border border-white/10 w-full max-w-sm relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
          <X size={20} />
        </button>
        
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
        </h2>
        
        {error && <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg mb-4 text-center">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input 
              type="text" 
              placeholder="Tên đăng nhập" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#ED2C25] focus:outline-none transition-colors"
              required
            />
          </div>
          <div className="mb-6">
            <input 
              type="password" 
              placeholder="Mật khẩu" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#ED2C25] focus:outline-none transition-colors"
              required
            />
          </div>
          <button type="submit" className="w-full bg-[#ED2C25] text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-[#ED2C25]/20">
            {isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-white/50">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-[#ED2C25] hover:underline font-medium">
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
