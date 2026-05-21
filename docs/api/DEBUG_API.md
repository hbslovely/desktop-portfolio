# Debug API Issues

## Vấn đề: NO_RESPONSE_FROM_FUNCTION

### Các bước debug:

1. **Restart Vercel Dev Server:**
   ```bash
   # Dừng process hiện tại (Ctrl+C)
   # Sau đó chạy lại:
   npm run dev:api
   ```

2. **Kiểm tra logs trong terminal:**
   - Xem terminal nơi chạy `vercel dev`
   - Tìm các lỗi TypeScript compilation
   - Tìm các lỗi "spawn EBADF" hoặc "NO_RESPONSE_FROM_FUNCTION"

3. **Test API trực tiếp:**
   ```bash
   curl http://localhost:3001/api/stocks/list
   curl http://localhost:3001/api/stocks/test
   ```

4. **Kiểm tra Environment Variables:**
   ```bash
   # Trong terminal chạy vercel dev, kiểm tra:
   echo $GITHUB_TOKEN
   echo $GITHUB_REPO_OWNER
   echo $GITHUB_REPO_NAME
   echo $GITHUB_BRANCH
   ```

5. **Kiểm tra file structure:**
   - Đảm bảo các file trong `api/stocks/` có đúng format
   - Đảm bảo có `export default async function handler`

6. **Thử với function đơn giản:**
   - Tạo file `api/simple-test.ts` với code đơn giản nhất
   - Test xem Vercel có nhận diện được không

## Nếu vẫn lỗi:

1. **Kiểm tra Vercel CLI version:**
   ```bash
   vercel --version
   ```

2. **Update Vercel CLI:**
   ```bash
   npm install -g vercel@latest
   ```

3. **Clear Vercel cache:**
   ```bash
   rm -rf .vercel
   vercel dev
   ```

4. **Kiểm tra TypeScript compilation:**
   ```bash
   npx tsc --noEmit api/stocks/list.ts
   ```

## Lưu ý:

- Vercel dev server cần restart sau khi thêm/sửa API functions
- Đảm bảo không có lỗi TypeScript compilation
- Kiểm tra logs trong terminal chạy `vercel dev` để xem lỗi cụ thể


