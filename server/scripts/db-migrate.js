/**
 * Database Migration Script
 * Creates necessary tables for viet-stock-pool database
 * 
 * Run this with: npm run db:migrate
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Get connection string from environment
const connectionString = process.env.VIET_STOCK_POOL_POSTGRES_URL 
  || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ Error: No database connection string found.');
  console.error('   Set VIET_STOCK_POOL_POSTGRES_URL or POSTGRES_URL environment variable.');
  process.exit(1);
}

const sql = neon(connectionString);

async function migrate() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Create stocks table (JSON storage for backward compatibility)
    console.log('📦 Creating stocks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) UNIQUE NOT NULL,
        basic_info JSONB DEFAULT '{}',
        price_data JSONB DEFAULT '{}',
        full_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ stocks table created');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol)
    `;
    console.log('✅ Index on stocks.symbol created');

    // Create stock_details table (normalized with individual columns)
    console.log('📦 Creating stock_details table...');
    await sql`
      CREATE TABLE IF NOT EXISTS stock_details (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) UNIQUE NOT NULL,
        
        -- Basic Info
        company_name VARCHAR(255),
        company_name_en VARCHAR(255),
        short_name VARCHAR(100),
        exchange VARCHAR(20),
        match_price DECIMAL(15, 2),
        changed_value DECIMAL(15, 2),
        changed_ratio DECIMAL(10, 4),
        total_volume BIGINT,
        market_cap DECIMAL(20, 2),
        beta DECIMAL(10, 6),
        eps DECIMAL(15, 4),
        roe DECIMAL(10, 6),
        roa DECIMAL(10, 6),
        
        -- Company Info
        company_id INTEGER,
        tax_code VARCHAR(50),
        address TEXT,
        phone VARCHAR(50),
        fax VARCHAR(50),
        email VARCHAR(100),
        website VARCHAR(255),
        logo_url TEXT,
        capital DECIMAL(20, 2),
        outstanding_shares BIGINT,
        
        -- Listing Info
        listed_date DATE,
        first_trading_price DECIMAL(15, 2),
        stock_face_value DECIMAL(15, 2),
        is_margin BOOLEAN DEFAULT FALSE,
        is_ftse BOOLEAN DEFAULT FALSE,
        is_vn30 BOOLEAN DEFAULT FALSE,
        is_hnx30 BOOLEAN DEFAULT FALSE,
        
        -- Industry Classification
        industry_name VARCHAR(100),
        sub_industry_name VARCHAR(100),
        sector_name VARCHAR(255),
        sector_index_id INTEGER,
        sector_index_name VARCHAR(100),
        
        -- GICS Classification
        gics_sector VARCHAR(100),
        gics_industry_group VARCHAR(100),
        gics_industry VARCHAR(100),
        gics_sub_industry VARCHAR(100),
        gics_sector_id VARCHAR(10),
        gics_industry_group_id VARCHAR(10),
        gics_industry_id VARCHAR(10),
        gics_sub_industry_id VARCHAR(10),
        
        -- Additional Info
        introduction TEXT,
        notes TEXT,
        audit_firm VARCHAR(100),
        contact_person VARCHAR(100),
        contact_position VARCHAR(100),
        
        -- Index membership
        index_codes TEXT[],
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ stock_details table created');

    // Create indexes for stock_details
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_details_symbol ON stock_details(symbol)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_details_exchange ON stock_details(exchange)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_details_industry ON stock_details(industry_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_details_gics_sector ON stock_details(gics_sector)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_details_is_vn30 ON stock_details(is_vn30)`;
    console.log('✅ Indexes on stock_details created');

    // Create stock_models table with flat trading config and neural network weights
    console.log('📦 Creating stock_models table...');
    await sql`
      CREATE TABLE IF NOT EXISTS stock_models (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) UNIQUE NOT NULL,
        
        -- Neural Network Model Data
        neural_network_weights JSONB,           -- Serialized model weights
        training_epochs INTEGER DEFAULT 50,     -- Number of training epochs
        training_loss DECIMAL(15, 10),          -- Final training loss
        training_accuracy DECIMAL(10, 6),       -- Model accuracy (0-1)
        model_config JSONB,                     -- Model architecture config
        
        -- Training Parameters (flat fields with descriptions in comments)
        lookback_days INTEGER DEFAULT 60,       -- Số ngày lịch sử để xét (input window)
        forecast_days INTEGER DEFAULT 1,        -- Số ngày dự đoán phía trước
        batch_size INTEGER DEFAULT 32,          -- Kích thước batch khi training
        validation_split DECIMAL(3, 2) DEFAULT 0.2, -- Tỷ lệ data dùng để validation (0.2 = 20%)
        
        -- Trading Config (flat fields)
        initial_capital DECIMAL(20, 2) DEFAULT 100000000, -- Vốn ban đầu (VND)
        stop_loss_percent DECIMAL(5, 2) DEFAULT 5,        -- % cắt lỗ (5 = 5%)
        take_profit_percent DECIMAL(5, 2) DEFAULT 10,     -- % chốt lời (10 = 10%)
        max_positions INTEGER DEFAULT 3,                   -- Số vị thế tối đa cùng lúc
        t_plus_days INTEGER DEFAULT 2,                     -- Quy tắc T+ (2 = T+2, sau 2 ngày mới được bán)
        
        -- Backtest Date Range
        date_range_start DATE,                  -- Ngày bắt đầu backtest
        date_range_end DATE,                    -- Ngày kết thúc backtest
        
        -- Simulation Result
        simulation_result JSONB,                -- Kết quả mô phỏng giao dịch
        
        -- Timestamps
        trained_at TIMESTAMP WITH TIME ZONE,    -- Thời điểm train model
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ stock_models table created');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_stock_models_symbol ON stock_models(symbol)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_stock_models_trained_at ON stock_models(trained_at)
    `;
    console.log('✅ Indexes on stock_models created');

    // Create price_history table
    console.log('📦 Creating price_history table...');
    await sql`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        open DECIMAL(15, 2),
        high DECIMAL(15, 2),
        low DECIMAL(15, 2),
        close DECIMAL(15, 2),
        volume BIGINT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(symbol, date)
      )
    `;
    console.log('✅ price_history table created');

    await sql`CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_price_history_symbol_date ON price_history(symbol, date)`;
    console.log('✅ Indexes on price_history created');

    // Create watchlists table
    console.log('📦 Creating watchlists table...');
    await sql`
      CREATE TABLE IF NOT EXISTS watchlists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        symbols TEXT[] DEFAULT '{}',
        user_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ watchlists table created');

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nTables created:');
    console.log('  - stocks (JSON storage - backward compatible)');
    console.log('  - stock_details (normalized columns)');
    console.log('  - stock_models (ML model results)');
    console.log('  - price_history (daily prices)');
    console.log('  - watchlists (user watchlists)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
