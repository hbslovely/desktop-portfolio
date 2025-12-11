import { Injectable } from '@angular/core';
import { StockPrediction } from './neural-network.service';

// Available trading strategies
export type TradingStrategy = 
  | 'neural_network'    // Neural Network based (current)
  | 'ma_crossover'      // Moving Average Crossover (SMA)
  | 'ema_crossover'     // Exponential Moving Average Crossover
  | 'rsi'               // Relative Strength Index
  | 'macd'              // MACD (Moving Average Convergence Divergence)
  | 'bollinger_bands';  // Bollinger Bands

export interface StrategyConfig {
  // MA Crossover settings
  maShortPeriod: number;      // Short MA period (default: 10)
  maLongPeriod: number;       // Long MA period (default: 30)
  
  // RSI settings
  rsiPeriod: number;          // RSI period (default: 14)
  rsiOverbought: number;      // Overbought level (default: 70)
  rsiOversold: number;        // Oversold level (default: 30)
  
  // MACD settings
  macdFastPeriod: number;     // Fast EMA period (default: 12)
  macdSlowPeriod: number;     // Slow EMA period (default: 26)
  macdSignalPeriod: number;   // Signal line period (default: 9)
  
  // Bollinger Bands settings
  bbPeriod: number;           // BB period (default: 20)
  bbStdDev: number;           // Standard deviation multiplier (default: 2)
}

export interface TradingConfig {
  initialCapital: number;     // Vốn ban đầu (đồng)
  stopLossPercent: number;    // % cắt lỗ (ví dụ: 5 = 5%)
  takeProfitPercent: number;  // % chốt lời (ví dụ: 10 = 10%)
  minConfidence: number;      // Độ tin cậy tối thiểu để mua (0-1)
  maxPositions: number;       // Số lượng cổ phiếu tối đa có thể mua cùng lúc
  tPlusDays: number;          // Số ngày T+ (mặc định T+2, nghĩa là sau 2 ngày mới được bán)
  
  // Strategy selection
  strategy: TradingStrategy;  // Trading strategy to use
  strategyConfig: StrategyConfig; // Strategy-specific configuration
}

export interface TradeSignal {
  date: number; // Timestamp
  price: number; // Giá tại thời điểm
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  predictedPrice?: number;
  reason: string;
}

export interface Position {
  buyDate: number;
  buyPrice: number;
  quantity: number; // Số lượng cổ phiếu
  stopLoss: number; // Giá cắt lỗ
  takeProfit: number; // Giá chốt lời
  currentPrice: number;
  unrealizedPL: number; // Lãi/lỗ chưa thực hiện
  unrealizedPLPercent: number;
  buyCapital: number; // Số tiền còn lại ở ngày mua
  buyPositions: number; // Số cổ phiếu đang nắm giữ ở ngày mua
}

export interface TradingResult {
  initialCapital: number;
  finalCapital: number;
  totalProfit: number;
  totalProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number; // Mức giảm tối đa
  maxDrawdownPercent: number;
  strategy: TradingStrategy; // Strategy used
  trades: Array<{
    buyDate: number;
    sellDate: number;
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    profit: number;
    profitPercent: number;
    duration: number; // Số ngày giữ
    buyCapital: number; // Số tiền còn lại ở ngày mua
    buyPositions: number; // Số cổ phiếu đang nắm giữ ở ngày mua
    sellCapital: number; // Số tiền còn lại ở ngày bán
    sellPositions: number; // Số cổ phiếu đang nắm giữ ở ngày bán
  }>;
  equityCurve: Array<{
    date: number;
    capital: number;
    positions: number;
  }>;
  signals: TradeSignal[];
}

// Default strategy configuration
export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  maShortPeriod: 10,
  maLongPeriod: 30,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  bbPeriod: 20,
  bbStdDev: 2
};

// Strategy descriptions for UI
export const STRATEGY_DESCRIPTIONS: Record<TradingStrategy, { name: string; description: string }> = {
  neural_network: {
    name: 'Neural Network (LSTM)',
    description: 'Sử dụng mạng neural network LSTM để dự đoán xu hướng giá dựa trên lịch sử giá.'
  },
  ma_crossover: {
    name: 'MA Crossover (SMA)',
    description: 'Mua khi MA ngắn hạn cắt lên MA dài hạn, bán khi cắt xuống. Phù hợp thị trường có xu hướng rõ ràng.'
  },
  ema_crossover: {
    name: 'EMA Crossover',
    description: 'Tương tự MA Crossover nhưng sử dụng EMA (phản ứng nhanh hơn với biến động giá gần đây).'
  },
  rsi: {
    name: 'RSI (Relative Strength Index)',
    description: 'Mua khi RSI < 30 (quá bán), bán khi RSI > 70 (quá mua). Phù hợp thị trường sideway.'
  },
  macd: {
    name: 'MACD',
    description: 'Mua khi MACD cắt lên Signal Line, bán khi cắt xuống. Kết hợp xu hướng và momentum.'
  },
  bollinger_bands: {
    name: 'Bollinger Bands',
    description: 'Mua khi giá chạm band dưới, bán khi chạm band trên. Phù hợp thị trường có volatility ổn định.'
  }
};

