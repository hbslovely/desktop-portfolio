# Google Apps Script cho Business Management App

## Sheet ID
Sheet ID: `1EHt1u4Ap8TfIwcH17OmdnlmXidnBHOb1wjuHA_ukB5g`

## Các Tab cần quản lý
1. **Menu** - Quản lý menu sản phẩm
2. **Nguồn nguyên liệu** - Quản lý nguyên liệu
3. **Nguồn vật liệu** - Quản lý vật liệu
4. **Chi phí đầu vào đầu ra** - Quản lý chi phí

## Google Apps Script Code

### Bước 1: Tạo Google Apps Script

1. Mở Google Sheets: https://docs.google.com/spreadsheets/d/1EHt1u4Ap8TfIwcH17OmdnlmXidnBHOb1wjuHA_ukB5g/edit
2. Vào **Extensions** → **Apps Script**
3. Xóa code mặc định và paste code sau:

```javascript
// Sheet ID
const SHEET_ID = '1EHt1u4Ap8TfIwcH17OmdnlmXidnBHOb1wjuHA_ukB5g';

// Get spreadsheet
function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// Get sheet by name
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

// Format number to Vietnamese format
function formatAmount(amount) {
  return amount.toLocaleString('vi-VN') + ' đ';
}

// Parse Vietnamese amount to number
function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const cleaned = amountStr.toString().replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Format date to Vietnamese format
function formatDate(date) {
  if (!date) return '';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = dayNames[dateObj.getDay()];
  
  return `${dayName}, ${day}/${month}/${year}`;
}

// Main POST handler
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const sheetName = data.sheetName;
    
    if (!sheetName) {
      return createErrorResponse('Sheet name is required');
    }
    
    switch (action) {
      case 'get':
        return getData(sheetName, data);
      case 'add':
        return addData(sheetName, data);
      case 'update':
        return updateData(sheetName, data);
      case 'delete':
        return deleteData(sheetName, data);
      default:
        return createErrorResponse('Invalid action');
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// GET handler (for read operations)
function doGet(e) {
  try {
    const sheetName = e.parameter.sheetName;
    const action = e.parameter.action || 'get';
    
    if (!sheetName) {
      return createErrorResponse('Sheet name is required');
    }
    
    if (action === 'get') {
      return getData(sheetName, e.parameter);
    }
    
    return createErrorResponse('Invalid action');
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// Get data from sheet
function getData(sheetName, params) {
  const sheet = getSheet(sheetName);
  if (!sheet) {
    return createErrorResponse(`Sheet "${sheetName}" not found`);
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return createSuccessResponse({ data: [] });
  }
  
  // Determine range based on sheet name
  let numCols;
  if (sheetName === 'Đầu vào đầu ra') {
    numCols = 5; // A-E
  } else if (sheetName === 'Nguồn vật liệu') {
    numCols = 4; // A-D
  } else if (sheetName === 'Nguồn nguyên liệu') {
    numCols = 9; // A-I
  } else if (sheetName === 'Menu') {
    numCols = 5; // A-E
  } else {
    numCols = sheet.getLastColumn();
  }
  
  // Get all data starting from row 2 (row 1 is header)
  const range = sheet.getRange(2, 1, lastRow - 1, numCols);
  const values = range.getValues();
  
  // Map to objects based on sheet structure
  const data = values.map((row, index) => {
    const baseItem = { rowIndex: index + 2 };
    
    if (sheetName === 'Đầu vào đầu ra') {
      // A=Tên chi phí, B=Chi phí, C=Tổng, D=Phân loại, E=Sàn
      return {
        ...baseItem,
        tenChiPhi: row[0] || '',
        soTien: row[1] || '',
        tongChiPhi: row[2] || '',
        phanLoai: row[3] || '',
        san: row[4] || ''
      };
    } else if (sheetName === 'Nguồn vật liệu') {
      // A=Món hàng, B=Giá tiền, C=Khối lượng, D=Thương hiệu
      return {
        ...baseItem,
        monHang: row[0] || '',
        giaTien: row[1] || '',
        khoiLuong: row[2] || '',
        thuongHieu: row[3] || ''
      };
    } else if (sheetName === 'Nguồn nguyên liệu') {
      // A=STT, B=Món hàng, C=Giá gốc, D=Đơn vị, E=Thương hiệu, F=Số lượng viên
      // G=Giá cốt (tính), H=Giá bán đề xuất (tính), I=Giá bán lẻ đề xuất (tính)
      const giaGoc = parseFloat(row[2]) || 0;
      const soLuongVien = parseFloat(row[5]) || 1;
      const giaCot = soLuongVien > 0 ? giaGoc / soLuongVien : 0;
      
      return {
        ...baseItem,
        soThuTu: row[0] || '',
        monHangNguyenLieu: row[1] || '',
        giaGoc: row[2] || '',
        donViTinh: row[3] || '',
        thuongHieuNguyenLieu: row[4] || '',
        soLuongVien: row[5] || '',
        giaCot: row[6] || formatAmount(giaCot),
        giaBanDeXuat: row[7] || formatAmount(giaCot * 2.01),
        giaBanLeDeXuat: row[8] || formatAmount(giaCot * 1.4)
      };
    } else if (sheetName === 'Menu') {
      // A=Tên món, B=Mô tả, C=Danh mục, D=Giá bán, E=Cách chế biến
      return {
        ...baseItem,
        tenMon: row[0] || '',
        moTa: row[1] || '',
        danhMuc: row[2] || '',
        giaBan: row[3] || '',
        cachCheBien: row[4] || ''
      };
    } else {
      // Fallback for unknown sheets
      return {
        ...baseItem,
        tenChiPhi: row[0] || '',
        soTien: row[1] || '',
        tongChiPhi: row[2] || '',
        phanLoai: row[3] || '',
        san: row[4] || ''
      };
    }
  }).filter(item => {
    // Filter out empty rows based on first field
    if (sheetName === 'Đầu vào đầu ra') return item.tenChiPhi;
    if (sheetName === 'Nguồn vật liệu') return item.monHang;
    if (sheetName === 'Nguồn nguyên liệu') return item.monHangNguyenLieu;
    if (sheetName === 'Menu') return item.tenMon;
    return item.tenChiPhi;
  });
  
  return createSuccessResponse({ data: data });
}

// Add data to sheet
function addData(sheetName, data) {
  const sheet = getSheet(sheetName);
  if (!sheet) {
    return createErrorResponse(`Sheet "${sheetName}" not found`);
  }
  
  const item = data.item;
  if (!item) {
    return createErrorResponse('Item data is required');
  }
  
  // Prepare row data based on sheet structure
  let row = [];
  
  if (sheetName === 'Đầu vào đầu ra') {
    row = [
      item.tenChiPhi || '',
      item.soTien || '',
      item.tongChiPhi || '',
      item.phanLoai || '',
      item.san || ''
    ];
  } else if (sheetName === 'Nguồn vật liệu') {
    row = [
      item.monHang || '',
      item.giaTien || '',
      item.khoiLuong || '',
      item.thuongHieu || ''
    ];
  } else if (sheetName === 'Nguồn nguyên liệu') {
    // Calculate derived values
    const giaGoc = parseFloat(item.giaGoc) || 0;
    const soLuongVien = parseFloat(item.soLuongVien) || 1;
    const giaCot = soLuongVien > 0 ? giaGoc / soLuongVien : 0;
    
    row = [
      item.soThuTu || '',
      item.monHangNguyenLieu || '',
      item.giaGoc || '',
      item.donViTinh || '',
      item.thuongHieuNguyenLieu || '',
      item.soLuongVien || '',
      formatAmount(giaCot),
      formatAmount(giaCot * 2.01),
      formatAmount(giaCot * 1.4)
    ];
  } else if (sheetName === 'Menu') {
    row = [
      item.tenMon || '',
      item.moTa || '',
      item.danhMuc || '',
      item.giaBan || '',
      item.cachCheBien || ''
    ];
  } else {
    // Fallback
    row = [
      item.tenChiPhi || '',
      item.soTien || '',
      item.tongChiPhi || '',
      item.phanLoai || '',
      item.san || ''
    ];
  }
  
  sheet.appendRow(row);
  
  return createSuccessResponse({ 
    message: 'Data added successfully',
    rowIndex: sheet.getLastRow()
  });
}

// Update data in sheet
function updateData(sheetName, data) {
  const sheet = getSheet(sheetName);
  if (!sheet) {
    return createErrorResponse(`Sheet "${sheetName}" not found`);
  }
  
  const item = data.item;
  const rowIndex = data.rowIndex;
  
  if (!item || !rowIndex) {
    return createErrorResponse('Item data and rowIndex are required');
  }
  
  // Prepare row data based on sheet structure
  let row = [];
  
  if (sheetName === 'Đầu vào đầu ra') {
    row = [
      item.tenChiPhi || '',
      item.soTien || '',
      item.tongChiPhi || '',
      item.phanLoai || '',
      item.san || ''
    ];
  } else if (sheetName === 'Nguồn vật liệu') {
    row = [
      item.monHang || '',
      item.giaTien || '',
      item.khoiLuong || '',
      item.thuongHieu || ''
    ];
  } else if (sheetName === 'Nguồn nguyên liệu') {
    // Calculate derived values
    const giaGoc = parseFloat(item.giaGoc) || 0;
    const soLuongVien = parseFloat(item.soLuongVien) || 1;
    const giaCot = soLuongVien > 0 ? giaGoc / soLuongVien : 0;
    
    row = [
      item.soThuTu || '',
      item.monHangNguyenLieu || '',
      item.giaGoc || '',
      item.donViTinh || '',
      item.thuongHieuNguyenLieu || '',
      item.soLuongVien || '',
      formatAmount(giaCot),
      formatAmount(giaCot * 2.01),
      formatAmount(giaCot * 1.4)
    ];
  } else if (sheetName === 'Menu') {
    row = [
      item.tenMon || '',
      item.moTa || '',
      item.danhMuc || '',
      item.giaBan || '',
      item.cachCheBien || ''
    ];
  } else {
    // Fallback
    row = [
      item.tenChiPhi || '',
      item.soTien || '',
      item.tongChiPhi || '',
      item.phanLoai || '',
      item.san || ''
    ];
  }
  
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  
  return createSuccessResponse({ 
    message: 'Data updated successfully'
  });
}

// Delete data from sheet
function deleteData(sheetName, data) {
  const sheet = getSheet(sheetName);
  if (!sheet) {
    return createErrorResponse(`Sheet "${sheetName}" not found`);
  }
  
  const rowIndex = data.rowIndex;
  if (!rowIndex) {
    return createErrorResponse('rowIndex is required');
  }
  
  sheet.deleteRow(rowIndex);
  
  return createSuccessResponse({ 
    message: 'Data deleted successfully'
  });
}

// Create success response
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    ...data
  })).setMimeType(ContentService.MimeType.JSON);
}

// Create error response
function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: message
  })).setMimeType(ContentService.MimeType.JSON);
}
```

### Bước 2: Deploy Web App

1. Click **Deploy** → **New deployment**
2. Chọn type: **Web app**
3. Settings:
   - **Description**: Business Management API
   - **Execute as**: **Me**
   - **Who has access**: **Anyone** (hoặc **Anyone with Google account**)
4. Click **Deploy**
5. **Copy Web App URL** (sẽ có dạng: `https://script.google.com/macros/s/.../exec`)

### Bước 3: Lưu Web App URL

Lưu URL này để cấu hình trong Angular app sau.

## Cấu trúc dữ liệu

### Menu
- Tên (A)
- Chi Phí (B)
- Tổng (C)
- Phân loại (D)
- Sàn (E)

### Nguồn nguyên liệu
- Tên (A)
- Chi Phí (B)
- Tổng (C)
- Phân loại (D)
- Sàn (E)

### Nguồn vật liệu
- Tên (A)
- Chi Phí (B)
- Tổng (C)
- Phân loại (D)
- Sàn (E)

### Chi phí đầu vào đầu ra
- Tên (A)
- Chi Phí (B)
- Tổng (C)
- Phân loại (D)
- Sàn (E)

