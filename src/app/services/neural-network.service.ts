import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as tf from '@tensorflow/tfjs';

export interface StockPrediction {
  predictedPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'neutral';
  nextDayPrediction?: number;
  nextWeekPrediction?: number;
  nextMonthPrediction?: number;
  // Trading decision from model
  tradingDecision?: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number; // Model's confidence in this decision
    reason: string;
  };
}

export interface TrainingProgress {
  epoch: number;
  loss: number;
  accuracy?: number;
}

export interface TrainingConfig {
  epochs: number;           // Số vòng lặp huấn luyện (50-200)
  batchSize: number;        // Kích thước batch (16-64)
  validationSplit: number;  // Tỷ lệ validation (0.1-0.3)
  lookbackDays: number;     // Số ngày lịch sử để xét (30-120)
  forecastDays: number;     // Số ngày dự đoán (1-7)
  learningRate: number;     // Tốc độ học (0.0001-0.01)
}

export interface NeuralNetworkWeights {
  weights: any[];
  trainingEpochs?: number;
  loss?: number;
  accuracy?: number;
  modelConfig?: any;
  trainedAt?: string;
  // Training config used
  lookbackDays?: number;
  forecastDays?: number;
  batchSize?: number;
  validationSplit?: number;
}

export interface ModelStatus {
  exists: boolean;
  hasWeights: boolean;
  hasSimulation: boolean;
}

// Default training configuration with descriptions
export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  epochs: 50,           // Số vòng lặp huấn luyện
  batchSize: 32,        // Kích thước batch
  validationSplit: 0.2, // Tỷ lệ validation
  lookbackDays: 60,     // Số ngày lịch sử
  forecastDays: 1,      // Số ngày dự đoán
  learningRate: 0.001,  // Tốc độ học
};

// Training config descriptions for UI
export const TRAINING_CONFIG_DESCRIPTIONS: Record<keyof TrainingConfig, { label: string; description: string; min: number; max: number; step: number }> = {
  epochs: {
    label: 'Số Epochs',
    description: 'Số vòng lặp huấn luyện. Nhiều epochs hơn = model học kỹ hơn nhưng có thể bị overfit. Khuyến nghị: 30-100',
    min: 10,
    max: 200,
    step: 10
  },
  batchSize: {
    label: 'Batch Size',
    description: 'Số mẫu dữ liệu xử lý mỗi lần. Batch nhỏ = học chi tiết hơn nhưng chậm hơn. Khuyến nghị: 16-64',
    min: 8,
    max: 128,
    step: 8
  },
  validationSplit: {
    label: 'Validation Split',
    description: 'Tỷ lệ dữ liệu dùng để kiểm tra (validation). 0.2 = 20% data để validate. Khuyến nghị: 0.1-0.3',
    min: 0.1,
    max: 0.4,
    step: 0.05
  },
  lookbackDays: {
    label: 'Lookback Days',
    description: 'Số ngày lịch sử để model xem xét. Nhiều ngày hơn = nhìn xa hơn nhưng cần nhiều data hơn. Khuyến nghị: 30-90',
    min: 20,
    max: 120,
    step: 10
  },
  forecastDays: {
    label: 'Forecast Days',
    description: 'Số ngày dự đoán phía trước. Dự đoán xa hơn = độ chính xác giảm. Khuyến nghị: 1-5',
    min: 1,
    max: 10,
    step: 1
  },
  learningRate: {
    label: 'Learning Rate',
    description: 'Tốc độ học của model. Cao = học nhanh nhưng có thể bỏ lỡ điểm tối ưu. Khuyến nghị: 0.0005-0.005',
    min: 0.0001,
    max: 0.01,
    step: 0.0001
  }
};

@Injectable({
  providedIn: 'root'
})
export class NeuralNetworkService {
  private model: tf.Sequential | null = null;
  private isModelReady = false;
  private isTraining = false;
  private trainingProgress: TrainingProgress | null = null;
  private lastTrainingLoss: number | null = null;
  private lastTrainingAccuracy: number | null = null;
  private lastTrainingEpochs: number = 0;
  private currentTrainingConfig: TrainingConfig = { ...DEFAULT_TRAINING_CONFIG };

  constructor(private http: HttpClient) {
    // Initialize TensorFlow.js backend
    tf.setBackend('webgl').catch(() => {
      // Fallback to CPU if WebGL is not available
      console.warn('WebGL not available, using CPU backend');
    });
  }

