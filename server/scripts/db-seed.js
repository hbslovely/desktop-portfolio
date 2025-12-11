/**
 * Database Seed Script
 * Imports existing JSON data from local files to Vercel Postgres
 *
 * Features:
 * - Skip stocks that already exist in database
 * - Only import new stocks with their details and price history
 *
 * Run this with: npm run db:seed
 */

import dotenv from 'dotenv';
import {neon} from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

// Load environment variables from .env.local
dotenv.config({path: '.env.local'});
dotenv.config({path: '.env'});

// Get connection string from environment
const connectionString = process.env.VIET_STOCK_POOL_POSTGRES_URL
  || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ Error: No database connection string found.');
  console.error('   Set VIET_STOCK_POOL_POSTGRES_URL or POSTGRES_URL environment variable.');
  process.exit(1);
}

const sql = neon(connectionString);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get list of existing stock symbols from database
 */
async function getExistingSymbols() {
  try {
    const result = await sql`SELECT symbol
                             FROM stocks
                             where full_data != '{}'::jsonb`;
    return new Set(result.map(row => row.symbol));
  } catch (error) {
    // Table might not exist yet
    console.log('⚠️  Could not fetch existing symbols (table may not exist yet)');
    return new Set();
  }
}

/**
 * Extract company info from fullData
 */
function extractCompanyInfo(fullData) {
  if (!fullData || !fullData.pageProps) return null;

  const {companyInfo, ticker, statistic, priceSnapshot} = fullData.pageProps;

  return {
    companyInfo: companyInfo || {},
    ticker: ticker || {},
    statistic: statistic || {},
    priceSnapshot: priceSnapshot || {}
  };
}

/**
 * Convert timestamp to date string
 */
function timestampToDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

