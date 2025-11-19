# Google Apps Script Setup cho Expense App

## Vấn đề
Google Sheets API không cho phép ghi dữ liệu bằng API Key. Cần OAuth2 hoặc Google Apps Script.

## Giải pháp: Sử dụng Google Apps Script

### Bước 1: Tạo Google Apps Script

1. Mở Google Sheets: https://docs.google.com/spreadsheets/d/1nlLxaRCSePOddntUeNsMBKx2qP6kGSNLsZwtyqSbb88/edit
2. Vào **Extensions** → **Apps Script**
3. Xóa code mặc định và paste code sau:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Chi tiêu');
    const data = JSON.parse(e.postData.contents);
    const expense = data.expense;
    
    // Format date: "Thứ Bảy, 01/11/2025"
    const date = new Date(expense.date);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${dayName}, ${day}/${month}/${year}`;
    
    // Format amount: "1.906.228 đ"
    const amountStr = `${expense.amount.toLocaleString('vi-VN')} đ`;
    
    // Add row: A=date, B=content, C=empty, D=amount, E=category
    sheet.appendRow([dateStr, expense.content, '', amountStr, expense.category]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true,
      message: 'Expense added successfully'
    }))
    .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false,
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

// Note: Read operations use Google Sheets API with API Key directly
// This script is only for write operations (POST requests)
```

### Bước 2: Deploy Web App

1. Click **Deploy** → **New deployment**
2. Chọn type: **Web app**
3. Settings:
   - **Description**: Expense App API
   - **Execute as**: **Me**
   - **Who has access**: **Anyone** (hoặc **Anyone with Google account** nếu muốn bảo mật hơn)
4. Click **Deploy**
5. **Copy Web App URL** (sẽ có dạng: `https://script.google.com/macros/s/.../exec`)

### Bước 3: Cập nhật Code

1. Mở file `src/app/services/expense.service.ts`
2. Tìm dòng: `private readonly APPS_SCRIPT_URL = '';`
3. Thay bằng URL vừa copy:
   ```typescript
   private readonly APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
   ```

### Bước 4: Test

1. Chạy app và thử thêm một chi tiêu mới
2. Kiểm tra Google Sheets xem dữ liệu đã được thêm chưa

## Lưu ý

- Nếu chọn "Anyone with Google account", người dùng cần đăng nhập Google để thêm chi tiêu
- Nếu chọn "Anyone", bất kỳ ai có URL đều có thể thêm dữ liệu (ít bảo mật hơn nhưng dễ sử dụng hơn)
- Script sẽ tự động format ngày và số tiền theo định dạng Việt Nam