@Injectable({
  providedIn: 'root'
})
export class TradingSimulationService {

  /**
   * Generate buy/sell signals based on selected strategy
   */
  generateSignals(
    prices: number[],
    timestamps: number[],
    predictions: StockPrediction[] | null,
    config: TradingConfig
  ): TradeSignal[] {
    const strategy = config.strategy || 'neural_network';
    
    console.log(`[TradingSimulation] Using strategy: ${strategy}`);
    
    switch (strategy) {
      case 'ma_crossover':
        return this.generateMACrossoverSignals(prices, timestamps, config, false);
      case 'ema_crossover':
        return this.generateMACrossoverSignals(prices, timestamps, config, true);
      case 'rsi':
        return this.generateRSISignals(prices, timestamps, config);
      case 'macd':
        return this.generateMACDSignals(prices, timestamps, config);
      case 'bollinger_bands':
        return this.generateBollingerBandsSignals(prices, timestamps, config);
      case 'neural_network':
      default:
        return this.generateNeuralNetworkSignals(prices, timestamps, predictions || [], config);
    }
  }

  /**
   * Generate signals using Neural Network predictions
   */
  private generateNeuralNetworkSignals(
    prices: number[],
    timestamps: number[],
    predictions: StockPrediction[],
    config: TradingConfig
  ): TradeSignal[] {
    const signals: TradeSignal[] = [];
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    for (let i = 0; i < prices.length - 1; i++) {
      const currentPrice = prices[i];
      const timestamp = timestamps[i];
      const prediction = predictions[Math.min(i, predictions.length - 1)];

      if (!prediction) {
        signals.push({
          date: timestamp,
          price: currentPrice,
          action: 'hold',
          confidence: 0,
          predictedPrice: currentPrice,
          reason: 'Không có dự đoán'
        });
        holdCount++;
        continue;
      }

      const predictedPrice = prediction.predictedPrice;
      const confidence = prediction.confidence;
      const trend = prediction.trend;
      const expectedReturn = (predictedPrice - currentPrice) / currentPrice;
      const expectedReturnPercent = expectedReturn * 100;

      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let reason = '';

      if (prediction.tradingDecision) {
        action = prediction.tradingDecision.action;
        reason = prediction.tradingDecision.reason;
      } else {
        if (confidence >= config.minConfidence && trend === 'up' && expectedReturnPercent > 0.5) {
          action = 'buy';
          reason = `NN: Dự đoán tăng ${expectedReturnPercent.toFixed(2)}%, độ tin cậy ${(confidence * 100).toFixed(1)}%`;
        } else if (trend === 'down' || expectedReturnPercent < -0.5 || (i > 0 && prices[i] < prices[i - 1] * 0.98)) {
          action = 'sell';
          reason = trend === 'down' 
            ? `NN: Dự đoán giảm ${Math.abs(expectedReturnPercent).toFixed(2)}%`
            : `NN: Giá giảm, bán để bảo toàn vốn`;
        } else {
          action = 'hold';
          reason = `NN: Giữ - Dự đoán ${expectedReturnPercent >= 0 ? 'tăng' : 'giảm'} ${Math.abs(expectedReturnPercent).toFixed(2)}%`;
        }
      }

      if (action === 'buy') buyCount++;
      else if (action === 'sell') sellCount++;
      else holdCount++;

      signals.push({ date: timestamp, price: currentPrice, action, confidence, predictedPrice, reason });
    }

    this.logSignalStats('Neural Network', signals.length, buyCount, sellCount, holdCount);
    return signals;
  }

