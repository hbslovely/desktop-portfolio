# WebRTC Signaling Server

Server Node.js để xử lý signaling cho WebRTC video chat.

## 🚀 Deploy lên Render.com (5 phút)

### Bước 1: Push code lên GitHub

```bash
# Từ thư mục gốc project
git add signaling-server/
git commit -m "Add WebRTC signaling server"
git push origin main
```

### Bước 2: Tạo Web Service trên Render

1. Mở: https://dashboard.render.com/web/new
2. Chọn **"Build and deploy from a Git repository"**
3. Connect GitHub và chọn repo của bạn
4. Điền thông tin:

| Field | Value |
|-------|-------|
| **Name** | `webrtc-signaling` |
| **Region** | `Singapore` (hoặc gần bạn nhất) |
| **Branch** | `main` |
| **Root Directory** | `signaling-server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

5. Click **"Create Web Service"**

### Bước 3: Lấy URL Server

Sau khi deploy xong (~2-3 phút), bạn sẽ có URL như:
```
https://webrtc-signaling.onrender.com
```

### Bước 4: Cập nhật Angular App

Mở file `src/environments/environment.prod.ts` và thay URL:

```typescript
signalingServerUrl: 'https://webrtc-signaling.onrender.com',
```

Hoặc thêm vào `.env` file:
```
NG_APP_SIGNALING_SERVER_URL=https://webrtc-signaling.onrender.com
```

### Bước 5: Test

1. Mở 2 browser/tab khác nhau
2. Truy cập `http://localhost:3006/chat`
3. Tạo room ở tab 1, copy Room ID
4. Join room đó ở tab 2
5. Video call sẽ hoạt động! 🎉

---

## 🧪 Test Local

**Terminal 1 - Chạy Server:**
```bash
cd signaling-server
npm install
npm start
```

**Terminal 2 - Chạy Angular:**
```bash
npm run dev
```

Truy cập: http://localhost:3006/chat

---

## 📡 API Endpoints

### Health Check
```
GET https://your-server.onrender.com/
```

Response:
```json
{
  "status": "ok",
  "message": "WebRTC Signaling Server is running",
  "activeRooms": 2,
  "activeUsers": 5
}
```

### Get Room Info
```
GET /api/rooms/:roomId
```

### Create Room
```
POST /api/rooms
```

---

## ⚡ Socket.IO Events

### Client gửi đến Server

| Event | Data | Mô tả |
|-------|------|-------|
| `join-room` | `{ roomId, userName }` | Vào phòng |
| `leave-room` | - | Rời phòng |
| `offer` | `{ targetId, offer }` | Gửi SDP offer |
| `answer` | `{ targetId, answer }` | Gửi SDP answer |
| `ice-candidate` | `{ targetId, candidate }` | Gửi ICE candidate |
| `chat-message` | `{ roomId, message }` | Gửi tin nhắn |

### Server gửi đến Client

| Event | Data | Mô tả |
|-------|------|-------|
| `room-joined` | `{ roomId, participants, userId }` | Đã vào phòng |
| `user-joined` | `{ userId, userName }` | Có người mới vào |
| `user-left` | `{ userId, userName }` | Có người rời đi |
| `offer` | `{ senderId, offer }` | Nhận SDP offer |
| `answer` | `{ senderId, answer }` | Nhận SDP answer |
| `ice-candidate` | `{ senderId, candidate }` | Nhận ICE candidate |
| `chat-message` | `ChatMessage` | Nhận tin nhắn |

---

## 🔧 Environment Variables (Optional)

| Variable | Mô tả | Default |
|----------|-------|---------|
| `PORT` | Port server | `3007` (Render tự set `10000`) |
| `ALLOWED_ORIGINS` | Danh sách origins được phép | `*` (tất cả) |

Ví dụ giới hạn origins:
```
ALLOWED_ORIGINS=https://myapp.vercel.app,https://mydomain.com
```

---

## 🏗️ Architecture

```
┌─────────────┐                    ┌─────────────┐
│   User A    │                    │   User B    │
│  (Browser)  │                    │  (Browser)  │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │    1. Connect WebSocket          │
       ├──────────────────────────────────┤
       │                                  │
       ▼                                  ▼
┌─────────────────────────────────────────────────┐
│         Signaling Server (Render.com)           │
│                                                 │
│  • Quản lý rooms                                │
│  • Exchange SDP offers/answers                  │
│  • Exchange ICE candidates                      │
│  • Relay chat messages                          │
└─────────────────────────────────────────────────┘
       │                                  │
       │    2. After signaling:           │
       │       Direct P2P connection      │
       │                                  │
       ▼                                  ▼
┌─────────────┐    WebRTC P2P     ┌─────────────┐
│   User A    │◄────────────────►│   User B    │
│   Video     │   (Direct media) │   Video     │
└─────────────┘                  └─────────────┘
```

---

## ❓ Troubleshooting

### Server không connect được?
- Kiểm tra URL có đúng không (bao gồm `https://`)
- Mở URL server trong browser để xem status
- Check console log của browser

### Video không hiển thị?
- Cho phép camera/microphone trong browser
- Kiểm tra HTTPS (WebRTC yêu cầu HTTPS trên production)

### Free tier chậm?
- Render free tier sẽ sleep sau 15 phút không hoạt động
- Request đầu tiên mất ~30s để wake up
- Upgrade lên paid plan nếu cần

---

## 📝 License

MIT
