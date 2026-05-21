# Google Apps Script cho Stock App

## Hướng dẫn sử dụng

1. Mở Google Sheets: https://docs.google.com/spreadsheets/d/17NW3ieBoMCpun6STz57AVoVHm7g7V5N7Dyu1gGG3Mi0/edit
2. Vào **Extensions** > **Apps Script**
3. Xóa code mặc định và dán code bên dưới
4. Lưu script (Ctrl+S hoặc Cmd+S)
5. Chạy hàm `doPost` một lần để cấp quyền
6. Deploy script:
   - Click **Deploy** > **New deployment**
   - Chọn type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
   - Copy **Script ID** và dán vào app

## Code Google Apps Script

```javascript
/**
 * Stock Data Saver - Lưu dữ liệu cổ phiếu vào Google Sheets
 * Mỗi mã cổ phiếu sẽ được lưu vào một tab riêng
 */

// ID của Google Sheets (có thể thay đổi)
const SHEET_ID = '17NW3ieBoMCpun6STz57AVoVHm7g7V5N7Dyu1gGG3Mi0';

/**
 * Hàm xử lý POST request từ app
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'saveStockData') {
      return saveStockData(data.sheetId || SHEET_ID, data.symbol, data.data);
    }
    
    if (data.action === 'savePriceData') {
      return savePriceData(data.sheetId || SHEET_ID, data.symbol, data.ohlcData);
    }
    
    if (data.action === 'checkSheetExists') {
      return checkSheetExists(data.sheetId || SHEET_ID, data.symbol);
    }
    
    if (data.action === 'getAllSymbols') {
      return getAllSymbols(data.sheetId || SHEET_ID);
    }
    
    if (data.action === 'getPriceData') {
      return getPriceData(data.sheetId || SHEET_ID, data.symbol);
    }
    
    if (data.action === 'getStockBasicInfo') {
      return getStockBasicInfo(data.sheetId || SHEET_ID, data.symbol);
    }
    
    if (data.action === 'getAllStocksBasicInfo') {
      return getAllStocksBasicInfo(data.sheetId || SHEET_ID);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Check if a sheet with the symbol name exists
 */
function checkSheetExists(sheetId, symbol) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(symbol);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      exists: sheet !== null
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      exists: false
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all sheet names (symbols) from the spreadsheet
 */
function getAllSymbols(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(sheet => sheet.getName());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      symbols: sheetNames
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      symbols: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get price data from sheet {SYMBOL}_Price
 * @param {string} sheetId - ID của Google Sheets
 * @param {string} symbol - Mã cổ phiếu
 */
function getPriceData(sheetId, symbol) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheetName = symbol + '_Price';
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `Sheet ${sheetName} không tồn tại`,
        data: null
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data from sheet (skip header row)
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: [],
        rowCount: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get data range (A2:F for Time, Open, Lowest, Highest, Close, Volume)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = dataRange.getValues();
    
    // Convert to array of objects
    const priceData = values.map(row => {
      return {
        time: row[0] || '', // Time (dd/mm/yyyy)
        open: row[1] || '', // Open
        lowest: row[2] || '', // Lowest
        highest: row[3] || '', // Highest
        close: row[4] || '', // Close
        volume: row[5] || '' // Volume
      };
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: priceData,
      rowCount: priceData.length,
      symbol: symbol
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      data: null
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Lưu dữ liệu cổ phiếu vào Google Sheets
 * @param {string} sheetId - ID của Google Sheets
 * @param {string} symbol - Mã cổ phiếu
 * @param {object} stockData - Dữ liệu cổ phiếu từ DNSE API
 */
function saveStockData(sheetId, symbol, stockData) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    
    // Tạo hoặc lấy sheet với tên là mã cổ phiếu
    let sheet = spreadsheet.getSheetByName(symbol);
    
    if (!sheet) {
      // Tạo sheet mới nếu chưa tồn tại
      sheet = spreadsheet.insertSheet(symbol);
      
      // Thêm header
      sheet.getRange(1, 1).setValue('Key');
      sheet.getRange(1, 2).setValue('Value');
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
      sheet.getRange(1, 1, 1, 2).setBackground('#4285f4');
      sheet.getRange(1, 1, 1, 2).setFontColor('#ffffff');
    } else {
      // Xóa dữ liệu cũ (giữ lại header)
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
    }
    
    // Chuyển đổi object thành mảng key-value
    const flatData = flattenObject(stockData);
    
    // Ghi dữ liệu vào sheet
    const rows = flatData.map(item => [item.key, item.value]);
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      
      // Định dạng cột
      sheet.setColumnWidth(1, 300); // Cột Key
      sheet.setColumnWidth(2, 500); // Cột Value
      
      // Wrap text cho cột Value
      sheet.getRange(2, 2, rows.length, 1).setWrap(true);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Đã lưu dữ liệu ${symbol} thành công`,
      rowCount: rows.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Chuyển đổi object lồng nhau thành mảng key-value phẳng
 * @param {object} obj - Object cần chuyển đổi
 * @param {string} prefix - Prefix cho key (dùng cho đệ quy)
 * @returns {Array} Mảng các object {key, value}
 */
