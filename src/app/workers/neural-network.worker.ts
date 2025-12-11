/// <reference lib="webworker" />

import * as tf from '@tensorflow/tfjs';

// Message types
interface TrainMessage {
  type: 'train';
  prices: number[];
  config: {
    epochs: number;
    batchSize: number;
    validationSplit: number;
    lookbackDays: number;
    forecastDays: number;
    learningRate: number;
  };
}

interface PredictMessage {
  type: 'predict';
  prices: number[];
  days: number;
}

interface LoadWeightsMessage {
  type: 'loadWeights';
  weightsData: any[];
  config: {
    lookbackDays: number;
    forecastDays: number;
  };
}

interface GetWeightsMessage {
  type: 'getWeights';
}

interface DisposeMessage {
  type: 'dispose';
}

type WorkerMessage = TrainMessage | PredictMessage | LoadWeightsMessage | GetWeightsMessage | DisposeMessage;

// Worker state
let model: tf.Sequential | null = null;
let isModelReady = false;
let currentConfig = {
  lookbackDays: 60,
  forecastDays: 1,
};

// Initialize TensorFlow.js backend
tf.setBackend('cpu'); // Use CPU in worker for stability

/**
 * Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
    if (i < period - 1) {
      ema.push(NaN);
    }
  }

  if (prices.length >= period) {
    ema.push(sum / period);

    for (let i = period; i < prices.length; i++) {
      ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
  }

  return ema;
}

/**
 * Calculate MACD indicators
 */
function calculateMACD(prices: number[]): {
  macd: number[];
  signal: number[];
  histogram: number[];
} {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);

  const macd: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(ema12[i]) || isNaN(ema26[i])) {
      macd.push(NaN);
    } else {
      macd.push(ema12[i] - ema26[i]);
    }
  }

  const validMacd = macd.filter(v => !isNaN(v));
  const signal = calculateEMA(validMacd, 9);
  
  const paddedSignal: number[] = [];
  const signalOffset = macd.length - signal.length;
  for (let i = 0; i < macd.length; i++) {
    if (i < signalOffset) {
      paddedSignal.push(NaN);
    } else {
      paddedSignal.push(signal[i - signalOffset]);
    }
  }

  const histogram: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (isNaN(macd[i]) || isNaN(paddedSignal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macd[i] - paddedSignal[i]);
    }
  }

  return { macd, signal: paddedSignal, histogram };
}

/**
 * Normalize data to 0-1 range
 */
function normalizeData(data: number[]): { normalized: number[], min: number, max: number } {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const normalized = data.map(val => (val - min) / range);
  return { normalized, min, max };
}

/**
 * Create neural network model
 */
function createModel(inputSize: number, learningRate: number): tf.Sequential {
  const newModel = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [inputSize],
        units: 128,
        activation: 'relu',
        name: 'dense1'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'dense2'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        name: 'dense3'
      }),
      
      tf.layers.dense({
        units: 3,
        activation: 'linear',
        name: 'output'
      })
    ]
  });

  newModel.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError'
  });

  return newModel;
}

/**
 * Train the model
 */
