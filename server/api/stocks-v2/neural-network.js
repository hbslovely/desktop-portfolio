import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  runtime: 'nodejs',
};

/**
 * Read neural network weights file
 */
function readNeuralNetworkFile(symbol) {
  const dataDir = path.join(__dirname, '../../data/stocks');
  const filePath = path.join(dataDir, `${symbol.toUpperCase()}.json`);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stockData = JSON.parse(content);
      
      // Return neural network data if exists
      if (stockData.neuralNetwork) {
        return { 
          success: true, 
          data: stockData.neuralNetwork,
          trainedAt: stockData.neuralNetwork?.trainedAt,
          trainingEpochs: stockData.neuralNetwork?.trainingEpochs,
          loss: stockData.neuralNetwork?.loss
        };
      }
      return { success: false, error: 'Neural network data not found' };
    }
    return { success: false, error: 'Stock file not found' };
  } catch (error) {
    console.error('Error reading neural network file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save neural network weights to stock file
 */
function saveNeuralNetworkFile(symbol, neuralNetworkData) {
  const dataDir = path.join(__dirname, '../../data/stocks');
  const filePath = path.join(dataDir, `${symbol.toUpperCase()}.json`);
  
  try {
    // Read existing stock data
    let stockData = {};
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      stockData = JSON.parse(content);
    }

    // Update neural network data
    stockData.neuralNetwork = {
      ...neuralNetworkData,
      trainedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, JSON.stringify(stockData, null, 2), 'utf-8');
    return { success: true, message: 'Neural network data saved successfully' };
  } catch (error) {
    console.error('Error saving neural network file:', error);
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

    // GET: Load neural network weights
    if (req.method === 'GET') {
      const result = readNeuralNetworkFile(symbol);

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
          trainedAt: result.trainedAt,
          trainingEpochs: result.trainingEpochs,
          loss: result.loss,
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

    // POST: Save neural network weights
    if (req.method === 'POST') {
      const body = await req.json();
      const { weights, trainingEpochs, loss, modelConfig } = body;

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

      const neuralNetworkData = {
        weights,
        trainingEpochs: trainingEpochs || 0,
        loss: loss || null,
        modelConfig: modelConfig || null,
      };

      const saveResult = saveNeuralNetworkFile(symbol, neuralNetworkData);

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
          message: saveResult.message,
          symbol: symbol,
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