  /**
   * Generate signals using Moving Average Crossover strategy
   * Buy when short MA crosses above long MA, sell when crosses below
   */
  private generateMACrossoverSignals(
    prices: number[],
    timestamps: number[],
    config: TradingConfig,
    useEMA: boolean
  ): TradeSignal[] {
    const signals: TradeSignal[] = [];
    const strategyConfig = config.strategyConfig || DEFAULT_STRATEGY_CONFIG;
    const shortPeriod = strategyConfig.maShortPeriod;
    const longPeriod = strategyConfig.maLongPeriod;
    
    const shortMA = useEMA ? this.calculateEMA(prices, shortPeriod) : this.calculateSMA(prices, shortPeriod);
    const longMA = useEMA ? this.calculateEMA(prices, longPeriod) : this.calculateSMA(prices, longPeriod);
    
    let buyCount = 0, sellCount = 0, holdCount = 0;
    let previousCross = 0; // 1 = short above long, -1 = short below long, 0 = not yet determined
    
    for (let i = 0; i < prices.length - 1; i++) {
      const timestamp = timestamps[i];
      const currentPrice = prices[i];
      
      // Need enough data for long MA
      if (i < longPeriod - 1 || shortMA[i] === null || longMA[i] === null) {
        signals.push({
          date: timestamp,
          price: currentPrice,
          action: 'hold',
          confidence: 0.5,
          reason: `${useEMA ? 'EMA' : 'MA'}: Chưa đủ dữ liệu (cần ${longPeriod} ngày)`
        });
        holdCount++;
        continue;
      }
      
      const currentCross = shortMA[i]! > longMA[i]! ? 1 : -1;
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let reason = '';
      let confidence = 0.6;
      
      // Crossover detection
      if (previousCross !== 0 && currentCross !== previousCross) {
        if (currentCross === 1) {
          // Golden cross: short MA crosses above long MA
          action = 'buy';
          confidence = 0.75;
          reason = `${useEMA ? 'EMA' : 'MA'}: Golden Cross - MA${shortPeriod} (${shortMA[i]!.toFixed(2)}) cắt lên MA${longPeriod} (${longMA[i]!.toFixed(2)})`;
        } else {
          // Death cross: short MA crosses below long MA
          action = 'sell';
          confidence = 0.75;
          reason = `${useEMA ? 'EMA' : 'MA'}: Death Cross - MA${shortPeriod} (${shortMA[i]!.toFixed(2)}) cắt xuống MA${longPeriod} (${longMA[i]!.toFixed(2)})`;
        }
      } else {
        reason = `${useEMA ? 'EMA' : 'MA'}: Giữ - MA${shortPeriod}=${shortMA[i]!.toFixed(2)}, MA${longPeriod}=${longMA[i]!.toFixed(2)}`;
      }
      
      previousCross = currentCross;
      
      if (action === 'buy') buyCount++;
      else if (action === 'sell') sellCount++;
      else holdCount++;
      
      signals.push({ date: timestamp, price: currentPrice, action, confidence, reason });
    }
    
    this.logSignalStats(`${useEMA ? 'EMA' : 'MA'} Crossover`, signals.length, buyCount, sellCount, holdCount);
    return signals;
  }

  /**
   * Generate signals using RSI strategy
   * Buy when RSI < oversold, sell when RSI > overbought
   */
  private generateRSISignals(
    prices: number[],
    timestamps: number[],
    config: TradingConfig
  ): TradeSignal[] {
    const signals: TradeSignal[] = [];
    const strategyConfig = config.strategyConfig || DEFAULT_STRATEGY_CONFIG;
    const period = strategyConfig.rsiPeriod;
    const overbought = strategyConfig.rsiOverbought;
    const oversold = strategyConfig.rsiOversold;
    
    const rsi = this.calculateRSI(prices, period);
    
    let buyCount = 0, sellCount = 0, holdCount = 0;
    
    for (let i = 0; i < prices.length - 1; i++) {
      const timestamp = timestamps[i];
      const currentPrice = prices[i];
      const currentRSI = rsi[i];
      
      if (currentRSI === null) {
        signals.push({
          date: timestamp,
          price: currentPrice,
          action: 'hold',
          confidence: 0.5,
          reason: `RSI: Chưa đủ dữ liệu (cần ${period} ngày)`
        });
        holdCount++;
        continue;
      }
      
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let reason = '';
      let confidence = 0.6;
      
      if (currentRSI <= oversold) {
        action = 'buy';
        confidence = 0.7 + (oversold - currentRSI) / 100;
        reason = `RSI: Quá bán (RSI=${currentRSI.toFixed(1)} < ${oversold}) - Cơ hội mua`;
      } else if (currentRSI >= overbought) {
        action = 'sell';
        confidence = 0.7 + (currentRSI - overbought) / 100;
        reason = `RSI: Quá mua (RSI=${currentRSI.toFixed(1)} > ${overbought}) - Nên bán`;
      } else {
        reason = `RSI: Trung tính (RSI=${currentRSI.toFixed(1)}) - Giữ`;
      }
      
      if (action === 'buy') buyCount++;
      else if (action === 'sell') sellCount++;
      else holdCount++;
      
      signals.push({ date: timestamp, price: currentPrice, action, confidence, reason });
    }
    
    this.logSignalStats('RSI', signals.length, buyCount, sellCount, holdCount);
    return signals;
  }

