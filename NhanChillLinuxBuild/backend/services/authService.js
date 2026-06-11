// Auth Service for NhanChillTV v1.4
const crypto = require('crypto');
const config = require('../config');

class AuthService {
  generateStreamToken(ip, channelId) {
    // Thời hạn token mặc định 12 giờ (43200 giây) để tránh player bị ngắt
    const expires = Math.floor(Date.now() / 1000) + 43200;
    
    // Tạo mã MD5 băm theo chuẩn Nginx Secure Link
    // Cấu trúc: "expires/channelIdIP secret"
    const secret = config.jwtSecret; 
    const str = `${expires}/${channelId}${ip} ${secret}`;
    const hash = crypto.createHash('md5').update(str).digest('base64');
    
    // Nginx base64url encode format: thay thế +/ và bỏ =
    const token = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    return { token, expires };
  }

  getClientIp(req) {
    // Ưu tiên X-Real-IP từ Nginx để chống IP Spoofing qua X-Forwarded-For
    return req.headers['x-real-ip'] || req.socket.remoteAddress;
  }
}

module.exports = new AuthService();
