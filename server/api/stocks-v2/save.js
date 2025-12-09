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
 * Read stock file from local filesystem
 */
function readStockFile(symbol) {
  const dataDir = path.join(__dirname, '../../data/stocks');
  const filePath = path.join(dataDir, `${symbol.toUpperCase()}.json`);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(content) };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, error: error.message };
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
    const { symbol, basicInfo, priceData, fullData } = body;

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
    console.log(`[stocks-v2/save.js] File exists for ${symbolUpper}:`, fileExists);

    // Prepare stock data (same structure as before)
    const stockData = {
      symbol: symbolUpper,
      basicInfo,
      priceData,
      fullData,
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
    console.error('[stocks-v2/save.js] Error saving stock data:', error);
    console.error('[stocks-v2/save.js] Error stack:', error?.stack);
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

