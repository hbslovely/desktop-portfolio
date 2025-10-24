# FireAnt Proxy Setup - Local & Vercel

## Overview

This project uses a proxy setup to avoid CORS issues when calling FireAnt APIs. The proxy works in both:
- 🏠 **Local Development** (using Angular proxy)
- ☁️ **Production on Vercel** (using Vercel rewrites)

## How It Works

### API Endpoints

All FireAnt requests go through proxy endpoints:

| Proxy Path | Target | Purpose |
|------------|--------|---------|
| `/api/fireant-api/*` | `https://restv2.fireant.vn/*` | API calls (search, stock info, etc.) |
| `/api/fireant-static/*` | `https://static.fireant.vn/*` | Static assets (JS files with tokens) |
| `/api/fireant` | `https://fireant.vn` | Main page (for scraping script tags) |

### Request Flow

```
Your App → /api/fireant-api/search?keywords=VNM
         ↓
    Proxy Server (local dev or Vercel)
         ↓
    https://restv2.fireant.vn/search?keywords=VNM
         ↓
    Response ← FireAnt API
         ↓
    Your App ← Proxy Server
```

## Configuration Files

### 1. `proxy.conf.json` (Local Development)

Used by Angular dev server (`ng serve`):

```json
{
  "/api/fireant-api": {
    "target": "https://restv2.fireant.vn",
    "changeOrigin": true,
    "pathRewrite": { "^/api/fireant-api": "" }
  },
  "/api/fireant-static": {
    "target": "https://static.fireant.vn",
    "changeOrigin": true,
    "pathRewrite": { "^/api/fireant-static": "" }
  },
  "/api/fireant": {
    "target": "https://fireant.vn",
    "changeOrigin": true,
    "pathRewrite": { "^/api/fireant": "" }
  }
}
```

### 2. `vercel.json` (Production)

Used by Vercel for production deployment:

```json
{
  "rewrites": [
    {
      "source": "/api/fireant-api/:path*",
      "destination": "https://restv2.fireant.vn/:path*"
    },
    {
      "source": "/api/fireant-static/:path*",
      "destination": "https://static.fireant.vn/:path*"
    },
    {
      "source": "/api/fireant",
      "destination": "https://fireant.vn"
    }
  ]
}
```

### 3. `angular.json`

Links the proxy config to the dev server:

```json
{
  "serve": {
    "builder": "@angular-devkit/build-angular:dev-server",
    "options": {
      "proxyConfig": "proxy.conf.json"
    }
  }
}
```

### 4. `fireant.service.ts`

Uses relative URLs that work in both environments:

```typescript
private readonly BASE_URL = '/api/fireant-api';

// Fetching token
this.http.get('/api/fireant', { responseType: 'text' })

// Fetching scripts  
this.http.get('/api/fireant-static/web/v1/_next/static/chunks/pages/...', { responseType: 'text' })
```

## Local Development

### Start the Dev Server

```bash
npm run start
# or
ng serve --port 3006
```

The proxy is automatically enabled when you start the dev server.

### Verify It's Working

1. **Check terminal for proxy logs:**
   ```
   [HPM] GET /api/fireant -> https://fireant.vn
   [HPM] GET /api/fireant-api/search?keywords=VNM -> https://restv2.fireant.vn/search?keywords=VNM
   ```

2. **Check browser console:**
   - Open DevTools (F12)
   - Look for: `✅ Found and updated FireAnt token`
   - Network tab should show requests to `/api/fireant*` (not external URLs)

3. **Test manually in console:**
   ```javascript
   fetch('/api/fireant')
     .then(r => r.text())
     .then(html => console.log('✅ Proxy works! HTML length:', html.length))
   ```

## Vercel Deployment

### How Vercel Rewrites Work

When deployed to Vercel:
1. Vercel reads `vercel.json` during build
2. Configures edge network to rewrite `/api/fireant*` requests
3. Forwards them to actual FireAnt servers
4. Returns responses to your app
5. No CORS issues because request appears to come from same domain