async function trainModel(prices: number[], config: TrainMessage['config']): Promise<void> {
  const lookback = config.lookbackDays;
  currentConfig.lookbackDays = lookback;
  currentConfig.forecastDays = config.forecastDays;

  // Normalize prices
  const { normalized: normalizedPrices, min, max } = normalizeData(prices);
  
  // Calculate MACD
  const macdData = calculateMACD(normalizedPrices);
  
  // Normalize MACD values
  const allMacdValues = macdData.macd.filter(v => !isNaN(v));
  const allSignalValues = macdData.signal.filter(v => !isNaN(v));
  const allHistogramValues = macdData.histogram.filter(v => !isNaN(v));
  
  const macdMin = Math.min(...allMacdValues);
  const macdMax = Math.max(...allMacdValues);
  const macdRange = macdMax - macdMin || 1;
  
  const signalMin = Math.min(...allSignalValues);
  const signalMax = Math.max(...allSignalValues);
  const signalRange = signalMax - signalMin || 1;
  
  const histMin = Math.min(...allHistogramValues);
  const histMax = Math.max(...allHistogramValues);
  const histRange = histMax - histMin || 1;

  // Prepare training data
  const normalizedXs: number[][] = [];
  const normalizedYs: number[][] = [];
  
  for (let i = lookback; i < normalizedPrices.length - 1; i++) {
    const priceFeatures = normalizedPrices.slice(i - lookback, i);
    const macdValue = isNaN(macdData.macd[i]) ? 0 : (macdData.macd[i] - macdMin) / macdRange;
    const signalValue = isNaN(macdData.signal[i]) ? 0 : (macdData.signal[i] - signalMin) / signalRange;
    const histogramValue = isNaN(macdData.histogram[i]) ? 0 : (macdData.histogram[i] - histMin) / histRange;
    normalizedXs.push([...priceFeatures, macdValue, signalValue, histogramValue]);
    
    const originalFuturePrice = prices[i + 1 - 1];
    const currentPrice = prices[i];
    const futurePriceOriginal = prices[Math.min(i + 5, prices.length - 1)];
    const returnPercent = (futurePriceOriginal - currentPrice) / currentPrice;
    
    const macdCrossUp = !isNaN(macdData.histogram[i]) && i > 0 && macdData.histogram[i] > 0 && macdData.histogram[i - 1] <= 0;
    const macdCrossDown = !isNaN(macdData.histogram[i]) && i > 0 && macdData.histogram[i] < 0 && macdData.histogram[i - 1] >= 0;
    
    let buySignal = 0;
    let sellSignal = 0;
    
    if (returnPercent > 0.02 || (macdCrossUp && returnPercent > 0)) {
      buySignal = 1;
    }
    if (returnPercent < -0.02 || (macdCrossDown && returnPercent < 0)) {
      sellSignal = 1;
    }
    
    const normalizedPrice = (originalFuturePrice - min) / (max - min);
    normalizedYs.push([normalizedPrice, buySignal, sellSignal]);
  }
  
  const minLength = Math.min(normalizedXs.length, normalizedYs.length);
  const finalXs = normalizedXs.slice(0, minLength);
  const finalYs = normalizedYs.slice(0, minLength);

  // Create tensors
  const xsTensor = tf.tensor2d(finalXs);
  const ysTensor = tf.tensor2d(finalYs);
  
  const inputSize = lookback + 3;

  // Create or recreate model
  if (model) {
    model.dispose();
  }
  model = createModel(inputSize, config.learningRate);

  // Train
  let finalLoss = 0;
  let finalAccuracy = 0;
  
  await model.fit(xsTensor, ysTensor, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationSplit: config.validationSplit,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        finalLoss = logs?.['loss'] || 0;
        finalAccuracy = finalLoss > 0 ? Math.max(0, Math.min(1, 1 / (1 + finalLoss))) : 0;
        
        // Send progress to main thread
        self.postMessage({
          type: 'progress',
          epoch: epoch + 1,
          totalEpochs: config.epochs,
          loss: finalLoss,
          accuracy: finalAccuracy
        });
      }
    }
  });

  // Cleanup
  xsTensor.dispose();
  ysTensor.dispose();

  isModelReady = true;

  // Send completion message
  self.postMessage({
    type: 'trained',
    loss: finalLoss,
    accuracy: finalAccuracy,
    epochs: config.epochs
  });
}

/**
 * Make prediction
 */
async function predict(prices: number[], days: number): Promise<void> {
  if (!model || !isModelReady) {
    self.postMessage({
      type: 'error',
      error: 'Model is not trained yet'
    });
    return;
  }

  const lookback = currentConfig.lookbackDays;
  if (prices.length < lookback) {
    self.postMessage({
      type: 'error',
      error: `Need at least ${lookback} days of historical data`
    });
    return;
  }

  try {
    const { normalized: normalizedPrices, min, max } = normalizeData(prices);
    const macdData = calculateMACD(normalizedPrices);
    
    const allMacdValues = macdData.macd.filter(v => !isNaN(v));
    const allSignalValues = macdData.signal.filter(v => !isNaN(v));
    const allHistogramValues = macdData.histogram.filter(v => !isNaN(v));
    
    const macdMin = Math.min(...allMacdValues);
    const macdMax = Math.max(...allMacdValues);
    const macdRange = macdMax - macdMin || 1;
    
    const signalMin = Math.min(...allSignalValues);
    const signalMax = Math.max(...allSignalValues);
    const signalRange = signalMax - signalMin || 1;
    
    const histMin = Math.min(...allHistogramValues);
    const histMax = Math.max(...allHistogramValues);
    const histRange = histMax - histMin || 1;

    const lastDays = normalizedPrices.slice(-lookback);
    const lastIndex = normalizedPrices.length - 1;
    const macdValue = isNaN(macdData.macd[lastIndex]) ? 0 : (macdData.macd[lastIndex] - macdMin) / macdRange;
    const signalValue = isNaN(macdData.signal[lastIndex]) ? 0 : (macdData.signal[lastIndex] - signalMin) / signalRange;
    const histogramValue = isNaN(macdData.histogram[lastIndex]) ? 0 : (macdData.histogram[lastIndex] - histMin) / histRange;
    
    const inputFeatures = [...lastDays, macdValue, signalValue, histogramValue];
    const inputTensor = tf.tensor2d([inputFeatures]);

    const prediction = model.predict(inputTensor) as tf.Tensor;
    const predictedValue = await prediction.data();
    const predictedNormalized = predictedValue[0];
    const buySignalRaw = predictedValue[1];
    const sellSignalRaw = predictedValue[2];

    const predictedPrice = predictedNormalized * (max - min) + min;
    const buySignalProb = 1 / (1 + Math.exp(-buySignalRaw));
    const sellSignalProb = 1 / (1 + Math.exp(-sellSignalRaw));

    // MACD signals
    const currentHistogram = macdData.histogram[lastIndex];
    const macdBullish = !isNaN(currentHistogram) && currentHistogram > 0;
    const macdBearish = !isNaN(currentHistogram) && currentHistogram < 0;
    
    let finalBuyProb = buySignalProb;
    let finalSellProb = sellSignalProb;
    
    if (macdBullish) {
      finalBuyProb = Math.min(1, buySignalProb + 0.15);
    }
    if (macdBearish) {
      finalSellProb = Math.min(1, sellSignalProb + 0.15);
    }

    // Determine action
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = Math.max(finalBuyProb, finalSellProb);
    let reason = '';
    
    if (finalBuyProb > 0.6 && finalBuyProb > finalSellProb) {
      action = 'buy';
      confidence = finalBuyProb;
      reason = `Model + MACD: Nên mua (confidence: ${(finalBuyProb * 100).toFixed(1)}%)`;
    } else if (finalSellProb > 0.6 && finalSellProb > finalBuyProb) {
      action = 'sell';
      confidence = finalSellProb;
      reason = `Model + MACD: Nên bán (confidence: ${(finalSellProb * 100).toFixed(1)}%)`;
    } else {
      reason = `Model + MACD: Khuyến nghị giữ (buy: ${(finalBuyProb * 100).toFixed(1)}%, sell: ${(finalSellProb * 100).toFixed(1)}%)`;
    }

    // Calculate trend
    const currentPrice = prices[prices.length - 1];
    const priceChange = predictedPrice - currentPrice;
    const changePercent = Math.abs(priceChange / currentPrice);
    
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (changePercent > 0.02) {
      trend = priceChange > 0 ? 'up' : 'down';
    }

    // Calculate volatility for confidence
    const recentPrices = prices.slice(-30);
    const returns: number[] = [];
    for (let i = 1; i < recentPrices.length; i++) {
      returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const priceConfidence = Math.max(0, Math.min(1, 1 - volatility / 0.1));

    inputTensor.dispose();
    prediction.dispose();

    const PRICE_MULTIPLIER = 1000;

    self.postMessage({
      type: 'prediction',
      result: {
        predictedPrice: predictedPrice * PRICE_MULTIPLIER,
        confidence: priceConfidence,
        trend,
        nextDayPrediction: predictedPrice * PRICE_MULTIPLIER,
        tradingDecision: {
          action,
          confidence,
          reason
        }
      }
    });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Prediction failed'
    });
  }
}

