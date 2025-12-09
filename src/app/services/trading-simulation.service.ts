import { Injectable } from '@angular/core';
import { StockPrediction } from './neural-network.service';

export interface TradingConfig {
  initialCapital: number; // Vốn ban đầu (đồng)
  stopLossPercent: number; // % cắt lỗ (ví dụ: 5 = 5%)
  takeProfitPercent: number; // % chốt lời (ví dụ: 10 = 10%)
  minConfidence: number; // Độ tin cậy tối thiểu để mua (0-1)
  maxPositions: number; // Số lượng cổ phiếu tối đa có thể mua cùng lúc
  tPlusDays: number; // Số ngày T+ (mặc định T+2, nghĩa là sau 2 ngày mới được bán)
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

@Injectable({
  providedIn: 'root'
})
export class TradingSimulationService {

  /**
   * Generate buy/sell signals based on neural network predictions
   */
  generateSignals(
    prices: number[],
    timestamps: number[],
    predictions: StockPrediction[],
    config: TradingConfig
  ): TradeSignal[] {
    const signals: TradeSignal[] = [];
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    // We need predictions for each price point
    // For simplicity, we'll use the prediction for the next day
    for (let i = 0; i < prices.length - 1; i++) {
      const currentPrice = prices[i];
      const timestamp = timestamps[i];

      // Get prediction (use the most recent one or interpolate)
      const prediction = predictions[Math.min(i, predictions.length - 1)];

      if (!prediction) {
        // If no prediction, create a hold signal
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

      // Calculate expected return
      const expectedReturn = (predictedPrice - currentPrice) / currentPrice;
      const expectedReturnPercent = expectedReturn * 100;

      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let reason = '';

      // Use model's trading decision if available
      if (prediction.tradingDecision) {
        action = prediction.tradingDecision.action;
        reason = prediction.tradingDecision.reason;
      } else {
        // Fallback to old logic if model doesn't provide decision
        // Buy signal conditions - more aggressive for continuous trading
        if (
          confidence >= config.minConfidence &&
          trend === 'up' &&
          expectedReturnPercent > 0.5 // Lower threshold to get more buy signals
        ) {
          action = 'buy';
          reason = `Dự đoán tăng ${expectedReturnPercent.toFixed(2)}%, độ tin cậy ${(confidence * 100).toFixed(1)}%`;
        }
        // Sell signal conditions - sell when trend turns down or profit target reached
        else if (
          trend === 'down' || 
          expectedReturnPercent < -0.5 || 
          (i > 0 && prices[i] < prices[i - 1] * 0.98)
        ) {
          action = 'sell';
          reason = trend === 'down' 
            ? `Dự đoán giảm ${Math.abs(expectedReturnPercent).toFixed(2)}%, nên bán`
            : `Giá giảm, nên bán để bảo toàn vốn`;
        }
        else {
          action = 'hold';
          reason = `Giữ - Dự đoán ${expectedReturnPercent >= 0 ? 'tăng' : 'giảm'} ${Math.abs(expectedReturnPercent).toFixed(2)}%`;
        }
      }

      if (action === 'buy') buyCount++;
      else if (action === 'sell') sellCount++;
      else holdCount++;

      signals.push({
        date: timestamp,
        price: currentPrice,
        action,
        confidence,
        predictedPrice,
        reason
      });
    }

    console.log(`[TradingSimulation] Generated signals: ${signals.length} total, ${buyCount} buy, ${sellCount} sell, ${holdCount} hold`);
    console.log(`[TradingSimulation] Config: minConfidence=${config.minConfidence}, maxPositions=${config.maxPositions}, initialCapital=${config.initialCapital}`);

    return signals;
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
