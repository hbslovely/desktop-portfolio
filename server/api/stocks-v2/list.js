/**
 * Stocks List API - V2
 * Returns list of all stocks from Vercel Postgres database
 */

import { getAllStocks } from '../../lib/db.js';

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
    console.log('[stocks-v2/list.js] API requested');

    const result = await getAllStocks();

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
    });

    return res.status(200).json({
      success: true,
      stocks: stocks,
      count: stocks.length,
    });
  } catch (error) {
    console.error('[stocks-v2/list.js] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
