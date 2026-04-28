# Feeding Log – Hướng dẫn cấu hình Google Sheets

Tài liệu hướng dẫn cách chuẩn bị **tab `Feeding`** trong Google Sheet **mới** và setup **Google Apps Script** riêng (tách khỏi expense) để app `/feeding?user=<tên>` đồng bộ cữ bú hai chiều: **đọc / thêm / sửa / xoá**.

> Sheet mới: <https://docs.google.com/spreadsheets/d/1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM/edit?gid=0#gid=0>
>
> Sheet ID: `1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM`

---

## 1. Chuẩn bị tab `Feeding` trong Google Sheets

1. Mở Sheet mới ở link trên.
2. Tạo (hoặc đổi tên) tab thành **chính xác** `Feeding`.
3. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B                  | C            | D                  | E           |
| -------- | ------------------ | ------------ | ------------------ | ----------- |
| **User** | **Ngày**           | **Giờ**      | **Dung tích (ml)** | **Ghi chú** |
| quyen    | 07/04/2026         | 16:20        | 50                 | bú mẹ       |

Quy ước dữ liệu:

- **User**: cùng giá trị với query param `?user=...` (VD: `quyen`, `phat`).
- **Ngày**: định dạng `DD/MM/YYYY`. Để format cột B là **Plain text** (Format → Number → Plain text) để Google Sheets không tự "đoán" thành số serial.
- **Giờ**: `HH:mm` 24h.
- **Dung tích**: số nguyên (`50` hoặc `50ml` đều đọc được).
- **Ghi chú**: tuỳ chọn.

---

## 2. Cấp quyền đọc public (cho API Key)

App đọc dữ liệu bằng **Sheets API v4 + API Key** → cần share sheet ở chế độ public-readable:

1. Bấm **Share / Chia sẻ** ở góc phải trên Sheet.
2. Mục **Truy cập chung** → chọn **Bất kỳ ai có đường liên kết** với quyền **Người xem (Viewer)**.

---

## 3. Tạo Apps Script bound vào Sheet mới

Vì sheet mới khác sheet expense, ta cần một Apps Script **mới**, bound vào chính sheet này.

1. Trong Sheet mới → **Extensions → Apps Script**.
2. Xoá toàn bộ code mặc định trong file `Code.gs`.
3. Paste **toàn bộ** code dưới đây vào:

```javascript
/**
 * Feeding Log – Google Apps Script
 * Bound vào sheet 1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM, tab `Feeding`.
 *
 * Hỗ trợ 4 action qua POST JSON:
 *  - addFeeding     → append cữ mới
 *  - updateFeeding  → cập nhật giờ / dung tích / note (KHÔNG đổi date)
 *  - deleteFeeding  → xoá row
 *  - getFeedings    → trả về toàn bộ logs (tuỳ chọn, app đang dùng API key đọc trực tiếp)
 *
 * Layout cột:
 *   A=User  B=Ngày(DD/MM/YYYY)  C=Giờ(HH:mm)  D=Dung tích(ml)  E=Ghi chú
 *
 * Dòng 1 là header → dữ liệu bắt đầu từ row 2.
 */

const SHEET_NAME = 'Feeding';

// ===== Column indices (1-based, dùng cho getRange) =====
const COL_USER   = 1;
const COL_DATE   = 2;
const COL_TIME   = 3;
const COL_VOLUME = 4;
const COL_NOTE   = 5;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';

    switch (action) {
      case 'addFeeding':    return _json(handleAdd(body));
      case 'updateFeeding': return _json(handleUpdate(body));
      case 'deleteFeeding': return _json(handleDelete(body));
      case 'getFeedings':   return _json(handleGet(body));
      default:
        throw new Error('Action không được hỗ trợ: ' + action);
    }
  } catch (err) {
    return _json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

/**
 * GET endpoint phụ: cho phép gọi `?action=getFeedings&user=quyen` qua trình
 * duyệt để debug, không bắt buộc cho app vận hành.
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'getFeedings';

    if (action !== 'getFeedings') {
      throw new Error('GET chỉ hỗ trợ action=getFeedings');
    }
    return _json(handleGet({ user: params.user || '' }));
  } catch (err) {
    return _json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

/* =========================
 * Handlers
 * ========================= */

function handleAdd(body) {
  const sheet = _getSheet();
  const log = body.log || {};
  const user = String(log.user || '').toLowerCase().trim();
  const dateIso = String(log.date || '').trim();   // YYYY-MM-DD
  const time = _normalizeTime(String(log.time || '').trim());
  const volume = parseInt(log.volume, 10) || 0;
  const note = String(log.note || '').trim();

  if (!user || !dateIso || !time || volume <= 0) {
    throw new Error('Thiếu trường bắt buộc (user, date, time, volume).');
  }

  const dateStr = _isoToDdMmYyyy(dateIso);
  if (!dateStr) throw new Error('Date không hợp lệ: ' + dateIso);

  sheet.appendRow([user, dateStr, time, volume, note]);

  return { success: true, message: 'Đã thêm cữ bú', rowIndex: sheet.getLastRow() };
}

/**
 * Cập nhật cữ bú. **CỐ Ý không cho đổi cột Ngày** – nghiệp vụ chỉ cho phép
 * chỉnh giờ / dung tích / ghi chú. Nếu cần đổi ngày thì xoá rồi thêm mới.
 */
function handleUpdate(body) {
  const sheet = _getSheet();
  const row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Row không hợp lệ');

  const lastRow = sheet.getLastRow();
  if (row > lastRow) throw new Error('Row vượt quá phạm vi sheet');

  const patch = body.patch || {};
  const time = _normalizeTime(String(patch.time || '').trim());
  const volume = parseInt(patch.volume, 10) || 0;
  const note = String(patch.note != null ? patch.note : '').trim();

  if (!time || volume <= 0) {
    throw new Error('Patch thiếu time hoặc volume');
  }

  // Chỉ ghi 3 cột Giờ / Dung tích / Ghi chú – tuyệt đối không đụng cột User & Ngày.
  sheet.getRange(row, COL_TIME).setValue(time);
  sheet.getRange(row, COL_VOLUME).setValue(volume);
  sheet.getRange(row, COL_NOTE).setValue(note);

  return { success: true, message: 'Đã cập nhật cữ bú', rowIndex: row };
}

function handleDelete(body) {
  const sheet = _getSheet();
  const row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Row không hợp lệ');

  const lastRow = sheet.getLastRow();
  if (row > lastRow) throw new Error('Row vượt quá phạm vi sheet');

  sheet.deleteRow(row);
  return { success: true, message: 'Đã xoá cữ bú' };
}

function handleGet(body) {
  const sheet = _getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, logs: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const userFilter = String((body && body.user) || '').toLowerCase().trim();

  const logs = values
    .map(function (r, idx) {
      const u = String(r[0] || '').toLowerCase().trim();
      const d = _fmtDate(r[1]);
      const t = _fmtTime(r[2]);
      const v = parseInt(String(r[3]).replace(/[^\d]/g, ''), 10) || 0;
      const n = String(r[4] || '').trim();
      if (!u || !d || v <= 0) return null;
      return { user: u, date: d, time: t, volume: v, note: n, rowIndex: idx + 2 };
    })
    .filter(function (l) { return l !== null; })
    .filter(function (l) { return !userFilter || l.user === userFilter; });

  return { success: true, logs: logs };
}

/* =========================
 * Helpers
 * ========================= */

function _getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Không tìm thấy tab "' + SHEET_NAME + '"');
  return sheet;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** "2026-04-07" → "07/04/2026". Trả null nếu không parse được. */
function _isoToDdMmYyyy(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = m[1];
  const mo = ('0' + m[2]).slice(-2);
  const d = ('0' + m[3]).slice(-2);
  return d + '/' + mo + '/' + y;
}

/** Chuẩn hoá ngày đọc từ sheet (Date object hoặc string) → "DD/MM/YYYY". */
function _fmtDate(val) {
  if (val instanceof Date) {
    const d = ('0' + val.getDate()).slice(-2);
    const m = ('0' + (val.getMonth() + 1)).slice(-2);
    const y = val.getFullYear();
    return d + '/' + m + '/' + y;
  }
  return String(val || '').trim();
}

/** Chuẩn hoá giờ đọc từ sheet (Date object hoặc string) → "HH:mm". */
function _fmtTime(val) {
  if (val instanceof Date) {
    const h = ('0' + val.getHours()).slice(-2);
    const m = ('0' + val.getMinutes()).slice(-2);
    return h + ':' + m;
  }
  return _normalizeTime(String(val || '').trim());
}

/** "9:5", "9h5", "09:05" → "09:05". */
function _normalizeTime(raw) {
  if (!raw) return '';
  const m = String(raw).match(/(\d{1,2})[:h](\d{1,2})/);
  if (!m) return raw;
  return ('0' + m[1]).slice(-2) + ':' + ('0' + m[2]).slice(-2);
}

/* =========================
 * Test helpers — chọn từng hàm trong dropdown rồi bấm ▶️ Run để test ngay
 * trong Apps Script editor (không phải gọi qua app).
 * ========================= */

/** Test thêm 1 cữ — chạy xong mở Sheet xem có row mới ở tab Feeding không. */
function testAdd() {
  const result = handleAdd({
    log: {
      user: 'quyen',
      date: '2026-04-28',
      time: '14:30',
      volume: 50,
      note: 'test từ Apps Script',
    },
  });
  Logger.log(JSON.stringify(result));
}

/** Test đọc toàn bộ logs. Xem kết quả ở View → Logs (Cmd/Ctrl + Enter). */
function testGet() {
  const result = handleGet({ user: '' });
  Logger.log(JSON.stringify(result));
}

/**
 * Test cập nhật. ĐỔI `row` thành row có thật trong sheet (≥ 2) trước khi chạy,
 * ví dụ row 2 = dòng dữ liệu đầu tiên dưới header.
 */
function testUpdate() {
  const result = handleUpdate({
    row: 2,
    patch: { time: '15:45', volume: 70, note: 'edit từ Apps Script' },
  });
  Logger.log(JSON.stringify(result));
}

/** Test xoá. CẢNH BÁO: xoá thật → đổi `row` cẩn thận. */
function testDelete() {
  const result = handleDelete({ row: 2 });
  Logger.log(JSON.stringify(result));
}
```

