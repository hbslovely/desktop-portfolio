# Fix "spawn EBADF" Error

## Vấn đề
Lỗi "spawn EBADF" xảy ra khi Vercel dev server không thể spawn process để chạy serverless functions.

## Giải pháp

### 1. **Kiểm tra Vercel CLI version:**
```bash
vercel --version
```

Nếu version cũ, update:
```bash
npm install -g vercel@latest
```

### 2. **Clear cache và restart:**
```bash
# Dừng tất cả processes
# Xóa cache
rm -rf .vercel
rm -rf node_modules/.cache

# Restart server
npm run dev:api
```

### 3. **Kiểm tra Node.js version:**
```bash
node --version
```

Vercel yêu cầu Node.js >= 18. Nếu version thấp hơn, update Node.js.

### 4. **Thử chạy Vercel dev trực tiếp:**
```bash
cd /Users/hongphat/Projects/desktop-portfolio
vercel dev --listen 3001
```

Xem logs chi tiết để tìm lỗi cụ thể.

### 5. **Kiểm tra file permissions:**
```bash
ls -la api/stocks/
chmod +x api/stocks/*.js
```

### 6. **Thử với file đơn giản hơn:**
Tạo file `api/test.js`:
```javascript
export default async function handler(req) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Test: `curl http://localhost:3001/api/test`

### 7. **Kiểm tra environment variables:**
Đảm bảo các biến môi trường được set:
```bash
export GITHUB_TOKEN=your_token
export GITHUB_REPO_OWNER=hongphat
export GITHUB_REPO_NAME=desktop-portfolio
export GITHUB_BRANCH=master
```

### 8. **Thử chạy với debug mode:**
```bash
DEBUG=* vercel dev --listen 3001
```

### 9. **Kiểm tra logs trong terminal:**
Khi chạy `vercel dev`, xem terminal output để tìm lỗi cụ thể. Lỗi "spawn EBADF" thường đi kèm với thông tin chi tiết hơn.

### 10. **Nếu vẫn không được, thử cách khác:**
- Sử dụng `vercel dev --debug` để xem logs chi tiết
- Kiểm tra xem có process nào đang chiếm port 3001 không: `lsof -i :3001`
- Thử port khác: `vercel dev --listen 3002`

## Lưu ý
- Vercel dev cần restart sau mỗi lần thay đổi file trong `api/`
- Đảm bảo không có lỗi syntax trong các file JavaScript
- Kiểm tra xem Vercel có nhận diện được các file trong `api/stocks/` không

