/**
 * Stock Model API - V2
 * Save and retrieve ML model results from Neon PostgreSQL database
 * 
 * Endpoints:
 * - GET /api/stocks-v2/stock-model/:symbol - Get model data for a symbol
 * - POST /api/stocks-v2/stock-model/:symbol - Save model data
 * - GET /api/stocks-v2/stock-model/:symbol/check - Check if model exists
 */

import { 
  getStockModel, 
  saveStockModel, 
  saveNeuralNetworkWeights,
  getNeuralNetworkWeights,
  saveSimulationResult,
  checkModelExists 
} from '../../lib/db.js';

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

    // Check for action parameter (check, weights, simulation)
    const action = req.query.action;

    // GET: Load stock model data
    if (req.method === 'GET') {
      // Check action parameter
      if (action === 'check') {
        const result = await checkModelExists(symbol);
        return res.status(200).json({
          success: true,
          ...result
        });
      }

      if (action === 'weights') {
        const result = await getNeuralNetworkWeights(symbol);
        if (!result.success) {
          return res.status(404).json({
            success: false,
            error: result.error || 'Neural network weights not found',
          });
        }
        return res.status(200).json({
          success: true,
          data: result.data,
        });
      }

      // Default: get full model data
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
        // Neural network data
        neuralNetworkWeights: typeof row.neural_network_weights === 'string'
          ? JSON.parse(row.neural_network_weights)
          : row.neural_network_weights,
        trainingEpochs: row.training_epochs,
        trainingLoss: row.training_loss ? parseFloat(row.training_loss) : null,
        trainingAccuracy: row.training_accuracy ? parseFloat(row.training_accuracy) : null,
        modelConfig: typeof row.model_config === 'string'
          ? JSON.parse(row.model_config)
          : row.model_config,
        // Training parameters
        lookbackDays: row.lookback_days,
        forecastDays: row.forecast_days,
        batchSize: row.batch_size,
        validationSplit: row.validation_split ? parseFloat(row.validation_split) : 0.2,
        // Trading config (flat fields)
        tradingConfig: {
          initialCapital: row.initial_capital ? parseFloat(row.initial_capital) : 100000000,
          stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : 5,
          takeProfitPercent: row.take_profit_percent ? parseFloat(row.take_profit_percent) : 10,
          maxPositions: row.max_positions || 3,
          tPlusDays: row.t_plus_days || 2,
        },
        // Date range
        dateRange: {
          startDate: row.date_range_start,
          endDate: row.date_range_end,
        },
        // Simulation result
        simulationResult: typeof row.simulation_result === 'string'
          ? JSON.parse(row.simulation_result)
          : row.simulation_result,
        // Timestamps
        trainedAt: row.trained_at,
        updatedAt: row.updated_at,
      };

      return res.status(200).json({
        success: true,
        data: modelData,
      });
    }

    // POST: Save stock model data
    if (req.method === 'POST') {
      const body = req.body;

      // Determine what type of save based on request body
      if (body.weights) {
        // Save neural network weights only
        const weightsData = {
          weights: body.weights,
          trainingEpochs: body.trainingEpochs || 50,
          loss: body.loss || null,
          accuracy: body.accuracy || null,
          modelConfig: body.modelConfig || null,
          lookbackDays: body.lookbackDays || 60,
          forecastDays: body.forecastDays || 1,
          batchSize: body.batchSize || 32,
          validationSplit: body.validationSplit || 0.2,
        };

        const saveResult = await saveNeuralNetworkWeights(symbol, weightsData);

        if (!saveResult.success) {
          return res.status(500).json({
            success: false,
            error: saveResult.error || 'Failed to save neural network weights',
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Neural network weights saved successfully',
          symbol: symbol,
          updatedAt: saveResult.updatedAt,
        });
      }

      if (body.simulationResult) {
        // Save simulation result and trading config
        const tradingConfig = body.tradingConfig || {};
        const dateRange = body.dateRange || {};

        const saveResult = await saveSimulationResult(
          symbol,
          body.simulationResult,
          tradingConfig,
          dateRange
        );

        if (!saveResult.success) {
          return res.status(500).json({
            success: false,
            error: saveResult.error || 'Failed to save simulation result',
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Simulation result saved successfully',
          symbol: symbol,
          updatedAt: saveResult.updatedAt,
        });
      }

      // Full model save
      const saveResult = await saveStockModel(symbol, body);

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
