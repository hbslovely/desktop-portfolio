/**
 * Stocks List API - V2
 * Returns list of all stocks from Vercel Postgres database
 * Falls back to JSON files if database query fails
 *
 * Query Parameters:
 * - keyword: Search by symbol or company name (optional)
 * - limit: Number of records to return (default: 100, max: 500)
 * - offset: Number of records to skip for pagination (default: 0)
 *
 * Example:
 * GET /api/stocks-v2/list?keyword=VNM&limit=20&offset=0
 */

import { getAllStocks } from '../../lib/db.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules (needed for Vercel deployment)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_LIMIT = 2500;
const DEFAULT_LIMIT = 2000;

/**
 * Parse and validate pagination parameters
 */
function parseQueryParams(query) {
  const keyword = query.keyword?.trim() || '';

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  let offset = parseInt(query.offset, 10);
  if (isNaN(offset) || offset < 0) {
    offset = 0;
  }

  return { keyword, limit, offset };
}

/**
 * Load stocks from JSON files as fallback
 * Path: api/stocks-v2/list.js -> ../../data/stocks/
 */
async function loadFromJsonFiles(keyword, limit, offset) {
  try {
    // Use __dirname for correct path on Vercel (relative to this file)
    // This file is at: api/stocks-v2/list.js
    // Data is at: data/stocks/
    const stocksDir = path.join(__dirname, '..', '..', 'data', 'stocks');
    console.log('[stocks-v2/list.js] Looking for JSON files in:', stocksDir);

    const files = await fs.readdir(stocksDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    let stocks = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(stocksDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        stocks.push({
          symbol: data.symbol || file.replace('.json', ''),
          basicInfo: data.basicInfo || {},
          fullData: data.fullData || {},
          priceData: data.priceData || {},
          updatedAt: data.updatedAt || null
        });
      } catch (err) {
        console.warn(`[stocks-v2/list.js] Error reading ${file}:`, err.message);
      }
    }

    // Filter by keyword if provided
    if (keyword) {
      const searchTerm = keyword.toLowerCase();
      stocks = stocks.filter(stock =>
        stock.symbol.toLowerCase().includes(searchTerm) ||
        (stock.basicInfo?.companyName || '').toLowerCase().includes(searchTerm)
      );
    }

    // Sort by symbol
    stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const total = stocks.length;

    // Apply pagination
    const paginatedStocks = stocks.slice(offset, offset + limit);

    return {
      success: true,
      stocks: paginatedStocks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + paginatedStocks.length < total
      },
      source: 'json_files'
    };
  } catch (error) {
    console.error('[stocks-v2/list.js] Error loading JSON files:', error);
    return {
      success: false,
      error: 'Failed to load JSON files',
      details: error.message,
      path: path.join(__dirname, '..', '..', 'data', 'stocks')
    };
  }
}


export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Parse query parameters
    const { keyword, limit, offset } = parseQueryParams(req.query || {});

    console.log('[stocks-v2/list.js] API requested with params:', { keyword, limit, offset });

    const result = await getAllStocks({ keyword, limit, offset });

    if (result.success) {
      // Transform data to expected format (same as detail API)
      const stocks = (result.stocks || []).map(row => {
        const basicInfo = typeof row.basic_info === 'string'
          ? JSON.parse(row.basic_info)
          : row.basic_info || {};
        const fullData = typeof row.full_data === 'string'
          ? JSON.parse(row.full_data)
          : row.full_data || {};
        const priceData = typeof row.price_data === 'string'
          ? JSON.parse(row.price_data)
          : row.price_data || {};

        return {
          symbol: row.symbol,
          basicInfo: basicInfo,
          fullData: fullData,
          priceData: priceData,
          updatedAt: row.updated_at
        };
      });

      console.log('[stocks-v2/list.js] Result from database:', {
        success: result.success,
        stocksCount: stocks.length,
        pagination: result.pagination
      });

      return res.status(200).json({
        success: true,
        stocks: stocks,
        count: stocks.length,
        pagination: result.pagination,
        query: { keyword, limit, offset },
        source: 'database'
      });
    }

    // Database failed, try JSON files fallback
    console.log('[stocks-v2/list.js] Database query failed, trying JSON files fallback...');
    const jsonResult = await loadFromJsonFiles(keyword, limit, offset);

    if (jsonResult.success) {
      console.log('[stocks-v2/list.js] Loaded from JSON files:', {
        stocksCount: jsonResult.stocks.length,
        pagination: jsonResult.pagination
      });

      return res.status(200).json({
        success: true,
        stocks: jsonResult.stocks,
        count: jsonResult.stocks.length,
        pagination: jsonResult.pagination,
        query: { keyword, limit, offset },
        source: 'json_files'
      });
    }

    // Both database and JSON files failed
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch stocks from database and JSON files',
      dbError: result.error || 'Unknown database error',
      jsonError: jsonResult.error || 'Unknown JSON error',
      jsonPath: jsonResult.path || path.join(__dirname, '..', '..', 'data', 'stocks')
    });
  } catch (error) {
    console.error('[stocks-v2/list.js] Unhandled error:', error);

    // Try JSON fallback on error
    const { keyword, limit, offset } = parseQueryParams(req.query || {});
    const jsonResult = await loadFromJsonFiles(keyword, limit, offset);

    if (jsonResult.success) {
      console.log('[stocks-v2/list.js] Error recovery: Loaded from JSON files');
      return res.status(200).json({
        success: true,
        stocks: jsonResult.stocks,
        count: jsonResult.stocks.length,
        pagination: jsonResult.pagination,
        query: { keyword, limit, offset },
        source: 'json_files_fallback'
      });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
