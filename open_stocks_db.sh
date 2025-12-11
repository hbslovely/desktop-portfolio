#!/bin/bash
# Script để mở SQLite database stocks.db

DB_PATH="/Users/phat@backbase.com/Projects/desktop-portfolio/server/data/stocks.db"

if [ ! -f "$DB_PATH" ]; then
    echo "Database không tồn tại tại: $DB_PATH"
    exit 1
fi

echo "Đang mở database: $DB_PATH"
echo "Sử dụng lệnh .help để xem các lệnh có sẵn"
echo "Sử dụng .tables để xem danh sách bảng"
echo "Sử dụng .schema để xem cấu trúc bảng"
echo ""

sqlite3 "$DB_PATH"





