# API Setup Guide

## Quick Start

### Local Development

1. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment variables:**
   Tạo file `.env.local` hoặc export:
   ```bash
   export GITHUB_TOKEN=your_token_here
   export GITHUB_REPO_OWNER=hongphat
   export GITHUB_REPO_NAME=desktop-portfolio
   export GITHUB_BRANCH=master
   ```

3. **Chạy development servers:**
   ```bash
   npm run dev
   ```
   
   Lệnh này sẽ chạy:
   - Vercel dev server (port 3001) - API routes
   - Angular dev server (port 4200) - Frontend

4. **Truy cập:**
   - Frontend: http://localhost:4200
   - API: http://localhost:3001/api/stocks/*

### Production (Vercel)

1. **Push code lên GitHub:**
   ```bash
   git push origin master
   ```

2. **Vercel tự động deploy:**
   - Vercel sẽ tự động detect API routes trong thư mục `api/`
   - API sẽ có sẵn tại: `https://your-domain.vercel.app/api/stocks/*`

3. **Cấu hình Environment Variables trong Vercel:**
   - Vào Vercel Dashboard → Project → Settings → Environment Variables
   - Thêm các biến:
     - `GITHUB_TOKEN`
     - `GITHUB_REPO_OWNER` (optional, default: hongphat)
     - `GITHUB_REPO_NAME` (optional, default: desktop-portfolio)
     - `GITHUB_BRANCH` (optional, default: master)

## API Endpoints

### POST /api/stocks/save
Lưu dữ liệu cổ phiếu vào JSON và commit lên GitHub

**Request:**
```json
{
  "symbol": "ACV",
  "basicInfo": { ... },
  "priceData": { ... },
  "fullData": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "message": "File committed successfully",
  "symbol": "ACV",
  "sha": "abc123..."
}
```

### GET /api/stocks/{SYMBOL}
Đọc dữ liệu cổ phiếu từ JSON

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ACV",
    "basicInfo": { ... },
    "priceData": { ... },
    "fullData": { ... },
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /api/stocks/list
Lấy danh sách tất cả mã cổ phiếu

**Response:**
```json
{
  "success": true,
  "symbols": ["ACV", "VCB", "VNM", ...],
  "count": 100
}
```

## File Structure

```
api/
└── stocks/
    ├── save.ts          # POST endpoint để lưu dữ liệu
    ├── [symbol].ts      # GET endpoint để đọc dữ liệu
    └── list.ts          # GET endpoint để lấy danh sách

src/assets/stocks/       # Nơi lưu JSON files (trong repo)
└── ACV.json
└── VCB.json
└── ...
```

## Troubleshooting

### Local: API không hoạt động

1. Kiểm tra Vercel dev server:
   ```bash
   curl http://localhost:3001/api/stocks/list
   ```

2. Kiểm tra environment variables:
   ```bash
   echo $GITHUB_TOKEN
   ```

3. Xem logs của Vercel dev server

### Production: API không hoạt động

1. Kiểm tra Vercel deployment logs
2. Kiểm tra environment variables trong Vercel Dashboard
3. Kiểm tra GitHub token có quyền `repo`

### CORS Errors

- Đảm bảo headers trong `vercel.json` đã được cấu hình
- Kiểm tra proxy config trong `proxy.conf.json` (local)

## Notes

- API routes tự động được detect bởi Vercel từ thư mục `api/`
- Không cần cấu hình thêm trong `vercel.json` cho API routes (chỉ cần headers)
- File JSON được lưu trong `src/assets/stocks/` và được commit lên GitHub
- Mỗi lần save sẽ tự động commit lên GitHub với message: "Update stock data for {SYMBOL}"

