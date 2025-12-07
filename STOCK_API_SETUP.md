# Stock API Setup - JSON Storage với GitHub Auto-commit

## Tổng quan

Hệ thống lưu trữ dữ liệu cổ phiếu vào JSON files và tự động commit lên GitHub thay vì sử dụng Google Sheets (tránh giới hạn 10 triệu ô).

## Cấu trúc

- Mỗi mã cổ phiếu được lưu dưới dạng file JSON: `src/assets/stocks/{SYMBOL}.json`
- File JSON chứa:
  - `symbol`: Mã cổ phiếu
  - `basicInfo`: Thông tin cơ bản
  - `priceData`: Dữ liệu giá (OHLC)
  - `fullData`: Dữ liệu đầy đủ từ DNSE
  - `updatedAt`: Thời gian cập nhật

## API Endpoints

### 1. Lưu dữ liệu cổ phiếu
**POST** `/api/stocks/save`

**Request Body:**
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

### 2. Đọc dữ liệu cổ phiếu
**GET** `/api/stocks/{SYMBOL}`

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
  },
  "symbol": "ACV"
}
```

### 3. Lấy danh sách mã cổ phiếu
**GET** `/api/stocks/list`

**Response:**
```json
{
  "success": true,
  "symbols": ["ACV", "VCB", "VNM", ...],
  "count": 100
}
```

## Cấu hình Environment Variables

Thêm các biến môi trường sau vào Vercel:

1. **GITHUB_TOKEN**: Personal Access Token từ GitHub
   - Tạo tại: https://github.com/settings/tokens
   - Quyền cần: `repo` (full control of private repositories)

2. **GITHUB_REPO_OWNER**: Tên owner của repo (mặc định: `hongphat`)

3. **GITHUB_REPO_NAME**: Tên repo (mặc định: `desktop-portfolio`)

4. **GITHUB_BRANCH**: Branch để commit (mặc định: `master`)

## Cách tạo GitHub Token

1. Vào https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Đặt tên token (ví dụ: "Vercel Stock API")
4. Chọn scope: `repo` (full control)
5. Click "Generate token"
6. Copy token và thêm vào Vercel Environment Variables

## Cách sử dụng trong Stock App

Cập nhật `stock-app.component.ts` để sử dụng API mới:

```typescript
// Thay vì gọi Google Sheets
saveToStockAPI(symbol: string, data: DNSEStockData, priceData: DNSEOHLCData) {
  this.http.post('/api/stocks/save', {
    symbol: symbol,
    basicInfo: this.extractBasicInfo(data),
    priceData: priceData,
    fullData: data.fullData || data
  }).subscribe({
    next: (response) => {
      console.log(`✅ Đã lưu ${symbol} vào JSON và commit lên GitHub`);
    },
    error: (error) => {
      console.error(`❌ Lỗi khi lưu ${symbol}:`, error);
    }
  });
}
```

## Lợi ích

1. ✅ Không bị giới hạn 10 triệu ô như Google Sheets
2. ✅ Dữ liệu được version control trên GitHub
3. ✅ Dễ dàng backup và restore
4. ✅ Có thể truy cập trực tiếp từ GitHub raw URL
5. ✅ Tự động commit khi có thay đổi
6. ✅ Dễ dàng tích hợp với các tool khác

## File Structure

```
src/assets/stocks/
├── ACV.json
├── VCB.json
├── VNM.json
└── ...
```

Mỗi file JSON có format:
```json
{
  "symbol": "ACV",
  "basicInfo": {
    "companyName": "...",
    "exchange": "...",
    ...
  },
  "priceData": {
    "t": [1234567890, ...],
    "o": [100, ...],
    "h": [110, ...],
    "l": [95, ...],
    "c": [105, ...],
    "v": [1000000, ...]
  },
  "fullData": {
    "pageProps.companyInfo.fullName": "...",
    ...
  },
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

