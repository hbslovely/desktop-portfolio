/**
 * Stock Detail API - V2
 * Get stock data by symbol from Vercel Postgres database
 * Falls back to JSON file if database query fails
 */

import { getStockBySymbol } from '../../lib/db.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Load stock data from JSON file as fallback
 */
async function loadFromJsonFile(symbol) {
  try {
    const jsonPath = path.join(process.cwd(), 'server', 'data', 'stocks', `${symbol}.json`);
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    
    return {
      success: true,
      data: {
        symbol: jsonData.symbol || symbol,
        basicInfo: jsonData.basicInfo || {},
        priceData: jsonData.priceData || {},
        fullData: jsonData.fullData || {},
        updatedAt: jsonData.updatedAt || null,
      },
      source: 'json_file'
    };
  } catch (error) {
    console.log(`[stocks-v2/[symbol].js] JSON file not found for ${symbol}:`, error.message);
    return { success: false, error: 'JSON file not found' };
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
    // Extract symbol from URL
    const { symbol } = req.query;
    const symbolUpper = symbol?.toUpperCase();

    if (!symbolUpper) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }

    // Try database first
    const result = await getStockBySymbol(symbolUpper);

    if (result.success) {
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
        source: 'database'
      });
    }

    // Database failed, try JSON file fallback
    console.log(`[stocks-v2/[symbol].js] Database query failed for ${symbolUpper}, trying JSON fallback...`);
    const jsonResult = await loadFromJsonFile(symbolUpper);

    if (jsonResult.success) {
      console.log(`[stocks-v2/[symbol].js] Loaded ${symbolUpper} from JSON file`);
      return res.status(200).json({
        success: true,
        data: jsonResult.data,
        symbol: symbolUpper,
        source: 'json_file'
      });
    }

    // Both database and JSON file failed
    return res.status(404).json({
      success: false,
      error: 'Stock data not found in database or JSON file',
    });
  } catch (error) {
    console.error('[stocks-v2/[symbol].js] Error:', error);
    
    // Even on error, try JSON fallback
    const { symbol } = req.query;
    const symbolUpper = symbol?.toUpperCase();
    
    if (symbolUpper) {
      const jsonResult = await loadFromJsonFile(symbolUpper);
      if (jsonResult.success) {
        console.log(`[stocks-v2/[symbol].js] Error recovery: Loaded ${symbolUpper} from JSON file`);
        return res.status(200).json({
          success: true,
          data: jsonResult.data,
          symbol: symbolUpper,
          source: 'json_file_fallback'
        });
      }
    }
    
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
