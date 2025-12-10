/**
 * Database Alter Script for stock_models table
 * Updates existing table to new schema with flat trading config and neural network weights
 * 
 * Run with: node --env-file=.env.local server/scripts/db-alter-stock-models.js
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const connectionString = process.env.VIET_STOCK_POOL_POSTGRES_URL 
  || process.env.POSTGRES_URL
  || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: No database connection string found.');
  process.exit(1);
}

const sql = neon(connectionString);

async function alterStockModels() {
  console.log('🚀 Starting stock_models table alteration...\n');
  
  try {
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'stock_models'
      );
    `;
    
    if (!tableCheck[0].exists) {
      console.log('⚠️  Table stock_models does not exist. Creating new table...');
      await createNewTable();
      return;
    }

    console.log('📋 Table stock_models exists. Checking columns...\n');

    // Get existing columns
    const existingColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_models'
    `;
    
    const columnNames = existingColumns.map(c => c.column_name);
    console.log('Existing columns:', columnNames.join(', '));

    // Define new columns to add
    const newColumns = [
      { name: 'neural_network_weights', type: 'JSONB', description: 'Serialized model weights' },
      { name: 'training_epochs', type: 'INTEGER DEFAULT 50', description: 'Number of training epochs' },
      { name: 'training_loss', type: 'DECIMAL(15, 10)', description: 'Final training loss' },
      { name: 'training_accuracy', type: 'DECIMAL(10, 6)', description: 'Model accuracy (0-1)' },
      { name: 'model_config', type: 'JSONB', description: 'Model architecture config' },
      { name: 'lookback_days', type: 'INTEGER DEFAULT 60', description: 'Số ngày lịch sử input' },
      { name: 'forecast_days', type: 'INTEGER DEFAULT 1', description: 'Số ngày dự đoán' },
      { name: 'batch_size', type: 'INTEGER DEFAULT 32', description: 'Training batch size' },
      { name: 'validation_split', type: 'DECIMAL(3, 2) DEFAULT 0.2', description: 'Validation split ratio' },
      { name: 'initial_capital', type: 'DECIMAL(20, 2) DEFAULT 100000000', description: 'Vốn ban đầu (VND)' },
      { name: 'stop_loss_percent', type: 'DECIMAL(5, 2) DEFAULT 5', description: '% cắt lỗ' },
      { name: 'take_profit_percent', type: 'DECIMAL(5, 2) DEFAULT 10', description: '% chốt lời' },
      { name: 'max_positions', type: 'INTEGER DEFAULT 3', description: 'Số vị thế tối đa' },
      { name: 't_plus_days', type: 'INTEGER DEFAULT 2', description: 'Quy tắc T+' },
      { name: 'date_range_start', type: 'DATE', description: 'Ngày bắt đầu backtest' },
      { name: 'date_range_end', type: 'DATE', description: 'Ngày kết thúc backtest' },
      { name: 'trained_at', type: 'TIMESTAMP WITH TIME ZONE', description: 'Thời điểm train model' },
    ];

    // Add missing columns
    console.log('\n📦 Adding new columns...\n');
    for (const col of newColumns) {
      if (!columnNames.includes(col.name)) {
        console.log(`  Adding ${col.name} (${col.description})...`);
        await sql.unsafe(`ALTER TABLE stock_models ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`  ✅ ${col.name} added`);
      } else {
        console.log(`  ⏭️  ${col.name} already exists`);
      }
    }

    // Migrate data from old JSONB fields to new flat fields if needed
    console.log('\n📊 Migrating existing data...');
    
    // Check if old trading_config column exists and has data
    if (columnNames.includes('trading_config')) {
      console.log('  Migrating trading_config data to flat fields...');
      await sql`
        UPDATE stock_models 
        SET 
          initial_capital = COALESCE(
            (trading_config->>'initialCapital')::DECIMAL,
            initial_capital,
            100000000
          ),
          stop_loss_percent = COALESCE(
            (trading_config->>'stopLossPercent')::DECIMAL,
            stop_loss_percent,
            5
          ),
          take_profit_percent = COALESCE(
            (trading_config->>'takeProfitPercent')::DECIMAL,
            take_profit_percent,
            10
          ),
          max_positions = COALESCE(
            (trading_config->>'maxPositions')::INTEGER,
            max_positions,
            3
          ),
          t_plus_days = COALESCE(
            (trading_config->>'tPlusDays')::INTEGER,
            t_plus_days,
            2
          )
        WHERE trading_config IS NOT NULL 
          AND trading_config != '{}'::jsonb
      `;
      console.log('  ✅ trading_config data migrated');
    }

    // Check if old date_range column exists and has data
    if (columnNames.includes('date_range')) {
      console.log('  Migrating date_range data to flat fields...');
      await sql`
        UPDATE stock_models 
        SET 
          date_range_start = COALESCE(
            (date_range->>'startDate')::DATE,
            date_range_start
          ),
          date_range_end = COALESCE(
            (date_range->>'endDate')::DATE,
            date_range_end
          )
        WHERE date_range IS NOT NULL 
          AND date_range != '{}'::jsonb
      `;
      console.log('  ✅ date_range data migrated');
    }

    // Create index on trained_at
    console.log('\n📇 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_models_trained_at ON stock_models(trained_at)`;
    console.log('  ✅ Index on trained_at created');

    // Optionally drop old columns (commented out for safety)
    // console.log('\n🗑️  Dropping old columns...');
    // await sql`ALTER TABLE stock_models DROP COLUMN IF EXISTS trading_config`;
    // await sql`ALTER TABLE stock_models DROP COLUMN IF EXISTS date_range`;
    // await sql`ALTER TABLE stock_models DROP COLUMN IF EXISTS simulations`;
    // console.log('  ✅ Old columns dropped');

    console.log('\n🎉 stock_models table alteration completed successfully!\n');
    
    // Show final table structure
    const finalColumns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'stock_models'
      ORDER BY ordinal_position
    `;
    
    console.log('Final table structure:');
    console.log('─'.repeat(80));
    for (const col of finalColumns) {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(30)} ${col.column_default || ''}`);
    }
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

async function createNewTable() {
  console.log('📦 Creating stock_models table with new schema...');
  
  await sql`
    CREATE TABLE stock_models (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) UNIQUE NOT NULL,
      
      -- Neural Network Model Data
      neural_network_weights JSONB,
      training_epochs INTEGER DEFAULT 50,
      training_loss DECIMAL(15, 10),
      training_accuracy DECIMAL(10, 6),
      model_config JSONB,
      
      -- Training Parameters
      lookback_days INTEGER DEFAULT 60,
      forecast_days INTEGER DEFAULT 1,
      batch_size INTEGER DEFAULT 32,
      validation_split DECIMAL(3, 2) DEFAULT 0.2,
      
      -- Trading Config
      initial_capital DECIMAL(20, 2) DEFAULT 100000000,
      stop_loss_percent DECIMAL(5, 2) DEFAULT 5,
      take_profit_percent DECIMAL(5, 2) DEFAULT 10,
      max_positions INTEGER DEFAULT 3,
      t_plus_days INTEGER DEFAULT 2,
      
      -- Backtest Date Range
      date_range_start DATE,
      date_range_end DATE,
      
      -- Simulation Result
      simulation_result JSONB,
      
      -- Timestamps
      trained_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  
  await sql`CREATE INDEX IF NOT EXISTS idx_stock_models_symbol ON stock_models(symbol)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stock_models_trained_at ON stock_models(trained_at)`;
  
  console.log('✅ stock_models table created with new schema');
  process.exit(0);
}

alterStockModels();
