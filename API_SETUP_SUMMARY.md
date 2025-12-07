# API Setup Summary

## ✅ Đã hoàn thành

### 1. API Routes
- ✅ `/api/stocks/save` - Lưu dữ liệu cổ phiếu
- ✅ `/api/stocks/[symbol]` - Đọc dữ liệu cổ phiếu  
- ✅ `/api/stocks/list` - Lấy danh sách mã cổ phiếu

### 2. Local Development
- ✅ Cài đặt Vercel CLI và concurrently
- ✅ Script `npm run dev` để chạy cả API và Frontend
- ✅ Proxy config để forward requests từ Angular đến Vercel dev server
- ✅ Port configuration: API (3001), Frontend (4200)

### 3. Production (Vercel)
- ✅ Vercel tự động detect API routes từ thư mục `api/`
- ✅ Headers CORS đã được cấu hình trong `vercel.json`
- ✅ `.vercelignore` để ignore các file không cần thiết

## 🚀 Cách sử dụng

### Local Development

1. **Setup environment variables:**
   ```bash
   export GITHUB_TOKEN=your_token
   export GITHUB_REPO_OWNER=hongphat
   export GITHUB_REPO_NAME=desktop-portfolio
   export GITHUB_BRANCH=master
   ```

2. **Chạy development:**
   ```bash
   npm run dev
   ```

3. **Truy cập:**
   - Frontend: http://localhost:4200
   - API: http://localhost:3001/api/stocks/*

### Production

1. **Push code:**
   ```bash
   git push origin master
   ```

2. **Vercel tự động deploy:**
   - API sẽ có sẵn tại: `https://your-domain.vercel.app/api/stocks/*`

3. **Cấu hình Environment Variables trong Vercel Dashboard:**
   - `GITHUB_TOKEN` (required)
   - `GITHUB_REPO_OWNER` (optional)
   - `GITHUB_REPO_NAME` (optional)
   - `GITHUB_BRANCH` (optional)

## 📁 File Structure

```
api/
└── stocks/
    ├── save.ts          # POST /api/stocks/save
    ├── [symbol].ts      # GET /api/stocks/{SYMBOL}
    └── list.ts          # GET /api/stocks/list

src/assets/stocks/       # JSON files location
└── ACV.json
└── VCB.json
└── ...
```

## 🔧 Configuration Files

- `vercel.json` - Vercel configuration với CORS headers
- `proxy.conf.json` - Angular proxy config cho local dev
- `package.json` - Scripts để chạy dev servers
- `.vercelignore` - Files to ignore khi deploy

## 📝 Next Steps

1. **Tạo GitHub Token:**
   - Vào https://github.com/settings/tokens
   - Generate token với quyền `repo`
   - Thêm vào Vercel Environment Variables

2. **Test API:**
   ```bash
   # Local
   curl http://localhost:3001/api/stocks/list
   
   # Production
   curl https://your-domain.vercel.app/api/stocks/list
   ```

3. **Cập nhật Stock App Component:**
   - Thay thế Google Sheets API calls bằng Stock API
   - Sử dụng `/api/stocks/save` để lưu dữ liệu
   - Sử dụng `/api/stocks/{symbol}` để đọc dữ liệu

## ⚠️ Lưu ý

- Vercel CLI cần được cài đặt (đã có trong devDependencies)
- Lần đầu chạy `vercel dev` có thể cần login: `vercel login`
- GitHub token cần có quyền `repo` để commit files
- File JSON được lưu trong `src/assets/stocks/` và tự động commit lên GitHub

