# Vercel Deployment Configuration

## Tự động Deploy API Routes

Khi bạn push code lên GitHub, Vercel sẽ tự động:

1. **Detect các API routes** trong thư mục `api/`
2. **Build và deploy** chúng như serverless functions
3. **Tạo endpoints** tương ứng với cấu trúc file

## Cấu trúc API Routes

```
api/
├── stocks/
│   ├── list.js          → /api/stocks/list
│   ├── save.js          → /api/stocks/save
│   └── [symbol].js      → /api/stocks/:symbol (dynamic)
├── help.js              → /api/help
├── test-minimal.js      → /api/test-minimal
└── stocks-list.js       → /api/stocks-list (via rewrite)
```

## Cấu hình trong vercel.json

### 1. Builds Config
```json
"builds": [
  { "src": "api/**/*.js", "use": "@vercel/node" }
]
```
→ Vercel sẽ build tất cả file `.js` trong `api/` thành serverless functions

### 2. Rewrites (nếu cần)
```json
{
  "source": "/api/stocks/list",
  "destination": "/api/stocks-list.js"
}
```
→ Map URL đến file cụ thể

### 3. Headers (CORS)
```json
{
  "source": "/api/stocks/:path*",
  "headers": [
    {
      "key": "Access-Control-Allow-Origin",
      "value": "*"
    }
  ]
}
```

## Environment Variables

Đảm bảo set các biến môi trường trong Vercel Dashboard:

1. Vào Vercel Dashboard → Project → Settings → Environment Variables
2. Thêm:
   - `GITHUB_TOKEN` (required)
   - `GITHUB_REPO_OWNER` (optional, default: hongphat)
   - `GITHUB_REPO_NAME` (optional, default: desktop-portfolio)
   - `GITHUB_BRANCH` (optional, default: master)

## Kiểm tra Deployment

Sau khi push code:

1. **Xem deployment logs** trong Vercel Dashboard
2. **Kiểm tra Functions tab** để xem các API routes đã được deploy
3. **Test API endpoints:**
   ```bash
   curl https://your-domain.vercel.app/api/stocks/list
   curl https://your-domain.vercel.app/api/stocks/ACV
   ```

## Lưu ý

- **Local development**: Dùng `api-server-simple.js` (Node.js server)
- **Production (Vercel)**: Tự động deploy từ `api/` directory
- **Không cần** `api-server-simple.js` trên production (chỉ dùng cho local)
- Vercel tự động detect và deploy các file trong `api/` khi push code

## Troubleshooting

### API không hoạt động trên Vercel

1. **Kiểm tra Functions tab** trong Vercel Dashboard
2. **Xem deployment logs** để tìm lỗi
3. **Kiểm tra environment variables** đã được set chưa
4. **Kiểm tra file format** - đảm bảo có `export default async function handler`

### Dynamic routes không work

- Đảm bảo file có tên đúng format: `[symbol].js` (với brackets)
- Kiểm tra rewrite rules trong `vercel.json`

