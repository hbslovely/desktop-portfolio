# Hướng dẫn Migrate SQLite sang MySQL

## Bước 1: Cài đặt MySQL

### Option 1: Sử dụng Docker (Khuyên dùng)

```bash
# Khởi động MySQL container
docker-compose -f docker-compose.mysql.yml up -d

# Kiểm tra MySQL đã chạy
docker ps | grep mysql
```

### Option 2: Cài đặt MySQL trực tiếp

Trên macOS:
```bash
brew install mysql
brew services start mysql
```

## Bước 2: Cài đặt Python dependencies

```bash
pip3 install -r requirements_mysql.txt
```

Hoặc:
```bash
pip3 install mysql-connector-python
```

## Bước 3: Cấu hình MySQL (QUAN TRỌNG)

MySQL thường yêu cầu password. Bạn có 2 lựa chọn:

### Option A: Tạo user mới không có password (Khuyên dùng)

```bash
# Chạy script tự động
./setup_mysql_no_auth.sh

# Hoặc thủ công:
mysql -u root -p
```

Sau đó trong MySQL:
```sql
CREATE USER IF NOT EXISTS 'stocks_user'@'localhost' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON stocks_db.* TO 'stocks_user'@'localhost';
FLUSH PRIVILEGES;
```

Sau đó chạy migration với user mới:
```bash
python3 migrate_sqlite_to_mysql.py \
  server/data/stocks.db \
  localhost \
  3306 \
  stocks_user \
  "" \
  stocks_db
```

### Option B: Sử dụng root với password

```bash
python3 migrate_sqlite_to_mysql.py \
  server/data/stocks.db \
  localhost \
  3306 \
  root \
  "your_password" \
  stocks_db
```

## Bước 4: Chạy migration

```bash
python3 migrate_sqlite_to_mysql.py
```

Hoặc với custom settings:
```bash
python3 migrate_sqlite_to_mysql.py \
  /path/to/stocks.db \
  localhost \
  3306 \
  root \
  "" \
  stocks_db
```

## Bước 5: Kiểm tra dữ liệu

### Sử dụng MySQL command line:
```bash
mysql -u root -h localhost stocks_db

# Trong MySQL:
SELECT COUNT(*) FROM stocks;
SELECT COUNT(*) FROM price_data;
SELECT * FROM stocks LIMIT 5;
```

### Hoặc sử dụng script Python:
```python
import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='',
    database='stocks_db'
)
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM stocks")
print(f"Total stocks: {cursor.fetchone()[0]}")
```

## Kết nối từ ứng dụng

### Connection string:
```
mysql://root@localhost:3306/stocks_db
```

### Node.js (mysql2):
```javascript
const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'stocks_db'
});
```

### Python:
```python
import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='',
    database='stocks_db'
)
```

## Troubleshooting

### Lỗi: "Access denied for user 'root'@'localhost'"
- Kiểm tra MySQL đã chạy: `docker ps` hoặc `brew services list`
- Thử reset password: `mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '';"`

### Lỗi: "Can't connect to MySQL server"
- Kiểm tra MySQL đã start: `docker ps` hoặc `brew services start mysql`
- Kiểm tra port 3306: `lsof -i :3306`

### Lỗi: "Unknown database 'stocks_db'"
- Script sẽ tự động tạo database, nhưng nếu lỗi, chạy:
  ```sql
  CREATE DATABASE stocks_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```

