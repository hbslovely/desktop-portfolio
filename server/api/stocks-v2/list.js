import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  runtime: 'nodejs',
};

/**
 * Extract companyInfo from fullData and convert to flat key structure
 * Returns flat key structure like: { 'pageProps.companyInfo.fullName': '...', ... }
 */
function extractCompanyInfoToFlatKeys(fullData) {
  if (!fullData) return {};

  let companyInfo = null;

  // Try to find companyInfo in various possible structures
  // Case 1: fullData.pageProps.companyInfo (nested object)
  if (fullData.pageProps && fullData.pageProps.companyInfo) {
    companyInfo = fullData.pageProps.companyInfo;
  }
  // Case 2: fullData['pageProps.companyInfo'] (flat key structure - already an object)
  else if (fullData['pageProps.companyInfo']) {
    companyInfo = fullData['pageProps.companyInfo'];
  }
  // Case 3: Look for keys starting with 'pageProps.companyInfo.'
  else {
    companyInfo = {};
    for (const key in fullData) {
      if (key.startsWith('pageProps.companyInfo.')) {
        const fieldName = key.replace('pageProps.companyInfo.', '');
        companyInfo[fieldName] = fullData[key];
      }
    }
    
    // If no fields found, return empty object
    if (Object.keys(companyInfo).length === 0) {
      return {};
    }
  }

  // Convert companyInfo object to flat key structure
  const flatKeys = {};
  if (companyInfo && typeof companyInfo === 'object') {
    for (const key in companyInfo) {
      flatKeys[`pageProps.companyInfo.${key}`] = companyInfo[key];
    }
  }

  return flatKeys;
}

/**
 * Get list of all stock data from local filesystem
 * Only returns fullData.pageProps.companyInfo for each stock
 */
function getStockListFromLocal() {
  const dataDir = path.join(__dirname, '../../data/stocks');
  
  try {
    // Check if directory exists
    if (!fs.existsSync(dataDir)) {
      console.log('Stocks directory does not exist yet, returning empty list');
      return { success: true, stocks: [] };
    }

    // Read directory
    const files = fs.readdirSync(dataDir);

    // Filter JSON files and extract only companyInfo
    const stocks = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        try {
          const filePath = path.join(dataDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const stockData = JSON.parse(content);
          
          // Extract only companyInfo from fullData and convert to flat keys
          const companyInfoFlatKeys = extractCompanyInfoToFlatKeys(stockData.fullData);
          
          // Return minimal structure with symbol, basicInfo, and companyInfo (as flat keys)
          return {
            symbol: stockData.symbol || file.replace('.json', '').toUpperCase(),
            basicInfo: stockData.basicInfo || {},
            fullData: Object.keys(companyInfoFlatKeys).length > 0 ? companyInfoFlatKeys : null
          };
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
          return null;
        }
      })
      .filter((stock) => stock !== null)
      .sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));

    return { success: true, stocks };
  } catch (error) {
    console.error('Error reading stock list:', error);
    return { success: true, stocks: [] };
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
      stocksCount: result.stocks?.length || 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        stocks: result.stocks || [],
        count: result.stocks?.length || 0,
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

