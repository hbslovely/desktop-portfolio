# FireAnt CORS Solution

## Problem
When making direct HTTP requests to `https://fireant.vn` and its subdomains from the browser, CORS (Cross-Origin Resource Sharing) errors occur because the FireAnt servers don't allow requests from your development domain.

## Solution: Angular Development Proxy

We've configured Angular's built-in proxy server to forward requests to FireAnt domains, bypassing CORS restrictions during development.

## What Was Changed

### 1. Created Proxy Configuration (`proxy.conf.json`)

Three proxy routes were configured:

- **`/api/fireant/restv2.fireant.vn`** → Routes API calls to `https://restv2.fireant.vn`
- **`/api/fireant/static.fireant.vn`** → Routes static asset requests to `https://static.fireant.vn`  
- **`/api/fireant`** → Routes main page requests to `https://fireant.vn`

### 2. Updated `angular.json`

Added proxy configuration to the serve builder:

```json
"serve": {
  "builder": "@angular-devkit/build-angular:dev-server",
  "options": {
    "proxyConfig": "proxy.conf.json"
  },
  ...
}
```

### 3. Updated `fireant.service.ts`

Changed all URLs to use the proxy:

**Before:**
```typescript
private readonly BASE_URL = 'https://restv2.fireant.vn';
this.http.get('https://fireant.vn', { responseType: 'text' })
this.http.get('https://static.fireant.vn/web/v1/...', { responseType: 'text' })
```

**After:**
```typescript
private readonly BASE_URL = '/api/fireant-api';
this.http.get('/api/fireant', { responseType: 'text' })
this.http.get('/api/fireant-static/web/v1/...', { responseType: 'text' })
```

## How It Works

1. Your Angular app makes requests to `/api/fireant/*` (same origin)
2. Angular's dev server intercepts these requests
3. The proxy forwards them to the actual FireAnt servers
4. FireAnt servers see the request coming from the proxy (not browser), avoiding CORS
5. Response is sent back through the proxy to your app

## Usage

Simply run your development server as usual:

```bash
npm run start
```

The proxy is automatically enabled and will handle all FireAnt API requests.

## Important Notes

### ⚠️ Development Only
This proxy configuration **only works during development** with `ng serve`. 

### Production Deployment
For production, you have several options:

1. **Backend Proxy (Recommended)**: Create a backend service that proxies requests to FireAnt
2. **Serverless Functions**: Use platforms like Vercel/Netlify functions as a proxy
3. **CORS Proxy Service**: Use a dedicated CORS proxy service (not recommended for production)

### Nginx Configuration (Production)
If deploying with Nginx, you can add proxy rules to `nginx.conf`:

```nginx
location /api/fireant/ {
    proxy_pass https://fireant.vn/;
    proxy_set_header Host fireant.vn;
    proxy_set_header User-Agent "Mozilla/5.0...";
}
```

## Testing

### Step 1: Restart the Development Server

**Important:** You MUST restart the dev server after changing `proxy.conf.json`:

```bash
# Stop the current server (Ctrl+C)
# Then start again
npm run start
```

### Step 2: Verify Proxy is Working

1. **Check Terminal Output**: Look for proxy debug logs when making requests:
   ```
   [HPM] GET /api/fireant -> https://fireant.vn
   [HPM] GET /api/fireant-api/search?keywords=VNM -> https://restv2.fireant.vn/search?keywords=VNM
   ```

2. **Check Browser Console**: Open DevTools and look for:
   - ✅ `Found and updated FireAnt token` - Token fetched successfully
   - Network tab should show requests to `/api/fireant*` (not CORS errors)
   - Should see successful 200 responses

3. **Test in VNStock App**: 
   - Open the VNStock app in your portfolio
   - Try searching for a stock symbol (e.g., "VNM", "FPT")
   - Data should load without CORS errors

### Step 3: Test Proxy Manually

You can test the proxy directly in the browser:

```javascript
// Open browser console and run:
fetch('/api/fireant')
  .then(r => r.text())
  .then(html => console.log(html.substring(0, 200)))
  
// Should return HTML from fireant.vn without CORS error
```

## Troubleshooting

### Proxy not working?

**1. Did you restart the dev server?**
   - This is the #1 cause of proxy issues
   - Stop the server completely (Ctrl+C) and run `npm run start` again
   
**2. Check the terminal for errors:**
   - Look for `[HPM]` proxy logs
   - If you don't see any `[HPM]` logs, the proxy isn't configured correctly
   
**3. Verify proxy paths:**
   - Service should use `/api/fireant-api` for API calls
   - Service should use `/api/fireant` for main page
   - Service should use `/api/fireant-static` for static assets

**4. Check `angular.json`:**
   - Verify it has `"proxyConfig": "proxy.conf.json"` in the serve options

### "It works in Postman but not in the browser"

This is **expected behavior**:
- ✅ **Postman**: No CORS restrictions, works directly with `https://fireant.vn`
- ❌ **Browser without proxy**: CORS blocks the request
- ✅ **Browser with proxy**: Works because proxy forwards the request

The proxy is specifically for the browser. The fact that Postman works confirms the FireAnt API is accessible.

### Still getting CORS errors?

1. **Hard reload the browser:**
   - Mac: `Cmd+Shift+R`
   - Windows/Linux: `Ctrl+Shift+R`
   
2. **Verify the URL in Network tab:**
   - Should be: `http://localhost:3006/api/fireant`
   - NOT: `https://fireant.vn`
   
3. **Check for other proxy conflicts:**
   - Disable any browser extensions that might interfere
   - Make sure you're not running another proxy (VPN, corporate proxy, etc.)

4. **Test the proxy endpoint directly:**
   ```bash
   # In a new terminal (while dev server is running):
   curl http://localhost:3006/api/fireant
   # Should return HTML from fireant.vn
   ```

### Angular dev server not using the proxy?

Make sure you're running with the correct command:
```bash
npm run start
# NOT npm run build or ng build
```

The proxy only works with `ng serve` (development server), not with built static files.

## References

- [Angular Proxy Configuration](https://angular.io/guide/build#proxying-to-a-backend-server)
- [http-proxy-middleware documentation](https://github.com/chimurai/http-proxy-middleware)

