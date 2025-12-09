const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Import API handlers
const listHandler = require('./stocks/list.js').default;
const saveHandler = require('./stocks/save.js').default;
const symbolHandler = require('./stocks/[symbol].js').default;
const helpHandler = require('./help.js').default;
const testMinimalHandler = require('./test-minimal.js').default;
const stocksListHandler = require('./stocks-list.js').default;
// Stocks v2 handlers (local filesystem)
const listV2Handler = require('./stocks-v2/list.js').default;
const saveV2Handler = require('./stocks-v2/save.js').default;
const symbolV2Handler = require('./stocks-v2/[symbol].js').default;
const fetchAndSaveV2Handler = require('./stocks-v2/fetch-and-save.js').default;
const neuralNetworkV2Handler = require('./stocks-v2/neural-network.js').default;
const stockModelV2Handler = require('./stocks-v2/stock-model.js').default;

// Convert Vercel handler to Express middleware
function vercelToExpress(handler) {
  return async (req, res) => {
    try {
      // Convert Express request to Vercel Request-like object
      const vercelReq = {
        method: req.method,
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        headers: req.headers,
        json: async () => req.body,
        text: async () => JSON.stringify(req.body),
      };

      const response = await handler(vercelReq);

      // Set headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Set status and send body
      res.status(response.status);

      if (response.body) {
        const text = await response.text();
        res.send(text);
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Error in handler:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

// Routes
app.get('/api/help', vercelToExpress(helpHandler));
app.get('/api/test-minimal', vercelToExpress(testMinimalHandler));
app.get('/api/stocks/list', vercelToExpress(stocksListHandler));
app.post('/api/stocks/save', vercelToExpress(saveHandler));
app.get('/api/stocks/:symbol', vercelToExpress(symbolHandler));
// Stocks v2 routes (local filesystem)
// IMPORTANT: More specific routes must come BEFORE generic routes
app.get('/api/stocks-v2/list', vercelToExpress(listV2Handler));
app.post('/api/stocks-v2/save', vercelToExpress(saveV2Handler));
app.post('/api/stocks-v2/fetch-and-save', vercelToExpress(fetchAndSaveV2Handler));
// Specific routes first
app.get('/api/stocks-v2/neural-network/:symbol', vercelToExpress(neuralNetworkV2Handler));
app.post('/api/stocks-v2/neural-network/:symbol', vercelToExpress(neuralNetworkV2Handler));
app.get('/api/stocks-v2/stock-model/:symbol', vercelToExpress(stockModelV2Handler));
app.post('/api/stocks-v2/stock-model/:symbol', vercelToExpress(stockModelV2Handler));
// Generic route last
app.get('/api/stocks-v2/:symbol', vercelToExpress(symbolV2Handler));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`API Server running at http://localhost:${port}`);
  console.log('Available routes:');
  console.log('  GET  /api/help');
  console.log('  GET  /api/test-minimal');
  console.log('  GET  /api/stocks/list');
  console.log('  POST /api/stocks/save');
  console.log('  GET  /api/stocks/:symbol');
  console.log('  GET  /api/stocks-v2/list');
  console.log('  POST /api/stocks-v2/save');
  console.log('  POST /api/stocks-v2/fetch-and-save');
  console.log('  GET  /api/stocks-v2/:symbol');
    console.log('  GET  /api/stocks-v2/neural-network/:symbol');
    console.log('  POST /api/stocks-v2/neural-network/:symbol');
    console.log('  GET  /api/stocks-v2/stock-model/:symbol');
    console.log('  POST /api/stocks-v2/stock-model/:symbol');
});

