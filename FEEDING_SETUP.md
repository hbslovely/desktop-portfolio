# Baby App – Hướng dẫn cấu hình Google Sheets

Tài liệu hướng dẫn chuẩn bị **các tab** trong Google Sheet và **Google Apps Script chung** để app `/feeding?user=<tên>` có thể đồng bộ:

- Tab **`Feeding`**: nhật ký cữ bú (đọc / thêm / sửa / xoá).
- Tab **`Weight`**: cân nặng bé (đọc / thêm / sửa / xoá).
- Tab **`MedicalHistory`**: tiền sử y tế bé — Medical history V2 (đọc qua API; ghi / sửa / xoá qua Apps Script).
- Tab **`Explorer`**: cây thư mục + ảnh base64 (đọc / thêm / sửa / xoá có cascade).

> Sheet: <https://docs.google.com/spreadsheets/d/1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM/edit?gid=0#gid=0>
>
> Sheet ID: `1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM`

---

## 1. Chuẩn bị tab `Feeding`

1. Mở sheet ở link trên → tạo (hoặc đổi tên) tab thành **chính xác** `Feeding`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B          | C       | D                  | E           |
| -------- | ---------- | ------- | ------------------ | ----------- |
| **User** | **Ngày**   | **Giờ** | **Dung tích (ml)** | **Ghi chú** |
| quyen    | 07/04/2026 | 16:20   | 50                 | bú mẹ       |

Quy ước:

- **User**: cùng giá trị với query param `?user=...` (VD: `quyen`, `phat`).
- **Ngày**: định dạng `DD/MM/YYYY`. Để format cột B là **Plain text** để Google Sheets không tự "đoán" thành số serial.
- **Giờ**: `HH:mm` 24h.
- **Dung tích**: số nguyên (`50` hoặc `50ml` đều đọc được).
- **Ghi chú**: tuỳ chọn.

---

## 1b. Chuẩn bị tab `Weight`

1. Tạo tab mới tên **chính xác** `Weight`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B          | C             | D           |
| -------- | ---------- | ------------- | ----------- |
| **User** | **Ngày**   | **Cân (kg)**  | **Ghi chú** |
| phat     | 03/05/2026 | 4,25          |             |

Quy ước:

- **User**: giống `Feeding` — ghi nhận ai đang log (query `?user=`).
- **Ngày**: `DD/MM/YYYY`. Nên để cột B là **Plain text**.
- **Cân (kg)**: số thập phân (`4,25` hoặc `4.25`).
- **Ghi chú**: tuỳ chọn.

Sau khi thêm tab, **cập nhật và redeploy** Google Apps Script (mục 4 bên dưới) để có các action `addWeight` / `updateWeight` / `deleteWeight`.

---

## 1c. Chuẩn bị tab `MedicalHistory` (tiền sử y tế V2)

1. Tạo tab mới tên **chính xác** `MedicalHistory`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B          | C (slug)   | D           | E          | F              |
| -------- | ---------- | ---------- | ----------- | ---------- | -------------- |
| **User** | **Ngày**   | **Loại**   | **Tiêu đề** | **Chi tiết** | **Nơi khám** |
| phat     | 03/05/2026 | vaccine    | Pentaxim mũi 2 | Không sốt | BV Nhi |

Quy ước:

- **User**: giống `Feeding` / `Weight`.
- **Ngày**: `DD/MM/YYYY` — nên để cột B **Plain text**.
- **Loại**: một trong `vaccine` | `checkup` | `medication` | `illness` | `lab` | `other` (app chuẩn hoá khi ghi).
- **Tiêu đề**: bắt buộc; **Chi tiết** / **Nơi khám**: tuỳ chọn.

Sau khi thêm tab, **cập nhật và redeploy** Apps Script (mục 4) để có `addMedicalHistory` / `updateMedicalHistory` / `deleteMedicalHistory`.

---

## 2. Chuẩn bị tab `Explorer`

1. Tạo tab mới tên **chính xác** `Explorer`.
2. Dòng 1 là **header** với **106 cột**. Cột E là content chính, H..DB là 99 cột overflow để chứa file lớn (ảnh tới ~3.6MB).

| A      | B        | C        | D             | E           | F                        | G             | H..DB             |
| ------ | -------- | -------- | ------------- | ----------- | ------------------------ | ------------- | ----------------- |
| **id** | **name** | **type** | **parent_id** | **Content** | **created_at**           | **isDeleted** | **content2..100** |
| 1      | root     | folder   |               |             | 2026-04-29T00:00:00.000Z | FALSE         |                   |
| 2      | docs     | folder   | 1             |             | 2026-04-29T00:00:00.000Z | FALSE         |                   |
| 3      | img      | folder   | 1             |             | 2026-04-29T00:00:00.000Z | FALSE         |                   |

Quy ước:

