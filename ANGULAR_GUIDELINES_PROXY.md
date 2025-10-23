# Angular Guidelines App - Proxy Configuration

## Problem
The Angular Guidelines app was experiencing CORS errors when trying to fetch content from `https://angular.dev/assets/content/guide/what-is-angular.md.html`.

```
Request URL: https://angular.dev/assets/content/guide/what-is-angular.md.html
Request Method: GET
Status Code: CORS Error
```

## Solution
Added proxy configuration to bypass CORS restrictions by routing requests through the local development server and Vercel in production.

## Changes Made

### 1. proxy.conf.json
Added Angular.dev proxy configuration:

```json
"/api/angular-dev": {
  "target": "https://angular.dev",
  "secure": true,
  "changeOrigin": true,
  "logLevel": "debug",
  "pathRewrite": {
    "^/api/angular-dev": ""
  },
  "headers": {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://angular.dev/"
  }
}
```

**How it works:**
- Requests to `/api/angular-dev/*` are proxied to `https://angular.dev/*`
- The path is rewritten to remove the `/api/angular-dev` prefix
- Proper headers are added to mimic browser requests

### 2. angular-guidelines.service.ts
Updated the base URL to use the proxy:

```typescript
// Before
private readonly ANGULAR_DEV_CONTENT = 'https://angular.dev/assets/content';

// After
private readonly ANGULAR_DEV_CONTENT = '/api/angular-dev/assets/content';
```

### 3. vercel.json
Added proxy configuration for production deployment:

```json
{
  "rewrites": [
    {
      "source": "/api/angular-dev/:path*",
      "destination": "https://angular.dev/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/angular-dev/:path*",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type"
        }
      ]
    }
  ]
}
```

## How to Test

### Development
1. Restart the development server to apply proxy changes:
   ```bash
   npm start
   ```

2. Open the Angular Guidelines app in your portfolio

3. Try loading any guideline - it should now work without CORS errors

### Example Request Flow
```
Browser Request: /api/angular-dev/assets/content/guide/what-is-angular.md.html
     ↓
Proxy Server: Rewrites to https://angular.dev/assets/content/guide/what-is-angular.md.html
     ↓
Angular.dev: Returns content
     ↓
Browser: Receives content (no CORS error)
```

## URLs That Now Work
- `/api/angular-dev/assets/content/guide/what-is-angular.md.html`
- `/api/angular-dev/assets/content/guide/installation.md.html`
- `/api/angular-dev/assets/content/guide/components/anatomy-of-components.md.html`
- And all other Angular.dev documentation URLs

## Benefits
✅ No CORS errors
✅ Works in both development and production
✅ Clean separation between environments
✅ Easy to maintain and debug with logLevel: "debug"

## Related Files
- `/proxy.conf.json` - Local development proxy configuration
- `/vercel.json` - Production proxy configuration
- `/src/app/services/angular-guidelines.service.ts` - Service using the proxy
- `/src/app/components/apps/angular-guidelines-app/` - App component

## Notes
- The proxy server acts as an intermediary, making the request from the server side where CORS doesn't apply
- In production, Vercel's rewrite rules perform the same function
- Make sure to restart the dev server after changing `proxy.conf.json`

