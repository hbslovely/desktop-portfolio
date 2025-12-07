# Fix Vercel Dev - NO_RESPONSE_FROM_FUNCTION

## Vấn đề
Tất cả các API routes trả về "NO_RESPONSE_FROM_FUNCTION", kể cả file đơn giản nhất.

## Nguyên nhân có thể
Vercel dev có thể không nhận diện được các file `.js` với ES modules hoặc có vấn đề với cách nó compile các file.

## Giải pháp

### 1. **Kiểm tra Vercel CLI version và update:**
```bash
vercel --version
npm install -g vercel@latest
```

### 2. **Clear cache và restart:**
```bash
# Dừng tất cả processes
# Xóa cache
rm -rf .vercel
rm -rf node_modules/.cache

# Restart
npm run dev:api
```

### 3. **Kiểm tra logs khi khởi động:**
Khi chạy `vercel dev`, tìm các dòng:
- "Detected API Routes"
- "Ready! Available at http://localhost:3001"
- Bất kỳ error messages nào

### 4. **Thử chạy với debug mode:**
```bash
DEBUG=* vercel dev --listen 3001
```

### 5. **Kiểm tra xem Vercel có nhận diện được các file:**
Trong logs, tìm xem có list các routes như:
- `/api/help`
- `/api/stocks-list`
- `/api/stocks/save`
- etc.

### 6. **Nếu vẫn không được, thử cách khác:**

**Option A: Sử dụng TypeScript thay vì JavaScript**
- Đổi các file `.js` thành `.ts`
- Vercel dev có thể nhận diện TypeScript tốt hơn

**Option B: Kiểm tra package.json**
- Đảm bảo có `"type": "module"` nếu cần
- Hoặc không có nếu Vercel tự xử lý

**Option C: Thử chạy trực tiếp với Node:**
```bash
# Test xem code có chạy được không
node --input-type=module -e "import('./api/stocks-list.js').then(m => console.log('OK'))"
```

### 7. **Kiểm tra environment:**
```bash
echo $GITHUB_TOKEN
echo $GITHUB_REPO_OWNER
```

### 8. **Nếu tất cả đều không được:**
Có thể cần:
- Update Node.js version (>= 18)
- Reinstall Vercel CLI
- Hoặc sử dụng Vercel production deployment thay vì dev mode

## Lưu ý
- Vercel dev cần restart sau mỗi lần thay đổi `vercel.json`
- Kiểm tra logs trong terminal chạy `vercel dev` để tìm lỗi cụ thể
- Có thể cần chờ vài giây sau khi restart để Vercel compile các files

