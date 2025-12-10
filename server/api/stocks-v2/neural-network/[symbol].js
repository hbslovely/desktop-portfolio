/**
 * Neural Network API - V2
 * Save and load neural network weights from Neon PostgreSQL database
 *
 * Endpoints:
 * - GET /api/stocks-v2/neural-network/:symbol - Load neural network weights
 * - POST /api/stocks-v2/neural-network/:symbol - Save neural network weights
 */

import {
  saveNeuralNetworkWeights,
  getNeuralNetworkWeights,
  checkModelExists
} from '../../../lib/db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }

    // Check for action parameter
    const action = url.searchParams.get('action');

    // GET: Load neural network weights from database
    if (req.method === 'GET') {
      // Check action parameter
      if (action === 'check') {
        const result = await checkModelExists(symbol);
        return res.status(200).json({
          success: true,
          ...result
        });
      }

      const result = await getNeuralNetworkWeights(symbol);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'Neural network data not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        trainedAt: result.data.trainedAt,
        trainingEpochs: result.data.trainingEpochs,
        loss: result.data.loss,
        accuracy: result.data.accuracy,
        // Training parameters
        lookbackDays: result.data.lookbackDays,
        forecastDays: result.data.forecastDays,
        batchSize: result.data.batchSize,
        validationSplit: result.data.validationSplit,
      });
    }

    // POST: Save neural network weights to database
    if (req.method === 'POST') {
      const {
        weights,
        trainingEpochs,
        loss,
        accuracy,
        modelConfig,
        // Training parameters
        lookbackDays,
        forecastDays,
        batchSize,
        validationSplit,
      } = req.body;

      if (!weights) {
        return res.status(400).json({ success: false, error: 'Weights are required' });
      }

      const weightsData = {
        weights,
        trainingEpochs: trainingEpochs || 50,
        loss: loss || null,
        accuracy: accuracy || null,
        modelConfig: modelConfig || {
          inputSize: lookbackDays || 60,
          layers: [
            { units: 128, activation: 'relu' },
            { units: 64, activation: 'relu' },
            { units: 32, activation: 'relu' },
            { units: 3, activation: 'linear' }
          ]
        },
        lookbackDays: lookbackDays || 60,
        forecastDays: forecastDays || 1,
        batchSize: batchSize || 32,
        validationSplit: validationSplit || 0.2,
      };

      const saveResult = await saveNeuralNetworkWeights(symbol, weightsData);

      if (!saveResult.success) {
        return res.status(500).json({
          success: false,
          error: saveResult.error || 'Failed to save neural network data',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Neural network data saved to database successfully',
        symbol: symbol,
        updatedAt: saveResult.updatedAt,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[stocks-v2/neural-network.js] Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