  /**
   * Generate signals using MACD strategy
   * Buy when MACD crosses above Signal line, sell when crosses below
   */
  private generateMACDSignals(
    prices: number[],
    timestamps: number[],
    config: TradingConfig
  ): TradeSignal[] {
    const signals: TradeSignal[] = [];
    const strategyConfig = config.strategyConfig || DEFAULT_STRATEGY_CONFIG;
    const fastPeriod = strategyConfig.macdFastPeriod;
    const slowPeriod = strategyConfig.macdSlowPeriod;
    const signalPeriod = strategyConfig.macdSignalPeriod;
    
    const { macd, signal: signalLine, histogram } = this.calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod);
    
    let buyCount = 0, sellCount = 0, holdCount = 0;
    let previousHistogram = 0;
    
    for (let i = 0; i < prices.length - 1; i++) {
      const timestamp = timestamps[i];
      const currentPrice = prices[i];
      
      if (macd[i] === null || signalLine[i] === null) {
        signals.push({
          date: timestamp,
          price: currentPrice,
          action: 'hold',
          confidence: 0.5,
          reason: `MACD: Chưa đủ dữ liệu (cần ${slowPeriod + signalPeriod} ngày)`
        });
        holdCount++;
        continue;
      }
      
      const currentHistogram = histogram[i]!;
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let reason = '';
      let confidence = 0.6;
      
      // Crossover detection using histogram
      if (previousHistogram !== 0) {
        if (previousHistogram < 0 && currentHistogram > 0) {
          // MACD crosses above signal line (bullish)
          action = 'buy';
          confidence = 0.75;
          reason = `MACD: Bullish crossover - MACD (${macd[i]!.toFixed(2)}) cắt lên Signal (${signalLine[i]!.toFixed(2)})`;
        } else if (previousHistogram > 0 && currentHistogram < 0) {
          // MACD crosses below signal line (bearish)
          action = 'sell';
          confidence = 0.75;
          reason = `MACD: Bearish crossover - MACD (${macd[i]!.toFixed(2)}) cắt xuống Signal (${signalLine[i]!.toFixed(2)})`;
        } else {
          reason = `MACD: Giữ - MACD=${macd[i]!.toFixed(2)}, Signal=${signalLine[i]!.toFixed(2)}, Histogram=${currentHistogram.toFixed(2)}`;
        }
      } else {
        reason = `MACD: Khởi tạo - MACD=${macd[i]!.toFixed(2)}, Signal=${signalLine[i]!.toFixed(2)}`;
      }
      
      previousHistogram = currentHistogram;
      
      if (action === 'buy') buyCount++;
      else if (action === 'sell') sellCount++;
      else holdCount++;
      
      signals.push({ date: timestamp, price: currentPrice, action, confidence, reason });
    }
    