- **id**: số nguyên duy nhất. Dòng đầu tiên (`id=1`) **bắt buộc** là root folder, app dùng nó làm gốc cây.
- **name**: tên hiển thị.
- **type**: `folder` hoặc `file`.
- **parent_id**: id của folder cha. Để **trống** (hoặc `NULL`) cho root.
- **Content** (E): phần đầu của data URL base64 (`data:image/jpeg;base64,...`). Folder để trống.
- **created_at**: ISO timestamp (`2026-04-29T16:20:30.123Z`). **Apps Script sẽ tự stamp** khi gọi `addExplorer` → bạn không phải gõ tay. Cho 3 row seed root/docs/img có thể để trống hoặc gõ thời điểm hiện tại.
- **isDeleted**: `TRUE` nếu file đã bị xoá mềm, ngược lại để trống hoặc `FALSE`. App + Apps Script tự lọc các row có `isDeleted=TRUE`, nên người dùng cuối không thấy chúng. **Folder vẫn bị soft-delete** giống file (cùng cascade) để có thể restore sau.
- **content2..content100** (H..DB): phần overflow cho file lớn. Mỗi cell tối đa ~49.000 ký tự (giới hạn cứng 50.000 của Google Sheets). Server tự cắt khi ghi và tự nối khi đọc — bạn không cần can thiệp tay.

> 💡 Để tránh Google Sheets format số serial / chuyển ISO thành Date object lệch timezone:
> - Chọn cột **A** → Format → Number → **Plain text**.
> - Chọn cột **F** → Format → Number → **Plain text**.

> 🔄 **Nếu sheet `Explorer` của bạn đã có sẵn (≤ 7 cột)**:
> - Chưa có cột `created_at`: thêm cell `created_at` vào ô `F1`.
> - Chưa có cột `isDeleted`: thêm cell `isDeleted` vào ô `G1`. Các row cũ để trống cột G được hiểu là chưa xoá.
> - Chưa có overflow content (H..DB): thêm các header `content2` ... `content100` từ ô `H1` đến `DB1`. Các row cũ để trống → server đọc thành chuỗi rỗng → ảnh cũ vẫn hiển thị bình thường.

---

## 3. Cấp quyền đọc public

Để app đọc được bằng API key:

1. Bấm **Share / Chia sẻ** trên Sheet.
2. **Truy cập chung** → chọn **Bất kỳ ai có đường liên kết** với quyền **Người xem (Viewer)**.

---

## 4. Tạo Apps Script

Trong Sheet → **Extensions → Apps Script** → xoá toàn bộ code mặc định trong `Code.gs` → paste **toàn bộ** code dưới đây vào → Save (Cmd/Ctrl + S):

