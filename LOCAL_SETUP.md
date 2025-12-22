# Local Development Setup

## Quick Start

Chạy cả Angular app và API server cùng lúc:

```bash
npm run dev
```

Lệnh này sẽ:
- ✅ Khởi động API server tại `http://localhost:3001`
- ✅ Khởi động Angular app tại `http://localhost:3006`
- ✅ Angular app sẽ tự động proxy API requests đến API server

## Chạy riêng lẻ

### Chỉ chạy Angular app:
```bash
npm run dev:angular
# Hoặc
npm run dev:angular-only
```

### Chỉ chạy API server:
```bash
npm run dev:api
```

## Cấu trúc

- **Angular App**: `http://localhost:3006`
  - Frontend application
  - Tự động proxy `/api/stocks/*` đến API server

- **API Server**: `http://localhost:3001`
  - Backend API server
  - Endpoints:
    - `GET /api/test-minimal`
    - `GET /api/help`
    - `GET /api/stocks/list`
    - `POST /api/stocks/save`
    - `GET /api/stocks/:symbol`

## Proxy Configuration

Angular app sử dụng `proxy.conf.json` để proxy các API requests:
- `/api/stocks/*` → `http://localhost:3001/api/stocks/*`
- Các API khác (fireant, booking, etc.) → External URLs

## Environment Variables

Tạo file `.env.local` trong thư mục root nếu cần:

```env
GITHUB_TOKEN=your_github_token
GITHUB_APP_ID=your_app_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REPO_OWNER=hbslovely
GITHUB_REPO_NAME=desktop-portfolio
GITHUB_BRANCH=master
```

## Troubleshooting

### Port đã được sử dụng
Nếu port 3001 hoặc 3006 đã được sử dụng:
- Thay đổi port trong `server/api/api-server-simple.js` (line 10)
- Hoặc thay đổi port trong `package.json` script: `ng serve --port 4201`

### API không hoạt động
1. Kiểm tra API server đã chạy: `curl http://localhost:3001/api/test-minimal`
2. Kiểm tra proxy config trong `proxy.conf.json`
3. Kiểm tra console logs trong browser

### Dependencies chưa được cài
```bash
# Cài dependencies cho root project
npm install

# Cài dependencies cho server
cd server && npm install
```



