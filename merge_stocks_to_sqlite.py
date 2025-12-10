#!/usr/bin/env python3
"""
Script để merge tất cả file JSON stocks vào một file SQLite
"""

import json
import sqlite3
import os
from pathlib import Path
from typing import Dict, Any, List
import sys

def create_database(db_path: str):
    """Tạo database và các bảng cần thiết"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Bảng stocks: lưu thông tin cơ bản của cổ phiếu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stocks (
            symbol TEXT PRIMARY KEY,
            company_name TEXT,
            exchange TEXT,
            market_cap REAL,
            beta REAL,
            eps REAL,
            roe REAL,
            roa REAL,
            match_price REAL,
            changed_value REAL,
            changed_ratio REAL,
            total_volume INTEGER,
            updated_at TEXT,
            full_data_json TEXT
        )
    ''')
    
    # Bảng price_data: lưu dữ liệu giá theo từng ngày
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            open_price REAL,
            high_price REAL,
            low_price REAL,
            close_price REAL,
            volume INTEGER,
            FOREIGN KEY (symbol) REFERENCES stocks(symbol),
            UNIQUE(symbol, timestamp)
        )
    ''')
    
    # Tạo index để tăng tốc độ truy vấn
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_price_symbol ON price_data(symbol)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_data(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_price_symbol_timestamp ON price_data(symbol, timestamp)')
    
    conn.commit()
    return conn

def insert_stock_data(conn: sqlite3.Connection, data: Dict[str, Any]):
    """Insert dữ liệu cổ phiếu vào database"""
    cursor = conn.cursor()
    
    symbol = data.get('symbol', '')
    basic_info = data.get('basicInfo', {})
    price_data = data.get('priceData', {})
    full_data = data.get('fullData', {})
    updated_at = data.get('updatedAt', '')
    
    # Lưu fullData dưới dạng JSON string
    full_data_json = json.dumps(full_data, ensure_ascii=False)
    
    # Insert hoặc update thông tin cơ bản
    cursor.execute('''
        INSERT OR REPLACE INTO stocks (
            symbol, company_name, exchange, market_cap, beta, eps, roe, roa,
            match_price, changed_value, changed_ratio, total_volume,
            updated_at, full_data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        symbol,
        basic_info.get('companyName', ''),
        basic_info.get('exchange', ''),
        basic_info.get('marketCap'),
        basic_info.get('beta'),
        basic_info.get('eps'),
        basic_info.get('roe'),
        basic_info.get('roa'),
        basic_info.get('matchPrice'),
        basic_info.get('changedValue'),
        basic_info.get('changedRatio'),
        basic_info.get('totalVolume'),
        updated_at,
        full_data_json
    ))
    
    # Insert dữ liệu giá
    timestamps = price_data.get('t', [])
    opens = price_data.get('o', [])
    highs = price_data.get('h', [])
    lows = price_data.get('l', [])
    closes = price_data.get('c', [])
    volumes = price_data.get('v', [])
    
    # Xóa dữ liệu giá cũ của symbol này
    cursor.execute('DELETE FROM price_data WHERE symbol = ?', (symbol,))
    
    # Insert dữ liệu giá mới
    if timestamps:
        price_records = []
        max_len = len(timestamps)
        
        for i in range(max_len):
            price_records.append((
                symbol,
                timestamps[i] if i < len(timestamps) else None,
                opens[i] if i < len(opens) else None,
                highs[i] if i < len(highs) else None,
                lows[i] if i < len(lows) else None,
                closes[i] if i < len(closes) else None,
                volumes[i] if i < len(volumes) else None
            ))
        
        cursor.executemany('''
            INSERT OR REPLACE INTO price_data (
                symbol, timestamp, open_price, high_price, low_price, close_price, volume
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', price_records)
    
    conn.commit()

def process_stocks_folder(stocks_folder: str, db_path: str):
    """Xử lý tất cả file JSON trong thư mục stocks"""
    stocks_path = Path(stocks_folder)
    
    if not stocks_path.exists():
        print(f"Thư mục không tồn tại: {stocks_folder}")
        return
    
    # Tạo database
    print(f"Đang tạo database: {db_path}")
    conn = create_database(db_path)
    
    # Lấy danh sách tất cả file JSON
    json_files = list(stocks_path.glob('*.json'))
    total_files = len(json_files)
    
    print(f"Tìm thấy {total_files} file JSON")
    print("Đang xử lý...")
    
    success_count = 0
    error_count = 0
    
    for idx, json_file in enumerate(json_files, 1):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                insert_stock_data(conn, data)
                success_count += 1
            
            if idx % 50 == 0:
                print(f"Đã xử lý: {idx}/{total_files} files ({success_count} thành công, {error_count} lỗi)")
        
        except Exception as e:
            error_count += 1
            print(f"Lỗi khi xử lý {json_file.name}: {str(e)}")
    
    conn.close()
    
    print(f"\nHoàn thành!")
    print(f"Tổng số file: {total_files}")
    print(f"Thành công: {success_count}")
    print(f"Lỗi: {error_count}")
    print(f"Database đã được tạo tại: {db_path}")

def main():
    # Đường dẫn mặc định
    stocks_folder = '/Users/phat@backbase.com/Projects/desktop-portfolio/server/data/stocks'
    db_path = '/Users/phat@backbase.com/Projects/desktop-portfolio/server/data/stocks.db'
    
    # Cho phép override từ command line
    if len(sys.argv) > 1:
        stocks_folder = sys.argv[1]
    if len(sys.argv) > 2:
        db_path = sys.argv[2]
    
    process_stocks_folder(stocks_folder, db_path)

if __name__ == '__main__':
    main()

