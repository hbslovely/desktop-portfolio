# Quick Start: Migrate SQLite → MySQL

## Cách nhanh nhất:

### 1. Tạo user MySQL không cần password:
```bash
./setup_mysql_no_auth.sh
```
(Nhập password MySQL root khi được hỏi)

### 2. Chạy migration:
```bash
python3 migrate_sqlite_to_mysql.py \
  server/data/stocks.db \
  localhost \
  3306 \
  stocks_user \
  "" \
  stocks_db
```

## Hoặc nếu MySQL root không có password:

```bash
python3 migrate_sqlite_to_mysql.py
```

## Kết quả:
- Database: `stocks_db`
- Tables: `stocks`, `price_data`
- Connection: `mysql://stocks_user@localhost:3306/stocks_db`

## Kiểm tra:
```bash
mysql -u stocks_user -h localhost stocks_db -e "SELECT COUNT(*) FROM stocks;"
```




