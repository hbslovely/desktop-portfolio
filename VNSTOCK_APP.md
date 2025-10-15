# VNStock App - Vietnam Stock Market Viewer

## Overview
VNStock is a desktop application that displays real-time Vietnam stock market data using the FireAnt API. It provides an intuitive interface for viewing stock prices, changes, volumes, and other market data for Vietnamese stocks.

## Features

### 🎯 Core Features
- **Real-time Stock Data**: Displays current stock prices from Vietnamese markets (HOSE, HNX, UPCOM)
- **Multi-Exchange Support**: Easy switching between HOSE, HNX, and UPCOM markets with tabs
- **Anonymous Authentication**: Automatically logs in using FireAnt's anonymous API endpoint (`/authentication/anonymous-login`)
- **Auto-refresh**: Automatically updates stock data every 30 seconds (toggleable)
- **Search Functionality**: Search for stocks by symbol or company name
- **Sortable Columns**: Click on column headers to sort by any field
- **Responsive Design**: Beautiful gradient UI with responsive tables and mobile-friendly layout

### 📊 Stock Information Displayed
- **Symbol**: Stock ticker symbol (e.g., VNM, VIC, VHM)
- **Company Name**: Full company name in Vietnamese
- **Current Price**: Latest trading price
- **Price Change**: Absolute and percentage change
- **Volume**: Trading volume
- **High/Low**: Daily high and low prices
- **Open Price**: Opening price

### 🎨 Visual Features
- Color-coded price changes (green for gains, red for losses, orange for no change)
- Modern gradient background (blue gradient)
- Smooth animations and hover effects
- Clean, professional table layout
- Loading spinner and error handling

## Technical Implementation

### API Integration
The app uses the FireAnt API (https://api.fireant.vn) with the following endpoints:

1. **Anonymous Login**
   ```
   POST /authentication/anonymous-login
   ```
   - Obtains an access token for subsequent API calls
   - No credentials required for anonymous access

2. **Market Data**
   ```
   GET /markets/{exchange}
   ```
   - Retrieves stock data from the specified exchange (HOSE, HNX, or UPCOM)
   - Requires Bearer token authentication
   - Alternative endpoints tried: `/symbols/{exchange}`, `/stocks/{exchange}`, `/market/{exchange}/symbols`

3. **Fallback Behavior**
   - If API is unavailable, the app automatically falls back to mock data
   - Console logs show API responses and errors for debugging
   - Multiple endpoint formats are tried to maximize compatibility

### Files Created
- `src/app/services/fireant.service.ts` - Service handling FireAnt API calls
- `src/app/components/apps/vnstock-app/vnstock-app.component.ts` - Component logic
- `src/app/components/apps/vnstock-app/vnstock-app.component.html` - Component template
- `src/app/components/apps/vnstock-app/vnstock-app.component.scss` - Component styles

### Configuration Updates
- Added to `window-registry.ts` with window configuration
- Added to `app-icons.config.ts` with desktop icon (position x: 320, y: 220)
- Added to `app.component.ts` imports and start menu
- Added to `app.component.html` with *ngSwitchCase

## Usage

### Opening the App
1. **From Desktop**: Double-click the "VNStock" icon on the desktop
2. **From Start Menu**: Click Start → Information → VNStock
3. **From Search**: Press the search key and type "VNStock" or related keywords

### Using the App
1. **Select Exchange**: Click on the exchange tabs (HOSE, HNX, UPCOM) to switch between markets
2. **View Stocks**: The app automatically loads stock data on startup and when switching exchanges
3. **Search**: Type in the search box to filter stocks by symbol or name
4. **Sort**: Click any column header to sort by that field (click again to reverse order)
5. **Refresh**: Click the "🔄 Làm mới" button to manually refresh data
6. **Auto-refresh**: Toggle the "▶️/⏸️ Tự động" button to enable/disable automatic updates (30s interval)

### Search Keywords
The app can be found by searching for:
- stock, market, vietnam, fireant, trading, shares, prices
- hose, hnx, vn30, stocks, finance, investment

## Mock Data
If the FireAnt API is unavailable, the app falls back to mock data for each exchange:

### HOSE (10 stocks)
- VNM (Vinamilk), VIC (Vingroup), VHM (Vinhomes)
- HPG (Hòa Phát), VCB (Vietcombank), FPT (FPT Corporation)
- MSN (Masan Group), GAS (PV Gas), TCB (Techcombank), MWG (Mobile World)

### HNX (5 stocks)
- PVS (Dịch vụ Kỹ thuật Dầu khí Việt Nam)
- SHS (Chứng khoán Sài Gòn - Hà Nội)
- VCS (Vicostone), TNG (TNG Group), CEO (C.E.O Group)

### UPCOM (3 stocks)
- ABI (Bảo hiểm Ngân hàng Nông nghiệp)
- PCG (Đầu tư và Xây dựng Dầu khí)
- BSC (Chứng khoán BIDV)

## API Notes

### Authentication
The app uses anonymous login which doesn't require user credentials. The access token is stored in memory and used for subsequent API calls.

### Rate Limiting
The auto-refresh feature is set to 30 seconds to avoid overwhelming the API. Users can also manually refresh at any time.

### Error Handling
- Network errors display a warning message
- Failed API calls fall back to mock data
- Loading states provide visual feedback

## Future Enhancements
Potential features for future development:
- Individual stock detail view
- Historical price charts
- Watchlist functionality
- Price alerts
- Multiple market support (HOSE, HNX, UPCOM)
- Real-time WebSocket updates
- Export data to CSV/Excel
- Customizable columns
- Dark/light theme support

## Credits
- **Data Provider**: [FireAnt.vn](https://fireant.vn)
- **API Documentation**: [https://api.fireant.vn](https://api.fireant.vn)

## Disclaimer
⚠️ Dữ liệu chỉ mang tính chất tham khảo.
(Data is for reference purposes only.)

---

**Developer**: Desktop Portfolio Project
**Date Created**: October 15, 2025
**Version**: 1.0.0

