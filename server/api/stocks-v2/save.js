/**
 * Stock Save API - V2
 * Save stock data to Vercel Postgres database
 */

import { saveStock, getStockBySymbol } from '../../lib/db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { symbol, basicInfo, priceData, fullData } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }

    const symbolUpper = symbol.toUpperCase();

    // Check if stock exists
    const existingStock = await getStockBySymbol(symbolUpper);
    const stockExists = existingStock.success;
    console.log(`[stocks-v2/save.js] Stock exists for ${symbolUpper}:`, stockExists);

    // Save to database
    const saveResult = await saveStock(symbolUpper, basicInfo, priceData, fullData);

    if (!saveResult.success) {
      return res.status(500).json({
        success: false,
        error: saveResult.error || 'Failed to save stock data',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Stock data saved successfully',
      symbol: symbolUpper,
      fileExists: stockExists,
      updatedAt: saveResult.updatedAt,
    });
  } catch (error) {
    console.error('[stocks-v2/save.js] Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
