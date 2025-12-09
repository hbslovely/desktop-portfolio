/**
 * Stock Detail API - V2
 * Get stock data by symbol from Vercel Postgres database
 */

import { getStockBySymbol } from '../../lib/db.js';

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
    // Extract symbol from URL
    const { symbol } = req.query;
    const symbolUpper = symbol?.toUpperCase();

    if (!symbolUpper) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }

    const result = await getStockBySymbol(symbolUpper);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Stock data not found',
      });
    }

    // Transform database row to expected format
    const row = result.data;
    const stockData = {
      symbol: row.symbol,
      basicInfo: typeof row.basic_info === 'string' 
        ? JSON.parse(row.basic_info) 
        : row.basic_info || {},
      priceData: typeof row.price_data === 'string'
        ? JSON.parse(row.price_data)
        : row.price_data || {},
      fullData: typeof row.full_data === 'string'
        ? JSON.parse(row.full_data)
        : row.full_data || {},
      updatedAt: row.updated_at,
    };

    return res.status(200).json({
      success: true,
      data: stockData,
      symbol: symbolUpper,
    });
  } catch (error) {
    console.error('[stocks-v2/[symbol].js] Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