/**
 * Load weights into model
 */
async function loadWeights(weightsData: any[], config: LoadWeightsMessage['config']): Promise<void> {
  try {
    currentConfig.lookbackDays = config.lookbackDays;
    currentConfig.forecastDays = config.forecastDays;
    
    const inputSize = config.lookbackDays + 3;
    
    if (!model) {
      model = createModel(inputSize, 0.001);
    }

    const weightTensors: tf.Tensor[][] = [];
    for (const layerData of weightsData) {
      const layerWeights: tf.Tensor[] = [];
      for (const weightData of layerData.weights) {
        const tensor = tf.tensor(weightData.data, weightData.shape);
        layerWeights.push(tensor);
      }
      weightTensors.push(layerWeights);
    }

    for (let i = 0; i < weightTensors.length && i < model.layers.length; i++) {
      model.layers[i].setWeights(weightTensors[i]);
    }

    weightTensors.forEach(layerWeights => {
      layerWeights.forEach(tensor => tensor.dispose());
    });

    isModelReady = true;

    self.postMessage({
      type: 'weightsLoaded',
      success: true
    });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Failed to load weights'
    });
  }
}

/**
 * Get model weights
 */
async function getWeights(): Promise<void> {
  if (!model || !isModelReady) {
    self.postMessage({
      type: 'error',
      error: 'Model is not ready'
    });
    return;
  }

  try {
    const weights: any[] = [];
    for (const layer of model.layers) {
      const layerWeights = layer.getWeights();
      const weightData: any[] = [];
      for (const weight of layerWeights) {
        const data = await weight.data();
        const shape = weight.shape;
        weightData.push({
          data: Array.from(data),
          shape: shape
        });
      }
      weights.push({
        layerName: layer.name,
        weights: weightData
      });
    }

    self.postMessage({
      type: 'weights',
      weights,
      config: currentConfig
    });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Failed to get weights'
    });
  }
}

/**
 * Dispose model
 */
function disposeModel(): void {
  if (model) {
    model.dispose();
    model = null;
    isModelReady = false;
  }
  self.postMessage({
    type: 'disposed'
  });
}

// Handle messages from main thread
addEventListener('message', async ({ data }: { data: WorkerMessage }) => {
  switch (data.type) {
    case 'train':
      await trainModel(data.prices, data.config);
      break;
    case 'predict':
      await predict(data.prices, data.days);
      break;
    case 'loadWeights':
      await loadWeights(data.weightsData, data.config);
      break;
    case 'getWeights':
      await getWeights();
      break;
    case 'dispose':
      disposeModel();
      break;
  }
});