4. **Save** (Ctrl/Cmd + S), đặt tên project (VD: `Feeding Sheet API`).

---

## 4. Deploy Apps Script (Web App)

1. Bấm **Deploy → New deployment**.
2. Bánh răng (⚙️) bên cạnh "Select type" → chọn **Web app**.
3. Cấu hình:
   - **Description**: `Feeding API v1`
   - **Execute as**: **Me** (chính tài khoản của bạn).
   - **Who has access**: **Anyone** *(không phải "Anyone with Google account" – sẽ bị 403)*.
4. Bấm **Deploy** → cấp quyền cho script (Allow).
5. Copy **Web app URL** dạng:
   `https://script.google.com/macros/s/AKfycbXXXX...XXXX/exec`

> Sau này khi sửa code, dùng **Manage deployments → Edit (✏️) → New version → Deploy** để giữ nguyên URL. Nếu tạo deployment mới thì URL sẽ đổi và bạn phải cập nhật env + proxy.

---

## 5. Cấu hình biến môi trường

Trong file `.env.local` của project (gốc repo), thêm/sửa biến mới:

```env
# Sheet API key (đã dùng cho expense, dùng chung được)
NG_APP_GOOGLE_SHEETS_API_KEY=your_api_key

# Apps Script URL DÀNH RIÊNG cho feeding sheet
NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbXXXX...XXXX/exec
```

> `feeding-log.service.ts` ưu tiên `googleFeedingAppsScriptUrl` và **fallback sang `googleAppsScriptUrl`** nếu chưa cấu hình – tương thích với dự án cũ dùng chung 1 script.

---

## 6. Cấu hình proxy dev (chỉ cho `npm run dev`)

Mở `proxy.conf.json`, tìm entry `/api/feeding-apps-script` (đã được tạo sẵn) và thay placeholder bằng deployment ID thật:

```json
"/api/feeding-apps-script": {
  "target": "https://script.google.com",
  "secure": true,
  "changeOrigin": true,
  "logLevel": "debug",
  "pathRewrite": {
    "^/api/feeding-apps-script": "/macros/s/<PASTE_DEPLOYMENT_ID_HERE>/exec"
  },
  "headers": {
    "User-Agent": "Mozilla/5.0 ...",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json"
  }
}
```

Sau khi sửa, **restart** dev server (`npm run dev`).

---

## 7. Kiểm tra nhanh (smoke test)

1. `npm run dev` → vào `http://localhost:3006/feeding?user=quyen`.
2. Thêm profile bé nếu chưa có.
3. Bấm FAB **"Ghi cữ bú"** → nhập 50 ml → **Lưu** → mở Sheet xem dòng mới ở tab `Feeding`.
4. Trong list cữ bú gần đây, bấm icon ✏️ → đổi giờ / ml / note → **Lưu thay đổi**:
   - App gọi `updateFeeding` → script sửa đúng row trên sheet.
   - Cột **Ngày** **không thay đổi** (kiểm tra trong sheet).
5. Bấm 🗑 để xoá – row tương ứng biến mất khỏi sheet.

Test trực tiếp trên trình duyệt:

```text
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?action=getFeedings
```

Trả về JSON `{ success: true, logs: [...] }`.

---

## 8. Troubleshooting

| Triệu chứng                                            | Nguyên nhân & cách xử lý                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Script function not found: doPost`                    | Bạn đang bấm **▶️ Run** trong Apps Script editor để test → sai cách. `doPost` chỉ chạy khi có HTTP POST tới deployment URL. Hãy: **(a)** chọn `testAdd` / `testGet` từ dropdown rồi Run để test, **(b)** hoặc gọi URL deployment qua app/curl. Nếu thấy lỗi này khi mở **URL deployment** → chắc chắn là **chưa Save trước khi Deploy**: Save (Cmd+S) → Manage deployments → Edit (✏️) → New version → Deploy lại. |
| `Authorization required` khi Run hàm test              | Apps Script lần đầu cần xin quyền truy cập Sheet. Bấm **Review permissions → Advanced → Go to (project name) → Allow**.                                   |
| `Không tải được dữ liệu từ Google Sheet`               | Tab `Feeding` chưa tồn tại trên sheet mới, hoặc sheet chưa share "Anyone with the link (Viewer)", hoặc `API_KEY` sai/quota.                              |
| `Lưu thất bại` khi POST                                | `googleFeedingAppsScriptUrl` chưa set, hoặc proxy `/api/feeding-apps-script` còn placeholder, hoặc deployment đã bị disable.                              |
| `403 Forbidden` khi POST                               | Deploy settings → **Who has access** phải là **Anyone** (không phải "Anyone with Google account").                                                        |
| Cập nhật xong nhưng UI không refresh                   | App tự reload sau ~900ms; nếu vẫn lỗi thì kiểm tra Apps Script **Executions** xem có exception không.                                                     |
| Ngày trong sheet bị format số/lệch                     | Cột B đang là Number/Date. Chọn cột B → Format → Number → **Plain text**, gõ lại 1-2 dòng test.                                                            |
| `updateFeeding` báo "Row vượt quá phạm vi sheet"       | Row đó vừa bị xoá ở tab khác/người khác. Bấm tải lại 🔄 trên app rồi sửa lại.                                                                              |

---

## 9. Sơ đồ luồng dữ liệu

```text
[Browser /feeding?user=quyen]
        │
        │  GET (read)
        ├───────────────► Google Sheets API v4 (API Key)
        │                 → tab Feeding, range A2:E
        │
        │  POST {action:'addFeeding'|'updateFeeding'|'deleteFeeding', ...}
        └───────────────► Proxy /api/feeding-apps-script  (dev)
                          hoặc googleFeedingAppsScriptUrl (prod)
                          → doPost
                            ├─ addFeeding    : appendRow
                            ├─ updateFeeding : setValue(C/D/E) – KHÔNG đụng A/B
                            └─ deleteFeeding : deleteRow
```

> Tách biệt với expense Apps Script: feeding sheet có deployment riêng, không ảnh hưởng các route khác.