### Deploy to Vercel

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel --prod
```

Or push to your connected Git repository (auto-deploy).

### Verify Production Deployment

1. **Visit your Vercel URL:**
   ```
   https://your-app.vercel.app
   ```

2. **Open DevTools and check:**
   - Network tab shows `/api/fireant*` requests
   - No CORS errors
   - Successful 200 responses

3. **Test VNStock app:**
   - Navigate to VNStock
   - Search for stocks (e.g., "VNM", "FPT")
   - Data should load successfully

## Troubleshooting

### Local Development Issues

**Problem:** Proxy not working locally

**Solutions:**
1. ✅ **Restart dev server** - Changes to `proxy.conf.json` require restart
2. ✅ Check `angular.json` has `"proxyConfig": "proxy.conf.json"`
3. ✅ Look for `[HPM]` logs in terminal
4. ✅ Hard reload browser (Cmd+Shift+R / Ctrl+Shift+R)

**Problem:** CORS errors in development

**Solutions:**
1. ✅ Verify you're using `http://localhost:3006` (not `file://` or IP address)
2. ✅ Check service is using `/api/fireant*` not `https://fireant.vn`
3. ✅ Clear browser cache and restart server

### Vercel Production Issues

**Problem:** Works locally but not on Vercel

**Solutions:**
1. ✅ Check `vercel.json` is committed to Git
2. ✅ Verify rewrites are in correct format (check Vercel docs)
3. ✅ Check Vercel build logs for errors
4. ✅ Test the proxy endpoint directly: `https://your-app.vercel.app/api/fireant`

**Problem:** 404 errors on `/api/fireant*` in production

**Solutions:**
1. ✅ Redeploy to Vercel (sometimes config changes need fresh deploy)
2. ✅ Check Vercel dashboard → Settings → Rewrites
3. ✅ Verify `vercel.json` syntax is correct (JSON format)

**Problem:** Vercel deployment works but data doesn't load

**Solutions:**
1. ✅ Check browser console for errors
2. ✅ Verify token extraction is working (look for `✅ Found and updated FireAnt token`)
3. ✅ Check if FireAnt changed their token pattern
4. ✅ Test API endpoints directly in Postman/curl

## Testing Checklist

### Local Development ✓
- [ ] `npm run start` works without errors
- [ ] Terminal shows `[HPM]` proxy logs
- [ ] Browser console shows `✅ Found and updated FireAnt token`
- [ ] VNStock app loads stock data
- [ ] No CORS errors in browser console

### Vercel Production ✓
- [ ] `vercel.json` is committed to Git
- [ ] Deployment succeeds without errors
- [ ] Production URL is accessible
- [ ] VNStock app works on production URL
- [ ] No CORS errors on production
- [ ] API calls show in Network tab as `/api/fireant*`

## Why This Approach?

### Benefits

1. **✅ No CORS Issues:** Requests appear to come from same domain
2. **✅ Works Everywhere:** Same code for dev and production
3. **✅ No Backend Needed:** Uses edge network rewrites
4. **✅ Simple Maintenance:** Just update `vercel.json` and `proxy.conf.json`
5. **✅ Fast:** Edge network proxying is fast (no extra server hops)

### Alternatives Considered

| Approach | Pros | Cons |
|----------|------|------|
| Direct API calls | Simple | ❌ CORS blocks it |
| CORS browser extension | Quick fix | ❌ Only works for developer |
| Dedicated backend server | Full control | ❌ Extra infrastructure cost |
| CORS proxy service | Easy | ❌ Reliability, rate limits |
| **Current: Proxy rewrites** | ✅ Works everywhere, no extra cost | Minor config needed |

## Important Notes

### Token Management

The service automatically:
1. Fetches HTML from FireAnt homepage
2. Finds `_app-*.js` script references
3. Downloads those scripts
4. Extracts JWT token using regex: `/let\s+em\s*=\s*"(eyJ[^"]+)"/`
5. Stores token in localStorage (expires in 3 days)
6. Refreshes token when API calls fail

### Rate Limiting

Be mindful of:
- Don't make excessive requests to FireAnt
- Token is cached to reduce requests
- Implement proper error handling
- Consider caching API responses

### Security

- The proxy forwards all requests to FireAnt as-is
- Don't expose sensitive data in API calls
- FireAnt's authentication token is extracted from public JS files
- This is the same approach their website uses

## Resources

- [Angular Proxy Configuration](https://angular.io/guide/build#proxying-to-a-backend-server)
- [Vercel Rewrites Documentation](https://vercel.com/docs/concepts/projects/project-configuration#rewrites)
- [FireAnt Website](https://fireant.vn)

## Support

If you encounter issues:

1. Check this documentation first
2. Look at browser console for errors
3. Check terminal logs for proxy activity
4. Verify `vercel.json` and `proxy.conf.json` match this guide
5. Test API endpoints directly with curl/Postman

---

**Last Updated:** 2025-10-23
**Tested With:** Angular 19, Vercel Edge Network


