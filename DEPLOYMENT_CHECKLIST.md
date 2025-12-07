# Deployment Checklist - Vercel API Routes

## ✅ Đã cấu hình

1. **vercel.json**:
   - ✅ `builds` config cho `api/**/*.js`
   - ✅ Rewrite rules cho stocks API
   - ✅ Headers (CORS) cho stocks API
   - ✅ Framework: "angular"

2. **API Files**:
   - ✅ `api/stocks/list.js` → `/api/stocks/list`
   - ✅ `api/stocks/save.js` → `/api/stocks/save`
   - ✅ `api/stocks/[symbol].js` → `/api/stocks/:symbol`
   - ✅ `api/package.json` với `"type": "module"`

3. **.vercelignore**:
   - ✅ Không ignore `api/` directory

## 📋 Trước khi push code

1. **Kiểm tra các file API có format đúng:**
   ```bash
   # Đảm bảo mỗi file có:
   export const config = { runtime: 'nodejs' };
   export default async function handler(req) { ... }
   ```

2. **Test local trước:**
   ```bash
   npm run dev:api
   curl http://localhost:3001/api/stocks/list
   ```

3. **Commit và push:**
   ```bash
   git add .
   git commit -m "Add stock API routes"
   git push origin master
   ```

## 🔧 Sau khi push lên Vercel

1. **Kiểm tra Deployment:**
   - Vào Vercel Dashboard → Project → Deployments
   - Xem deployment mới nhất
   - Kiểm tra "Functions" tab để xem các API routes

2. **Set Environment Variables:**
   - Vào Settings → Environment Variables
   - Thêm:
     - `GITHUB_TOKEN` (required)
     - `GITHUB_REPO_OWNER` (optional)
     - `GITHUB_REPO_NAME` (optional)
     - `GITHUB_BRANCH` (optional)

3. **Test API trên Production:**
   ```bash
   curl https://your-domain.vercel.app/api/stocks/list
   curl https://your-domain.vercel.app/api/stocks/ACV
   ```

## 🐛 Troubleshooting

### API không xuất hiện trong Functions tab

- Kiểm tra `vercel.json` có `builds` config đúng không
- Kiểm tra file có trong `api/` directory không
- Xem deployment logs để tìm lỗi

### API trả về 404

- Kiểm tra rewrite rules trong `vercel.json`
- Kiểm tra tên file có đúng không
- Kiểm tra dynamic routes có format `[symbol].js` không

### API trả về 500

- Xem function logs trong Vercel Dashboard
- Kiểm tra environment variables đã được set chưa
- Kiểm tra code có lỗi syntax không

## 📝 Lưu ý

- **Local**: Dùng `api-server-simple.js` (Node.js server)
- **Production**: Vercel tự động deploy từ `api/` directory
- **Không cần** `api-server-simple.js` trên production
- Vercel tự động detect và deploy khi push code

