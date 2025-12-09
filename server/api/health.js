/**
 * Health Check API
 * Tests database connection and returns server status
 */

import { testConnection } from '../lib/db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();

  try {
    const hasVietStockUrl = !!process.env.VIET_STOCK_POOL_POSTGRES_URL;
    const hasPostgresUrl = !!process.env.POSTGRES_URL;

    let dbResult = { success: false, error: 'No database URL configured' };
    
    if (hasVietStockUrl || hasPostgresUrl) {
      dbResult = await testConnection();
    }

    const responseTime = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      status: dbResult.success ? 'healthy' : 'degraded',
      database: dbResult.success ? 'connected' : 'disconnected',
      databaseTime: dbResult.time || null,
      databaseError: dbResult.error || null,
      responseTimeMs: responseTime,
      envVars: {
        VIET_STOCK_POOL_POSTGRES_URL: hasVietStockUrl,
        POSTGRES_URL: hasPostgresUrl,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[health] Error:', error);
    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
