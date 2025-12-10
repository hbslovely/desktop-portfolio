/**
 * Database Helper Functions for Neon PostgreSQL
 * Handles stock_models table operations
 */

import { neon } from '@neondatabase/serverless';

// Get connection string from environment
function getConnectionString() {
  return process.env.VIET_STOCK_POOL_POSTGRES_URL 
    || process.env.POSTGRES_URL
    || process.env.DATABASE_URL;
}

/**
 * Get SQL client
 */
function getSql() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Database connection string not found');
  }
  return neon(connectionString);
}

/**
 * Get stock model data by symbol
 * @param {string} symbol - Stock symbol (e.g., VNM, FPT)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function getStockModel(symbol) {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM stock_models 
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (rows.length === 0) {
      return { success: false, error: 'Stock model not found' };
    }

    return { success: true, data: rows[0] };
  } catch (error) {
    console.error('[db.js] getStockModel error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save or update stock model data
 * @param {string} symbol - Stock symbol
 * @param {object} data - Model data including neural network weights, trading config, etc.
 * @returns {Promise<{success: boolean, updatedAt?: string, error?: string}>}
 */
export async function saveStockModel(symbol, data) {
  try {
    const sql = getSql();
    const now = new Date().toISOString();

    // Extract and stringify JSON fields
    const neuralNetworkWeights = data.neuralNetworkWeights 
      ? JSON.stringify(data.neuralNetworkWeights) 
      : null;
    const simulationResult = data.simulationResult 
      ? JSON.stringify(data.simulationResult) 
      : null;
    const modelConfig = data.modelConfig 
      ? JSON.stringify(data.modelConfig) 
      : null;

    // Upsert query
    await sql`
      INSERT INTO stock_models (
        symbol,
        neural_network_weights,
        training_epochs,
        training_loss,
        training_accuracy,
        model_config,
        initial_capital,
        stop_loss_percent,
        take_profit_percent,
        max_positions,
        t_plus_days,
        lookback_days,
        forecast_days,
        batch_size,
        validation_split,
        date_range_start,
        date_range_end,
        simulation_result,
        trained_at,
        created_at,
        updated_at
      ) VALUES (
        ${symbol.toUpperCase()},
        ${neuralNetworkWeights},
        ${data.trainingEpochs || 50},
        ${data.trainingLoss || null},
        ${data.trainingAccuracy || null},
        ${modelConfig},
        ${data.initialCapital || 100000000},
        ${data.stopLossPercent || 5},
        ${data.takeProfitPercent || 10},
        ${data.maxPositions || 3},
        ${data.tPlusDays || 2},
        ${data.lookbackDays || 60},
        ${data.forecastDays || 1},
        ${data.batchSize || 32},
        ${data.validationSplit || 0.2},
        ${data.dateRangeStart || null},
        ${data.dateRangeEnd || null},
        ${simulationResult},
        ${data.trainedAt || now},
        ${now},
        ${now}
      )
      ON CONFLICT (symbol) DO UPDATE SET
        neural_network_weights = COALESCE(EXCLUDED.neural_network_weights, stock_models.neural_network_weights),
        training_epochs = COALESCE(EXCLUDED.training_epochs, stock_models.training_epochs),
        training_loss = COALESCE(EXCLUDED.training_loss, stock_models.training_loss),
        training_accuracy = COALESCE(EXCLUDED.training_accuracy, stock_models.training_accuracy),
        model_config = COALESCE(EXCLUDED.model_config, stock_models.model_config),
        initial_capital = COALESCE(EXCLUDED.initial_capital, stock_models.initial_capital),
        stop_loss_percent = COALESCE(EXCLUDED.stop_loss_percent, stock_models.stop_loss_percent),
        take_profit_percent = COALESCE(EXCLUDED.take_profit_percent, stock_models.take_profit_percent),
        max_positions = COALESCE(EXCLUDED.max_positions, stock_models.max_positions),
        t_plus_days = COALESCE(EXCLUDED.t_plus_days, stock_models.t_plus_days),
        lookback_days = COALESCE(EXCLUDED.lookback_days, stock_models.lookback_days),
        forecast_days = COALESCE(EXCLUDED.forecast_days, stock_models.forecast_days),
        batch_size = COALESCE(EXCLUDED.batch_size, stock_models.batch_size),
        validation_split = COALESCE(EXCLUDED.validation_split, stock_models.validation_split),
        date_range_start = COALESCE(EXCLUDED.date_range_start, stock_models.date_range_start),
        date_range_end = COALESCE(EXCLUDED.date_range_end, stock_models.date_range_end),
        simulation_result = COALESCE(EXCLUDED.simulation_result, stock_models.simulation_result),
        trained_at = COALESCE(EXCLUDED.trained_at, stock_models.trained_at),
        updated_at = ${now}
    `;

    return { success: true, updatedAt: now };
  } catch (error) {
    console.error('[db.js] saveStockModel error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save only neural network weights
 * @param {string} symbol - Stock symbol
 * @param {object} weightsData - Neural network weights and training info
 * @returns {Promise<{success: boolean, updatedAt?: string, error?: string}>}
 */
export async function saveNeuralNetworkWeights(symbol, weightsData) {
  try {
    const sql = getSql();
    const now = new Date().toISOString();

    const neuralNetworkWeights = JSON.stringify(weightsData.weights);
    const modelConfig = weightsData.modelConfig 
      ? JSON.stringify(weightsData.modelConfig) 
      : null;

    // Upsert only neural network fields
    await sql`
      INSERT INTO stock_models (
        symbol,
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
        updated_at
      ) VALUES (
        ${symbol.toUpperCase()},
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
        ${now}
      )
      ON CONFLICT (symbol) DO UPDATE SET
        neural_network_weights = EXCLUDED.neural_network_weights,
        training_epochs = EXCLUDED.training_epochs,
        training_loss = EXCLUDED.training_loss,
        training_accuracy = EXCLUDED.training_accuracy,
        model_config = COALESCE(EXCLUDED.model_config, stock_models.model_config),
        lookback_days = EXCLUDED.lookback_days,
        forecast_days = EXCLUDED.forecast_days,
        batch_size = EXCLUDED.batch_size,
        validation_split = EXCLUDED.validation_split,
        trained_at = ${now},
        updated_at = ${now}
    `;

    return { success: true, updatedAt: now };
  } catch (error) {
    console.error('[db.js] saveNeuralNetworkWeights error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get neural network weights for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function getNeuralNetworkWeights(symbol) {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT 
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
        updated_at
      FROM stock_models 
      WHERE symbol = ${symbol.toUpperCase()}
        AND neural_network_weights IS NOT NULL
    `;

    if (rows.length === 0) {
      return { success: false, error: 'Neural network weights not found' };
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
    return { success: false, error: error.message };
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
    const sql = getSql();
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
      INSERT INTO stock_models (
        symbol,
        simulation_result,
        initial_capital,
        stop_loss_percent,
        take_profit_percent,
        max_positions,
        t_plus_days,
        date_range_start,
        date_range_end,
        created_at,
        updated_at
      ) VALUES (
        ${symbol.toUpperCase()},
        ${JSON.stringify(trimmedResult)},
        ${tradingConfig?.initialCapital || 100000000},
        ${tradingConfig?.stopLossPercent || 5},
        ${tradingConfig?.takeProfitPercent || 10},
        ${tradingConfig?.maxPositions || 3},
        ${tradingConfig?.tPlusDays || 2},
        ${dateRange?.startDate || null},
        ${dateRange?.endDate || null},
        ${now},
        ${now}
      )
      ON CONFLICT (symbol) DO UPDATE SET
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

    return { success: true, updatedAt: now };
  } catch (error) {
    console.error('[db.js] saveSimulationResult error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a model exists for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{exists: boolean, hasWeights: boolean, hasSimulation: boolean}>}
 */
export async function checkModelExists(symbol) {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT 
        CASE WHEN neural_network_weights IS NOT NULL THEN true ELSE false END as has_weights,
        CASE WHEN simulation_result IS NOT NULL THEN true ELSE false END as has_simulation
      FROM stock_models 
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (rows.length === 0) {
      return { exists: false, hasWeights: false, hasSimulation: false };
    }

    return { 
      exists: true, 
      hasWeights: rows[0].has_weights,
      hasSimulation: rows[0].has_simulation
    };
  } catch (error) {
    console.error('[db.js] checkModelExists error:', error);
    return { exists: false, hasWeights: false, hasSimulation: false };
  }
}

/**
 * Delete stock model
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteStockModel(symbol) {
  try {
    const sql = getSql();
    await sql`
      DELETE FROM stock_models 
      WHERE symbol = ${symbol.toUpperCase()}
    `;
    return { success: true };
  } catch (error) {
    console.error('[db.js] deleteStockModel error:', error);
    return { success: false, error: error.message };
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
