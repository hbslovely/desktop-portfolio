/**
 * Database Utility for Vercel Postgres
 * Connects to viet-stock-pool database
 *
 * Uses @neondatabase/serverless for serverless-friendly connections
 */

/**
 * Get SQL function (lazy initialization)
 */
async function getSql() {
  const {neon} = await import('@neondatabase/serverless');
  const connectionString = process.env.VIET_STOCK_POOL_POSTGRES_URL
    || process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error('No database connection string configured');
  }

  return neon(connectionString);
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const sql = await getSql();
    const result = await sql`SELECT NOW() as current_time`;
    return {success: true, time: result[0]?.current_time};
  } catch (error) {
    console.error('[db] Connection failed:', error);
    return {success: false, error: error.message};
  }
}

// ============================================
// STOCKS TABLE OPERATIONS
// ============================================

/**
 * Get all stocks (with optional pagination and search)
 * @param {Object} options - Search options
 * @param {number} options.limit - Number of records to return (default: 100)
 * @param {number} options.offset - Number of records to skip (default: 0)
 * @param {string} options.keyword - Search keyword for symbol or company name
 * @param {string} options.symbolType - 'all' | 'stocks' - Filter by symbol type (stocks = 3-char symbols only)
 */
export async function getAllStocks(options = {}) {
  const {
    limit = 100,
    offset = 0,
    keyword = '',
    symbolType = 'all'
  } = options;

  try {
    const sql = await getSql();

    let result;
    let totalResult;

    // Build conditions based on filters
    const isStocksOnly = symbolType === 'stocks';
    const hasKeyword = keyword && keyword.trim();
    const searchPattern = hasKeyword ? `%${keyword.trim().toUpperCase()}%` : '';

    if (hasKeyword && isStocksOnly) {
      // Both keyword and stocks-only filter
      totalResult = await sql`
        SELECT COUNT(*) as total
        FROM stocks
        WHERE LENGTH(symbol) = 3
          AND (UPPER(symbol) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'companyName', '')) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'shortName', '')) LIKE ${searchPattern})
      `;

      result = await sql`
        SELECT symbol,
               basic_info,
               full_data,
               updated_at
        FROM stocks
        WHERE LENGTH(symbol) = 3
          AND (UPPER(symbol) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'companyName', '')) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'shortName', '')) LIKE ${searchPattern})
        ORDER BY symbol ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (hasKeyword) {
      // Keyword only
      totalResult = await sql`
        SELECT COUNT(*) as total
        FROM stocks
        WHERE UPPER(symbol) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'companyName', '')) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'shortName', '')) LIKE ${searchPattern}
      `;

      result = await sql`
        SELECT symbol,
               basic_info,
               full_data,
               updated_at
        FROM stocks
        WHERE UPPER(symbol) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'companyName', '')) LIKE ${searchPattern}
           OR UPPER(COALESCE(basic_info ->>'shortName', '')) LIKE ${searchPattern}
        ORDER BY symbol ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (isStocksOnly) {
      // Stocks-only filter (no keyword)
      totalResult = await sql`
        SELECT COUNT(*) as total
        FROM stocks
        WHERE LENGTH(symbol) = 3
      `;

      result = await sql`
        SELECT symbol,
               basic_info,
               full_data,
               updated_at
        FROM stocks
        WHERE LENGTH(symbol) = 3
        ORDER BY symbol ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      // No filters
      totalResult = await sql`
        SELECT COUNT(*) as total
        FROM stocks
      `;

      result = await sql`
        SELECT symbol,
               basic_info,
               full_data,
               updated_at
        FROM stocks
        ORDER BY symbol ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    const total = parseInt(totalResult[0]?.total || 0, 10);

    return {
      success: true,
      stocks: result,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + result.length < total
      }
    };
  } catch (error) {
    console.error('[db] Error getting all stocks:', error);
    return {success: false, error: error.message, stocks: [], pagination: null};
  }
}

/**
 * Get stock by symbol
 */
