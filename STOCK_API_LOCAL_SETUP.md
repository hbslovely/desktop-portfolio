# Stock API - Local Development Setup

## Tổng quan

Hệ thống API routes cho stocks được chạy thông qua Vercel serverless functions. Khi chạy local, bạn cần chạy cả Vercel dev server và Angular dev server.

## Cách chạy Local Development

### Option 1: Chạy cả hai server cùng lúc (Khuyến nghị)

```bash
npm run dev
```

Lệnh này sẽ:
- Chạy Vercel dev server trên port 3001 (API routes)
- Chạy Angular dev server trên port 3006 (Frontend)

Angular dev server sẽ tự động proxy requests đến `/api/stocks/*` đến Vercel dev server thông qua `proxy.conf.json`.

### Option 2: Chạy riêng từng server

**Terminal 1 - Vercel API Server:**
```bash
npm run dev:api
```

**Terminal 2 - Angular Dev Server:**
```bash
npm run dev:angular
```

### Option 3: Chỉ chạy Angular (không có API)

```bash
npm run dev:angular-only
```

Lưu ý: API routes sẽ không hoạt động với option này.

## Environment Variables cho Local

Tạo file `.env.local` trong root directory:

```env
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO_OWNER=hongphat
GITHUB_REPO_NAME=desktop-portfolio
GITHUB_BRANCH=master
```

Hoặc export trực tiếp trong terminal:

```bash
export GITHUB_TOKEN=your_token
export GITHUB_REPO_OWNER=hongphat
export GITHUB_REPO_NAME=desktop-portfolio
export GITHUB_BRANCH=master
```

## Cách tạo GitHub Token

1. Vào https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Đặt tên token (ví dụ: "Vercel Stock API Local")
4. Chọn scope: `repo` (full control)
5. Click "Generate token"
6. Copy token và thêm vào `.env.local` hoặc export

## Kiểm tra API hoạt động

Sau khi chạy `npm run dev`, bạn có thể test API:

**Lưu dữ liệu:**
```bash
curl -X POST http://localhost:3001/api/stocks/save \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ACV",
    "basicInfo": {},
    "priceData": {},
    "fullData": {}
  }'
```

**Đọc dữ liệu:**
```bash
curl http://localhost:3001/api/stocks/ACV
```

**Lấy danh sách:**
```bash
curl http://localhost:3001/api/stocks/list
```

## Cấu trúc Ports

- **Port 3001**: Vercel dev server (API routes)
- **Port 3006**: Angular dev server (Frontend)

Angular app sẽ gọi API thông qua proxy:
- Frontend: `http://localhost:3006/api/stocks/*`
- Proxy forward đến: `http://localhost:3001/api/stocks/*`

## Troubleshooting

### API không hoạt động

1. Kiểm tra Vercel dev server đã chạy chưa:
   ```bash
   curl http://localhost:3001/api/stocks/list
   ```

2. Kiểm tra environment variables:
   ```bash
   echo $GITHUB_TOKEN
   ```

3. Kiểm tra logs của Vercel dev server để xem lỗi

### CORS errors

Nếu gặp CORS errors, đảm bảo:
- Vercel dev server đang chạy
- Proxy config trong `proxy.conf.json` đúng
- Headers trong `vercel.json` đã được cấu hình

### Port đã được sử dụng

Nếu port 3001 hoặc 4200 đã được sử dụng:
- Thay đổi port trong script `dev:api`:
  ```json
  "dev:api": "vercel dev --listen 3002"
  ```
- Cập nhật `proxy.conf.json` với port mới

## Production (Vercel)

Khi deploy lên Vercel:
- API routes tự động được detect từ thư mục `api/`
- Environment variables cần được cấu hình trong Vercel Dashboard
- Không cần chạy Vercel dev server riêng

## Notes

- Vercel CLI cần được cài đặt: `npm install -g vercel` (hoặc dùng local version)
- Lần đầu chạy `vercel dev`, bạn có thể cần login: `vercel login`
- File `.vercelignore` đã được tạo để ignore các file không cần thiết khi deploy

