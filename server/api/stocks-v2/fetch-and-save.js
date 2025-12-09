import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  runtime: 'nodejs',
};

/**
 * Check if stock file exists locally
 */
function checkStockFileExists(symbol) {
  const dataDir = path.join(__dirname, '../../data/stocks');
  const filePath = path.join(dataDir, `${symbol.toUpperCase()}.json`);
  
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

/**
 * Save stock data to local filesystem
 */
function saveStockFile(symbol, content) {
  const dataDir = path.join(__dirname, '../../data/stocks');
  const filePath = path.join(dataDir, `${symbol.toUpperCase()}.json`);
  
  try {
    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, message: 'File saved successfully', filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
}

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

export default async function handler(req) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const body = await req.json();
    const { symbol, days } = body;

    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Symbol is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const symbolUpper = symbol.toUpperCase();

    // Check if file exists
    const fileExists = checkStockFileExists(symbolUpper);
    console.log(`[stocks-v2/fetch-and-save.js] File exists for ${symbolUpper}:`, fileExists);

    // Fetch both basicInfo and priceData together
    console.log(`[stocks-v2/fetch-and-save.js] Fetching data for ${symbolUpper}...`);
    const [basicInfoResult, priceDataResult] = await Promise.all([
      fetchBasicInfo(symbolUpper),
      fetchPriceData(symbolUpper, days || 1095),
    ]);

    if (!basicInfoResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch basic info: ${basicInfoResult.error}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (!priceDataResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch price data: ${priceDataResult.error}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Prepare stock data (same structure as before)
    const stockData = {
      symbol: symbolUpper,
      basicInfo: basicInfoResult.data,
      priceData: priceDataResult.data,
      fullData: basicInfoResult.data, // Use basicInfo as fullData
      updatedAt: new Date().toISOString(),
    };

    // Convert to JSON string with pretty formatting
    const jsonContent = JSON.stringify(stockData, null, 2);

    // Save to local filesystem
    const saveResult = saveStockFile(symbolUpper, jsonContent);

    if (!saveResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: saveResult.error || 'Failed to save stock data',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: saveResult.message,
        symbol: symbolUpper,
        fileExists: fileExists,
        filePath: saveResult.filePath,
        dataFetched: {
          basicInfo: !!basicInfoResult.data,
          priceData: !!priceDataResult.data,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[stocks-v2/fetch-and-save.js] Error:', error);
    console.error('[stocks-v2/fetch-and-save.js] Error stack:', error?.stack);
    // Always return a response, never throw
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

