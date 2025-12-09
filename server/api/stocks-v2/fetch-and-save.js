import { saveStock, getStockBySymbol } from '../../lib/db.js';

/**
 * Fetch stock basic info from DNSE
 */
async function fetchBasicInfo(symbol) {
  const url = `https://www.dnse.com.vn/senses/_next/data/TNgKE3JbtnJNequvT4tmO/co-phieu-${symbol.toUpperCase()}.json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.dnse.com.vn/',
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching basic info:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch stock price data (OHLC) from DNSE
 */
async function fetchPriceData(symbol, days = 1095) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - (days * 24 * 60 * 60);
  const url = `https://api.dnse.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${now}&symbol=${symbol.toUpperCase()}&resolution=1D`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.dnse.com.vn/',
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching price data:', error);
    return { success: false, error: error.message };
  }
}

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
    const { symbol, days } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }

    const symbolUpper = symbol.toUpperCase();

    // Check if stock exists in database
    const existingStock = await getStockBySymbol(symbolUpper);
    const stockExists = existingStock.success;
    console.log(`[stocks-v2/fetch-and-save.js] Stock exists for ${symbolUpper}:`, stockExists);

    // Fetch both basicInfo and priceData together
    console.log(`[stocks-v2/fetch-and-save.js] Fetching data for ${symbolUpper}...`);
    const [basicInfoResult, priceDataResult] = await Promise.all([
      fetchBasicInfo(symbolUpper),
      fetchPriceData(symbolUpper, days || 1095),
    ]);

    if (!basicInfoResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch basic info: ${basicInfoResult.error}`,
      });
    }

    if (!priceDataResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch price data: ${priceDataResult.error}`,
      });
    }

    // Save to database
    const saveResult = await saveStock(
      symbolUpper,
      basicInfoResult.data,
      priceDataResult.data,
      basicInfoResult.data
    );

    if (!saveResult.success) {
      return res.status(500).json({
        success: false,
        error: saveResult.error || 'Failed to save stock data',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Stock data fetched and saved successfully',
      symbol: symbolUpper,
      stockExists: stockExists,
      updatedAt: saveResult.updatedAt,
      dataFetched: {
        basicInfo: !!basicInfoResult.data,
        priceData: !!priceDataResult.data,
      },
    });
  } catch (error) {
    console.error('[stocks-v2/fetch-and-save.js] Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
