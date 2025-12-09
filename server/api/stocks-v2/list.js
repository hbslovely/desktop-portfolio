import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  runtime: 'nodejs',
};

/**
 * Get list of all stock symbols from local filesystem
 */
function getStockListFromLocal() {
  const dataDir = path.join(__dirname, '../../data/stocks');
  
  try {
    // Check if directory exists
    if (!fs.existsSync(dataDir)) {
      console.log('Stocks directory does not exist yet, returning empty list');
      return { success: true, symbols: [] };
    }

    // Read directory
    const files = fs.readdirSync(dataDir);

    // Filter JSON files and extract symbols
    const symbols = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', '').toUpperCase())
      .sort();

    return { success: true, symbols };
  } catch (error) {
    console.error('Error reading stock list:', error);
    return { success: true, symbols: [] };
  }
}

export default async function handler(req) {
  try {
    console.log('[stocks-v2/list.js] API requested', req?.url, req?.method);

    // Handle CORS preflight
    if (req?.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req?.method !== 'GET') {
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

    // Fetch stock list from local filesystem
    const result = getStockListFromLocal();

    console.log('[stocks-v2/list.js] Result:', {
      success: result.success,
      symbolsCount: result.symbols?.length || 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        symbols: result.symbols || [],
        count: result.symbols?.length || 0,
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
    console.error('[stocks-v2/list.js] Unhandled error:', error);
    console.error('[stocks-v2/list.js] Error stack:', error?.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
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

