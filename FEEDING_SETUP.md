# Feeding Log – Hướng dẫn cấu hình Google Sheets

Tài liệu này hướng dẫn cách chuẩn bị tab **`Feeding`** trong Google Sheets và mở rộng **Google Apps Script** hiện có để app ở route `/feeding?user=<tên>` có thể đồng bộ cữ bú hai chiều (đọc + ghi).

> Yêu cầu: bạn đã setup expense app (xem `GOOGLE_APPS_SCRIPT_SETUP.md`). Feeding tái sử dụng chung Sheet và chung Apps Script deployment.

---

## 1. Chuẩn bị tab `Feeding` trong Google Sheets

1. Mở Google Sheet: https://docs.google.com/spreadsheets/d/1nlLxaRCSePOddntUeNsMBKx2qP6kGSNLsZwtyqSbb88/edit
2. Tạo (hoặc chọn) tab có tên **chính xác** là `Feeding`.
3. Dòng 1 để làm **header** theo đúng thứ tự sau (phân biệt hoa/thường không quan trọng, miễn là đúng cột):

| A        | B                  | C            | D                | E        |
| -------- | ------------------ | ------------ | ---------------- | -------- |
| **User** | **Ngày**           | **Giờ**      | **Dung tích (ml)** | **Ghi chú** |
| quyen    | 07/04/2026         | 16:20        | 50               | bú mẹ    |

Quy ước dữ liệu:

- **User**: cùng giá trị với query param `?user=...` (VD: `quyen`, `phat`). App sẽ lọc cữ bú theo user → nhiều người có thể dùng chung sheet.
- **Ngày**: định dạng `DD/MM/YYYY` (VD `07/04/2026`). Apps Script sẽ ghi thành text có format kiểu này.
- **Giờ**: `HH:mm` 24h (VD `16:20`).
- **Dung tích**: số nguyên (VD `50`). App chấp nhận `50` hoặc `50ml` khi đọc.
- **Ghi chú**: tuỳ chọn.

> 💡 Bạn có thể set format cho cột B (Ngày) thành **Plain text** để tránh Google Sheets tự "đoán" thành số serial.

---

## 2. Cấp quyền đọc public (cho API Key)

App dùng **Google Sheets API v4 + API Key** để đọc dữ liệu (nhanh, không cần OAuth). API key chỉ đọc được sheet khi sheet cho phép "Bất kỳ ai có link" xem:

1. Góc phải trên Sheet → **Share / Chia sẻ**
2. Dưới mục **Truy cập chung**, chọn **Bất kỳ ai có đường liên kết** với quyền **Người xem (Viewer)**.

> Nếu bạn muốn sheet private hoàn toàn, cần đổi sang OAuth (hiện app chưa hỗ trợ cho tab Feeding).

---

## 3. Mở rộng Google Apps Script

Mở file Apps Script đã dùng cho expense (**Extensions → Apps Script** từ Sheet) và **thêm 3 action mới** vào hàm `doPost`, cùng 1 hàm phụ cho `deleteFeeding`.

Dưới đây là **bản gộp đầy đủ** – bạn có thể giữ nguyên phần xử lý expense cũ và chèn thêm các nhánh `addFeeding` / `deleteFeeding` (và `getFeedings` nếu muốn qua POST, không bắt buộc vì app đọc trực tiếp bằng API key).

```javascript
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'add';

    // ===== FEEDING: Thêm cữ bú =====
    if (action === 'addFeeding') {
      const sheet = ss.getSheetByName('Feeding');
      if (!sheet) throw new Error('Không tìm thấy tab "Feeding" trong Sheet');

      const log = data.log || {};
      const user = String(log.user || '').toLowerCase().trim();
      const dateIso = String(log.date || '').trim(); // YYYY-MM-DD
      const time = String(log.time || '').trim();    // HH:mm
      const volume = parseInt(log.volume, 10) || 0;
      const note = String(log.note || '').trim();

      if (!user || !dateIso || !time || volume <= 0) {
        throw new Error('Thiếu trường bắt buộc (user, date, time, volume).');
      }

      // Format ngày YYYY-MM-DD -> DD/MM/YYYY
      const [y, mo, d] = dateIso.split('-');
      const dateStr = d + '/' + mo + '/' + y;

      sheet.appendRow([user, dateStr, time, volume, note]);

      return _json({ success: true, message: 'Đã thêm cữ bú' });
    }

    // ===== FEEDING: Xoá cữ bú theo row =====
    if (action === 'deleteFeeding') {
      const sheet = ss.getSheetByName('Feeding');
      if (!sheet) throw new Error('Không tìm thấy tab "Feeding"');

      const row = parseInt(data.row, 10);
      if (!row || row < 2) throw new Error('Row không hợp lệ');

      sheet.deleteRow(row);
      return _json({ success: true, message: 'Đã xoá cữ bú' });
    }

    // ===== FEEDING: Lấy toàn bộ log (tuỳ chọn) =====
    if (action === 'getFeedings') {
      const sheet = ss.getSheetByName('Feeding');
      if (!sheet) throw new Error('Không tìm thấy tab "Feeding"');

      const values = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 5).getValues();
      const user = String(data.user || '').toLowerCase().trim();

      const logs = values
        .filter(r => r[0] && r[1] && r[3])
        .map((r, idx) => ({
          user: String(r[0]).toLowerCase().trim(),
          date: _fmtDate(r[1]),
          time: _fmtTime(r[2]),
          volume: parseInt(String(r[3]).replace(/[^\d]/g, ''), 10) || 0,
          note: String(r[4] || '').trim(),
          rowIndex: idx + 2
        }))
        .filter(l => !user || l.user === user);

      return _json({ success: true, logs: logs });
    }

    // ===== ↓↓↓ Giữ nguyên các action expense cũ của bạn ở đây ↓↓↓ =====
    // VD:
    // if (action === 'add') { ... }
    // if (action === 'edit') { ... }
    // if (action === 'saveBudgets') { ... }
    // ...

    throw new Error('Action không được hỗ trợ: ' + action);

  } catch (error) {
    return _json({ success: false, error: error.toString() });
  }
}

// Helper: trả về JSON response
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper: chuẩn hoá ngày về DD/MM/YYYY
function _fmtDate(val) {
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    // App ở client sẽ tự parse DD/MM/YYYY
    return d + '/' + m + '/' + y;
  }
  return String(val || '').trim();
}

// Helper: chuẩn hoá giờ về HH:mm
function _fmtTime(val) {
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0');
    const m = String(val.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }
  return String(val || '').trim();
}
```

