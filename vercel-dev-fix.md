# Fix Vercel Dev - Không detect API Routes

## Vấn đề
Vercel dev đang chạy `ng serve` (Angular dev server) thay vì detect API routes. Trong logs không có "Detected API Routes".

## Nguyên nhân
Vercel detect `"framework": "angular"` và tự động chạy Angular dev command, bỏ qua API routes.

## Giải pháp

### Option 1: Tắt auto dev command (Đã thêm vào vercel.json)
Đã thêm `"devCommand": "echo 'API routes only'"` để Vercel không tự động chạy Angular.

**Restart server:**
```bash
# Dừng server (Ctrl+C)
npm run dev:api
```

**Kiểm tra logs:**
- Tìm "Detected API Routes" hoặc tương tự
- Không nên thấy "Running Dev Command"

### Option 2: Chạy riêng API server (Khuyến nghị)
Thay vì dùng `vercel dev`, chạy API server riêng:

```bash
# Terminal 1 - API Server
npm run dev:api

# Terminal 2 - Angular Dev Server  
npm run dev:angular
```

Sau đó Angular sẽ proxy requests đến API qua `proxy.conf.json`.

### Option 3: Xóa framework config
Nếu Option 1 không work, thử xóa `"framework": "angular"` trong vercel.json và để Vercel tự detect.

## Test sau khi fix:
```bash
curl http://localhost:3001/api/test-minimal
curl http://localhost:3001/api/stocks/list
```

## Lưu ý
- Vercel dev có thể không hoàn hảo với Angular + API routes cùng lúc
- Option 2 (chạy riêng) là cách ổn định nhất
- Production deployment sẽ work tốt vì Vercel build cả Angular và API routes

