# Kiểm tra Vercel Dev Logs

## Bước 1: Restart Vercel Dev
```bash
# Dừng server hiện tại (Ctrl+C)
npm run dev:api
```

## Bước 2: Quan sát logs khi khởi động

Khi Vercel dev khởi động, tìm các dòng sau:

### ✅ Nếu thấy:
```
> Ready! Available at http://localhost:3001
Detected API Routes:
  /api/help
  /api/test-minimal
  /api/stocks-list
  ...
```
→ Vercel đã nhận diện được các routes

### ❌ Nếu thấy:
```
Error: spawn EBADF
NO_RESPONSE_FROM_FUNCTION
```
→ Có vấn đề với cách Vercel spawn process

### 🔍 Cần tìm:
- Bất kỳ error messages nào
- Warnings về file không được nhận diện
- Thông tin về compilation

## Bước 3: Test các routes

Sau khi server khởi động, test từng route:

```bash
# Test file đơn giản nhất
curl http://localhost:3001/api/test-minimal

# Test help
curl http://localhost:3001/api/help

# Test stocks-list
curl http://localhost:3001/api/stocks/list
```

## Bước 4: Nếu vẫn lỗi

1. **Chạy với debug mode:**
   ```bash
   DEBUG=* vercel dev --listen 3001
   ```

2. **Kiểm tra xem có process nào đang chiếm port:**
   ```bash
   lsof -i :3001
   ```

3. **Thử port khác:**
   ```bash
   vercel dev --listen 3002
   ```

4. **Kiểm tra Node.js version:**
   ```bash
   node --version
   # Cần >= 18
   ```

## Gửi thông tin để debug:
- Toàn bộ output khi chạy `vercel dev`
- Kết quả của `curl http://localhost:3001/api/test-minimal`
- Node.js version
- Vercel CLI version (đã check: 48.10.3)

