# Quick Deploy Guide

## Khi push code lên GitHub, Vercel sẽ tự động:

1. ✅ **Detect API routes** trong `api/` directory
2. ✅ **Build và deploy** chúng như serverless functions
3. ✅ **Tạo endpoints** tự động

## API Routes sẽ có sẵn tại:

- `https://your-domain.vercel.app/api/stocks/list`
- `https://your-domain.vercel.app/api/stocks/save`
- `https://your-domain.vercel.app/api/stocks/:symbol` (ví dụ: `/api/stocks/ACV`)

## Cần làm:

### 1. Set Environment Variables trong Vercel Dashboard:
- `GITHUB_TOKEN` (required) - GitHub personal access token với quyền `repo`
- `GITHUB_REPO_OWNER` (optional) - default: hbslovely
- `GITHUB_REPO_NAME` (optional) - default: desktop-portfolio  
- `GITHUB_BRANCH` (optional) - default: master

### 2. Push code:
```bash
git add .
git commit -m "Add stock API routes"
git push origin master
```

### 3. Kiểm tra deployment:
- Vào Vercel Dashboard → Deployments
- Xem "Functions" tab để thấy các API routes
- Test endpoints

## Lưu ý:

- **Local dev**: Dùng `npm run dev:api` (chạy `api-server-simple.js`)
- **Production**: Vercel tự động deploy từ `api/` directory
- Không cần làm gì thêm, Vercel tự động detect!

