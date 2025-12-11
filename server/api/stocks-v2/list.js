/**
 * Stocks List API - V2
 * Returns list of all stocks from Vercel Postgres database
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

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

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

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch stocks'
      });
    }

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

    console.log('[stocks-v2/list.js] Result:', {
      success: result.success,
      stocksCount: stocks.length,
      pagination: result.pagination
    });

    return res.status(200).json({
      success: true,
      stocks: stocks,
      count: stocks.length,
      pagination: result.pagination,
      query: { keyword, limit, offset }
    });
  } catch (error) {
    console.error('[stocks-v2/list.js] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
