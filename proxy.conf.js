const fs = require('fs');
const path = require('path');

// Read the JSON config
const jsonConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'proxy.conf.json'), 'utf8')
);

// Add custom onProxyRes handler for Facebook to rewrite redirects
if (jsonConfig['/api/facebook']) {
  jsonConfig['/api/facebook'].onProxyRes = function(proxyRes, req, res) {
    // Rewrite Location header in redirects
    if (proxyRes.headers['location']) {
      const location = proxyRes.headers['location'];
      if (location.includes('facebook.com') || location.includes('fb.com')) {
        try {
          const url = new URL(location);
          proxyRes.headers['location'] = `/api/facebook${url.pathname}${url.search}`;
        } catch (e) {
          // If URL parsing fails, try simple string replacement
          const match = location.match(/(?:https?:\/\/)?(?:www\.)?(?:facebook|fb)\.com([^\s?]*)/);
          if (match && match[1]) {
            proxyRes.headers['location'] = `/api/facebook${match[1]}`;
          }
        }
      }
    }
  };
}

module.exports = jsonConfig;