```javascript
/**
 * Baby App – Google Apps Script
 * Bound vào sheet 1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM.
 *
 * ===== Feeding actions =====
 *   addFeeding     → append cữ mới
 *   updateFeeding  → cập nhật giờ / dung tích / note (KHÔNG đổi date)
 *   deleteFeeding  → xoá row
 *   getFeedings    → trả về toàn bộ logs (tuỳ chọn)
 *
 * ===== Weight actions =====
 *   addWeight      → append dòng cân nặng
 *   updateWeight   → sửa ngày / kg / ghi chú theo row
 *   deleteWeight   → xoá row vật lý
 *
 * ===== Medical history V2 =====
 *   addMedicalHistory    → append tiền sử y tế
 *   updateMedicalHistory → sửa theo row
 *   deleteMedicalHistory → xoá row vật lý
 *
 * ===== Explorer actions =====
 *   addExplorer    → tạo folder hoặc file (auto-id, auto-stamp created_at, isDeleted=FALSE)
 *   updateExplorer → đổi name hoặc content (KHÔNG đổi type / parent_id)
 *   deleteExplorer → SOFT delete: set cột G `isDeleted=TRUE`. Folder cascade
 *                    luôn các con cháu. KHÔNG xoá row vật lý → có thể khôi phục.
 *   moveExplorer   → cut & paste 1 mảng ids (file lẫn folder) sang folder mới
 *                    Folder check chu kỳ: không cho move folder vào chính nó
 *                    hoặc descendant của nó (tránh tạo loop vô hạn).
 *   getExplorer    → trả về toàn bộ entries (đã filter isDeleted=TRUE)
 */

const FEED_SHEET = 'Feeding';
const EXPL_SHEET = 'Explorer';
const WEIGHT_SHEET = 'Weight';
const MEDICAL_SHEET = 'MedicalHistory';

// Weight columns (1-based): User | Ngày DD/MM/YYYY | kg | Ghi chú
const W_USER = 1, W_DATE = 2, W_WEIGHT = 3, W_NOTE = 4;

// MedicalHistory columns (1-based): User | Ngày | Loại | Tiêu đề | Chi tiết | Nơi khám
const M_USER = 1, M_DATE = 2, M_KIND = 3, M_TITLE = 4, M_DETAIL = 5, M_PLACE = 6;

// Feeding columns (1-based)
const F_USER = 1, F_DATE = 2, F_TIME = 3, F_VOLUME = 4, F_NOTE = 5;

// Explorer columns (1-based).
// Cột content gốc (E) + 99 cột overflow (H..DB) cho phép ảnh tới ~3.6MB
// thay vì giới hạn ~37KB của 1 cell. Khi đọc, server nối E + H..DB lại.
const E_ID = 1, E_NAME = 2, E_TYPE = 3, E_PARENT = 4, E_CONTENT = 5,
      E_CREATED = 6, E_DELETED = 7,
      E_CONTENT2 = 8; // H
const E_LAST_CONTENT_COL = 106; // DB = content100
const E_OVERFLOW_COLS = _buildOverflowCols();
const E_COLS = E_LAST_CONTENT_COL;
const E_CHUNK_SIZE = 49000;        // ký tự / cell, < 50K hard cap của Sheets
const E_MAX_CHUNKS = 1 + E_OVERFLOW_COLS.length; // 100 chunks → ~4.9M chars

function _buildOverflowCols() {
  const cols = [];
  for (let c = E_CONTENT2; c <= E_LAST_CONTENT_COL; c++) cols.push(c);
  return cols;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';

    switch (action) {
      // Feeding
      case 'addFeeding':     return _json(handleAddFeeding(body));
      case 'updateFeeding':  return _json(handleUpdateFeeding(body));
      case 'deleteFeeding':  return _json(handleDeleteFeeding(body));
      case 'getFeedings':    return _json(handleGetFeedings(body));
      // Weight
      case 'addWeight':      return _json(handleAddWeight(body));
      case 'updateWeight':   return _json(handleUpdateWeight(body));
      case 'deleteWeight':   return _json(handleDeleteWeight(body));
      // Medical history V2
      case 'addMedicalHistory':    return _json(handleAddMedicalHistory(body));
      case 'updateMedicalHistory': return _json(handleUpdateMedicalHistory(body));
      case 'deleteMedicalHistory': return _json(handleDeleteMedicalHistory(body));
      // Explorer
      case 'addExplorer':    return _json(handleAddExplorer(body));
      case 'updateExplorer': return _json(handleUpdateExplorer(body));
      case 'deleteExplorer': return _json(handleDeleteExplorer(body));
      case 'moveExplorer':   return _json(handleMoveExplorer(body));
      case 'getExplorer':    return _json(handleGetExplorer(body));
      default:
        throw new Error('Action không được hỗ trợ: ' + action);
    }
  } catch (err) {
    return _json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

/**
 * GET endpoint phụ — debug nhanh qua trình duyệt:
 *   ?action=getFeedings
 *   ?action=getExplorer
 * (Đọc Weight qua Google Sheets API trực tiếp trong app — không bắt buộc GET.)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'getFeedings';

    if (action === 'getFeedings') {
      return _json(handleGetFeedings({ user: params.user || '' }));
    }
    if (action === 'getExplorer') {
      return _json(handleGetExplorer({}));
    }
    throw new Error('GET chỉ hỗ trợ action=getFeedings hoặc getExplorer');
  } catch (err) {
    return _json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

/* =========================
 * Feeding handlers
 * ========================= */

function handleAddFeeding(body) {
  const sheet = _getSheet(FEED_SHEET);
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
 * Cập nhật cữ bú. **CỐ Ý không cho đổi cột Ngày** – chỉ chỉnh giờ / dung
 * tích / note. Nếu cần đổi ngày thì xoá rồi thêm mới.
 */
function handleUpdateFeeding(body) {
  const sheet = _getSheet(FEED_SHEET);
  const row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Row không hợp lệ');

  const lastRow = sheet.getLastRow();
  if (row > lastRow) throw new Error('Row vượt quá phạm vi sheet');

  const patch = body.patch || {};
  const time = _normalizeTime(String(patch.time || '').trim());
  const volume = parseInt(patch.volume, 10) || 0;
  const note = String(patch.note != null ? patch.note : '').trim();

  if (!time || volume <= 0) throw new Error('Patch thiếu time hoặc volume');

  sheet.getRange(row, F_TIME).setValue(time);
  sheet.getRange(row, F_VOLUME).setValue(volume);
  sheet.getRange(row, F_NOTE).setValue(note);

  return { success: true, message: 'Đã cập nhật cữ bú', rowIndex: row };
}

function handleDeleteFeeding(body) {
  const sheet = _getSheet(FEED_SHEET);
  const row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Row không hợp lệ');
  if (row > sheet.getLastRow()) throw new Error('Row vượt quá phạm vi sheet');

  sheet.deleteRow(row);
  return { success: true, message: 'Đã xoá cữ bú' };
}

function handleGetFeedings(body) {
  const sheet = _getSheet(FEED_SHEET);
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
 * Weight handlers
 * ========================= */

function _parseWeightKg(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return isNaN(n) || n <= 0 ? null : n;
}

function handleAddWeight(body) {
  const sheet = _getSheet(WEIGHT_SHEET);
  const log = body.log || {};
  const user = String(log.user || '').toLowerCase().trim();
  const dateIso = String(log.date || '').trim();
  var wRaw = log.weight_kg;
  if (wRaw === undefined || wRaw === null) wRaw = log.weightKg;
  const w = _parseWeightKg(wRaw);
  const note = String(log.note || '').trim();

  if (!user || !dateIso || w === null) {
    throw new Error('Thiếu trường bắt buộc (user, date, weight_kg).');
  }

  const dateStr = _isoToDdMmYyyy(dateIso);
  if (!dateStr) throw new Error('Ngày không hợp lệ (YYYY-MM-DD).');

  sheet.appendRow([user, dateStr, w, note]);

  return { success: true, rowIndex: sheet.getLastRow() };
}

function handleUpdateWeight(body) {
  const sheet = _getSheet(WEIGHT_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');

  const patch = body.patch || {};
  if (patch.date != null) {
    var iso = String(patch.date).trim();
    var d = _isoToDdMmYyyy(iso);
    if (!d) throw new Error('Ngày không hợp lệ');
    sheet.getRange(row, W_DATE).setValue(d);
  }
  var pk = patch.weight_kg;
  if (pk === undefined || pk === null) pk = patch.weightKg;
  if (pk !== undefined && pk !== null) {
    var wn = _parseWeightKg(pk);
    if (wn === null) throw new Error('Cân nặng không hợp lệ');
    sheet.getRange(row, W_WEIGHT).setValue(wn);
  }
  if (patch.note != null) {
    sheet.getRange(row, W_NOTE).setValue(String(patch.note));
  }

  return { success: true, rowIndex: row };
}

function handleDeleteWeight(body) {
  const sheet = _getSheet(WEIGHT_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');
  sheet.deleteRow(row);
  return { success: true };
}

/* =========================
 * Medical history V2 handlers
 * ========================= */

function _normalizeMedicalKind(k) {
  var s = String(k || '').trim().toLowerCase();
  var allowed = ['vaccine', 'checkup', 'medication', 'illness', 'lab', 'other'];
  return allowed.indexOf(s) >= 0 ? s : 'other';
}

function handleAddMedicalHistory(body) {
  const sheet = _getSheet(MEDICAL_SHEET);
  const log = body.log || {};
  const user = String(log.user || '').toLowerCase().trim();
  const dateIso = String(log.date || '').trim();
  const kind = _normalizeMedicalKind(log.kind);
  const title = String(log.title || '').trim();
  const detail = String(log.detail || '').trim();
  const place = String(log.place || '').trim();

  if (!user || !dateIso || !title) {
    throw new Error('Thiếu trường bắt buộc (user, date, title).');
  }

  const dateStr = _isoToDdMmYyyy(dateIso);
  if (!dateStr) throw new Error('Ngày không hợp lệ (YYYY-MM-DD).');

  sheet.appendRow([user, dateStr, kind, title, detail, place]);

  return { success: true, rowIndex: sheet.getLastRow() };
}

function handleUpdateMedicalHistory(body) {
  const sheet = _getSheet(MEDICAL_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');

  const patch = body.patch || {};
  if (patch.date != null) {
    var iso = String(patch.date).trim();
    var d = _isoToDdMmYyyy(iso);
    if (!d) throw new Error('Ngày không hợp lệ');
    sheet.getRange(row, M_DATE).setValue(d);
  }
  if (patch.kind != null) {
    sheet.getRange(row, M_KIND).setValue(_normalizeMedicalKind(patch.kind));
  }
  if (patch.title != null) {
    sheet.getRange(row, M_TITLE).setValue(String(patch.title).trim());
  }
  if (patch.detail != null) {
    sheet.getRange(row, M_DETAIL).setValue(String(patch.detail));
  }
  if (patch.place != null) {
    sheet.getRange(row, M_PLACE).setValue(String(patch.place));
  }

  return { success: true, rowIndex: row };
}

function handleDeleteMedicalHistory(body) {
  const sheet = _getSheet(MEDICAL_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');
  sheet.deleteRow(row);
  return { success: true };
}

/* =========================
 * Explorer handlers
 * ========================= */

/**
 * Cắt 1 chuỗi `content` thành tối đa `E_MAX_CHUNKS` chunks ≤ `E_CHUNK_SIZE`
 * ký tự. Dùng để ghi vào E + H..DB. Trả về mảng (rỗng nếu content rỗng).
 * Throw nếu vượt quá tổng dung lượng cho phép.
 */
function _splitContent(content) {
  const s = String(content || '');
  if (s.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < s.length; i += E_CHUNK_SIZE) {
    chunks.push(s.slice(i, i + E_CHUNK_SIZE));
  }
  if (chunks.length > E_MAX_CHUNKS) {
    throw new Error(
      'Content quá lớn (' + s.length + ' ký tự). Giới hạn ~' +
      (E_MAX_CHUNKS * E_CHUNK_SIZE) + ' ký tự (~' +
      Math.round(E_MAX_CHUNKS * E_CHUNK_SIZE / 1024) + 'KB base64).'
    );
  }
  return chunks;
}

/**
 * Nối content từ row (0-indexed) — gộp E + H..DB. Mọi row cũ
 * (chỉ có E) vẫn hoạt động vì các cột overflow trả về undefined → '' .
 */
function _joinContent(row) {
  let s = String(row[E_CONTENT - 1] || '');
  for (let i = 0; i < E_OVERFLOW_COLS.length; i++) {
    s += String(row[E_OVERFLOW_COLS[i] - 1] || '');
  }
  return s;
}

/**
 * Ghi content (đã split sẵn) vào row tại `rowIndex`. Lấp đầy phần thiếu
 * bằng chuỗi rỗng để xoá data overflow cũ khi user shrink ảnh.
 */
function _writeContentChunks(sheet, rowIndex, chunks) {
  // Cell chính E
  sheet.getRange(rowIndex, E_CONTENT).setValue(chunks[0] || '');
  // Cells overflow H..DB — luôn ghi đủ số cell (rỗng nếu không có chunk)
  for (let i = 0; i < E_OVERFLOW_COLS.length; i++) {
    sheet.getRange(rowIndex, E_OVERFLOW_COLS[i]).setValue(chunks[i + 1] || '');
  }
}

function handleAddExplorer(body) {
  const sheet = _getSheet(EXPL_SHEET);
  const entry = body.entry || {};
  const name = String(entry.name || '').trim();
  const type = String(entry.type || '').trim().toLowerCase();
  const parentRaw = entry.parent_id;
  const content = String(entry.content || '');

  if (!name) throw new Error('Thiếu name');
  if (type !== 'folder' && type !== 'file') {
    throw new Error('type phải là "folder" hoặc "file"');
  }

  const parentId = _toIntOrNull(parentRaw);
  if (parentId === null && type !== 'folder') {
    throw new Error('File phải có parent_id (folder cha)');
  }

  // Validate parent tồn tại (trừ root)
  if (parentId !== null) {
    const exists = _findExplorerRowById(sheet, parentId);
    if (!exists) throw new Error('Folder cha (id=' + parentId + ') không tồn tại');
    if (String(exists.row[E_TYPE - 1]).toLowerCase() !== 'folder') {
      throw new Error('parent_id không phải folder');
    }
  }

  // Split content thành chunks (sẽ throw nếu vượt giới hạn ~3.6MB)
  const chunks = _splitContent(content);

  const id = _nextExplorerId(sheet);
  const parentValue = parentId === null ? '' : parentId;
  const createdAt = new Date().toISOString();

  // Build full row A..DB: A..G (core) + H..DB (overflow chunks).
  // Cột G `isDeleted` mặc định FALSE cho mọi entry mới.
  const rowVals = [
    id, name, type, parentValue,
    chunks[0] || '',          // E (content chính)
    createdAt, false,         // F, G
  ];
  for (let i = 0; i < E_OVERFLOW_COLS.length; i++) {
    rowVals.push(chunks[i + 1] || ''); // H..DB
  }
  sheet.appendRow(rowVals);

  // Đảm bảo cell created_at là plain text (tránh Sheets parse thành Date lệch tz)
  try {
    sheet.getRange(sheet.getLastRow(), E_CREATED).setNumberFormat('@');
  } catch (e) {
    // Một số tài khoản không có quyền setNumberFormat → bỏ qua, giá trị vẫn ghi đúng.
  }

  return {
    success: true,
    message: 'Đã thêm ' + (type === 'folder' ? 'thư mục' : 'file'),
    id: id,
    rowIndex: sheet.getLastRow(),
    createdAt: createdAt,
    chunkCount: chunks.length
  };
}

/**
 * Update entry. CHỈ cho đổi `name` và `content`. Không cho đổi type
 * hoặc parent_id để tránh phải re-validate cây.
 */
function handleUpdateExplorer(body) {
  const sheet = _getSheet(EXPL_SHEET);
  const id = _toIntOrNull(body.id);
  if (id === null) throw new Error('Thiếu id');

  const found = _findExplorerRowById(sheet, id);
  if (!found) throw new Error('Không tìm thấy entry id=' + id);

  const patch = body.patch || {};
  if (patch.name != null) {
    const name = String(patch.name).trim();
    if (!name) throw new Error('Tên không được để trống');
    sheet.getRange(found.rowIndex, E_NAME).setValue(name);
  }
  if (patch.content != null) {
    if (String(found.row[E_TYPE - 1]).toLowerCase() !== 'file') {
      throw new Error('Chỉ file mới có content');
    }
    // Split + ghi đủ E + H..DB (xoá overflow cũ nếu user shrink ảnh).
    const chunks = _splitContent(patch.content);
    _writeContentChunks(sheet, found.rowIndex, chunks);
  }

  return { success: true, message: 'Đã cập nhật', id: id, rowIndex: found.rowIndex };
}

/**
 * SOFT delete entry: set cột G `isDeleted=TRUE` thay vì xoá row vật lý.
 * Nếu là folder → cascade soft-delete toàn bộ con cháu (BFS).
 *
 * Ưu điểm so với hard delete:
 *  - Có thể khôi phục bằng cách đặt lại `isDeleted=FALSE` thủ công trong Sheet.
 *  - Không làm shift rowIndex → các thao tác đang chạy song song không bị lệch.
 *  - Idempotent: gọi lại trên id đã xoá là no-op.
 */
function handleDeleteExplorer(body) {
  const sheet = _getSheet(EXPL_SHEET);
  const id = _toIntOrNull(body.id);
  if (id === null) throw new Error('Thiếu id');
  if (id === 1) throw new Error('Không được xoá root folder');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Sheet trống');

  const data = sheet.getRange(2, 1, lastRow - 1, E_COLS).getValues();

  // Build map: id -> { rowIndex, parentId, type, name, isDeleted }
  const byId = {};
  data.forEach(function (r, idx) {
    const rid = parseInt(r[E_ID - 1], 10);
    if (!rid) return;
    byId[rid] = {
      rowIndex: idx + 2,
      parentId: _toIntOrNull(r[E_PARENT - 1]),
      type: String(r[E_TYPE - 1]).toLowerCase(),
      name: String(r[E_NAME - 1]),
      isDeleted: _toBool(r[E_DELETED - 1])
    };
  });

  if (!byId[id]) throw new Error('Không tìm thấy entry id=' + id);

  // BFS gom toàn bộ id sẽ bị soft-delete (root + descendants).
  const toDelete = {};
  toDelete[id] = true;
  let added = true;
  while (added) {
    added = false;
    Object.keys(byId).forEach(function (key) {
      const rid = parseInt(key, 10);
      const item = byId[rid];
      if (!toDelete[rid] && item.parentId !== null && toDelete[item.parentId]) {
        toDelete[rid] = true;
        added = true;
      }
    });
  }

  // Set cột G `isDeleted=TRUE` cho từng row còn FALSE. Đếm số row thực sự đổi.
  let count = 0;
  Object.keys(toDelete).forEach(function (k) {
    const rid = parseInt(k, 10);
    const item = byId[rid];
    if (!item || item.isDeleted) return;
    sheet.getRange(item.rowIndex, E_DELETED).setValue(true);
    count++;
  });

  return {
    success: true,
    message: 'Đã đánh dấu xoá ' + count + ' entry',
    deletedCount: count,
    softDelete: true
  };
}

/**
 * Cut & paste nhiều file ids sang folder mới (parent_id mới).
 *
 * Chính sách:
 *  - **CHỈ áp dụng cho `type=file`**. Folder bị bỏ qua silent (movedCount
 *    sẽ phản ánh số thực sự được move).
 *  - Folder đích phải tồn tại và là `type=folder`.
 *  - Bỏ qua những file vốn đã ở folder đích (no-op).
 */
function handleMoveExplorer(body) {
  const sheet = _getSheet(EXPL_SHEET);
  const ids = (body.ids || [])
    .map(function (x) { return parseInt(x, 10); })
    .filter(function (n) { return !!n; });
  const newParentId = _toIntOrNull(body.parentId);

  if (newParentId === null) throw new Error('Thiếu parentId đích');
  if (ids.length === 0) throw new Error('Không có id nào để move');

  // Validate target folder
  const parentFound = _findExplorerRowById(sheet, newParentId);
  if (!parentFound) throw new Error('Folder đích id=' + newParentId + ' không tồn tại');
  if (String(parentFound.row[E_TYPE - 1]).toLowerCase() !== 'folder') {
    throw new Error('Đích không phải folder');
  }

  let moved = 0;
  let skippedRoot = 0;
  let skippedCycle = 0;
  let skippedSame = 0;
  let skippedMissing = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    // Không cho move root (id=1) — root phải đứng yên.
    if (id === 1) { skippedRoot++; continue; }

    const found = _findExplorerRowById(sheet, id);
    if (!found) { skippedMissing++; continue; }
    const t = String(found.row[E_TYPE - 1]).toLowerCase();
    if (t !== 'file' && t !== 'folder') { skippedMissing++; continue; }

    const curParent = _toIntOrNull(found.row[E_PARENT - 1]);
    if (curParent === newParentId) { skippedSame++; continue; }

    // Cycle check cho folder: target không được là chính nó hoặc descendant.
    // Walk lên ancestry của newParentId — nếu gặp `id` thì refuse.
    if (t === 'folder' && _isFolderAncestorOrSelf(sheet, newParentId, id)) {
      skippedCycle++;
      continue;
    }

    sheet.getRange(found.rowIndex, E_PARENT).setValue(newParentId);
    moved++;
  }

  return {
    success: true,
    message: 'Đã chuyển ' + moved + ' mục',
    movedCount: moved,
    skippedRoot: skippedRoot,
    skippedCycle: skippedCycle,
    skippedSame: skippedSame,
    skippedMissing: skippedMissing
  };
}

/**
 * Trả về true nếu `nodeId` là `ancestorId` hoặc nằm trong cây con của
 * `ancestorId` (đi lên qua parentId chain). Dùng cho cycle check khi move
 * folder. Có safety bound để tránh loop vô hạn nếu sheet bị hỏng.
 */
function _isFolderAncestorOrSelf(sheet, nodeId, ancestorId) {
  let cur = nodeId;
  let safety = 64;
  while (cur !== null && safety-- > 0) {
    if (cur === ancestorId) return true;
    const found = _findExplorerRowById(sheet, cur);
    if (!found) return false;
    cur = _toIntOrNull(found.row[E_PARENT - 1]);
  }
  return false;
}

function handleGetExplorer(_body) {
  const sheet = _getSheet(EXPL_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, entries: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, E_COLS).getValues();
  const entries = values
    .map(function (r, idx) {
      // Bỏ qua row đã soft-delete — coi như không tồn tại.
      if (_toBool(r[E_DELETED - 1])) return null;
      const id = parseInt(r[E_ID - 1], 10);
      const name = String(r[E_NAME - 1] || '').trim();
      const type = String(r[E_TYPE - 1] || '').toLowerCase();
      const parentId = _toIntOrNull(r[E_PARENT - 1]);
      // Nối content từ E + H..DB (file lớn lưu chia nhiều cell)
      const content = type === 'file' ? _joinContent(r) : '';
      const createdRaw = r[E_CREATED - 1];
      if (!id || !name) return null;
      if (type !== 'folder' && type !== 'file') return null;
      return {
        id: id,
        name: name,
        type: type,
        parentId: parentId,
        content: type === 'file' ? content : '',
        createdAt: _fmtIso(createdRaw),
        rowIndex: idx + 2
      };
    })
    .filter(function (e) { return e !== null; });

  return { success: true, entries: entries };
}

/* =========================
 * Helpers
 * ========================= */

function _getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Không tìm thấy tab "' + name + '"');
  return sheet;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _toIntOrNull(val) {
  if (val === '' || val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  if (s === '' || s === 'null') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * Chuẩn hoá giá trị boolean đọc từ cell. Sheets có thể trả về:
 *   - boolean true/false (khi cell type là Checkbox/Boolean)
 *   - string "TRUE" / "FALSE" / "true" / "1" / "yes" / ""
 *   - number 1 / 0
 *   - undefined (cột G chưa được tạo trên sheet cũ)
 */
function _toBool(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function _nextExplorerId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const ids = sheet.getRange(2, E_ID, lastRow - 1, 1).getValues();
  let max = 0;
  for (let i = 0; i < ids.length; i++) {
    const n = parseInt(ids[i][0], 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Tìm row theo id. **Mặc định bỏ qua các row đã soft-delete** (cột G = TRUE)
 * để các action update / move / add-validate-parent coi entry đó như không
 * tồn tại. Truyền `includeDeleted=true` nếu cần nhìn cả row đã xoá (hiện tại
 * chưa có call site nào cần — dành cho tương lai khi làm restore).
 */
function _findExplorerRowById(sheet, id, includeDeleted) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const data = sheet.getRange(2, 1, lastRow - 1, E_COLS).getValues();
  for (let i = 0; i < data.length; i++) {
    if (parseInt(data[i][E_ID - 1], 10) !== id) continue;
    if (!includeDeleted && _toBool(data[i][E_DELETED - 1])) return null;
    return { rowIndex: i + 2, row: data[i] };
  }
  return null;
}

function _isoToDdMmYyyy(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return ('0' + m[3]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[1];
}

function _fmtDate(val) {
  if (val instanceof Date) {
    const d = ('0' + val.getDate()).slice(-2);
    const m = ('0' + (val.getMonth() + 1)).slice(-2);
    return d + '/' + m + '/' + val.getFullYear();
  }
  return String(val || '').trim();
}

function _fmtTime(val) {
  if (val instanceof Date) {
    return ('0' + val.getHours()).slice(-2) + ':' + ('0' + val.getMinutes()).slice(-2);
  }
  return _normalizeTime(String(val || '').trim());
}

function _normalizeTime(raw) {
  if (!raw) return '';
  const m = String(raw).match(/(\d{1,2})[:h](\d{1,2})/);
  if (!m) return raw;
  return ('0' + m[1]).slice(-2) + ':' + ('0' + m[2]).slice(-2);
}

/**
 * Chuẩn hoá giá trị `created_at` đọc từ sheet về ISO string.
 * - Nếu cell là Date object (Google Sheets tự parse) → trả ISO.
 * - Nếu cell là string ISO sẵn → trả string đó.
 * - Trống → '' .
 */
function _fmtIso(val) {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString();
  }
  return String(val || '').trim();
}

/* =========================
 * Test helpers — chọn từng hàm trong dropdown rồi bấm ▶️ Run.
 * ========================= */

function testFeedingAdd() {
  const result = handleAddFeeding({
    log: { user: 'quyen', date: '2026-04-28', time: '14:30', volume: 50, note: 'test' },
  });
  Logger.log(JSON.stringify(result));
}

function testFeedingGet() {
  Logger.log(JSON.stringify(handleGetFeedings({ user: '' })));
}

function testFeedingUpdate() {
  // ĐỔI row=2 thành row có thật trong sheet trước khi chạy
  const result = handleUpdateFeeding({
    row: 2,
    patch: { time: '15:45', volume: 70, note: 'edit từ script' },
  });
  Logger.log(JSON.stringify(result));
}

function testExplorerGet() {
  Logger.log(JSON.stringify(handleGetExplorer({})));
}

function testExplorerAddFolder() {
  const result = handleAddExplorer({
    entry: { name: 'test-folder', type: 'folder', parent_id: 1, content: '' },
  });
  Logger.log(JSON.stringify(result));
}

function testExplorerDelete() {
  // ĐỔI id thành id có thật trong sheet (≠ 1) trước khi chạy.
  // Đây là SOFT delete → mở sheet xem cột G của row đó sẽ chuyển sang TRUE,
  // row vẫn còn nguyên trong sheet. Gọi handleGetExplorer xác nhận đã ẩn.
  const result = handleDeleteExplorer({ id: 999 });
  Logger.log(JSON.stringify(result));
}

function testExplorerMove() {
  // ĐỔI ids thành id file có thật, parentId = id folder đích.
  const result = handleMoveExplorer({ ids: [4, 5], parentId: 2 });
  Logger.log(JSON.stringify(result));
}
```