export async function getStockBySymbol(symbol) {
  try {
    const sql = await getSql();
    const result = await sql`
      SELECT symbol,
             basic_info,
             price_data,
             full_data,
             updated_at
      FROM stocks
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (result.length === 0) {
      return {success: false, error: 'Stock not found'};
    }

    return {success: true, data: result[0]};
  } catch (error) {
    console.error('[db] Error getting stock:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Save or update stock data
 */
export async function saveStock(symbol, basicInfo, priceData, fullData) {
  try {
    const sql = await getSql();
    const symbolUpper = symbol.toUpperCase();

    const result = await sql`
      INSERT INTO stocks (symbol, basic_info, price_data, full_data, updated_at)
      VALUES (${symbolUpper},
              ${JSON.stringify(basicInfo || {})},
              ${JSON.stringify(priceData || {})},
              ${JSON.stringify(fullData || {})},
              NOW()) ON CONFLICT (symbol)
      DO
      UPDATE SET
        basic_info = EXCLUDED.basic_info,
        price_data = EXCLUDED.price_data,
        full_data = EXCLUDED.full_data,
        updated_at = NOW()
        RETURNING symbol, updated_at
    `;

    return {
      success: true,
      symbol: result[0]?.symbol,
      updatedAt: result[0]?.updated_at
    };
  } catch (error) {
    console.error('[db] Error saving stock:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Delete stock by symbol
 */
export async function deleteStock(symbol) {
  try {
    const sql = await getSql();
    const result = await sql`
      DELETE
      FROM stocks
      WHERE symbol = ${symbol.toUpperCase()} RETURNING symbol
    `;

    if (result.length === 0) {
      return {success: false, error: 'Stock not found'};
    }

    return {success: true, symbol: result[0]?.symbol};
  } catch (error) {
    console.error('[db] Error deleting stock:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Get list of all stock symbols
 */
export async function getStockSymbols() {
  try {
    const sql = await getSql();
    const result = await sql`
      SELECT symbol
      FROM stocks
      ORDER BY symbol ASC
    `;
    return {
      success: true,
      symbols: result.map(row => row.symbol)
    };
  } catch (error) {
    console.error('[db] Error getting stock symbols:', error);
    return {success: false, error: error.message, symbols: []};
  }
}

// ============================================
// STOCK MODEL TABLE OPERATIONS
// ============================================

/**
 * Get stock model by symbol
 */
export async function getStockModel(symbol) {
  try {
    const sql = await getSql();
    const result = await sql`
      SELECT symbol,
             simulation_result,
             trading_config,
             date_range,
             simulations,
             updated_at
      FROM stock_models
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (result.length === 0) {
      return {success: false, error: 'Stock model not found'};
    }

    return {success: true, data: result[0]};
  } catch (error) {
    console.error('[db] Error getting stock model:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Save or update stock model data
 */
export async function saveStockModel(symbol, simulationResult, tradingConfig, dateRange) {
  try {
    const sql = await getSql();
    const symbolUpper = symbol.toUpperCase();

    // First, get existing simulations if any
    let existingSimulations = [];
    try {
      const existing = await sql`
        SELECT simulations
        FROM stock_models
        WHERE symbol = ${symbolUpper}
      `;
      if (existing.length > 0 && existing[0]?.simulations) {
        existingSimulations = existing[0].simulations;
      }
    } catch (e) {
      // Table might not exist yet
    }

    // Add current simulation to history (keep last 10)
    const newSimulation = {
      ...simulationResult,
      createdAt: new Date().toISOString(),
    };
    const simulations = [newSimulation, ...existingSimulations.slice(0, 9)];

    const result = await sql`
      INSERT INTO stock_models (symbol, simulation_result, trading_config, date_range, simulations, updated_at)
      VALUES (${symbolUpper},
              ${JSON.stringify(simulationResult || {})},
              ${JSON.stringify(tradingConfig || {})},
              ${JSON.stringify(dateRange || {})},
              ${JSON.stringify(simulations)},
              NOW()) ON CONFLICT (symbol)
      DO
      UPDATE SET
        simulation_result = EXCLUDED.simulation_result,
        trading_config = EXCLUDED.trading_config,
        date_range = EXCLUDED.date_range,
        simulations = EXCLUDED.simulations,
        updated_at = NOW()
        RETURNING symbol, updated_at
    `;

    return {
      success: true,
      symbol: result[0]?.symbol,
      updatedAt: result[0]?.updated_at
    };
  } catch (error) {
    console.error('[db] Error saving stock model:', error);
    return {success: false, error: error.message};
  }
}

// ============================================
// PRICE HISTORY TABLE OPERATIONS
// ============================================

/**
 * Save price history for a stock
 */
export async function savePriceHistory(symbol, prices) {
  try {
    const sql = await getSql();
    const symbolUpper = symbol.toUpperCase();

    for (const price of prices) {
      await sql`
        INSERT INTO price_history (symbol, date, open, high, low, close, volume)
        VALUES (${symbolUpper},
                ${price.date},
                ${price.open},
                ${price.high},
                ${price.low},
                ${price.close},
                ${price.volume || 0}) ON CONFLICT (symbol, date) DO NOTHING
      `;
    }

    return {success: true, count: prices.length};
  } catch (error) {
    console.error('[db] Error saving price history:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Get price history for a stock
 */
export async function getPriceHistory(symbol, startDate, endDate) {
  try {
    const sql = await getSql();
    const result = await sql`
      SELECT date, open, high, low, close, volume
      FROM price_history
      WHERE symbol = ${symbol.toUpperCase()}
        AND date >= ${startDate}
        AND date <= ${endDate}
      ORDER BY date ASC
    `;

    return {success: true, prices: result};
  } catch (error) {
    console.error('[db] Error getting price history:', error);
    return {success: false, error: error.message, prices: []};
  }
}


/**
 * Database Helper Functions for Neon PostgreSQL
 * Handles stock_models table operations
 */

// Get connection string from environment
function getConnectionString() {
  return process.env.VIET_STOCK_POOL_POSTGRES_URL
    || process.env.POSTGRES_URL
    || process.env.DATABASE_URL;
}

/**
 * Save only neural network weights
 * @param {string} symbol - Stock symbol
 * @param {object} weightsData - Neural network weights and training info
 * @returns {Promise<{success: boolean, updatedAt?: string, error?: string}>}
 */
export async function saveNeuralNetworkWeights(symbol, weightsData) {
  try {
    const sql = await getSql();
    const now = new Date().toISOString();

    const neuralNetworkWeights = JSON.stringify(weightsData.weights);
    const modelConfig = weightsData.modelConfig
      ? JSON.stringify(weightsData.modelConfig)
      : null;

    // Upsert only neural network fields
    await sql`
      INSERT INTO stock_models (symbol,
                                neural_network_weights,
                                training_epochs,
                                training_loss,
                                training_accuracy,
                                model_config,
                                lookback_days,
                                forecast_days,
                                batch_size,
                                validation_split,
                                trained_at,
                                created_at,
                                updated_at)
      VALUES (${symbol.toUpperCase()},
              ${neuralNetworkWeights},
              ${weightsData.trainingEpochs || 50},
              ${weightsData.loss || null},
              ${weightsData.accuracy || null},
              ${modelConfig},
              ${weightsData.lookbackDays || 60},
              ${weightsData.forecastDays || 1},
              ${weightsData.batchSize || 32},
              ${weightsData.validationSplit || 0.2},
              ${now},
              ${now},
              ${now}) ON CONFLICT (symbol) DO
      UPDATE SET
        neural_network_weights = EXCLUDED.neural_network_weights,
        training_epochs = EXCLUDED.training_epochs,
        training_loss = EXCLUDED.training_loss,
        training_accuracy = EXCLUDED.training_accuracy,
        model_config = COALESCE (EXCLUDED.model_config, stock_models.model_config),
        lookback_days = EXCLUDED.lookback_days,
        forecast_days = EXCLUDED.forecast_days,
        batch_size = EXCLUDED.batch_size,
        validation_split = EXCLUDED.validation_split,
        trained_at = ${now},
        updated_at = ${now}
    `;

    return {success: true, updatedAt: now};
  } catch (error) {
    console.error('[db.js] saveNeuralNetworkWeights error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Get neural network weights for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function getNeuralNetworkWeights(symbol) {
  try {
    const sql = await getSql();
    const rows = await sql`
      SELECT neural_network_weights,
             training_epochs,
             training_loss,
             training_accuracy,
             model_config,
             lookback_days,
             forecast_days,
             batch_size,
             validation_split,
             trained_at,
             updated_at
      FROM stock_models
      WHERE symbol = ${symbol.toUpperCase()}
        AND neural_network_weights IS NOT NULL
    `;

    if (rows.length === 0) {
      return {success: false, error: 'Neural network weights not found'};
    }

    const row = rows[0];
    return {
      success: true,
      data: {
        weights: typeof row.neural_network_weights === 'string'
          ? JSON.parse(row.neural_network_weights)
          : row.neural_network_weights,
        trainingEpochs: row.training_epochs,
        loss: row.training_loss,
        accuracy: row.training_accuracy,
        modelConfig: typeof row.model_config === 'string'
          ? JSON.parse(row.model_config)
          : row.model_config,
        lookbackDays: row.lookback_days,
        forecastDays: row.forecast_days,
        batchSize: row.batch_size,
        validationSplit: row.validation_split,
        trainedAt: row.trained_at,
        updatedAt: row.updated_at
      }
    };
  } catch (error) {
    console.error('[db.js] getNeuralNetworkWeights error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Save simulation result and trading config
 * @param {string} symbol - Stock symbol
 * @param {object} simulationResult - Backtest results
 * @param {object} tradingConfig - Trading configuration
 * @param {object} dateRange - Date range for backtest
 * @returns {Promise<{success: boolean, updatedAt?: string, error?: string}>}
 */
export async function saveSimulationResult(symbol, simulationResult, tradingConfig, dateRange) {
  try {
    const sql = await getSql();
    const now = new Date().toISOString();

    // Trim simulation data to reduce storage
    const trimmedResult = {
      ...simulationResult,
      signalsCount: simulationResult?.signals?.length || 0,
      signals: simulationResult?.signals?.slice(0, 100) || [],
      equityCurveCount: simulationResult?.equityCurve?.length || 0,
      equityCurve: simulationResult?.equityCurve?.slice(-100) || [],
    };

    await sql`
      INSERT INTO stock_models (symbol,
                                simulation_result,
                                initial_capital,
                                stop_loss_percent,
                                take_profit_percent,
                                max_positions,
                                t_plus_days,
                                date_range_start,
                                date_range_end,
                                created_at,
                                updated_at)
      VALUES (${symbol.toUpperCase()},
              ${JSON.stringify(trimmedResult)},
              ${tradingConfig?.initialCapital || 100000000},
              ${tradingConfig?.stopLossPercent || 5},
              ${tradingConfig?.takeProfitPercent || 10},
              ${tradingConfig?.maxPositions || 3},
              ${tradingConfig?.tPlusDays || 2},
              ${dateRange?.startDate || null},
              ${dateRange?.endDate || null},
              ${now},
              ${now}) ON CONFLICT (symbol) DO
      UPDATE SET
        simulation_result = EXCLUDED.simulation_result,
        initial_capital = EXCLUDED.initial_capital,
        stop_loss_percent = EXCLUDED.stop_loss_percent,
        take_profit_percent = EXCLUDED.take_profit_percent,
        max_positions = EXCLUDED.max_positions,
        t_plus_days = EXCLUDED.t_plus_days,
        date_range_start = EXCLUDED.date_range_start,
        date_range_end = EXCLUDED.date_range_end,
        updated_at = ${now}
    `;

    return {success: true, updatedAt: now};
  } catch (error) {
    console.error('[db.js] saveSimulationResult error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Check if a model exists for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{exists: boolean, hasWeights: boolean, hasSimulation: boolean}>}
 */
export async function checkModelExists(symbol) {
  try {
    const sql = await getSql();
    const rows = await sql`
      SELECT CASE WHEN neural_network_weights IS NOT NULL THEN true ELSE false END as has_weights,
             CASE WHEN simulation_result IS NOT NULL THEN true ELSE false END      as has_simulation
      FROM stock_models
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (rows.length === 0) {
      return {exists: false, hasWeights: false, hasSimulation: false};
    }

    return {
      exists: true,
      hasWeights: rows[0].has_weights,
      hasSimulation: rows[0].has_simulation
    };
  } catch (error) {
    console.error('[db.js] checkModelExists error:', error);
    return {exists: false, hasWeights: false, hasSimulation: false};
  }
}

/**
 * Delete stock model
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteStockModel(symbol) {
  try {
    const sql = await getSql();
    await sql`
      DELETE
      FROM stock_models
      WHERE symbol = ${symbol.toUpperCase()}
    `;
    return {success: true};
  } catch (error) {
    console.error('[db.js] deleteStockModel error:', error);
    return {success: false, error: error.message};
  }
}

export default {
  getStockModel,
  saveStockModel,
  saveNeuralNetworkWeights,
  getNeuralNetworkWeights,
  saveSimulationResult,
  checkModelExists,
  deleteStockModel
};

