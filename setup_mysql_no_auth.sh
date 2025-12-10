#!/bin/bash
# Script để setup MySQL user không cần password

echo "Thiết lập MySQL user không cần password..."
echo ""
echo "Bạn cần nhập password MySQL root hiện tại để tạo user mới"
echo ""

read -sp "Nhập MySQL root password: " MYSQL_ROOT_PASSWORD
echo ""

# Tạo user mới không có password
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
-- Tạo user mới không có password
CREATE USER IF NOT EXISTS 'stocks_user'@'localhost' IDENTIFIED BY '';
CREATE USER IF NOT EXISTS 'stocks_user'@'%' IDENTIFIED BY '';

-- Cấp quyền
GRANT ALL PRIVILEGES ON stocks_db.* TO 'stocks_user'@'localhost';
GRANT ALL PRIVILEGES ON stocks_db.* TO 'stocks_user'@'%';

-- Hoặc nếu muốn dùng root không password (không khuyên dùng cho production)
-- ALTER USER 'root'@'localhost' IDENTIFIED BY '';

FLUSH PRIVILEGES;

SELECT 'User stocks_user đã được tạo thành công!' AS message;
EOF

echo ""
echo "✓ Hoàn thành!"
echo ""
echo "Bây giờ bạn có thể chạy migration với:"
echo "  python3 migrate_sqlite_to_mysql.py"
echo ""
echo "Hoặc chỉ định user mới:"
echo "  python3 migrate_sqlite_to_mysql.py <sqlite_path> localhost 3306 stocks_user '' stocks_db"


