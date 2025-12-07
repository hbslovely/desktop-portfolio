const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Import API handlers
const listHandler = require('./api/stocks/list.js').default;
const saveHandler = require('./api/stocks/save.js').default;
const symbolHandler = require('./api/stocks/[symbol].js').default;
const helpHandler = require('./api/help.js').default;
const testMinimalHandler = require('./api/test-minimal.js').default;
const stocksListHandler = require('./api/stocks-list.js').default;

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
});

