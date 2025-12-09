# Viet Stock API Server

API server cho Vietnamese Stock Data, sử dụng Vercel Serverless Functions và Vercel Postgres.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- Vercel CLI: `npm i -g vercel`
- Vercel account với Postgres database đã tạo

### 2. Setup Vercel Project

```bash
# Di chuyển vào thư mục server
cd server

# Login vào Vercel
vercel login

# Link project với Vercel (chọn project hiện có hoặc tạo mới)
vercel link
```

### 3. Kết nối Vercel Postgres

1. Vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Chọn project của bạn
3. Vào tab **Storage**
4. Chọn database **viet-stock-pool** (hoặc tạo mới nếu chưa có)
5. Click **Connect** để link database với project

Vercel sẽ tự động thêm các environment variables cần thiết.

### 4. Pull Environment Variables

```bash
# Pull env vars từ Vercel
vercel env pull .env.local
```

### 5. Run Database Migration

```bash
# Tạo các tables trong database
npm run db:migrate
```

### 6. (Optional) Import Data từ JSON files

```bash
# Import dữ liệu từ thư mục data/ vào database
npm run db:seed
```

### 7. Local Development

```bash
# Chạy development server
npm run dev
```

Server sẽ chạy tại `http://localhost:3000`

## 📚 API Endpoints

### Health Check
- `GET /api/health` - Kiểm tra trạng thái server và database

### Stocks V2 (Database)
- `GET /api/stocks-v2/list` - Danh sách tất cả stocks
- `GET /api/stocks-v2/:symbol` - Chi tiết stock theo symbol
- `POST /api/stocks-v2/save` - Lưu/cập nhật stock data

### Stock Model
- `GET /api/stocks-v2/stock-model/:symbol` - Lấy model results
- `POST /api/stocks-v2/stock-model/:symbol` - Lưu model results

### Legacy (GitHub-based)
- `GET /api/stocks/list` - Danh sách stocks từ GitHub
- `GET /api/stocks/:symbol` - Chi tiết stock từ GitHub

## 🗄️ Database Schema

### stocks (JSON storage - backward compatible)
```sql
- id: SERIAL PRIMARY KEY
- symbol: VARCHAR(20) UNIQUE
- basic_info: JSONB
- price_data: JSONB
- full_data: JSONB
- created_at, updated_at: TIMESTAMP
```

### stock_details (Normalized columns)
```sql
-- Basic Info
- symbol: VARCHAR(20) UNIQUE
- company_name, company_name_en, short_name: VARCHAR
- exchange: VARCHAR(20)
- match_price, changed_value: DECIMAL
- changed_ratio: DECIMAL
- total_volume: BIGINT
- market_cap, capital: DECIMAL
- beta, eps, roe, roa: DECIMAL

-- Company Info
- company_id: INTEGER
- tax_code, address, phone, fax, email, website: VARCHAR/TEXT
- logo_url: TEXT
- outstanding_shares: BIGINT
- listed_date: DATE
- is_margin, is_ftse, is_vn30, is_hnx30: BOOLEAN

-- Industry Classification
- industry_name, sub_industry_name, sector_name: VARCHAR
- sector_index_id: INTEGER
- sector_index_name: VARCHAR

-- GICS Classification
- gics_sector, gics_industry_group, gics_industry, gics_sub_industry: VARCHAR
- gics_sector_id, gics_industry_group_id, gics_industry_id, gics_sub_industry_id: VARCHAR

-- Additional
- introduction, notes: TEXT
- audit_firm, contact_person, contact_position: VARCHAR
- index_codes: TEXT[]
```

### stock_models
```sql
- symbol: VARCHAR(20) UNIQUE
- simulation_result: JSONB
- trading_config: JSONB
- date_range: JSONB
- simulations: JSONB (array)
```

### price_history
```sql
- symbol: VARCHAR(20)
- date: DATE
- open, high, low, close: DECIMAL
- volume: BIGINT
- UNIQUE(symbol, date)
```

## 🔧 Scripts

```bash
# Development
npm run dev          # Vercel dev server
npm run dev:api      # Simple Node.js API server

# Database
npm run db:migrate   # Chạy migrations
npm run db:seed      # Import data từ JSON files

# Build
npm run build        # Build for production
```

## 🌐 Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

## 📁 Project Structure

```
server/
├── api/
│   ├── health.js           # Health check endpoint
│   ├── help.js             # API documentation
│   ├── stocks/             # Legacy GitHub-based APIs
│   │   ├── list.js
│   │   ├── save.js
│   │   └── [symbol].js
│   └── stocks-v2/          # Database-based APIs
│       ├── list.js
│       ├── save.js
│       ├── stock-model.js
│       └── [symbol].js
├── lib/
│   └── db.js               # Database utilities
├── scripts/
│   ├── db-migrate.js       # Database migrations
│   └── db-seed.js          # Data seeding
├── data/                   # Local JSON data (for seeding)
├── vercel.json            # Vercel configuration
├── package.json
└── README.md
```

## 🔐 Environment Variables

| Variable | Description |
|----------|-------------|
| `VIET_STOCK_POOL_POSTGRES_URL` | Main database connection URL |
| `VIET_STOCK_POOL_POSTGRES_URL_NON_POOLING` | Direct connection URL |
| `VIET_STOCK_POOL_POSTGRES_USER` | Database username |
| `VIET_STOCK_POOL_POSTGRES_HOST` | Database host |
| `VIET_STOCK_POOL_POSTGRES_PASSWORD` | Database password |
| `VIET_STOCK_POOL_POSTGRES_DATABASE` | Database name |
| `GITHUB_APP_ID` | (Optional) GitHub App ID |
| `GITHUB_CLIENT_SECRET` | (Optional) GitHub App Private Key |
| `GITHUB_TOKEN` | (Optional) GitHub Personal Access Token |

> **Note:** Vercel tự động prefix tên database vào env vars. Nếu database tên "viet-stock-pool" thì biến sẽ là `VIET_STOCK_POOL_POSTGRES_URL`.

## 🐛 Troubleshooting

### Database connection failed
- Đảm bảo đã link Postgres database với project
- Chạy `vercel env pull .env.local` để lấy env vars mới nhất
- Kiểm tra `POSTGRES_URL` trong `.env.local`

### Migration failed
- Kiểm tra database connection với `/api/health`
- Đảm bảo database đang chạy và accessible

### Import data failed
- Đảm bảo thư mục `data/stocks/` tồn tại
- Kiểm tra format JSON files hợp lệ

## 📝 License

MIT