---

## 4. Re-deploy Apps Script

Sau khi paste code mới:

1. **Save** (Ctrl/Cmd + S).
2. Click **Deploy** → **Manage deployments**.
3. Chọn deployment hiện có, bấm biểu tượng cây bút (✏️ Edit).
4. Ở phần **Version**, chọn **New version**, thêm mô tả (VD: "Add feeding log actions"), rồi **Deploy**.
5. URL deployment **không đổi**, tức là biến môi trường `NG_APP_GOOGLE_APPS_SCRIPT_URL` và proxy `proxy.conf.json` **không cần update**.

> Nếu bạn tạo deployment mới (URL khác), cập nhật:
> - `.env.local`: `NG_APP_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/<NEW_ID>/exec`
> - `proxy.conf.json` → entry `/api/google-apps-script` → `pathRewrite` đổi `<OLD_ID>` thành `<NEW_ID>`.

---

## 5. Cấu hình biến môi trường

App tái dùng `environment.googleAppsScriptUrl` và `environment.googleSheetsApiKey`:

```env
# .env.local (development) – đã có sẵn nếu expense app chạy được
NG_APP_GOOGLE_SHEETS_API_KEY=your_api_key
NG_APP_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxx/exec
```

Trong môi trường dev, request `POST` đi qua proxy `/api/google-apps-script` (định nghĩa sẵn trong `proxy.conf.json`) để né CORS.

---

## 6. Kiểm tra nhanh

1. `npm run dev` → vào `http://localhost:3006/feeding?user=quyen`.
2. Thêm profile bé (tên + ngày sinh) nếu chưa có.
3. Ở section **"Nhật ký cữ bú"**:
   - Ngày/giờ sẽ **tự auto-fill theo hiện tại** – có nút `Đặt về bây giờ` nếu muốn reset.
   - Nhập dung tích (hoặc bấm chip nhanh: 30/50/70/90/120 ml).
   - Nhấn **"Lưu cữ bú"**.
4. Mở Sheet tab `Feeding` → sẽ thấy 1 dòng mới được thêm với đúng `user=quyen`.
5. Quay lại app, các khối **Hôm nay / Hôm qua** sẽ cập nhật tổng ml, số cữ, trung bình, cao nhất và so sánh chênh lệch (±ml và %).
6. Nút 🗑 bên cạnh mỗi cữ để **xoá** – sẽ xoá đúng row trên Sheet.

---

## 7. Troubleshooting

| Triệu chứng                                                               | Nguyên nhân & cách xử lý                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Không tải được dữ liệu từ Google Sheet`                                  | Tab `Feeding` chưa tồn tại, hoặc Sheet chưa share "Anyone with the link (Viewer)", hoặc `API_KEY` sai.                                            |
| `Không thể lưu cữ bú lên Google Sheet` (400/500 sau khi nhấn "Lưu cữ bú") | Chưa re-deploy Apps Script sau khi paste code mới; hoặc Apps Script không có nhánh `addFeeding`. Mở Apps Script → **Executions** xem log chi tiết. |
| `403 Forbidden` khi POST                                                  | Ở deploy settings, **Who has access** phải là **Anyone** (không phải "Anyone with Google account").                                                |
| Ngày bị lệch / hiển thị sai                                               | Cột B (Ngày) trong Sheet đang bị Google format thành số/ngày khác. Chọn cột B → Format → Number → **Plain text** rồi chạy lại.                      |
| Nhiều user dùng chung sheet bị trộn                                       | Kiểm tra cột A (`User`). App lọc theo `?user=<tên>` viết thường, đảm bảo data trong sheet cũng lowercase.                                          |

---

## 8. Sơ đồ luồng dữ liệu

```
[Browser /feeding?user=quyen]
        │
        │  GET (read)
        ├───────────────► Google Sheets API v4 (API Key)
        │                 → tab Feeding, range A2:E
        │
        │  POST {action:'addFeeding'|'deleteFeeding', ...}
        └───────────────► Proxy /api/google-apps-script
                          → Google Apps Script Web App (doPost)
                          → append/deleteRow trên tab Feeding
```

Nhỏ gọn, cùng Sheet với expense app, không phải deploy thêm script.