async function seed() {
  console.log('🌱 Starting database seed...');
  console.log('   This will SKIP stocks that already exist in the database.\n');

  const stocksDir = path.join(__dirname, '../data/stocks');

  let newStockCount = 0;
  let skippedCount = 0;
  let detailsCount = 0;
  let priceCount = 0;
  let errorCount = 0;

  try {
    // Get existing symbols to skip
    console.log('📋 Fetching existing stocks from database...');
    const existingSymbols = await getExistingSymbols();
    console.log(`   Found ${existingSymbols.size} existing stocks in database.\n`);

    // Seed stocks from JSON files
    if (fs.existsSync(stocksDir)) {
      console.log('📦 Processing stock files...');
      const stockFiles = fs.readdirSync(stocksDir).filter(f => f.endsWith('.json'));
      console.log(`   Total files to process: ${stockFiles.length}\n`);

      for (const file of stockFiles) {
        try {
          const symbol = file.replace('.json', '').toUpperCase();
          console.log('Processing ', symbol)

          // Skip if already exists
          if (existingSymbols.has(symbol)) {
            skippedCount++;
            continue;
          }

          const filePath = path.join(stocksDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const stockData = JSON.parse(content);

          // 1. Insert into stocks table (JSON storage)
          await sql`
            INSERT INTO stocks (symbol, basic_info, price_data, full_data, updated_at)
            VALUES (${symbol},
                    ${JSON.stringify(stockData.basicInfo || {})},
                    ${JSON.stringify(stockData.priceData || {})},
                    ${JSON.stringify(stockData.fullData || {})},
                    ${stockData.updatedAt || new Date().toISOString()}) ON CONFLICT (symbol) DO NOTHING
          `;
          newStockCount++;

          // 2. Insert into stock_details table (normalized)
          const extracted = extractCompanyInfo(stockData.fullData);
          const basicInfo = stockData.basicInfo || {};
          const companyInfo = extracted?.companyInfo || {};
          const ticker = extracted?.ticker || {};
          const statistic = extracted?.statistic || {};

          try {
            await sql`
              INSERT INTO stock_details (symbol,
                                         company_name,
                                         company_name_en,
                                         short_name,
                                         exchange,
                                         match_price,
                                         changed_value,
                                         changed_ratio,
                                         total_volume,
                                         market_cap,
                                         beta,
                                         eps,
                                         roe,
                                         roa,
                                         company_id,
                                         tax_code,
                                         address,
                                         phone,
                                         fax,
                                         email,
                                         website,
                                         logo_url,
                                         capital,
                                         outstanding_shares,
                                         listed_date,
                                         first_trading_price,
                                         stock_face_value,
                                         is_margin,
                                         is_ftse,
                                         is_vn30,
                                         is_hnx30,
                                         industry_name,
                                         sub_industry_name,
                                         sector_name,
                                         sector_index_id,
                                         sector_index_name,
                                         gics_sector,
                                         gics_industry_group,
                                         gics_industry,
                                         gics_sub_industry,
                                         gics_sector_id,
                                         gics_industry_group_id,
                                         gics_industry_id,
                                         gics_sub_industry_id,
                                         introduction,
                                         notes,
                                         audit_firm,
                                         contact_person,
                                         contact_position,
                                         index_codes,
                                         updated_at)
              VALUES (${symbol},
                      ${companyInfo.fullName || basicInfo.companyName || null},
                      ${companyInfo.fullNameEn || null},
                      ${companyInfo.name || ticker.shortName || null},
                      ${companyInfo.exchange || basicInfo.exchange || ticker.floor || null},
                      ${basicInfo.matchPrice || null},
                      ${basicInfo.changedValue || null},
                      ${basicInfo.changedRatio || null},
                      ${basicInfo.totalVolume || null},
                      ${basicInfo.marketCap || companyInfo.capital || null},
                      ${basicInfo.beta || companyInfo.beta || null},
                      ${basicInfo.eps || null},
                      ${basicInfo.roe || null},
                      ${basicInfo.roa || null},
                      ${companyInfo.id || null},
                      ${companyInfo.taxCode || null},
                      ${companyInfo.address || null},
                      ${companyInfo.phone || null},
                      ${companyInfo.fax || null},
                      ${companyInfo.email || null},
                      ${companyInfo.url || null},
                      ${companyInfo.image || ticker.logo || null},
                      ${companyInfo.capital || null},
                      ${statistic.klcplh || null},
                      ${ticker.listedDate || (companyInfo.postUpDate ? companyInfo.postUpDate.split('T')[0] : null)},
                      ${companyInfo.firstTradingSessionPrice || null},
                      ${companyInfo.stockFaceValue || null},
                      ${companyInfo.isMargin || false},
                      ${companyInfo.isFtse || false},
                      ${companyInfo.isVn30 || false},
                      ${companyInfo.isHnx30 || false},
                      ${companyInfo.industryName || ticker.industry || null},
                      ${companyInfo.subIndustryName || ticker.subIndustry || null},
                      ${companyInfo.sectorName || ticker.sector || null},
                      ${companyInfo.sectorIndexId || (ticker.sectorIndexId ? parseInt(ticker.sectorIndexId) : null)},
                      ${companyInfo.sectorIndexName || ticker.sectorIndex || null},
                      ${companyInfo.gicsSector || ticker.gicsSector || null},
                      ${companyInfo.gicsIndustryGroup || ticker.gicsIndustryGroup || null},
                      ${companyInfo.gicsIndustry || ticker.gicsIndustry || null},
                      ${companyInfo.gicsSubIndustry || ticker.gicsSubIndustry || null},
                      ${ticker.gicsSectorId || null},
                      ${ticker.gicsIndustryGroupId || null},
                      ${ticker.gicsIndustryId || null},
                      ${ticker.gicsSubIndustryId || null},
                      ${companyInfo.introduction || null},
                      ${companyInfo.notes || null},
                      ${companyInfo.auditFirm || null},
                      ${companyInfo.contactPerson || null},
                      ${companyInfo.contactPersonPosition || null},
                      ${ticker.indexCodes || null},
                      NOW()) ON CONFLICT (symbol) DO NOTHING
            `;
            detailsCount++;
          } catch (detailErr) {
            console.error(`  ⚠️  Error inserting details for ${symbol}:`, detailErr.message);
          }

          // 3. Insert price history (last 100 records only)
          const priceData = stockData.priceData;
          if (priceData && priceData.t && priceData.c) {
            const {t, o, h, l, c, v} = priceData;
            const startIdx = Math.max(0, t.length - 100);

            for (let i = startIdx; i < t.length; i++) {
              try {
                const dateStr = timestampToDate(t[i]);
                await sql`
                  INSERT INTO price_history (symbol, date, open, high, low, close, volume)
                  VALUES (${symbol},
                          ${dateStr},
                          ${o ? o[i] : null},
                          ${h ? h[i] : null},
                          ${l ? l[i] : null},
                          ${c ? c[i] : null},
                          ${v ? v[i] : 0}) ON CONFLICT (symbol, date) DO NOTHING
                `;
                priceCount++;
              } catch (priceErr) {
                // Skip duplicate dates silently
              }
            }
          }

          // Progress log
          if (newStockCount % 10 === 0) {
            console.log(`   ✅ Imported ${newStockCount} new stocks (skipped ${skippedCount})...`);
          }
        } catch (err) {
          console.error(`  ❌ Error importing ${file}:`, err.message);
          errorCount++;
        }
      }

      console.log(`\n✅ Imported ${newStockCount} NEW stocks`);
      console.log(`✅ Imported ${detailsCount} stock details`);
      console.log(`✅ Imported ${priceCount} price records`);
      console.log(`⏭️  Skipped ${skippedCount} existing stocks`);
    } else {
      console.log('⚠️  No stocks directory found, skipping...');
    }

    console.log('\n🎉 Seed completed!');
    console.log('─'.repeat(40));
    console.log(`  New Stocks:     ${newStockCount}`);
    console.log(`  Stock Details:  ${detailsCount}`);
    console.log(`  Price Records:  ${priceCount}`);
    console.log(`  Skipped:        ${skippedCount}`);
    if (errorCount > 0) {
      console.log(`  Errors:         ${errorCount}`);
    }
    console.log('─'.repeat(40));

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
