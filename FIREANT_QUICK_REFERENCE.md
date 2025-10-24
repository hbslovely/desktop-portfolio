# FireAnt Proxy - Quick Reference

## 🚀 Quick Start

### Local Development
```bash
npm run start
# Server starts on http://localhost:3006
# Proxy is automatically enabled
```

### Deploy to Vercel
```bash
vercel --prod
# Or push to Git (auto-deploy)
```

## 🔍 Quick Tests

### Test Proxy Locally
```javascript
// In browser console at http://localhost:3006
fetch('/api/fireant')
  .then(r => r.text())
  .then(html => console.log('✅ Works! Length:', html.length))
```

### Test Proxy on Vercel
```javascript
// In browser console at https://your-app.vercel.app
fetch('/api/fireant')
  .then(r => r.text())
  .then(html => console.log('✅ Works! Length:', html.length))
```

## 📋 Proxy Endpoints

| Local/Production Path | Target Server |
|----------------------|---------------|
| `/api/fireant-api/*` | `https://restv2.fireant.vn/*` |
| `/api/fireant-static/*` | `https://static.fireant.vn/*` |
| `/api/fireant` | `https://fireant.vn` |

## ✅ Success Indicators

### Terminal (Local Dev)
```
[HPM] GET /api/fireant -> https://fireant.vn
[HPM] GET /api/fireant-api/search -> https://restv2.fireant.vn/search
```

### Browser Console
```
✅ Found and updated FireAnt token
```

### Network Tab
- Requests show `/api/fireant*` (not external URLs)
- Status: 200 OK
- No CORS errors

## ❌ Common Issues

### "It doesn't work locally"
```bash
# 1. Restart dev server
Ctrl+C
npm run start

# 2. Hard reload browser
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

# 3. Check terminal for [HPM] logs
# If no logs → proxy not loaded
```

### "Works locally, not on Vercel"
```bash
# 1. Verify vercel.json is committed
git status
git add vercel.json
git commit -m "Add Vercel proxy config"
git push

# 2. Redeploy
vercel --prod

# 3. Check Vercel logs
vercel logs
```

### "CORS errors everywhere"
```bash
# Check if service is using proxy paths:
# ✅ GOOD: /api/fireant-api/search
# ❌ BAD:  https://restv2.fireant.vn/search
```

## 📁 Key Files

### Must Have These Files:

1. **`proxy.conf.json`** - Local dev proxy config
2. **`vercel.json`** - Production proxy config (Vercel rewrites)
3. **`angular.json`** - Links proxy to dev server

### Code Should Use:

```typescript
// ✅ CORRECT - Uses proxy paths
private readonly BASE_URL = '/api/fireant-api';
this.http.get('/api/fireant', ...)
this.http.get('/api/fireant-static/...', ...)

// ❌ WRONG - Direct URLs bypass proxy
private readonly BASE_URL = 'https://restv2.fireant.vn';
this.http.get('https://fireant.vn', ...)
```

## 🛠️ Debug Commands

### Check if proxy config is loaded
```bash
# Look for this in terminal after starting server:
npm run start | grep proxy
# Should see: Using proxy configuration from proxy.conf.json
```

### Test proxy endpoint directly
```bash
# While dev server is running:
curl http://localhost:3006/api/fireant
# Should return HTML

# On Vercel:
curl https://your-app.vercel.app/api/fireant
# Should return HTML
```

### Check service uses proxy
```bash
# Search for proxy paths in service:
grep -n "api/fireant" src/app/services/fireant.service.ts
# Should show /api/fireant-api, /api/fireant, /api/fireant-static
```

## 📊 Request Examples

### Search for stock
```
GET /api/fireant-api/search?keywords=VNM&type=symbol
→ https://restv2.fireant.vn/search?keywords=VNM&type=symbol
```

### Get stock info
```
GET /api/fireant-api/symbols/VNM
→ https://restv2.fireant.vn/symbols/VNM
```

### Get main page
```
GET /api/fireant
→ https://fireant.vn
```

### Get static script
```
GET /api/fireant-static/web/v1/_next/static/chunks/pages/_app-abc123.js
→ https://static.fireant.vn/web/v1/_next/static/chunks/pages/_app-abc123.js
```

## 🔄 Deployment Checklist

### Before Deploying
- [ ] `proxy.conf.json` exists and is correct
- [ ] `vercel.json` has rewrites section
- [ ] `angular.json` has proxyConfig
- [ ] Service uses `/api/fireant*` paths
- [ ] Works locally (`npm run start`)

### After Deploying
- [ ] Visit production URL
- [ ] Open DevTools → Console
- [ ] Look for `✅ Found and updated FireAnt token`
- [ ] Test VNStock app functionality
- [ ] Check Network tab for `/api/fireant*` requests

## 💡 Pro Tips

1. **Always restart dev server** after changing `proxy.conf.json`
2. **Hard reload browser** after changing code (Cmd+Shift+R)
3. **Check [HPM] logs** in terminal to verify proxy is working
4. **Test proxy endpoint** directly with curl or browser console
5. **Commit vercel.json** to Git for auto-deploy to work

## 🆘 Emergency Fixes

### Nuclear Option (Reset Everything)
```bash
# 1. Stop server
Ctrl+C

# 2. Clear everything
rm -rf node_modules dist
npm cache clean --force

# 3. Reinstall
npm install

# 4. Rebuild and restart
npm run start
```

### Vercel Not Working
```bash
# Force fresh deployment
vercel --prod --force

# Check logs
vercel logs --follow
```

## 📞 Need More Help?

See `FIREANT_PROXY_SETUP.md` for detailed documentation.

---

**Quick Access URLs:**
- Local: http://localhost:3006
- Proxy Test: http://localhost:3006/api/fireant
- FireAnt Site: https://fireant.vn


