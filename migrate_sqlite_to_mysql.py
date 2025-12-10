#!/usr/bin/env python3
"""
Script để migrate dữ liệu từ SQLite sang MySQL (no auth)
"""

import sqlite3
import mysql.connector
from mysql.connector import Error
import sys
from typing import Optional

def create_mysql_database(host: str = 'localhost', port: int = 3306, 
                         user: str = 'root', password: Optional[str] = None, 
                         database: str = 'stocks_db'):
    """Tạo database MySQL và các bảng"""
    try:
        # Kết nối MySQL (không chỉ định database để tạo database mới)
        connect_kwargs = {
            'host': host,
            'port': port,
            'user': user
        }
        if password:
            connect_kwargs['password'] = password
        
        conn = mysql.connector.connect(**connect_kwargs)
        cursor = conn.cursor()
        
        # Tạo database nếu chưa tồn tại
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.execute(f"USE {database}")
        
        # Tạo bảng stocks
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stocks (
                symbol VARCHAR(50) PRIMARY KEY,
                company_name TEXT,
                exchange VARCHAR(20),
                market_cap DECIMAL(20, 2),
                beta DECIMAL(10, 6),
                eps DECIMAL(10, 2),
                roe DECIMAL(10, 6),
                roa DECIMAL(10, 6),
                match_price DECIMAL(10, 2),
                changed_value DECIMAL(10, 2),
                changed_ratio DECIMAL(10, 2),
                total_volume BIGINT,
                updated_at DATETIME,
                full_data_json LONGTEXT,
                INDEX idx_exchange (exchange),
                INDEX idx_updated_at (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')
        
        # Tạo bảng price_data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS price_data (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                symbol VARCHAR(50) NOT NULL,
                timestamp BIGINT NOT NULL,
                open_price DECIMAL(10, 2),
                high_price DECIMAL(10, 2),
                low_price DECIMAL(10, 2),
                close_price DECIMAL(10, 2),
                volume BIGINT,
                FOREIGN KEY (symbol) REFERENCES stocks(symbol) ON DELETE CASCADE,
                UNIQUE KEY unique_symbol_timestamp (symbol, timestamp),
                INDEX idx_symbol (symbol),
                INDEX idx_timestamp (timestamp),
                INDEX idx_symbol_timestamp (symbol, timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')
        
        conn.commit()
        print(f"✓ Đã tạo database và tables trong MySQL: {database}")
        return conn
        
    except Error as e:
        print(f"✗ Lỗi khi tạo database MySQL: {e}")
        sys.exit(1)

def migrate_data(sqlite_path: str, mysql_host: str = 'localhost', 
                mysql_port: int = 3306, mysql_user: str = 'root', 
                mysql_password: Optional[str] = None, mysql_database: str = 'stocks_db'):
    """Migrate dữ liệu từ SQLite sang MySQL"""
    
    # Kết nối SQLite
    print(f"Đang kết nối SQLite: {sqlite_path}")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_cursor = sqlite_conn.cursor()
    
    # Tạo MySQL database và tables
    mysql_conn = create_mysql_database(mysql_host, mysql_port, mysql_user, 
                                       mysql_password, mysql_database)
    mysql_cursor = mysql_conn.cursor()
    
    try:
        # Migrate bảng stocks
        print("\nĐang migrate bảng stocks...")
        sqlite_cursor.execute("SELECT COUNT(*) FROM stocks")
        total_stocks = sqlite_cursor.fetchone()[0]
        print(f"Tổng số cổ phiếu: {total_stocks}")
        
        sqlite_cursor.execute("""
            SELECT symbol, company_name, exchange, market_cap, beta, eps, roe, roa,
                   match_price, changed_value, changed_ratio, total_volume, updated_at, full_data_json
            FROM stocks
        """)
        
        stocks_data = sqlite_cursor.fetchall()
        
        insert_stocks_query = """
            INSERT INTO stocks (
                symbol, company_name, exchange, market_cap, beta, eps, roe, roa,
                match_price, changed_value, changed_ratio, total_volume, updated_at, full_data_json
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                exchange = VALUES(exchange),
                market_cap = VALUES(market_cap),
                beta = VALUES(beta),
                eps = VALUES(eps),
                roe = VALUES(roe),
                roa = VALUES(roa),
                match_price = VALUES(match_price),
                changed_value = VALUES(changed_value),
                changed_ratio = VALUES(changed_ratio),
                total_volume = VALUES(total_volume),
                updated_at = VALUES(updated_at),
                full_data_json = VALUES(full_data_json)
        """
        
        batch_size = 100
        for i in range(0, len(stocks_data), batch_size):
            batch = stocks_data[i:i + batch_size]
            mysql_cursor.executemany(insert_stocks_query, batch)
            mysql_conn.commit()
            print(f"  Đã migrate {min(i + batch_size, len(stocks_data))}/{len(stocks_data)} cổ phiếu")
        
        print(f"✓ Hoàn thành migrate {len(stocks_data)} cổ phiếu")
        
        # Migrate bảng price_data
        print("\nĐang migrate bảng price_data...")
        sqlite_cursor.execute("SELECT COUNT(*) FROM price_data")
        total_prices = sqlite_cursor.fetchone()[0]
        print(f"Tổng số bản ghi giá: {total_prices}")
        
        # Xóa dữ liệu cũ nếu có
        mysql_cursor.execute("DELETE FROM price_data")
        mysql_conn.commit()
        
        insert_price_query = """
            INSERT INTO price_data (
                symbol, timestamp, open_price, high_price, low_price, close_price, volume
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        # Migrate theo batch để tránh memory issue
        sqlite_cursor.execute("""
            SELECT symbol, timestamp, open_price, high_price, low_price, close_price, volume
            FROM price_data
            ORDER BY symbol, timestamp
        """)
        
        batch_size = 1000
        count = 0
        batch = []
        
        for row in sqlite_cursor:
            batch.append(row)
            count += 1
            
            if len(batch) >= batch_size:
                mysql_cursor.executemany(insert_price_query, batch)
                mysql_conn.commit()
                print(f"  Đã migrate {count}/{total_prices} bản ghi giá")
                batch = []
        
        # Insert phần còn lại
        if batch:
            mysql_cursor.executemany(insert_price_query, batch)
            mysql_conn.commit()
            print(f"  Đã migrate {count}/{total_prices} bản ghi giá")
        
        print(f"✓ Hoàn thành migrate {count} bản ghi giá")
        
        # Thống kê
        mysql_cursor.execute("SELECT COUNT(*) FROM stocks")
        mysql_stocks_count = mysql_cursor.fetchone()[0]
        
        mysql_cursor.execute("SELECT COUNT(*) FROM price_data")
        mysql_prices_count = mysql_cursor.fetchone()[0]
        
        print("\n" + "="*50)
        print("KẾT QUẢ MIGRATE:")
        print(f"  Stocks: {mysql_stocks_count} records")
        print(f"  Price Data: {mysql_prices_count} records")
        print("="*50)
        
    except Error as e:
        print(f"✗ Lỗi khi migrate dữ liệu: {e}")
        mysql_conn.rollback()
        sys.exit(1)
    
    finally:
        sqlite_conn.close()
        mysql_conn.close()
        print("\n✓ Đã đóng kết nối")

def main():
    sqlite_path = '/Users/phat@backbase.com/Projects/desktop-portfolio/server/data/stocks.db'
    
    # MySQL connection settings
    mysql_host = 'localhost'
    mysql_port = 3306
    mysql_user = 'root'
    mysql_password = None  # None = không dùng password, hoặc nhập password
    mysql_database = 'stocks_db'
    
    # Cho phép override từ command line
    if len(sys.argv) > 1:
        sqlite_path = sys.argv[1]
    if len(sys.argv) > 2:
        mysql_host = sys.argv[2]
    if len(sys.argv) > 3:
        mysql_port = int(sys.argv[3])
    if len(sys.argv) > 4:
        mysql_user = sys.argv[4]
    if len(sys.argv) > 5:
        # Nếu là empty string, set thành None
        mysql_password = sys.argv[5] if sys.argv[5] else None
    if len(sys.argv) > 6:
        mysql_database = sys.argv[6]
    
    print("="*50)
    print("MIGRATE SQLITE → MYSQL")
    print("="*50)
    print(f"SQLite: {sqlite_path}")
    password_display = "no password" if mysql_password is None else "***"
    print(f"MySQL: {mysql_user}@{mysql_host}:{mysql_port}/{mysql_database} (password: {password_display})")
    print("="*50)
    print("\n⚠️  Nếu gặp lỗi authentication, hãy:")
    print("   1. Chạy: ./setup_mysql_no_auth.sh để tạo user không password")
    print("   2. Hoặc chỉ định password: python3 migrate_sqlite_to_mysql.py <sqlite> localhost 3306 root <password> stocks_db")
    print("="*50)
    print()
    
    migrate_data(sqlite_path, mysql_host, mysql_port, mysql_user, 
                mysql_password, mysql_database)

if __name__ == '__main__':
    main()

