/**
 * Update Stock Prices Script
 * 
 * This script fetches the latest price data from DNSE API and updates:
 * 1. priceData in JSON files (appends new dates)
 * 2. basicInfo with latest price information
 * 
 * Usage:
 *   node scripts/update-prices.js                  # Update all stocks
 *   node scripts/update-prices.js VNM FPT ACB     # Update specific stocks
 *   node scripts/update-prices.js --stocks-only   # Update only 3-char stock symbols
 *   node scripts/update-prices.js --days=30       # Fetch last 30 days (default: 7)
 *   node scripts/update-prices.js --concurrent=5  # Process 5 stocks at a time (default: 3)
 * 
 * Run: npm run update:prices
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DNSE_API_BASE = 'https://api.dnse.com.vn';
const STOCKS_DIR = path.join(__dirname, '../data/stocks');
const DEFAULT_DAYS = 7; // Fetch last 7 days by default
const DEFAULT_CONCURRENT = 3; // Process 3 stocks at a time
const DELAY_BETWEEN_REQUESTS = 500; // 500ms delay between requests to avoid rate limiting

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    symbols: [],
    stocksOnly: false,
    days: DEFAULT_DAYS,
    concurrent: DEFAULT_CONCURRENT,
  };

  for (const arg of args) {
    if (arg === '--stocks-only') {
      options.stocksOnly = true;
    } else if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10) || DEFAULT_DAYS;
    } else if (arg.startsWith('--concurrent=')) {
      options.concurrent = parseInt(arg.split('=')[1], 10) || DEFAULT_CONCURRENT;
    } else if (!arg.startsWith('--')) {
      options.symbols.push(arg.toUpperCase());
    }
  }

  return options;
}

/**
 * Fetch OHLC data from DNSE API
 */
async function fetchOHLCData(symbol, days) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - (days * 24 * 60 * 60);
  
  const url = `${DNSE_API_BASE}/chart-api/v2/ohlcs/stock?from=${from}&to=${now}&symbol=${symbol}&resolution=1D`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.dnse.com.vn/'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`  ❌ Error fetching ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Merge new price data with existing data
 * Keeps existing data and appends/updates new dates
 */
function mergePriceData(existingData, newData) {
  if (!newData || !newData.t || newData.t.length === 0) {
    return existingData;
  }

  if (!existingData || !existingData.t || existingData.t.length === 0) {
    return newData;
  }

  // Create a map of existing timestamps for quick lookup
  const existingTimestamps = new Set(existingData.t);
  
  // Find new data points that don't exist
  const newIndices = [];
  for (let i = 0; i < newData.t.length; i++) {
    if (!existingTimestamps.has(newData.t[i])) {
      newIndices.push(i);
    }
  }

  // If no new data, return existing
  if (newIndices.length === 0) {
    // But still update the last price if timestamps match
    const lastNewIdx = newData.t.length - 1;
    const lastExistingIdx = existingData.t.findIndex(t => t === newData.t[lastNewIdx]);
    
    if (lastExistingIdx !== -1) {
      // Update the last matching entry with fresh data
      existingData.o[lastExistingIdx] = newData.o[lastNewIdx];
      existingData.h[lastExistingIdx] = newData.h[lastNewIdx];
      existingData.l[lastExistingIdx] = newData.l[lastNewIdx];
      existingData.c[lastExistingIdx] = newData.c[lastNewIdx];
      existingData.v[lastExistingIdx] = newData.v[lastNewIdx];
    }
    
    return existingData;
  }

  // Append new data
  const merged = {
    t: [...existingData.t],
    o: [...existingData.o],
    h: [...existingData.h],
    l: [...existingData.l],
    c: [...existingData.c],
    v: [...existingData.v],
  };

  for (const i of newIndices) {
    merged.t.push(newData.t[i]);
    merged.o.push(newData.o[i]);
    merged.h.push(newData.h[i]);
    merged.l.push(newData.l[i]);
    merged.c.push(newData.c[i]);
    merged.v.push(newData.v[i]);
  }

  // Sort by timestamp
  const indices = merged.t.map((_, i) => i);
  indices.sort((a, b) => merged.t[a] - merged.t[b]);

  return {
    t: indices.map(i => merged.t[i]),
    o: indices.map(i => merged.o[i]),
    h: indices.map(i => merged.h[i]),
    l: indices.map(i => merged.l[i]),
    c: indices.map(i => merged.c[i]),
    v: indices.map(i => merged.v[i]),
  };
}

/**
 * Update basicInfo with latest price data
 */
