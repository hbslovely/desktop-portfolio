// Simple API server using Node.js built-in modules
import http from 'http';
import url from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3001;

// Simple router - paths relative to server/api/ directory
const routes = {
  '/api/test-minimal': './test-minimal.js',
  '/api/help': './help.js',
  '/api/stocks/list': './stocks/list.js',
  '/api/stocks/save': './stocks/save.js',
  '/api/stocks-v2/list': './stocks-v2/list.js',
  '/api/stocks-v2/save': './stocks-v2/save.js',
  '/api/stocks-v2/fetch-and-save': './stocks-v2/fetch-and-save.js',
};

// Handle dynamic route
function getHandler(pathname) {
  // Check exact matches first
  if (routes[pathname]) {
    return routes[pathname];
  }

  // Check dynamic routes
  if (pathname.startsWith('/api/stocks/') && pathname !== '/api/stocks/list' && pathname !== '/api/stocks/save') {
    const symbol = pathname.replace('/api/stocks/', '');
    if (symbol && symbol.length > 0) {
      return './stocks/[symbol].js';
    }
  }

  // Check stocks-v2 dynamic routes
  if (pathname.startsWith('/api/stocks-v2/') && pathname !== '/api/stocks-v2/list' && pathname !== '/api/stocks-v2/save' && pathname !== '/api/stocks-v2/fetch-and-save') {
    const symbol = pathname.replace('/api/stocks-v2/', '');
    if (symbol && symbol.length > 0) {
      return './stocks-v2/[symbol].js';
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  const handlerPath = getHandler(pathname);

  if (!handlerPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
    return;
  }

  try {
    // Import handler dynamically (ES modules)
    // Resolve path relative to api/ directory
    const fullPath = path.resolve(__dirname, handlerPath);
    const fileUrl = `file://${fullPath}`;
    console.log(`Loading handler from: ${fileUrl}`);
    const handlerModule = await import(fileUrl);
    const handler = handlerModule.default;

    // Create Request-like object
    let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

    req.on('end', async () => {
      try {
        const vercelReq = {
          method: req.method,
          url: `http://${req.headers.host}${req.url}`,
          headers: req.headers,
          json: async () => body ? JSON.parse(body) : {},
          text: async () => body,
        };

        const response = await handler(vercelReq);

        // Set headers
        if (response.headers) {
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
        }

        // Set status
        res.writeHead(response.status || 200);

        // Send body
        if (response.body) {
          const text = await response.text();
          res.end(text);
        } else {
          res.end();
        }
      } catch (error) {
        console.error('Error executing handler:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } catch (error) {
    console.error('Error loading handler:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`API Server running at http://localhost:${port}`);
  console.log('Available routes:');
  console.log('  GET  /api/test-minimal');
  console.log('  GET  /api/help');
  console.log('  GET  /api/stocks/list');
  console.log('  POST /api/stocks/save');
  console.log('  GET  /api/stocks/:symbol');
  console.log('  GET  /api/stocks-v2/list');
  console.log('  POST /api/stocks-v2/save');
  console.log('  POST /api/stocks-v2/fetch-and-save');
  console.log('  GET  /api/stocks-v2/:symbol');
});

