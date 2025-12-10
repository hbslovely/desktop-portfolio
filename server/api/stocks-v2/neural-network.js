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
} from '../../lib/db.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    // Find index of 'neural-network' and get next part as symbol
    const nnIndex = pathParts.indexOf('neural-network');
    const symbol = nnIndex >= 0 && nnIndex < pathParts.length - 1 
      ? pathParts[nnIndex + 1]?.toUpperCase() 
      : null;

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

    // Check for action parameter
    const action = url.searchParams.get('action');

    // GET: Load neural network weights from database
    if (req.method === 'GET') {
      // Check action parameter
      if (action === 'check') {
        const result = await checkModelExists(symbol);
        return new Response(
          JSON.stringify({
            success: true,
            ...result
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const result = await getNeuralNetworkWeights(symbol);

      if (!result.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error || 'Neural network data not found',
          }),
          {
            status: 404,
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
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // POST: Save neural network weights to database
    if (req.method === 'POST') {
      const body = await req.json();
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
      } = body;

      if (!weights) {
        return new Response(
          JSON.stringify({ success: false, error: 'Weights are required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
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
        return new Response(
          JSON.stringify({
            success: false,
            error: saveResult.error || 'Failed to save neural network data',
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
          message: 'Neural network data saved to database successfully',
          symbol: symbol,
          updatedAt: saveResult.updatedAt,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

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
  } catch (error) {
    console.error('[stocks-v2/neural-network.js] Error:', error);
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
