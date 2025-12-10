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
  const { neon } = await import('@neondatabase/serverless');
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
    return { success: true, time: result[0]?.current_time };
  } catch (error) {
    console.error('[db] Connection failed:', error);
    return { success: false, error: error.message };
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
 */
export async function getAllStocks(options = {}) {
  const {
    limit = 100,
    offset = 0,
    keyword = ''
  } = options;

  try {
    const sql = await getSql();

    let result;
    let totalResult;

    if (keyword && keyword.trim()) {
      const searchPattern = `%${keyword.trim().toUpperCase()}%`;

      // Get total count for pagination
      totalResult = await sql`
        SELECT COUNT(*) as total
        FROM stocks
        WHERE
          UPPER(symbol) LIKE ${searchPattern}
          OR UPPER(COALESCE(basic_info->>'companyName', '')) LIKE ${searchPattern}
          OR UPPER(COALESCE(basic_info->>'shortName', '')) LIKE ${searchPattern}
      `;

      // Get paginated results with keyword search
      result = await sql`
        SELECT
          symbol,
          basic_info,
          full_data,
          updated_at
        FROM stocks
        WHERE
          UPPER(symbol) LIKE ${searchPattern}
          OR UPPER(COALESCE(basic_info->>'companyName', '')) LIKE ${searchPattern}
          OR UPPER(COALESCE(basic_info->>'shortName', '')) LIKE ${searchPattern}
        ORDER BY symbol ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      // Get total count for pagination
      totalResult = await sql`
        SELECT COUNT(*) as total FROM stocks
      `;

      // Get all stocks without keyword filter
      result = await sql`
        SELECT
          symbol,
          basic_info,
          full_data,
          updated_at
        FROM stocks
        ORDER BY symbol ASC
        LIMIT ${limit} OFFSET ${offset}
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
    return { success: false, error: error.message, stocks: [], pagination: null };
  }
}

/**
 * Get stock by symbol
 */
export async function getStockBySymbol(symbol) {
  try {
    const sql = await getSql();
    const result = await sql`
      SELECT
        symbol,
        basic_info,
        price_data,
        full_data,
        updated_at
      FROM stocks
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (result.length === 0) {
      return { success: false, error: 'Stock not found' };
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('[db] Error getting stock:', error);
    return { success: false, error: error.message };
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
      VALUES (
        ${symbolUpper},
        ${JSON.stringify(basicInfo || {})},
        ${JSON.stringify(priceData || {})},
        ${JSON.stringify(fullData || {})},
        NOW()
      )
      ON CONFLICT (symbol)
      DO UPDATE SET
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
    return { success: false, error: error.message };
  }
}

/**
 * Delete stock by symbol
 */
export async function deleteStock(symbol) {
  try {
    const sql = await getSql();
    const result = await sql`
      DELETE FROM stocks
      WHERE symbol = ${symbol.toUpperCase()}
      RETURNING symbol
    `;

    if (result.length === 0) {
      return { success: false, error: 'Stock not found' };
    }

    return { success: true, symbol: result[0]?.symbol };
  } catch (error) {
    console.error('[db] Error deleting stock:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get list of all stock symbols
 */
export async function getStockSymbols() {
  try {
    const sql = await getSql();
    const result = await sql`
      SELECT symbol FROM stocks ORDER BY symbol ASC
    `;
    return {
      success: true,
      symbols: result.map(row => row.symbol)
    };
  } catch (error) {
    console.error('[db] Error getting stock symbols:', error);
    return { success: false, error: error.message, symbols: [] };
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
      SELECT
        symbol,
        simulation_result,
        trading_config,
        date_range,
        simulations,
        updated_at
      FROM stock_models
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (result.length === 0) {
      return { success: false, error: 'Stock model not found' };
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('[db] Error getting stock model:', error);
    return { success: false, error: error.message };
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
        SELECT simulations FROM stock_models WHERE symbol = ${symbolUpper}
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
      VALUES (
        ${symbolUpper},
        ${JSON.stringify(simulationResult || {})},
        ${JSON.stringify(tradingConfig || {})},
        ${JSON.stringify(dateRange || {})},
        ${JSON.stringify(simulations)},
        NOW()
      )
      ON CONFLICT (symbol)
      DO UPDATE SET
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
    return { success: false, error: error.message };
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
        VALUES (
          ${symbolUpper},
          ${price.date},
          ${price.open},
          ${price.high},
          ${price.low},
          ${price.close},
          ${price.volume || 0}
        )
        ON CONFLICT (symbol, date) DO NOTHING
      `;
    }

    return { success: true, count: prices.length };
  } catch (error) {
    console.error('[db] Error saving price history:', error);
    return { success: false, error: error.message };
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

    return { success: true, prices: result };
  } catch (error) {
    console.error('[db] Error getting price history:', error);
    return { success: false, error: error.message, prices: [] };
  }
}
