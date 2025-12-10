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

/**
 * Extract companyInfo from fullData and convert to flat key structure
 */
function extractCompanyInfoToFlatKeys(fullData) {
  if (!fullData) return {};

  let companyInfo = null;

  if (fullData.pageProps && fullData.pageProps.companyInfo) {
    companyInfo = fullData.pageProps.companyInfo;
  } else if (fullData['pageProps.companyInfo']) {
    companyInfo = fullData['pageProps.companyInfo'];
  } else {
    companyInfo = {};
    for (const key in fullData) {
      if (key.startsWith('pageProps.companyInfo.')) {
        const fieldName = key.replace('pageProps.companyInfo.', '');
        companyInfo[fieldName] = fullData[key];
      }
    }
    if (Object.keys(companyInfo).length === 0) {
      return {};
    }
  }

  const flatKeys = {};
  if (companyInfo && typeof companyInfo === 'object') {
    for (const key in companyInfo) {
      flatKeys[`pageProps.companyInfo.${key}`] = companyInfo[key];
    }
  }

  return flatKeys;
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

    // Transform data to expected format
    const stocks = (result.stocks || []).map(row => {
      const basicInfo = typeof row.basic_info === 'string'
        ? JSON.parse(row.basic_info)
        : row.basic_info || {};
      const fullData = typeof row.full_data === 'string'
        ? JSON.parse(row.full_data)
        : row.full_data || {};

      const companyInfoFlatKeys = extractCompanyInfoToFlatKeys(fullData);

      return {
        symbol: row.symbol,
        basicInfo: basicInfo,
        fullData: Object.keys(companyInfoFlatKeys).length > 0 ? companyInfoFlatKeys : null
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