function updateBasicInfo(basicInfo, priceData) {
  if (!priceData || !priceData.c || priceData.c.length === 0) {
    return basicInfo;
  }

  const lastIdx = priceData.c.length - 1;
  const prevIdx = lastIdx > 0 ? lastIdx - 1 : 0;

  const currentPrice = priceData.c[lastIdx];
  const previousPrice = priceData.c[prevIdx];
  const changedValue = currentPrice - previousPrice;
  const changedRatio = previousPrice > 0 ? ((changedValue / previousPrice) * 100) : 0;
  const totalVolume = priceData.v[lastIdx];

  return {
    ...basicInfo,
    matchPrice: currentPrice,
    changedValue: Math.round(changedValue * 100) / 100,
    changedRatio: Math.round(changedRatio * 100) / 100,
    totalVolume: totalVolume,
  };
}

/**
 * Process a single stock
 */
async function processStock(symbol, days) {
  const filePath = path.join(STOCKS_DIR, `${symbol}.json`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${symbol}: File not found, skipping`);
    return { symbol, status: 'skipped', reason: 'file_not_found' };
  }

  try {
    // Read existing data
    const content = fs.readFileSync(filePath, 'utf-8');
    const stockData = JSON.parse(content);

    // Fetch new price data
    const newPriceData = await fetchOHLCData(symbol, days);
    
    if (!newPriceData || !newPriceData.t || newPriceData.t.length === 0) {
      console.log(`  ⚠️  ${symbol}: No price data available from API`);
      return { symbol, status: 'skipped', reason: 'no_data' };
    }

    // Merge price data
    const mergedPriceData = mergePriceData(stockData.priceData || {}, newPriceData);
    
    // Update basicInfo
    const updatedBasicInfo = updateBasicInfo(stockData.basicInfo || {}, mergedPriceData);

    // Create updated stock data (preserve structure)
    const updatedStockData = {
      symbol: stockData.symbol || symbol,
      basicInfo: updatedBasicInfo,
      priceData: mergedPriceData,
      fullData: stockData.fullData || {}, // Keep existing fullData
      updatedAt: new Date().toISOString(),
    };

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(updatedStockData, null, 2));
    
    const newDataPoints = newPriceData.t.length;
    console.log(`  ✅ ${symbol}: Updated (${newDataPoints} data points from API, latest price: ${updatedBasicInfo.matchPrice})`);
    
    return { symbol, status: 'updated', dataPoints: newDataPoints, price: updatedBasicInfo.matchPrice };

  } catch (error) {
    console.error(`  ❌ ${symbol}: Error - ${error.message}`);
    return { symbol, status: 'error', error: error.message };
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process stocks in batches
 */
async function processBatch(symbols, days, concurrent) {
  const results = {
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Process in batches
  for (let i = 0; i < symbols.length; i += concurrent) {
    const batch = symbols.slice(i, i + concurrent);
    
    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (symbol, idx) => {
        // Add staggered delay to avoid hitting rate limits
        await sleep(idx * DELAY_BETWEEN_REQUESTS);
        return processStock(symbol, days);
      })
    );

    // Collect results
    for (const result of batchResults) {
      results.details.push(result);
      if (result.status === 'updated') {
        results.updated++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else {
        results.errors++;
      }
    }

    // Progress update
    const processed = Math.min(i + concurrent, symbols.length);
    console.log(`\n📊 Progress: ${processed}/${symbols.length} stocks processed`);
    
    // Delay between batches
    if (i + concurrent < symbols.length) {
      await sleep(1000);
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Stock Price Update Script');
  console.log('════════════════════════════════════════\n');

  const options = parseArgs();
  
  console.log('📋 Options:');
  console.log(`   Days to fetch: ${options.days}`);
  console.log(`   Concurrent: ${options.concurrent}`);
  console.log(`   Stocks only (3-char): ${options.stocksOnly}`);
  console.log(`   Specific symbols: ${options.symbols.length > 0 ? options.symbols.join(', ') : 'All'}\n`);

  // Get list of symbols to process
  let symbols = [];
  
  if (options.symbols.length > 0) {
    // Use specified symbols
    symbols = options.symbols;
  } else {
    // Read all JSON files
    const files = fs.readdirSync(STOCKS_DIR).filter(f => f.endsWith('.json'));
    symbols = files.map(f => f.replace('.json', '').toUpperCase());
  }

  // Filter to stocks only if requested
  if (options.stocksOnly) {
    symbols = symbols.filter(s => s.length === 3);
    console.log(`📈 Filtering to stocks only (3-char symbols): ${symbols.length} stocks\n`);
  }

  console.log(`📦 Total stocks to process: ${symbols.length}\n`);
  console.log('────────────────────────────────────────');

  const startTime = Date.now();
  
  // Process stocks
  const results = await processBatch(symbols, options.days, options.concurrent);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log('📊 Summary');
  console.log('────────────────────────────────────────');
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   ⚠️  Skipped: ${results.skipped}`);
  console.log(`   ❌ Errors:  ${results.errors}`);
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log('════════════════════════════════════════\n');

  if (results.errors > 0) {
    console.log('❌ Errors:');
    results.details
      .filter(d => d.status === 'error')
      .forEach(d => console.log(`   - ${d.symbol}: ${d.error}`));
  }

  console.log('✨ Done!');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
