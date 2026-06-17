# Google Apps Script — Setup & Architecture

## Overview

All write operations (add / update / delete) go through **Google Apps Script** web apps because the Google Sheets API v4 does not support writes with an API key.

There are **two call modes** selectable via an environment variable:

| Mode | `NG_APP_APPS_SCRIPT_MODE` | Request path |
|---|---|---|
| **Proxy** (default) | *(unset)* | Browser → `/api/<name>-apps-script` (Vercel function) → GAS |
| **Direct** | `direct` | Browser → GAS URL directly (`no-cors` fetch) |

### Why two modes?

- **Proxy** — Vercel acts as a server-side relay. The browser makes a same-origin request (no CORS preflight), and the function forwards it to GAS and returns the response. Best for production on Vercel.
- **Direct** — Calls GAS from the browser using `fetch` with `mode: 'no-cors'`. No response can be read (opaque), but GAS still writes the data. Used when Vercel functions are unavailable or for local development pointing directly at GAS.

### CORS / Content-Type rule

All POST bodies are sent as **`text/plain;charset=UTF-8`** (a CORS-safelisted content type). This avoids triggering a preflight `OPTIONS` request, which GAS does not respond to. The GAS handler reads the body with `e.postData.contents` and parses it as JSON.

---

## Environment Variables

Set these in Vercel (or `.env.local` for local dev):

| Variable | Required | Description |
|---|---|---|
| `NG_APP_APPS_SCRIPT_MODE` | No | Set to `direct` to bypass Vercel proxy and call GAS directly |
| `NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL` | Yes (direct mode) | Full GAS exec URL for the Feeding sheet |
| `NG_APP_GOOGLE_APPS_SCRIPT_URL` | Yes (direct mode) | Full GAS exec URL for the Expense sheet |
| `NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL` | Yes (direct mode) | Full GAS exec URL for the Business sheet |
| `GOOGLE_FEEDING_APPS_SCRIPT_URL` | Yes (proxy mode) | GAS exec URL read by Vercel function `/api/feeding-apps-script` |
| `GOOGLE_APPS_SCRIPT_URL` | Yes (proxy mode) | GAS exec URL read by Vercel function `/api/google-apps-script` |
| `GOOGLE_BUSINESS_APPS_SCRIPT_URL` | Yes (proxy mode) | GAS exec URL read by Vercel function `/api/business-apps-script` |
| `NG_APP_GOOGLE_FEEDING_SHEET_ID` | Yes | Google Sheet ID for the Feeding sheet (for read via Sheets API) |
| `NG_APP_GOOGLE_SHEETS_API_KEY` | Yes | Google Sheets API key (read-only operations) |

> **Note:** In proxy mode the `NG_APP_GOOGLE_*_APPS_SCRIPT_URL` frontend variables are ignored — only the server-side `GOOGLE_*_APPS_SCRIPT_URL` variables (without `NG_APP_` prefix) are used by the Vercel functions.

---

## Vercel Proxy Functions

Each function lives in `api/` and proxies to the corresponding GAS deployment:

| Endpoint | File | Env key read |
|---|---|---|
| `/api/feeding-apps-script` | `api/feeding-apps-script.js` | `GOOGLE_FEEDING_APPS_SCRIPT_URL` |
| `/api/google-apps-script` | `api/google-apps-script.js` | `GOOGLE_APPS_SCRIPT_URL` |
| `/api/business-apps-script` | `api/business-apps-script.js` | `GOOGLE_BUSINESS_APPS_SCRIPT_URL` |

The shared proxy logic (`api/_apps-script-proxy.js`) forwards the request body and headers to GAS, follows redirects, and returns the JSON response to the client.

---

## Services → GAS Endpoint Mapping

| Angular Service | GAS Sheet | Proxy endpoint |
|---|---|---|
| `feeding-log.service.ts` | Feeding | `/api/feeding-apps-script` |
| `activity-log.service.ts` | Feeding (Activity tab) | `/api/feeding-apps-script` |
| `weight-log.service.ts` | Feeding (Weight tab) | `/api/feeding-apps-script` |
| `notification-log.service.ts` | Feeding (Notification tab) | `/api/feeding-apps-script` |
| `event-log.service.ts` | Feeding (Event tab) | `/api/feeding-apps-script` |
| `medical-history.service.ts` | Feeding (Medical tab) | `/api/feeding-apps-script` |
| `explorer.service.ts` | Feeding (Explorer/Docs tab) | `/api/feeding-apps-script` |
| `expense.service.ts` | Expense | `/api/google-apps-script` |
| `business.service.ts` | Business | `/api/business-apps-script` |

---

## GAS `doPost` — Supported Actions per Sheet

### Feeding Sheet (`/api/feeding-apps-script`)

| `action` | Description |
|---|---|
| `addLog` | Append row to Activity Log tab |
| `clearBottlePrep` | Clear bottle prep cells (H1:K1) on Feeding tab |
| `setBottlePrep` | Write bottle prep data to Feeding tab |
| `addFeeding` | Append a feeding log row |
| `updateFeeding` | Update an existing feeding row |
| `deleteFeeding` | Delete a feeding row |
| `addWeight` | Append a weight/height row |
| `updateWeight` | Update an existing weight row |
| `deleteWeight` | Delete a weight row |
| `addMedical` | Append a medical history row |
| `updateMedical` | Update a medical history row |
| `deleteMedical` | Delete a medical history row |
| `addEvent` | Append a scheduled event row |
| `updateEvent` | Update an event row |
| `deleteEvent` | Delete an event row |
| `addNotification` | Append a notification row |
| `acknowledgeNotification` | Update acknowledge list on a notification row |
| `deleteNotification` | Delete a notification row (owner only) |
| `addExplorerFile` | Upload/create a file in the Explorer |
| `deleteExplorerFile` | Delete an Explorer file |
| `moveExplorerFile` | Move/rename an Explorer file |
| `getExplorerFile` | Fetch file content (requires proxy mode — response must be readable) |

### Expense Sheet (`/api/google-apps-script`)

| `action` | Description |
|---|---|
| `add` | Append an expense row |
| `edit` | Update an expense row |
| `delete` | Delete an expense row |

### Business Sheet (`/api/business-apps-script`)

| `action` | Description |
|---|---|
| `add` | Append a row to a named sheet |
| `update` | Update a row |
| `delete` | Delete a row |

---

## GAS Deployment Steps

1. Open the target Google Sheet
2. Go to **Extensions → Apps Script**
3. Paste the script code (see individual script docs or the deployed script)
4. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the exec URL (`https://script.google.com/macros/s/.../exec`)
6. Set the URL in Vercel environment variables (see table above)
7. Redeploy on Vercel

> **Re-deploy after code changes:** Every time the GAS code is updated, a **new deployment** is required. Updating the existing deployment does not publish new code.

---

## Local Development

For local dev, the Angular proxy (`proxy.conf.json`) forwards `/api/*-apps-script` to the corresponding GAS exec URLs directly. Set `NG_APP_APPS_SCRIPT_MODE` to anything other than `direct` (or leave unset) in `.env.local` to use the proxy.

```env
# .env.local example (proxy mode — recommended)
NG_APP_GOOGLE_FEEDING_SHEET_ID=your_sheet_id
NG_APP_GOOGLE_SHEETS_API_KEY=your_api_key
# NG_APP_APPS_SCRIPT_MODE not set → uses /api/* proxy
```

The proxy rewrites in `proxy.conf.json` route to the real GAS exec URLs, so no Vercel function is needed locally.