> **Quan trọng**: bấm **Save (Cmd/Ctrl+S)** trước khi deploy. Nếu chưa save mà deploy thì deployment sẽ chạy version cũ (rỗng) → trả về `Script function not found: doPost`.

---

## 5. Deploy Apps Script (Web App)

1. Bấm **Deploy → New deployment**.
2. Bánh răng (⚙️) bên cạnh "Select type" → chọn **Web app**.
3. Cấu hình:
   - **Description**: `Baby App API v1`
   - **Execute as**: **Me**
   - **Who has access**: **Anyone** *(không phải "Anyone with Google account" – sẽ bị 403)*.
4. **Deploy** → cấp quyền cho script (Allow).
5. Copy **Web app URL** dạng:
   `https://script.google.com/macros/s/AKfycbXXXX...XXXX/exec`

> Sau này khi sửa code, dùng **Manage deployments → Edit (✏️) → Version: New version → Deploy** để **giữ nguyên URL**. Nếu tạo deployment mới thì URL đổi và phải cập nhật env + proxy.

---

## 6. Cấu hình biến môi trường + proxy dev

`.env.local` ở gốc repo:

```env
NG_APP_GOOGLE_SHEETS_API_KEY=your_api_key
NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbXXXX...XXXX/exec
```

Trong `proxy.conf.json`, tìm entry `/api/feeding-apps-script` và thay placeholder bằng deployment ID thật:

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