function flattenObject(obj, prefix = '') {
  const result = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value === null || value === undefined) {
        result.push({ key: fullKey, value: 'null' });
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Đệ quy cho object lồng nhau
        result.push(...flattenObject(value, fullKey));
      } else if (Array.isArray(value)) {
        // Xử lý mảng
        if (value.length === 0) {
          result.push({ key: fullKey, value: '[]' });
        } else {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              result.push(...flattenObject(item, `${fullKey}[${index}]`));
            } else {
              result.push({ key: `${fullKey}[${index}]`, value: String(item) });
            }
          });
        }
      } else {
        // Giá trị đơn giản
        result.push({ key: fullKey, value: String(value) });
      }
    }
  }
  
  return result;
}

/**
 * Lưu dữ liệu giá cổ phiếu vào Google Sheets
 * @param {string} sheetId - ID của Google Sheets
 * @param {string} symbol - Mã cổ phiếu
 * @param {object} ohlcData - Dữ liệu OHLC từ DNSE API
 */
function savePriceData(sheetId, symbol, ohlcData) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheetName = symbol + '_Price';
    
    // Tạo hoặc lấy sheet với tên là {SYMBOL}_Price
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      // Tạo sheet mới nếu chưa tồn tại
      sheet = spreadsheet.insertSheet(sheetName);
      
      // Thêm header
      sheet.getRange(1, 1).setValue('Time');
      sheet.getRange(1, 2).setValue('Open');
      sheet.getRange(1, 3).setValue('Lowest');
      sheet.getRange(1, 4).setValue('Highest');
      sheet.getRange(1, 5).setValue('Close');
      sheet.getRange(1, 6).setValue('Volume');
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
      sheet.getRange(1, 1, 1, 6).setBackground('#4285f4');
      sheet.getRange(1, 1, 1, 6).setFontColor('#ffffff');
    } else {
      // Xóa dữ liệu cũ (giữ lại header)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
      }
    }
    
    // Chuyển đổi dữ liệu OHLC thành mảng rows
    const rows = [];
    const timestamps = ohlcData.t || [];
    const opens = ohlcData.o || [];
    const lows = ohlcData.l || [];
    const highs = ohlcData.h || [];
    const closes = ohlcData.c || [];
    const volumes = ohlcData.v || [];
    
    for (let i = 0; i < timestamps.length; i++) {
      // Chuyển timestamp (seconds) thành Date
      const date = new Date(timestamps[i] * 1000);
      const dateStr = formatDateVN(date); // dd/mm/yyyy
      
      // Format số với dấu chấm phân cách hàng nghìn và dấu phẩy cho phần thập phân
      const openStr = formatNumberVN(opens[i] || 0);
      const lowStr = formatNumberVN(lows[i] || 0);
      const highStr = formatNumberVN(highs[i] || 0);
      const closeStr = formatNumberVN(closes[i] || 0);
      const volumeStr = formatNumberVN(volumes[i] || 0);
      
      rows.push([dateStr, openStr, lowStr, highStr, closeStr, volumeStr]);
    }
    
    // Ghi dữ liệu vào sheet
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 6).setValues(rows);
      
      // Định dạng cột
      sheet.setColumnWidth(1, 120); // Time
      sheet.setColumnWidth(2, 120); // Open
      sheet.setColumnWidth(3, 120); // Lowest
      sheet.setColumnWidth(4, 120); // Highest
      sheet.setColumnWidth(5, 120); // Close
      sheet.setColumnWidth(6, 150); // Volume
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Đã lưu dữ liệu giá ${symbol} thành công`,
      rowCount: rows.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Format date to Vietnamese format dd/mm/yyyy
 */
function formatDateVN(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format number to Vietnamese format with dot as thousand separator and comma as decimal separator
 * Example: 23000.10 -> "23.000,10"
 */
function formatNumberVN(number) {
  if (number === null || number === undefined || isNaN(number)) {
    return '0';
  }
  
  // Split into integer and decimal parts
  const parts = number.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Add dot as thousand separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Combine with comma as decimal separator
  if (decimalPart) {
    return formattedInteger + ',' + decimalPart;
  }
  
  return formattedInteger;
}

/**
 * Test function - Có thể chạy để test
 */
function testSaveStockData() {
  const testData = {
    pageProps: {
      symbol: 'TCX',
      companyInfo: {
        symbol: 'TCX',
        name: 'Test Company'
      }
    }
  };
  
  const result = saveStockData(SHEET_ID, 'TCX', testData);
  Logger.log(result.getContent());
}

/**
 * Get basic info of a stock from sheet {SYMBOL}
 * @param {string} sheetId - ID của Google Sheets
 * @param {string} symbol - Mã cổ phiếu
 */
function getStockBasicInfo(sheetId, symbol) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(symbol);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `Sheet ${symbol} không tồn tại`,
        data: null
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data from sheet (Key-Value format)
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: {},
        symbol: symbol
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get data range (A2:B for Key-Value pairs)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
    const values = dataRange.getValues();
    
    // Convert to object
    const basicInfo = {};
    values.forEach(row => {
      const key = row[0];
      const value = row[1];
      if (key) {
        basicInfo[key] = value;
      }
    });
    
    // Extract important fields
    const extractedInfo = {
      symbol: symbol,
      companyName: basicInfo['pageProps.companyInfo.name'] || basicInfo['pageProps.companyInfo.fullName'] || '',
      exchange: basicInfo['pageProps.companyInfo.exchange'] || '',
      matchPrice: basicInfo['pageProps.priceSnapshot.matchPrice'] || '',
      changedValue: basicInfo['pageProps.priceSnapshot.changedValue'] || '',
      changedRatio: basicInfo['pageProps.priceSnapshot.changedRatio'] || '',
      totalVolume: basicInfo['pageProps.priceSnapshot.totalVolumeTraded'] || '',
      marketCap: basicInfo['pageProps.companyInfo.capital'] || '',
      beta: basicInfo['pageProps.companyInfo.beta'] || '',
      eps: basicInfo['pageProps.financialIndicators.indexes.eps.value'] || '',
      pe: basicInfo['pageProps.financialIndicators.indexes.pe.value'] || '',
      pb: basicInfo['pageProps.financialIndicators.indexes.pb.value'] || '',
      roe: basicInfo['pageProps.financialIndicators.indexes.roe.value'] || '',
      roa: basicInfo['pageProps.financialIndicators.indexes.roa.value'] || '',
      // Full data for reference
      fullData: basicInfo
    };
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: extractedInfo,
      symbol: symbol
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      data: null
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get basic info of all stocks
 * @param {string} sheetId - ID của Google Sheets
 */
function getAllStocksBasicInfo(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheets = spreadsheet.getSheets();
    const allStocksInfo = [];
    
    // Get all sheets that are stock symbols (not _Price sheets)
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      // Skip _Price sheets and default sheets
      if (!sheetName.includes('_Price') && sheetName !== 'Sheet1') {
        try {
          const lastRow = sheet.getLastRow();
          if (lastRow > 1) {
            const dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
            const values = dataRange.getValues();
            
            const basicInfo = {};
            values.forEach(row => {
              const key = row[0];
              const value = row[1];
              if (key) {
                basicInfo[key] = value;
              }
            });
            
            // Extract important fields
            const extractedInfo = {
              symbol: sheetName,
              companyName: basicInfo['pageProps.companyInfo.name'] || basicInfo['pageProps.companyInfo.fullName'] || '',
              exchange: basicInfo['pageProps.companyInfo.exchange'] || '',
              matchPrice: basicInfo['pageProps.priceSnapshot.matchPrice'] || '',
              changedValue: basicInfo['pageProps.priceSnapshot.changedValue'] || '',
              changedRatio: basicInfo['pageProps.priceSnapshot.changedRatio'] || '',
              totalVolume: basicInfo['pageProps.priceSnapshot.totalVolumeTraded'] || ''
            };
            
            allStocksInfo.push(extractedInfo);
          }
        } catch (e) {
          // Skip sheets that can't be read
          Logger.log('Error reading sheet ' + sheetName + ': ' + e.toString());
        }
      }
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: allStocksInfo,
      count: allStocksInfo.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      data: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function for price data
 */
function testSavePriceData() {
  const testOHLCData = {
    t: [1761012000, 1761098400],
    o: [49.8, 49],
    h: [51, 49],
    l: [48.45, 47.3],
    c: [48.95, 48.05],
    v: [14668000, 5853000]
  };
  
  const result = savePriceData(SHEET_ID, 'TCX', testOHLCData);
  Logger.log(result.getContent());
}
```

## Lưu ý

- Script sẽ tạo một tab mới cho mỗi mã cổ phiếu
- Dữ liệu được lưu dưới dạng key-value để dễ đọc
- Nếu tab đã tồn tại, dữ liệu cũ sẽ bị ghi đè
- Cần cấp quyền truy cập Google Sheets cho script