    this.logSignalStats('MACD', signals.length, buyCount, sellCount, holdCount);
    return signals;
  }

  /**
   * Generate signals using Bollinger Bands strategy
   * Buy when price touches lower band, sell when touches upper band
   */
  private generateBollingerBandsSignals(
    prices: number[],
    timestamps: number[],
    config: TradingConfig
  ): TradeSignal[] {
    const signals: TradeSignal[] = [];
    const strategyConfig = config.strategyConfig || DEFAULT_STRATEGY_CONFIG;
    const period = strategyConfig.bbPeriod;
    const stdDevMultiplier = strategyConfig.bbStdDev;
    
    const { upper, middle, lower } = this.calculateBollingerBands(prices, period, stdDevMultiplier);
    
    let buyCount = 0, sellCount = 0, holdCount = 0;
    
    for (let i = 0; i < prices.length - 1; i++) {
      const timestamp = timestamps[i];
      const currentPrice = prices[i];
      
      if (upper[i] === null || middle[i] === null || lower[i] === null) {
        signals.push({
          date: timestamp,
          price: currentPrice,
          action: 'hold',
          confidence: 0.5,
          reason: `BB: Chưa đủ dữ liệu (cần ${period} ngày)`
        });
        holdCount++;
        continue;
      }
      
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let reason = '';
      let confidence = 0.6;
      
      const bandwidth = upper[i]! - lower[i]!;
      const percentB = (currentPrice - lower[i]!) / bandwidth; // 0 = at lower band, 1 = at upper band
      
      if (currentPrice <= lower[i]!) {
        action = 'buy';
        confidence = 0.7 + (lower[i]! - currentPrice) / currentPrice;
        reason = `BB: Giá (${currentPrice.toFixed(2)}) chạm/dưới band dưới (${lower[i]!.toFixed(2)}) - Quá bán`;
      } else if (currentPrice >= upper[i]!) {
        action = 'sell';
        confidence = 0.7 + (currentPrice - upper[i]!) / currentPrice;
        reason = `BB: Giá (${currentPrice.toFixed(2)}) chạm/trên band trên (${upper[i]!.toFixed(2)}) - Quá mua`;
      } else {
        reason = `BB: Giá trong band - Lower=${lower[i]!.toFixed(2)}, Price=${currentPrice.toFixed(2)}, Upper=${upper[i]!.toFixed(2)} (%B=${(percentB*100).toFixed(1)}%)`;
      }
      
      if (action === 'buy') buyCount++;
      else if (action === 'sell') sellCount++;
      else holdCount++;
      
      signals.push({ date: timestamp, price: currentPrice, action, confidence, reason });
    }
    
    this.logSignalStats('Bollinger Bands', signals.length, buyCount, sellCount, holdCount);
    return signals;
  }

  // ============ Technical Indicators ============

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): (number | null)[] {
    const sma: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): (number | null)[] {
    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ema.push(null);
      } else if (i === period - 1) {
        // First EMA is SMA
        const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
        ema.push(sum / period);
      } else {
        const prevEMA = ema[i - 1]!;
        ema.push((prices[i] - prevEMA) * multiplier + prevEMA);
      }
    }
    return ema;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number): (number | null)[] {
    const rsi: (number | null)[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    // First value is null
    rsi.push(null);
    
    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        rsi.push(null);
      } else if (i === period - 1) {
        const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        if (avgLoss === 0) {
          rsi.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
      } else {
        const prevRSI = rsi[i]!;
        const prevAvgGain = (100 - prevRSI) !== 0 ? (prevRSI / (100 - prevRSI)) : 0;
        const avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
        const avgLoss = ((1 / (prevAvgGain + 0.0001)) * (period - 1) + losses[i]) / period;
        
        if (avgLoss === 0) {
          rsi.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
      }
    }
    
    return rsi;
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(
    prices: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number
  ): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    const macd: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (fastEMA[i] === null || slowEMA[i] === null) {
        macd.push(null);
      } else {
        macd.push(fastEMA[i]! - slowEMA[i]!);
      }
    }
    
    // Calculate signal line (EMA of MACD)
    const macdValues = macd.filter(v => v !== null) as number[];
    const signalEMA = this.calculateEMA(macdValues, signalPeriod);
    
    const signal: (number | null)[] = [];
    const histogram: (number | null)[] = [];
    let signalIndex = 0;
    
    for (let i = 0; i < prices.length; i++) {
      if (macd[i] === null) {
        signal.push(null);
        histogram.push(null);
      } else {
        if (signalIndex < signalEMA.length && signalEMA[signalIndex] !== null) {
          signal.push(signalEMA[signalIndex]);
          histogram.push(macd[i]! - signalEMA[signalIndex]!);
        } else {
          signal.push(null);
          histogram.push(null);
        }
        signalIndex++;
      }
    }
    
    return { macd, signal, histogram };
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(
    prices: number[],
    period: number,
    stdDevMultiplier: number
  ): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
    const middle = this.calculateSMA(prices, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (middle[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = middle[i]!;
        const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        
        upper.push(mean + stdDevMultiplier * stdDev);
        lower.push(mean - stdDevMultiplier * stdDev);
      }
    }
    
    return { upper, middle, lower };
  }

  /**
   * Log signal statistics
   */
  private logSignalStats(strategy: string, total: number, buy: number, sell: number, hold: number) {
    console.log(`[TradingSimulation] ${strategy} - Generated signals: ${total} total, ${buy} buy, ${sell} sell, ${hold} hold`);
  }

  /**
   * Simulate trading based on signals
   */
  simulateTrading(
    prices: number[],
    timestamps: number[],
    signals: TradeSignal[],
    config: TradingConfig
  ): TradingResult {
    let capital = config.initialCapital;
    const positions: Position[] = [];
    const completedTrades: TradingResult['trades'] = [];
    const equityCurve: TradingResult['equityCurve'] = [];
    
    let maxCapital = capital;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    console.log(`[TradingSimulation] Starting simulation with ${prices.length} prices, ${signals.length} signals`);

    for (let i = 0; i < prices.length; i++) {
      const currentPrice = prices[i];
      const timestamp = timestamps[i];
      // Signals array has length = prices.length - 1, so use i or i-1
      const signal = signals[Math.min(i, signals.length - 1)];

      // NOTE: Prices in database are stored in units of 1000, so multiply by 1000
      const actualPrice = currentPrice * 1000;

      if (!signal) {
        // If no signal for this price point, just update positions and continue
        for (let j = 0; j < positions.length; j++) {
          positions[j].currentPrice = actualPrice;
          positions[j].unrealizedPL = (actualPrice - positions[j].buyPrice) * positions[j].quantity;
          positions[j].unrealizedPLPercent = ((actualPrice - positions[j].buyPrice) / positions[j].buyPrice) * 100;
        }
        continue;
      }

      // Update existing positions
      
      for (let j = positions.length - 1; j >= 0; j--) {
        const position = positions[j];
        position.currentPrice = actualPrice;
        position.unrealizedPL = (actualPrice - position.buyPrice) * position.quantity;
        position.unrealizedPLPercent = ((actualPrice - position.buyPrice) / position.buyPrice) * 100;

        // Check T+2 rule: Can only sell after T+2 days (2 trading days)
        const daysSinceBuy = this.calculateTradingDays(position.buyDate, timestamp);
        const canSell = daysSinceBuy >= (config.tPlusDays || 2);

        // Check stop loss (only if T+2 is satisfied)
        if (actualPrice <= position.stopLoss && canSell) {
          // Execute stop loss
          const sellPrice = position.stopLoss;
          const profit = (sellPrice - position.buyPrice) * position.quantity;
          const profitPercent = ((sellPrice - position.buyPrice) / position.buyPrice) * 100;
          const duration = daysSinceBuy;
          
          const sellCapital = capital; // Capital before selling
          const sellPositions = positions.length - 1; // Positions after removing this one

          completedTrades.push({
            buyDate: position.buyDate,
            sellDate: timestamp,
            buyPrice: position.buyPrice,
            sellPrice: sellPrice,
            quantity: position.quantity,
            profit,
            profitPercent,
            duration,
            buyCapital: position.buyCapital,
            buyPositions: position.buyPositions,
            sellCapital: sellCapital,
            sellPositions: sellPositions
          });

          capital += sellPrice * position.quantity;
          positions.splice(j, 1);
          continue;
        }

        // Check take profit (only if T+2 is satisfied)
        if (actualPrice >= position.takeProfit && canSell) {
          // Execute take profit
          const sellPrice = position.takeProfit;
          const profit = (sellPrice - position.buyPrice) * position.quantity;
          const profitPercent = ((sellPrice - position.buyPrice) / position.buyPrice) * 100;
          const duration = daysSinceBuy;
          
          const sellCapital = capital; // Capital before selling
          const sellPositions = positions.length - 1; // Positions after removing this one

          completedTrades.push({
            buyDate: position.buyDate,
            sellDate: timestamp,
            buyPrice: position.buyPrice,
            sellPrice: sellPrice,
            quantity: position.quantity,
            profit,
            profitPercent,
            duration,
            buyCapital: position.buyCapital,
            buyPositions: position.buyPositions,
            sellCapital: sellCapital,
            sellPositions: sellPositions
          });

          capital += sellPrice * position.quantity;
          positions.splice(j, 1);
          continue;
        }

        // Check sell signal (only if T+2 is satisfied for all positions)
        if (signal.action === 'sell' && positions.length > 0) {
          const sellCapital = capital; // Capital before selling
          
          // Sell all positions that satisfy T+2
          for (let k = positions.length - 1; k >= 0; k--) {
            const pos = positions[k];
            const posDaysSinceBuy = this.calculateTradingDays(pos.buyDate, timestamp);
            const posCanSell = posDaysSinceBuy >= (config.tPlusDays || 2);

            if (posCanSell) {
              const profit = (actualPrice - pos.buyPrice) * pos.quantity;
              const profitPercent = ((actualPrice - pos.buyPrice) / pos.buyPrice) * 100;
              const duration = posDaysSinceBuy;
              const sellPositions = positions.length - 1; // Positions after removing this one

              completedTrades.push({
                buyDate: pos.buyDate,
                sellDate: timestamp,
                buyPrice: pos.buyPrice,
                sellPrice: actualPrice,
                quantity: pos.quantity,
                profit,
                profitPercent,
                duration,
                buyCapital: pos.buyCapital,
                buyPositions: pos.buyPositions,
                sellCapital: sellCapital,
                sellPositions: sellPositions
              });

              capital += actualPrice * pos.quantity;
              positions.splice(k, 1);
            }
          }
        }
      }

      // Execute buy signal - allow continuous buying
      // Can buy if: have capital, haven't reached max positions, and have buy signal
      if (signal.action === 'buy' && positions.length < config.maxPositions && capital > 0) {
        // Calculate how many shares we can buy with available capital
        // For continuous trading, use a portion of capital (e.g., 100% if maxPositions = 1, or split if multiple)
        const capitalPerPosition = config.maxPositions > 1 
          ? capital / (config.maxPositions - positions.length) 
          : capital;
        
        // Calculate quantity and round down to nearest 100 (bội số của 100)
        const rawQuantity = Math.floor(capitalPerPosition / actualPrice);
        const quantity = Math.floor(rawQuantity / 100) * 100; // Round down to nearest 100

        if (quantity > 0) {
          const cost = actualPrice * quantity;
          if (cost <= capital) {
            const stopLoss = actualPrice * (1 - config.stopLossPercent / 100);
            const takeProfit = actualPrice * (1 + config.takeProfitPercent / 100);
            
            const buyCapital = capital; // Capital before buying
            const buyPositions = positions.length; // Number of positions before buying

            positions.push({
              buyDate: timestamp,
              buyPrice: actualPrice, // Store actual price (multiplied by 1000)
              quantity,
              stopLoss,
              takeProfit,
              currentPrice: actualPrice,
              unrealizedPL: 0,
              unrealizedPLPercent: 0,
              buyCapital: buyCapital,
              buyPositions: buyPositions
            });

            capital -= cost;
            console.log(`[TradingSimulation] BUY at day ${i}: price=${actualPrice.toFixed(2)}, quantity=${quantity}, cost=${cost.toFixed(2)}, remaining capital=${capital.toFixed(2)}`);
          } else {
            console.log(`[TradingSimulation] BUY signal but insufficient capital: need=${cost.toFixed(2)}, have=${capital.toFixed(2)}`);
          }
        } else {
          console.log(`[TradingSimulation] BUY signal but quantity=0: capitalPerPosition=${capitalPerPosition.toFixed(2)}, price=${actualPrice.toFixed(2)}`);
        }
      } else if (signal.action === 'buy') {
        // Debug why buy signal was not executed
        if (positions.length >= config.maxPositions) {
          console.log(`[TradingSimulation] BUY signal ignored: max positions reached (${positions.length}/${config.maxPositions})`);
        } else if (capital <= 0) {
          console.log(`[TradingSimulation] BUY signal ignored: no capital (${capital.toFixed(2)})`);
        }
      }

      // Calculate current equity (capital + unrealized P/L)
      const unrealizedPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
      const currentEquity = capital + unrealizedPL;

      // Update max drawdown
      if (currentEquity > maxCapital) {
        maxCapital = currentEquity;
      }
      const drawdown = maxCapital - currentEquity;
      const drawdownPercent = (drawdown / maxCapital) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }

      // Record equity curve
      equityCurve.push({
        date: timestamp,
        capital: currentEquity,
        positions: positions.length
      });
    }

    // Close all remaining positions at the end
    const finalPrice = prices[prices.length - 1];
    const finalActualPrice = finalPrice * 1000; // Convert to actual price
    const finalTimestamp = timestamps[timestamps.length - 1];
    const sellCapital = capital; // Capital before closing
    
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const profit = (finalActualPrice - position.buyPrice) * position.quantity;
      const profitPercent = ((finalActualPrice - position.buyPrice) / position.buyPrice) * 100;
      const duration = this.calculateTradingDays(position.buyDate, finalTimestamp);
      const sellPositions = positions.length - i - 1; // Positions remaining after this one

      completedTrades.push({
        buyDate: position.buyDate,
        sellDate: finalTimestamp,
        buyPrice: position.buyPrice,
        sellPrice: finalActualPrice,
        quantity: position.quantity,
        profit,
        profitPercent,
        duration,
        buyCapital: position.buyCapital,
        buyPositions: position.buyPositions,
        sellCapital: sellCapital,
        sellPositions: sellPositions
      });

      capital += finalActualPrice * position.quantity;
    }

    // Calculate statistics
    const totalProfit = capital - config.initialCapital;
    const totalProfitPercent = (totalProfit / config.initialCapital) * 100;
    const winningTrades = completedTrades.filter(t => t.profit > 0).length;
    const losingTrades = completedTrades.filter(t => t.profit <= 0).length;
    const winRate = completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0;

    console.log(`[TradingSimulation] Simulation completed:`);
    console.log(`  - Initial capital: ${config.initialCapital.toFixed(2)}`);
    console.log(`  - Final capital: ${capital.toFixed(2)}`);
    console.log(`  - Total trades: ${completedTrades.length}`);
    console.log(`  - Remaining positions: ${positions.length}`);
    console.log(`  - Total profit: ${totalProfit.toFixed(2)} (${totalProfitPercent.toFixed(2)}%)`);

    return {
      initialCapital: config.initialCapital,
      finalCapital: capital,
      totalProfit,
      totalProfitPercent,
      totalTrades: completedTrades.length,
      winningTrades,
      losingTrades,
      winRate,
      maxDrawdown,
      maxDrawdownPercent,
      strategy: config.strategy || 'neural_network',
      trades: completedTrades,
      equityCurve,
      signals
    };
  }

  /**
   * Generate predictions for all price points
   * Uses sliding window approach with the base prediction pattern
   * Includes trading decision from model
   */
  generatePredictionsForBacktest(
    prices: number[],
    timestamps: number[],
    basePrediction: StockPrediction
  ): StockPrediction[] {
    const predictions: StockPrediction[] = [];
    const lookback = 60; // Same as neural network input size

    for (let i = 0; i < prices.length; i++) {
      const currentPrice = prices[i];
      
      // Calculate recent price trend (last 5 days)
      const recentPrices = prices.slice(Math.max(0, i - 5), i + 1);
      const priceChange = recentPrices.length > 1 
        ? (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]
        : 0;

      // Calculate volatility
      const volatility = this.calculateVolatility(recentPrices);

      // Calculate expected return based on base prediction
      // Use previous price or current price if at start
      const previousPrice = i > 0 ? prices[i - 1] : currentPrice;
      const baseExpectedReturn = (basePrediction.predictedPrice - previousPrice) / previousPrice;
      const trendMultiplier = 1 + (priceChange * 0.3); // Moderate adjustment
      const adjustedExpectedReturn = baseExpectedReturn * trendMultiplier;
      const adjustedPredictedPrice = currentPrice * (1 + adjustedExpectedReturn);
      
      // Adjust confidence based on volatility
      const adjustedConfidence = Math.max(0.3, Math.min(0.95, basePrediction.confidence * (1 - volatility * 2)));
      
      // Determine trend
      const adjustedTrend: 'up' | 'down' | 'neutral' = 
        priceChange > 0.015 ? 'up' : 
        priceChange < -0.015 ? 'down' : 
        basePrediction.trend;

      // Generate trading decision if base prediction has one, otherwise create one
      let tradingDecision: StockPrediction['tradingDecision'];
      
      if (basePrediction.tradingDecision) {
        // Use base decision but adjust confidence
        const adjustedDecisionConfidence = Math.max(0.5, basePrediction.tradingDecision.confidence * (1 - volatility * 0.5));
        
        // Adjust action based on recent trend if confidence is moderate
        let action = basePrediction.tradingDecision.action;
        if (adjustedDecisionConfidence < 0.7) {
          // If confidence is low, be more conservative
          if (action === 'buy' && adjustedTrend === 'down') {
            action = 'hold';
          } else if (action === 'sell' && adjustedTrend === 'up') {
            action = 'hold';
          }
        }
        
        tradingDecision = {
          action,
          confidence: adjustedDecisionConfidence,
          reason: basePrediction.tradingDecision.reason + ` (điều chỉnh theo xu hướng gần đây)`
        };
      } else {
        // Generate trading decision based on expected return and trend
        const expectedReturnPercent = adjustedExpectedReturn * 100;
        
        // More aggressive buy conditions for backtesting
        if (adjustedConfidence >= 0.4 && adjustedTrend === 'up' && expectedReturnPercent > 0.3) {
          tradingDecision = {
            action: 'buy',
            confidence: adjustedConfidence,
            reason: `Dự đoán tăng ${expectedReturnPercent.toFixed(2)}%, xu hướng tăng, độ tin cậy ${(adjustedConfidence * 100).toFixed(1)}%`
          };
        } else if (adjustedTrend === 'down' || expectedReturnPercent < -0.3) {
          tradingDecision = {
            action: 'sell',
            confidence: adjustedConfidence,
            reason: `Dự đoán giảm ${Math.abs(expectedReturnPercent).toFixed(2)}%, nên bán để bảo toàn vốn`
          };
        } else {
          tradingDecision = {
            action: 'hold',
            confidence: adjustedConfidence,
            reason: `Giữ - Dự đoán ${expectedReturnPercent >= 0 ? 'tăng' : 'giảm'} ${Math.abs(expectedReturnPercent).toFixed(2)}%`
          };
        }
      }

      const adjustedPrediction: StockPrediction = {
        predictedPrice: adjustedPredictedPrice,
        confidence: adjustedConfidence,
        trend: adjustedTrend,
        nextDayPrediction: basePrediction.nextDayPrediction,
        nextWeekPrediction: basePrediction.nextWeekPrediction,
        nextMonthPrediction: basePrediction.nextMonthPrediction,
        tradingDecision
      };

      predictions.push(adjustedPrediction);
    }

    return predictions;
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
   * Calculate trading days between two timestamps
   * Timestamps are in seconds, not milliseconds
   */
  private calculateTradingDays(startTimestamp: number, endTimestamp: number): number {
    // Timestamps are in seconds, convert to milliseconds for Date
    const startDate = new Date(startTimestamp * 1000);
    const endDate = new Date(endTimestamp * 1000);
    
    // Calculate difference in days
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
}