Restart `npm run dev` sau khi sửa.

---

## 7. Smoke test

### 7.1 Test trong Apps Script editor (không dùng app)

Chọn từng hàm từ dropdown function rồi bấm **▶️ Run**:

- `testFeedingGet` → xem **View → Logs**, trả về `{"success":true,"logs":[...]}`.
- `testFeedingAdd` → mở Sheet xem row mới ở tab `Feeding`.
- `testExplorerGet` → trả về toàn bộ entries.
- `testExplorerAddFolder` → tạo folder test ở dưới root.

> Lần đầu sẽ bật pop-up xin quyền: **Review permissions → Advanced → Go to (project) → Allow**.

### 7.2 Test deployment URL trên trình duyệt

```
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?action=getExplorer
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?action=getFeedings
```

Phải trả về JSON `{ success: true, ... }`. Nếu thấy `Script function not found` → quay lại bước 4 (chưa Save) hoặc bước 5 (chưa Deploy New version).

### 7.3 Test trên app

1. `npm run dev` → vào `http://localhost:3006/feeding?user=quyen`.
2. Tab **Cữ bú** (mặc định): test ➕ ✏️ 🗑 cữ bú như cũ.
3. Bấm tab **Tài liệu** ở bottom navigation:
   - Thấy 2 thư mục mặc định `docs` và `img` (con của root, không hiện root).
   - Bấm **+ Thêm thư mục** → tạo thư mục con.
   - Bấm vào thư mục → vào trong → breadcrumb hiện đường dẫn.
   - Bấm **+ Tải ảnh lên** → chọn ảnh nhỏ (< 1MB lý tưởng) → app tự nén xuống ~720px JPEG q=0.7 và lưu base64 vào sheet.
   - Bấm vào ảnh → xem preview fullscreen.
   - Bấm icon ✏️ trên folder → đổi tên.
   - Bấm icon 🗑 trên folder → cảnh báo cascade delete → xác nhận → folder + toàn bộ con cháu chuyển sang `isDeleted=TRUE` (vẫn còn trong sheet, có thể restore thủ công bằng cách đổi cột G về `FALSE`).