  /**
   * Get current training configuration
   */
  getTrainingConfig(): TrainingConfig {
    return { ...this.currentTrainingConfig };
  }

  /**
   * Set training configuration
   */
  setTrainingConfig(config: Partial<TrainingConfig>): void {
    this.currentTrainingConfig = { ...this.currentTrainingConfig, ...config };
  }

  /**
   * Check if model exists in database
   */
  checkModelExists(symbol: string): Observable<ModelStatus> {
    return this.http.get<any>(`/api/stocks-v2/neural-network/${symbol.toUpperCase()}?action=check`).pipe(
      map(response => ({
        exists: response.exists || false,
        hasWeights: response.hasWeights || false,
        hasSimulation: response.hasSimulation || false
      })),
      catchError(error => {
        console.error('Error checking model exists:', error);
        return of({ exists: false, hasWeights: false, hasSimulation: false });
      })
    );
  }

  /**
   * Create a neural network model for stock price prediction and trading decision
   * Input: lookbackDays prices + 3 MACD indicators
   * Model outputs: [predictedPrice, buySignal, sellSignal]
   */
  createModel(inputSize: number = 63, learningRate: number = 0.001): tf.Sequential {
    const model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [inputSize],
          units: 128,
          activation: 'relu',
          name: 'dense1'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        // Hidden layers
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
        
        // Output layer: [predictedPrice, buySignal, sellSignal]
        // buySignal and sellSignal are probabilities (0-1) from sigmoid
        tf.layers.dense({
          units: 3,
          activation: 'linear', // We'll apply sigmoid to buy/sell signals manually
          name: 'output'
        })
      ]
    });

    // Compile the model with configurable learning rate
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'meanSquaredError'
    });

    return model;
  }

  /**
   * Prepare training data from historical price data
   */
  prepareTrainingData(
    prices: number[],
    lookback: number = 60,
    forecastDays: number = 1
  ): { xs: number[][], ys: number[] } {
    const xs: number[][] = [];
    const ys: number[] = [];

    for (let i = lookback; i < prices.length - forecastDays + 1; i++) {
      // Input: last 'lookback' days of prices
      const x = prices.slice(i - lookback, i);
      xs.push(x);
      
      // Output: price 'forecastDays' days ahead
      const y = prices[i + forecastDays - 1];
      ys.push(y);
    }

    return { xs, ys };
  }

  /**
   * Normalize data to 0-1 range
   */
  normalizeData(data: number[]): { normalized: number[], min: number, max: number } {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Avoid division by zero

    const normalized = data.map(val => (val - min) / range);
    return { normalized, min, max };
  }

  /**
   * Denormalize data back to original scale
   */
  denormalizeData(normalized: number[], min: number, max: number): number[] {
    const range = max - min;
    return normalized.map(val => val * range + min);
  }

  /**
   * Calculate MACD indicators
   */
  calculateMACD(prices: number[]): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);

    const macd: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (isNaN(ema12[i]) || isNaN(ema26[i])) {
        macd.push(NaN);
      } else {
        macd.push(ema12[i] - ema26[i]);
      }
    }

    // Signal line is EMA of MACD (9 periods)
    const validMacd = macd.filter(v => !isNaN(v));
    const signal = this.calculateEMA(validMacd, 9);
    
    // Pad signal array to match macd length
    const paddedSignal: number[] = [];
    const signalOffset = macd.length - signal.length;
    for (let i = 0; i < macd.length; i++) {
      if (i < signalOffset) {
        paddedSignal.push(NaN);
      } else {
        paddedSignal.push(signal[i - signalOffset]);
      }
    }

    // Histogram = MACD - Signal
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
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < period && i < prices.length; i++) {
      sum += prices[i];
      if (i < period - 1) {
        ema.push(NaN);
      }
    }

    if (prices.length >= period) {
      ema.push(sum / period);

      // Calculate subsequent EMA values
      for (let i = period; i < prices.length; i++) {
        ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
      }
    }

    return ema;
  }

  /**
   * Prepare training data with trading signals and MACD
   * Input: [prices (lookback days), macd, signal, histogram] = lookback + 3 features
   * Output: [predictedPrice, buySignal, sellSignal]
   */
  prepareTrainingDataWithSignals(
    prices: number[],
    lookback: number = 60,
    forecastDays: number = 1
  ): { xs: number[][], ys: number[][] } {
    const xs: number[][] = [];
    const ys: number[][] = [];

    // Calculate MACD for all prices
    const macdData = this.calculateMACD(prices);

    for (let i = lookback; i < prices.length - forecastDays + 1; i++) {
      // Input: last 'lookback' days of prices + MACD indicators
      const priceFeatures = prices.slice(i - lookback, i);
      
      // Get MACD values at current position
      const macdValue = isNaN(macdData.macd[i]) ? 0 : macdData.macd[i];
      const signalValue = isNaN(macdData.signal[i]) ? 0 : macdData.signal[i];
      const histogramValue = isNaN(macdData.histogram[i]) ? 0 : macdData.histogram[i];
      
      // Normalize MACD values (they can be negative, so we need to handle this)
      // For simplicity, we'll use raw values and let normalization handle it
      const x = [...priceFeatures, macdValue, signalValue, histogramValue];
      xs.push(x);
      
      // Output: [predictedPrice, buySignal, sellSignal]
      const predictedPrice = prices[i + forecastDays - 1];
      
      // Calculate buy/sell signals based on future returns + MACD
      const currentPrice = prices[i];
      const futurePrice = prices[Math.min(i + 5, prices.length - 1)]; // Look 5 days ahead
      const returnPercent = (futurePrice - currentPrice) / currentPrice;
      
      // MACD signals
      const macdCrossUp = histogramValue > 0 && (i === 0 || macdData.histogram[i - 1] <= 0);
      const macdCrossDown = histogramValue < 0 && (i === 0 || macdData.histogram[i - 1] >= 0);
      
      // Combined signal: price return + MACD
      let buySignal = 0;
      let sellSignal = 0;
      
      if (returnPercent > 0.02 || (macdCrossUp && returnPercent > 0)) {
        buySignal = 1;
      }
      if (returnPercent < -0.02 || (macdCrossDown && returnPercent < 0)) {
        sellSignal = 1;
      }
      
      ys.push([predictedPrice, buySignal, sellSignal]);
    }

    return { xs, ys };
  }

  /**
   * Train the neural network model with configurable parameters
   */
  async trainModel(
    prices: number[],
    config: Partial<TrainingConfig> = {},
    onProgress?: (progress: TrainingProgress) => void
  ): Promise<void> {
    if (this.isTraining) {
      throw new Error('Model is already training');
    }

    // Merge with current config
    const trainingConfig = { ...this.currentTrainingConfig, ...config };
    this.currentTrainingConfig = trainingConfig;

    this.isTraining = true;
    this.isModelReady = false;

    try {
      // Prepare data with trading signals and MACD
      const lookback = trainingConfig.lookbackDays;
      const { xs, ys } = this.prepareTrainingDataWithSignals(prices, lookback, trainingConfig.forecastDays);

      if (xs.length === 0) {
        throw new Error('Not enough data for training. Need at least ' + (lookback + 1) + ' data points.');
      }

      // Normalize data - need to normalize prices and MACD separately
      const allPrices = [...prices];
      const { normalized: normalizedPrices, min, max } = this.normalizeData(allPrices);
      
      // Calculate MACD for normalized prices
      const macdData = this.calculateMACD(normalizedPrices);
      
      // Normalize MACD values (they can be negative)
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

      // Recreate training data with normalized values
      // Make sure xs and ys have the same length
      const normalizedXs: number[][] = [];
      const normalizedYs: number[][] = [];
      
      // Use the same loop structure as prepareTrainingDataWithSignals
      for (let i = lookback; i < normalizedPrices.length - 1; i++) {
        const priceFeatures = normalizedPrices.slice(i - lookback, i);
        const macdValue = isNaN(macdData.macd[i]) ? 0 : (macdData.macd[i] - macdMin) / macdRange;
        const signalValue = isNaN(macdData.signal[i]) ? 0 : (macdData.signal[i] - signalMin) / signalRange;
        const histogramValue = isNaN(macdData.histogram[i]) ? 0 : (macdData.histogram[i] - histMin) / histRange;
        normalizedXs.push([...priceFeatures, macdValue, signalValue, histogramValue]);
        
        // Get corresponding y value (future price at i + 1)
        const futurePrice = normalizedPrices[i + 1 - 1]; // i + forecastDays - 1, where forecastDays = 1
        const originalFuturePrice = prices[i + 1 - 1];
        
        // Calculate buy/sell signals
        const currentPrice = prices[i];
        const futurePriceOriginal = prices[Math.min(i + 5, prices.length - 1)];
        const returnPercent = (futurePriceOriginal - currentPrice) / currentPrice;
        
        // MACD signals
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
        
        // Normalize price
        const normalizedPrice = (originalFuturePrice - min) / (max - min);
        normalizedYs.push([normalizedPrice, buySignal, sellSignal]);
      }
      
      // Ensure xs and ys have the same length
      const minLength = Math.min(normalizedXs.length, normalizedYs.length);
      const finalXs = normalizedXs.slice(0, minLength);
      const finalYs = normalizedYs.slice(0, minLength);

      // Convert to tensors
      const xsTensor = tf.tensor2d(finalXs);
      const ysTensor = tf.tensor2d(finalYs);
      
      const inputSize = lookback + 3; // lookback prices + 3 MACD features
      console.log(`Training data: ${finalXs.length} samples, input shape: [${finalXs.length}, ${inputSize}], output shape: [${finalYs.length}, 3]`);
      console.log(`Training config: epochs=${trainingConfig.epochs}, batchSize=${trainingConfig.batchSize}, validationSplit=${trainingConfig.validationSplit}, learningRate=${trainingConfig.learningRate}`);

      // Create or recreate model
      if (this.model) {
        this.model.dispose();
      }
      this.model = this.createModel(inputSize, trainingConfig.learningRate);

      // Train the model
      let finalLoss = 0;
      let finalAccuracy = 0;
      await this.model.fit(xsTensor, ysTensor, {
        epochs: trainingConfig.epochs,
        batchSize: trainingConfig.batchSize,
        validationSplit: trainingConfig.validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            finalLoss = logs?.['loss'] || 0;
            // Calculate accuracy from loss (lower loss = higher accuracy)
            // Accuracy is inversely related to loss, normalized to 0-1 range
            finalAccuracy = finalLoss > 0 ? Math.max(0, Math.min(1, 1 / (1 + finalLoss))) : 0;
            const progress: TrainingProgress = {
              epoch: epoch + 1,
              loss: finalLoss,
              accuracy: finalAccuracy
            };
            this.trainingProgress = progress;
            this.lastTrainingLoss = finalLoss;
            this.lastTrainingAccuracy = finalAccuracy;
            this.lastTrainingEpochs = epoch + 1;
            if (onProgress) {
              onProgress(progress);
            }
          }
        }
      });

      // Clean up tensors
      xsTensor.dispose();
      ysTensor.dispose();

      this.isModelReady = true;
      console.log('✅ Neural network model trained successfully');
    } catch (error) {
      console.error('Error training model:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Predict next price(s) using the trained model
   */
  async predict(
    prices: number[],
    days: number = 1
  ): Promise<StockPrediction> {
    if (!this.model || !this.isModelReady) {
      throw new Error('Model is not trained yet. Please train the model first.');
    }

    const lookback = this.currentTrainingConfig.lookbackDays;
    if (prices.length < lookback) {
      throw new Error(`Need at least ${lookback} days of historical data for prediction`);
    }

    try {
      // Normalize input data
      const allPrices = [...prices];
      const { normalized: normalizedPrices, min, max } = this.normalizeData(allPrices);

      // Calculate MACD
      const macdData = this.calculateMACD(normalizedPrices);
      
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

      // Get last lookback days of prices + MACD indicators
      const lastDays = normalizedPrices.slice(-lookback);
      const lastIndex = normalizedPrices.length - 1;
      const macdValue = isNaN(macdData.macd[lastIndex]) ? 0 : (macdData.macd[lastIndex] - macdMin) / macdRange;
      const signalValue = isNaN(macdData.signal[lastIndex]) ? 0 : (macdData.signal[lastIndex] - signalMin) / signalRange;
      const histogramValue = isNaN(macdData.histogram[lastIndex]) ? 0 : (macdData.histogram[lastIndex] - histMin) / histRange;
      
      const inputFeatures = [...lastDays, macdValue, signalValue, histogramValue];
      const inputTensor = tf.tensor2d([inputFeatures]);

      // Predict - output is [predictedPrice, buySignal, sellSignal]
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictedValue = await prediction.data();
      const predictedNormalized = predictedValue[0];
      const buySignalRaw = predictedValue[1];
      const sellSignalRaw = predictedValue[2];
      
      // Get current MACD for decision making
      const currentMacd = macdData.macd[lastIndex];
      const currentSignal = macdData.signal[lastIndex];
      const currentHistogram = macdData.histogram[lastIndex];

      // Denormalize price
      const predictedPrice = predictedNormalized * (max - min) + min;
      
      // Apply sigmoid to buy/sell signals to get probabilities
      const buySignalProb = 1 / (1 + Math.exp(-buySignalRaw));
      const sellSignalProb = 1 / (1 + Math.exp(-sellSignalRaw));
      
      // MACD signals
      const macdBullish = !isNaN(currentHistogram) && currentHistogram > 0;
      const macdBearish = !isNaN(currentHistogram) && currentHistogram < 0;
      const macdCrossUp = !isNaN(currentHistogram) && normalizedPrices.length > 1 && 
                          currentHistogram > 0 && macdData.histogram[lastIndex - 1] <= 0;
      const macdCrossDown = !isNaN(currentHistogram) && normalizedPrices.length > 1 && 
                            currentHistogram < 0 && macdData.histogram[lastIndex - 1] >= 0;
      
      // Combine model prediction with MACD
      let finalBuyProb = buySignalProb;
      let finalSellProb = sellSignalProb;
      
      // Boost buy signal if MACD is bullish
      if (macdBullish || macdCrossUp) {
        finalBuyProb = Math.min(1, buySignalProb + 0.15);
      }
      
      // Boost sell signal if MACD is bearish
      if (macdBearish || macdCrossDown) {
        finalSellProb = Math.min(1, sellSignalProb + 0.15);
      }
      
      // Determine trading decision
      let tradingDecision: StockPrediction['tradingDecision'];
      const macdInfo = !isNaN(currentHistogram) 
        ? `MACD: ${currentHistogram > 0 ? 'Tăng' : 'Giảm'}${macdCrossUp ? ' (Cắt lên)' : macdCrossDown ? ' (Cắt xuống)' : ''}`
        : '';
      
      if (finalBuyProb > 0.6 && finalBuyProb > finalSellProb) {
        tradingDecision = {
          action: 'buy',
          confidence: finalBuyProb,
          reason: `Model + MACD: Nên mua (confidence: ${(finalBuyProb * 100).toFixed(1)}%)${macdInfo ? '. ' + macdInfo : ''}`
        };
      } else if (finalSellProb > 0.6 && finalSellProb > finalBuyProb) {
        tradingDecision = {
          action: 'sell',
          confidence: finalSellProb,
          reason: `Model + MACD: Nên bán (confidence: ${(finalSellProb * 100).toFixed(1)}%)${macdInfo ? '. ' + macdInfo : ''}`
        };
      } else {
        tradingDecision = {
          action: 'hold',
          confidence: Math.max(finalBuyProb, finalSellProb),
          reason: `Model + MACD: Khuyến nghị giữ (buy: ${(finalBuyProb * 100).toFixed(1)}%, sell: ${(finalSellProb * 100).toFixed(1)}%)${macdInfo ? '. ' + macdInfo : ''}`
        };
      }

      // Calculate confidence based on recent volatility
      const recentPrices = prices.slice(-30);
      const volatility = this.calculateVolatility(recentPrices);
      const confidence = Math.max(0, Math.min(1, 1 - volatility / 0.1)); // Normalize volatility

      // Determine trend
      const currentPrice = prices[prices.length - 1];
      const priceChange = predictedPrice - currentPrice;
      const changePercent = Math.abs(priceChange / currentPrice);
      
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      if (changePercent > 0.02) { // 2% threshold
        trend = priceChange > 0 ? 'up' : 'down';
      }

      // Predict multiple days ahead
      let nextDayPrediction: number | undefined;
      let nextWeekPrediction: number | undefined;
      let nextMonthPrediction: number | undefined;

      if (days >= 1) {
        nextDayPrediction = predictedPrice;
      }

      // For longer predictions, use iterative approach
      if (days >= 7) {
        const weekPrediction = await this.predictMultipleDays(
          normalizedPrices, min, max, 7,
          macdData, macdMin, macdMax, macdRange,
          signalMin, signalMax, signalRange,
          histMin, histMax, histRange
        );
        nextWeekPrediction = weekPrediction;
      }

      if (days >= 30) {
        const monthPrediction = await this.predictMultipleDays(
          normalizedPrices, min, max, 30,
          macdData, macdMin, macdMax, macdRange,
          signalMin, signalMax, signalRange,
          histMin, histMax, histRange
        );
        nextMonthPrediction = monthPrediction;
      }

      inputTensor.dispose();
      prediction.dispose();

      // Convert all prices from database units to actual VND units (multiply by 1000)
      // Database stores prices in units of 1000 (e.g., 22.5 = 22,500 VND)
      // We normalize to actual units here so all consumers get consistent values
      const PRICE_MULTIPLIER = 1000;

      return {
        predictedPrice: predictedPrice * PRICE_MULTIPLIER,
        confidence,
        trend,
        nextDayPrediction: nextDayPrediction ? nextDayPrediction * PRICE_MULTIPLIER : undefined,
        nextWeekPrediction: nextWeekPrediction ? nextWeekPrediction * PRICE_MULTIPLIER : undefined,
        nextMonthPrediction: nextMonthPrediction ? nextMonthPrediction * PRICE_MULTIPLIER : undefined,
        tradingDecision
      };
    } catch (error) {
      console.error('Error making prediction:', error);
      throw error;
    }
  }

  /**
   * Predict multiple days ahead iteratively
   * Note: This is simplified - doesn't recalculate MACD for future predictions
   */
  private async predictMultipleDays(
    normalizedPrices: number[],
    min: number,
    max: number,
    days: number,
    macdData?: { macd: number[], signal: number[], histogram: number[] },
    macdMin?: number,
    macdMax?: number,
    macdRange?: number,
    signalMin?: number,
    signalMax?: number,
    signalRange?: number,
    histMin?: number,
    histMax?: number,
    histRange?: number
  ): Promise<number> {
    if (!this.model) {
      throw new Error('Model not available');
    }

    const lookback = this.currentTrainingConfig.lookbackDays;
    let currentSequence = [...normalizedPrices.slice(-lookback)];
    let lastPredicted = currentSequence[currentSequence.length - 1];
    const lastIndex = normalizedPrices.length - 1;

    for (let i = 0; i < days; i++) {
      // Get MACD values (use last known values for simplicity)
      const macdValue = macdData && !isNaN(macdData.macd[lastIndex]) && macdMin !== undefined && macdRange !== undefined
        ? (macdData.macd[lastIndex] - macdMin) / macdRange
        : 0;
      const signalValue = macdData && !isNaN(macdData.signal[lastIndex]) && signalMin !== undefined && signalRange !== undefined
        ? (macdData.signal[lastIndex] - signalMin) / signalRange
        : 0;
      const histogramValue = macdData && !isNaN(macdData.histogram[lastIndex]) && histMin !== undefined && histRange !== undefined
        ? (macdData.histogram[lastIndex] - histMin) / histRange
        : 0;

      // Create input with lookback + 3 features (lookback prices + 3 MACD)
      const inputFeatures = [...currentSequence, macdValue, signalValue, histogramValue];
      const inputTensor = tf.tensor2d([inputFeatures]);
      
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictedValue = await prediction.data();
      // Model outputs [predictedPrice, buySignal, sellSignal]
      const predictedNormalized = predictedValue[0];

      // Update sequence: remove first, add prediction
      currentSequence.shift();
      currentSequence.push(predictedNormalized);
      lastPredicted = predictedNormalized;

      inputTensor.dispose();
      prediction.dispose();
    }

    // Denormalize final prediction
    return lastPredicted * (max - min) + min;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const returnValue = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(returnValue);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.isModelReady && !this.isTraining;
  }

  /**
   * Check if model is training
   */
  isModelTraining(): boolean {
    return this.isTraining;
  }

  /**
   * Get training progress
   */
  getTrainingProgress(): TrainingProgress | null {
    return this.trainingProgress;
  }

  /**
   * Dispose the model to free memory
   */
  disposeModel(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelReady = false;
      this.trainingProgress = null;
    }
  }

  /**
   * Get model summary
   */
  getModelSummary(): string {
    if (!this.model) {
      return 'No model loaded';
    }

    let summary = 'Neural Network Model:\n';
    summary += `Status: ${this.isModelReady ? 'Ready' : 'Not Ready'}\n`;
    summary += `Training: ${this.isTraining ? 'Yes' : 'No'}\n`;
    
    if (this.trainingProgress) {
      summary += `Last Epoch: ${this.trainingProgress.epoch}\n`;
      summary += `Loss: ${this.trainingProgress.loss.toFixed(6)}\n`;
      if (this.trainingProgress.accuracy) {
        summary += `Accuracy: ${(this.trainingProgress.accuracy * 100).toFixed(2)}%\n`;
      }
    }

    return summary;
  }

  /**
   * Save model weights to API (database)
   */
  saveWeights(symbol: string): Observable<any> {
    if (!this.model || !this.isModelReady) {
      return throwError(() => new Error('Model is not trained yet'));
    }

    return new Observable(observer => {
      // Use async IIFE to handle async operations
      (async () => {
        try {
          // Get weights from the model
          const weights: any[] = [];
          for (const layer of this.model!.layers) {
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

          const inputSize = this.currentTrainingConfig.lookbackDays + 3;

          // Save to API (database)
          this.http.post<any>(`/api/stocks-v2/neural-network/${symbol.toUpperCase()}`, {
            weights,
            trainingEpochs: this.lastTrainingEpochs,
            loss: this.lastTrainingLoss,
            accuracy: this.lastTrainingAccuracy,
            modelConfig: {
              inputSize: inputSize,
              layers: [
                { units: 128, activation: 'relu' },
                { units: 64, activation: 'relu' },
                { units: 32, activation: 'relu' },
                { units: 3, activation: 'linear' }
              ]
            },
            // Save training config
            lookbackDays: this.currentTrainingConfig.lookbackDays,
            forecastDays: this.currentTrainingConfig.forecastDays,
            batchSize: this.currentTrainingConfig.batchSize,
            validationSplit: this.currentTrainingConfig.validationSplit,
          }).pipe(
            catchError(error => {
              console.error('Error saving weights:', error);
              return throwError(() => error);
            })
          ).subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (error) => {
              observer.error(error);
            }
          });
        } catch (error) {
          observer.error(error);
        }
      })();
    });
  }

  /**
   * Load model weights from API (database)
   */
  async loadWeights(symbol: string): Promise<boolean> {
    try {
      const response: any = await this.http.get<any>(`/api/stocks-v2/neural-network/${symbol.toUpperCase()}`).toPromise();
      
      if (!response.success || !response.data) {
        console.log('No saved weights found for', symbol);
        return false;
      }

      const weightsData = response.data.weights;
      if (!weightsData || !Array.isArray(weightsData)) {
        console.log('Invalid weights data format');
        return false;
      }

      // Load training config from saved model
      const lookbackDays = response.data.lookbackDays || response.lookbackDays || 60;
      const forecastDays = response.data.forecastDays || response.forecastDays || 1;
      const batchSize = response.data.batchSize || response.batchSize || 32;
      const validationSplit = response.data.validationSplit || response.validationSplit || 0.2;

      // Update current training config
      this.currentTrainingConfig = {
        ...this.currentTrainingConfig,
        lookbackDays,
        forecastDays,
        batchSize,
        validationSplit
      };

      const inputSize = lookbackDays + 3; // lookback prices + 3 MACD features

      // Create model if not exists
      if (!this.model) {
        this.model = this.createModel(inputSize);
      }

      // Load weights into model
      const weightTensors: tf.Tensor[][] = [];
      for (const layerData of weightsData) {
        const layerWeights: tf.Tensor[] = [];
        for (const weightData of layerData.weights) {
          const tensor = tf.tensor(weightData.data, weightData.shape);
          layerWeights.push(tensor);
        }
        weightTensors.push(layerWeights);
      }

      // Set weights for each layer
      for (let i = 0; i < weightTensors.length && i < this.model.layers.length; i++) {
        this.model.layers[i].setWeights(weightTensors[i]);
      }

      // Clean up temporary tensors
      weightTensors.forEach(layerWeights => {
        layerWeights.forEach(tensor => tensor.dispose());
      });

      this.isModelReady = true;
      this.lastTrainingEpochs = response.trainingEpochs || response.data.trainingEpochs || 0;
      this.lastTrainingLoss = response.loss || response.data.loss || null;
      this.lastTrainingAccuracy = response.accuracy || response.data.accuracy || null;
      
      console.log('✅ Neural network weights loaded successfully');
      console.log(`   Training config: lookback=${lookbackDays}, forecast=${forecastDays}, batch=${batchSize}`);
      return true;
    } catch (error) {
      console.error('Error loading weights:', error);
      return false;
    }
  }
}
