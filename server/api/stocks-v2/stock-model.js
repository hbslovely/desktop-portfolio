/**
 * Stock Model API - V2
 * Save and retrieve ML model results from Vercel Postgres database
 */

import { getStockModel, saveStockModel } from '../../lib/db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract symbol from query or URL path
    let symbol = req.query.symbol;
    
    // If not in query, try to extract from URL path
    if (!symbol) {
      const url = req.url || '';
      const pathParts = url.split('/').filter(p => p && p !== 'api' && p !== 'stocks-v2' && p !== 'stock-model');
      symbol = pathParts[pathParts.length - 1]?.split('?')[0];
    }

    symbol = symbol?.toUpperCase();

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }

    // GET: Load stock model results
    if (req.method === 'GET') {
      const result = await getStockModel(symbol);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'Stock model data not found',
        });
      }

      // Transform database row to expected format
      const row = result.data;
      const modelData = {
        symbol: row.symbol,
        simulationResult: typeof row.simulation_result === 'string'
          ? JSON.parse(row.simulation_result)
          : row.simulation_result || {},
        tradingConfig: typeof row.trading_config === 'string'
          ? JSON.parse(row.trading_config)
          : row.trading_config || {},
        dateRange: typeof row.date_range === 'string'
          ? JSON.parse(row.date_range)
          : row.date_range || {},
        simulations: typeof row.simulations === 'string'
          ? JSON.parse(row.simulations)
          : row.simulations || [],
        updatedAt: row.updated_at,
      };

      return res.status(200).json({
        success: true,
        data: modelData,
      });
    }

    // POST: Save stock model results
    if (req.method === 'POST') {
      const { simulationResult, tradingConfig, dateRange } = req.body;

      if (!simulationResult) {
        return res.status(400).json({ success: false, error: 'Simulation result is required' });
      }

      // Trim simulation data to reduce storage
      const trimmedSimulationResult = {
        ...simulationResult,
        signalsCount: simulationResult.signals?.length || 0,
        signals: simulationResult.signals?.slice(0, 100) || [],
        equityCurveCount: simulationResult.equityCurve?.length || 0,
        equityCurve: simulationResult.equityCurve?.slice(-100) || [],
      };

      const saveResult = await saveStockModel(
        symbol,
        trimmedSimulationResult,
        tradingConfig,
        dateRange
      );

      if (!saveResult.success) {
        return res.status(500).json({
          success: false,
          error: saveResult.error || 'Failed to save stock model data',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Stock model data saved successfully',
        symbol: symbol,
        updatedAt: saveResult.updatedAt,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[stocks-v2/stock-model.js] Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