---

## 8. Troubleshooting

| Triệu chứng                                      | Nguyên nhân & cách xử lý                                                                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Script function not found: doPost`              | Bấm **▶️ Run** trên `doPost` để test → sai cách. `doPost` chỉ chạy khi có HTTP POST. Hãy: **(a)** chọn `testFeedingGet` / `testExplorerGet` từ dropdown rồi Run, **(b)** hoặc gọi URL deployment qua app. Nếu thấy lỗi này khi mở **URL deployment** → chắc chắn là **chưa Save trước khi Deploy**: Save (Cmd+S) → Manage deployments → Edit (✏️) → New version → Deploy lại. |
| `Authorization required` khi Run                 | Apps Script lần đầu cần xin quyền truy cập Sheet. **Review permissions → Advanced → Go to (project) → Allow**.                                                                  |
| `Không tải được dữ liệu`                         | Tab tương ứng (`Feeding` / `Explorer`) chưa tồn tại, hoặc sheet chưa share "Anyone with the link (Viewer)", hoặc API key sai/quota.                                              |
| `Lưu thất bại` khi POST                          | `googleFeedingAppsScriptUrl` chưa set, hoặc proxy `/api/feeding-apps-script` còn placeholder, hoặc deployment đã bị disable.                                                    |
| `403 Forbidden` khi POST                         | Deploy settings → **Who has access** phải là **Anyone**.                                                                                                                          |
| Ảnh upload thất bại với lỗi "quá lớn"            | App đã tự nén nhiều bậc (đến 2048px/0.92) nhưng vẫn vượt ~4.900.000 ký tự (100 cells). Trường hợp này thường là ảnh cực lớn/panorama; hãy giảm kích thước trước khi upload. |
| Không xoá được folder                            | Folder đó là root (`id=1`) → không cho xoá. Hoặc tab `Explorer` chưa đúng tên (phân biệt hoa thường).                                                                            |
| Đã xoá rồi nhưng row vẫn còn trong sheet        | Bình thường — đây là **soft delete**. Cột G của row sẽ chuyển sang `TRUE`, app + Apps Script sẽ tự ẩn các row này. Muốn xoá vĩnh viễn / restore thì sửa cột G thủ công.        |
| Mới upload xong mà refresh thấy biến mất         | Có thể row đó đang có cột G = `TRUE` (do bug data cũ). Vào sheet kiểm tra cột G, đặt lại `FALSE` hoặc xoá cell.                                                              |
| Ngày trong Feeding bị format số/lệch              | Cột B của Feeding đang là Number/Date. Chọn cột B → Format → Number → **Plain text**.                                                                                              |

---

## 9. Sơ đồ luồng dữ liệu

```text
[Browser /feeding?user=quyen]
        │
        │  GET (read)
        ├──────► Google Sheets API v4 (API Key)
        │        ├─ Feeding!A2:E
        │        └─ Explorer!A2:DB   (E + H..DB được nối lại thành content; G `isDeleted` filter ra)
        │
        │  POST {action, ...}
        └──────► Proxy /api/feeding-apps-script (dev)
                 hoặc googleFeedingAppsScriptUrl (prod)
                 → doPost
                   ├─ Feeding:  add / update / delete (hard) / get
                   └─ Explorer: add / update / delete (SOFT, cascade) / move (file-only) / get
```
