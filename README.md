# NhanChillTV Beta v1.3

## Cài đặt

### 1. Cài đặt FFmpeg
- Tải FFmpeg binary cho Windows
- Giải nén và đặt `ffmpeg.exe` vào: `ffmpeg-core/bin/ffmpeg.exe`

### 2. Cài đặt Node.js
- Tải và cài Node.js (phiên bản LTS)
- Chạy `start.bat` sẽ tự động cài dependencies

### 3. Khởi động hệ thống
```
start.bat
```

### 4. Tắt hệ thống
```
stop.bat
```

## Truy cập

- **Trang chủ**: http://localhost:8050
- **Truyền hình**: http://localhost:8050/tv.html
- **Admin**: http://localhost:8050/admin/
- **API**: http://localhost:3000/api

## Tính năng chính

### Người dùng
- Xem 200+ kênh IPTV
- Tìm kiếm và lọc kênh
- Yêu thích kênh
- Xem sự kiện bóng đá

### Admin
- Quản lý sự kiện
- Xem streams đang chạy
- CRUD events với thumbnail
- Mật khẩu mặc định: `admin123`

## Cơ chế hoạt động

1. User click kênh → API gọi FFmpeg transcode UDP→HLS
2. FFmpeg tạo HLS trong `nginx/temp/hls_temp/{channelId}/`
3. Player phát HLS qua Nginx
4. Heartbeat mỗi 60s để maintain session
5. Cleanup worker dọn streams inactive >5 phút

## Cấu trúc thư mục

```
NhanChillTV/
├── backend/          # Node.js API
├── ffmpeg-core/      # FFmpeg wrapper
├── nginx/            # Web server + HLS
│   ├── html/        # Frontend files
│   └── m3u_iptv/    # IPTV playlist
├── start.bat        # Khởi động
└── stop.bat         # Tắt
```

## Lưu ý

- Chỉ sử dụng cho nội dung có quyền hợp pháp
- Đổi mật khẩu admin trong `backend/config.js`
- Cấu hình FFmpeg trong config nếu cần tối ưu
