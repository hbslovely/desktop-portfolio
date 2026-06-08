  # Baby App – Hướng dẫn cấu hình Google Sheets

Tài liệu hướng dẫn chuẩn bị **các tab** trong Google Sheet và **Google Apps Script chung** để app `/feeding?user=<tên>` có thể đồng bộ:

- Tab **`Feeding`**: nhật ký cữ bú (đọc / thêm / sửa / xoá).
- Tab **`Settings`**: tham số cữ bú (đọc API; ghi qua Apps Script theo **ID**).
- Tab **`Weight`**: cân nặng bé (đọc / thêm / sửa / xoá).
- Tab **`Event`**: lịch sự kiện (đọc API; thêm / sửa / xoá / acknowledge qua Apps Script) — trong app hiển thị tab **Lịch**.
- Tab **`MedicalHistory`**: tiền sử y tế bé — Medical history V2 (đọc qua API; ghi / sửa / xoá qua Apps Script).
- **Explorer V2**: **Drive-first** - không còn dùng tab Explorer trong Sheet nữa. Files được lưu trực tiếp vào Google Drive với metadata trong PropertiesService. Hỗ trợ migration từ tab Explorer cũ.
- Tab **`Log`**: lịch sử hoạt động (đọc API; ghi qua Apps Script).

---

## 1. Chuẩn bị tab `Feeding`

1. Mở sheet ở link trên → tạo (hoặc đổi tên) tab thành **chính xác** `Feeding`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B          | C       | D                  | E           |
| -------- | ---------- | ------- | ------------------ | ----------- |
| **User** | **Ngày**   | **Giờ** | **Dung tích (ml)** | **Ghi chú** |
| quyen    | 07/04/2026 | 16:20   | 50                 | bú mẹ       |

Trên **cùng dòng 1**, thêm cột **G → K** cho widget «Pha sữa» — app **chỉ đọc/ghi Sheet** (không dùng localStorage):

| G                   | H (`?user=`) | I       | J (giờ pha) | K (ISO lúc pha — app ghi) |
| ------------------- | ------------ | ------- | ----------- | ------------------------- |
| Thông tin pha sữa  | phat         | 100ml   | 08:43       | 2026-05-07T08:43:00.000Z  |

- **Có** pha sữa: **G1** nhãn, **H1** user, **I1** dung tích (VD `100ml`), **J1** `HH:mm`, **K1** ISO (để load đúng ngày / hạn dùng).
- **Xoá**: app xoá **H1:K1** (G có thể giữ tay).
- Script **cũ** không ghi K: app vẫn đọc được H–J và **ước lượng** ngày từ giờ J.

Cần **Apps Script** có action `setBottlePrep` / `clearBottlePrep` (xem khối script mục 4).

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

| A        | B          | C             | D                 | E           |
| -------- | ---------- | ------------- | ----------------- | ----------- |
| **User** | **Ngày**   | **Cân (kg)**  | **Chiều cao (cm)** | **Ghi chú** |
| phat     | 03/05/2026 | 4,25          | 63,5              |             |

Quy ước:

- **User**: giống `Feeding` — ghi nhận ai đang log (query `?user=`).
- **Ngày**: `DD/MM/YYYY`. Nên để cột B là **Plain text**.
- **Cân (kg)**: số thập phân (`4,25` hoặc `4.25`).
- **Chiều cao (cm)**: tuỳ chọn (có thể bỏ trống nếu chưa đo).
- **Ghi chú**: tuỳ chọn.

Sau khi thêm tab, **cập nhật và redeploy** Google Apps Script (mục 4 bên dưới) để có các action `addWeight` / `updateWeight` / `deleteWeight`.

---

## 1b-Event. Chuẩn bị tab `Event` (tab **Lịch** trong app)

1. Tạo tab mới tên **chính xác** `Event`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B          | C       | D               | E           | F        | G              |
| -------- | ---------- | ------- | --------------- | ----------- | -------- | -------------- |
| **User** | **Ngày**   | **Giờ** | **Tên sự kiện** | **Ghi chú** | **Vị trí** | **Acknowledge** |
| phat     | 20/05/2026 | 09:00   | Tiêm 6in1       | mang thẻ    | BV Nhi   | FALSE          |

- **Ngày / Giờ / Tên**: bắt buộc khi thêm từ app. **Ghi chú / Vị trí**: tuỳ chọn.
- **Acknowledge**: `TRUE` / `FALSE` (hoặc để trống = chưa ẩn nhắc). App ghi `TRUE` khi bạn bấm «Ẩn nhắc» trên dialog nhắc lịch.
- Cửa sổ nhắc: tab `Settings` — ID **`EVENT_REMINDER_DAYS`** và **`EVENT_REMINDER_HOURS`**.

Sau khi thêm tab, **cập nhật và redeploy** Apps Script (mục 4) để có `addEvent` / `updateEvent` / `deleteEvent` / `acknowledgeEvent`.

---

## 1c. Chuẩn bị tab `MedicalHistory` (tiền sử y tế V2)

1. Tạo tab mới tên **chính xác** `MedicalHistory`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A        | B          | C (slug)   | D           | E          | F              | G (tuỳ chọn)     |
| -------- | ---------- | ---------- | ----------- | ---------- | -------------- | ---------------- |
| **User** | **Ngày**   | **Loại**   | **Tiêu đề** | **Chi tiết** | **Nơi khám** | **id file Explorer** |
| phat     | 03/05/2026 | vaccine    | Pentaxim mũi 2 | Không sốt | BV Nhi         |                  |

Cột **G**: Google Drive file ID cho ảnh đính kèm y tế, để trống nếu không có đính kèm. App tự ghi khi bạn đính kèm ảnh trong màn hình tiền sử. Files được lưu trong thư mục Drive riêng biệt (không qua Explorer tab).

Quy ước:

- **User**: giống `Feeding` / `Weight`.
- **Ngày**: `DD/MM/YYYY` — nên để cột B **Plain text**.
- **Loại**: một trong `vaccine` | `checkup` | `medication` | `illness` | `lab` | `other` (app chuẩn hoá khi ghi).
- **Tiêu đề**: bắt buộc; **Chi tiết** / **Nơi khám**: tuỳ chọn.
- **Cột G**: tuỳ chọn — Google Drive file ID cho ảnh đính kèm (app tự điền khi có đính kèm trong màn tiền sử).

Sau khi thêm tab, **cập nhật và redeploy** Apps Script (mục 4) để có `addMedicalHistory` / `updateMedicalHistory` / `deleteMedicalHistory` với Drive-first attachment support.

---

## 1d. Tab `Settings` (cấu hình cữ bú — theo **ID**)

1. Tạo tab tên **`Settings`** (đúng chữ hoa thường).
2. Dòng 1: **ID** | **Tên chỉ tiêu** | **Giá trị** | **Đơn vị** | **Kiểu dữ liệu**
3. Từ dòng 2, mỗi chỉ số một dòng. App **chỉ** khớp cột **A (ID)** khi đọc/ghi; cột B chỉ để người đọc sheet — đổi tên B không làm hỏng app.

Ví dụ các dòng Settings (app đọc theo cột A); có thể thêm ID mới — lần đầu **Lưu** từ app sẽ append nếu script đã cập nhật:

| ID | Tên chỉ tiêu | Giá trị | Đơn vị | Kiểu dữ liệu |
| --- | --- | --- | --- | --- |
| `FEED_TIME_WARNING` | Đánh dấu cữ bú khi lâu hơn | `3` | Giờ | Số |
| `FEED_WARNING_AMOUNT` | Đánh dấu cữ bú khi nhỏ hơn | `40` | ml | Số |
| `FEED_GROUP_GAP_MINUTES` | Gom cữ hiển thị khi gần nhau | `0` | phút | Số |
| `FEEDING_NOTIFICATION_MINUTES` | Thông báo sắp bú trước | `5` | phút | Số |
| `EVENT_REMINDER_DAYS` | Nhắc sự kiện lịch trước | `3` | ngày | Số |
| `EVENT_REMINDER_HOURS` | Nhắc sự kiện lịch thêm | `0` | giờ | Số |

- **`FEED_TIME_WARNING`** (giờ, số thập phân được): gọi **H**. UI tô cảnh báo **chỉ nhãn khoảng cách** (pill) khi hai cữ liên tiếp cách nhau **≥ H** giờ.
- **`FEED_WARNING_AMOUNT`** (ml, số nguyên): cữ có `volume` **nhỏ hơn** giá trị này được CSS class `low-volume`.
- **`FEED_GROUP_GAP_MINUTES`** (phút, số nguyên **0–180**): nếu **> 0**, các cữ liên tiếp cách nhau ≤ phút này được **gom một dòng** hiển thị (giờ = trung bình, ml = tổng); **0** = tắt gom.
- **`FEEDING_NOTIFICATION_MINUTES`**: khi còn ≤ N phút đến cữ dự đoán, UI hiển thị trạng thái «Sắp tới» (tab Cữ bú).
- **`EVENT_REMINDER_DAYS`** / **`EVENT_REMINDER_HOURS`**: cửa sổ nhắc lịch — khi thời điểm sự kiện (tab `Event`) nằm trong khoảng **≤ (ngày×24 + giờ)** từ hiện tại và chưa Acknowledge, app mở dialog nhắc (có thể bỏ qua theo phiên hoặc ẩn nhắc ghi `TRUE` cột G).

> **Tương thích:** nếu sheet cũ vẫn có ID `GROUP_FEEDING_TIME`, app vẫn **đọc** được làm H; khi **Lưu** từ dialog app ghi ID `FEED_TIME_WARNING` — nên đổi dòng trên sheet cho thống nhất.

Đọc: Google Sheets API `Settings!A2:E` (cùng sheet ID với Feeding).  
Ghi: Apps Script action **`updateFeedingSettings`** — body `{ "action": "updateFeedingSettings", "updates": [ { "id": "FEED_TIME_WARNING", "value": 3, "name": "…", "unit": "giờ", "dataType": "Số" }, … ] }`. Mỗi phần tử **bắt buộc** có `id` và `value`; `name` / `unit` / `dataType` **khuyến nghị** khi ID chưa có trên sheet (script sẽ **append** một dòng mới A:E). Nếu thiếu, script dùng `name = id`, `unit` rỗng, `dataType = "Số"`.

Sau khi thêm tab, **deploy lại** script trong mục 4 nếu bản cũ chưa có `handleUpdateFeedingSettings`.

---

## 1e. Chuẩn bị tab `Log` (lịch sử hoạt động)

Tab này ghi nhận mọi thao tác trên app (thêm/sửa/xóa cữ bú, cân nặng, y tế...) để các user khác nhau có thể theo dõi hoạt động.

1. Tạo tab mới tên **chính xác** `Log`.
2. Dòng 1 là **header** theo đúng thứ tự sau:

| A      | B        | C        | D           | E             |
| ------ | -------- | -------- | ----------- | ------------- |
| **id** | **user** | **type** | **content** | **timestamp** |
| log-1  | phat     | FEEDING_ADDED | Thêm cữ bú '100ml' vào lúc '08:30' | 2026-05-19T10:30:00.000Z |

Quy ước:

- **id**: unique ID do app tự sinh (VD: `log-1716093600000-abc123`).
- **user**: user thực hiện thao tác (query `?user=`).
- **type**: loại event — một trong các giá trị:
  - `FEEDING_ADDED`, `FEEDING_UPDATED`, `FEEDING_DELETED`
  - `WEIGHT_ADDED`, `WEIGHT_UPDATED`, `WEIGHT_DELETED`
  - `MEDICAL_ADDED`, `MEDICAL_UPDATED`, `MEDICAL_DELETED`
  - `SCHEDULE_ADDED`, `SCHEDULE_UPDATED`, `SCHEDULE_DELETED`
  - `SETTINGS_UPDATED`, `PROFILE_UPDATED`
- **content**: nội dung user-friendly. Phần trong dấu `''` sẽ được in đậm trong UI.
  - VD: `Thêm cữ bú '100ml' vào lúc '09:00'`
  - VD: `Thay đổi cữ bú lúc '09:00' từ '100ml' thành '110ml'`
  - VD: `Thêm ghi nhận cân nặng '4.8kg' ngày '19/05/2026'`
  - VD: `Chỉnh sửa sự kiện y tế 'Khám cho Bối' tại 'BV Quốc tế City'`
- **timestamp**: ISO timestamp khi ghi log.

> 💡 Để cột A và E là **Plain text** để tránh Sheets tự format.

Sau khi thêm tab, **deploy lại** Apps Script (mục 4) để có action `addLog`.

---

## 2. Chuẩn bị tab `Explorer` (legacy, chỉ cần khi migrate)

1. Tạo tab mới tên **chính xác** `Explorer` nếu bạn đang có dữ liệu cũ cần migrate.
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
 * Baby App – Google Apps Script V2.0 (Drive-first)
 * Updated: June 3, 2026
 * - Explorer V2: Drive-first storage (không dùng Sheet tabs nữa)
 * - Medical History: hỗ trợ Drive file ID attachments trực tiếp
 * - Migration tools: từ Explorer legacy sang Drive với batch processing
 * - Better performance, security và scalability
 *
 * ===== Feeding actions =====
 *   addFeeding     → append cữ mới
 *   updateFeeding  → cập nhật giờ / dung tích / note (KHÔNG đổi date)
 *   deleteFeeding  → xoá row
 *   getFeedings    → trả về toàn bộ logs (tuỳ chọn)
 *   setBottlePrep  → G1:K1 — pha sữa (+ ISO cột K)
 *   clearBottlePrep→ xoá H1:K1
 *   updateFeedingSettings → cập nhật cột **Giá trị** tab `Settings` theo **ID** (cột A)
 *
 * ===== Weight actions =====
 *   addWeight      → append dòng cân nặng
 *   updateWeight   → sửa ngày / kg / ghi chú / chiều cao theo row
 *   deleteWeight   → xoá row vật lý
 *
 * ===== Event / Lịch (tab Google Sheet `Event`) =====
 *   addEvent           → append sự kiện
 *   updateEvent        → sửa ngày/giờ/tên/ghi chú/vị trí (row)
 *   deleteEvent        → xoá row
 *   acknowledgeEvent   → cột G = TRUE (ẩn nhắc)
 *   addMedicalHistory    → append tiền sử y tế (với Drive file ID)
 *   updateMedicalHistory → sửa theo row (bao gồm attachment_id)
 *   deleteMedicalHistory → xoá row vật lý
 *
 * ===== Explorer V2 actions (Drive-first) =====
 *   addExplorer    → tạo folder/file trực tiếp trong Google Drive
 *   updateExplorer → đổi name hoặc content (metadata lưu trong PropertiesService)
 *   deleteExplorer → SOFT delete + trash Drive objects (có thể restore)
 *   moveExplorer   → move files/folders trong Drive với cycle detection
 *   getExplorer    → trả về tree metadata từ PropertiesService
 *   getExplorerFile → fetch file content từ Drive by ID hoặc driveFileId
 *   migrateExplorerToDrive → migrate batch từ Explorer legacy sang Drive
 *   cleanupExplorerLegacyContent → dọn base64 content sau khi migrate
 *
 * ===== Log (activity history) =====
 *   addLog         → append log entry (id, user, type, content, timestamp)
 */

/***********************
 * QUAN TRỌNG: Cấu hình Drive folder trước khi deploy:
 * 1. Tạo folder trên Google Drive
 * 2. Copy folder ID vào EXPL_DRIVE_FOLDER_ID bên dưới
 * 3. Grant permissions cho Apps Script bằng cách chạy authorizeDriveAccess()
 * 4. Test write permissions bằng authorizeDriveWrite()
 ***********************/

const FEED_SHEET = 'Feeding';
const SETTINGS_SHEET = 'Settings';
const WEIGHT_SHEET = 'Weight';
const EVENT_SHEET = 'Event';
const MEDICAL_SHEET = 'MedicalHistory';
const LOG_SHEET = 'Log';

// Log columns (1-based): id | user | type | content | timestamp
const L_ID = 1, L_USER = 2, L_TYPE = 3, L_CONTENT = 4, L_TIMESTAMP = 5;

// Event columns (1-based): User | Ngày | Giờ | Tên | Ghi chú | Vị trí | Acknowledge
const EV_USER = 1, EV_DATE = 2, EV_TIME = 3, EV_TITLE = 4, EV_NOTE = 5, EV_PLACE = 6,
  EV_ACK = 7;

// Weight columns (1-based): User | Ngày DD/MM/YYYY | kg | Chiều cao(cm, optional) | Ghi chú
const W_USER = 1, W_DATE = 2, W_WEIGHT = 3, W_HEIGHT = 4, W_NOTE = 5;

// MedicalHistory columns (1-based): User | Ngày | Loại | Tiêu đề | Chi tiết | Nơi khám | Drive file ID
const M_USER = 1, M_DATE = 2, M_KIND = 3, M_TITLE = 4, M_DETAIL = 5, M_PLACE = 6,
  M_ATTACHMENT = 7;

// Feeding columns (1-based)
const F_USER = 1, F_DATE = 2, F_TIME = 3, F_VOLUME = 4, F_NOTE = 5;
// Dòng 1 — pha sữa: G | H | I | J | K (ISO)
const F_BOTTLE_LABEL_COL = 7, F_BOTTLE_USER_COL = 8, F_BOTTLE_VOL_COL = 9,
  F_BOTTLE_TIME_COL = 10, F_BOTTLE_AT_ISO_COL = 11;
const F_BOTTLE_LABEL_TEXT = 'Thông tin pha sữa';

// Explorer columns (1-based).
// Cột content gốc (E) + 99 cột overflow (H..DB) cho phép ảnh tới ~3.6MB
// thay vì giới hạn ~37KB của 1 cell. Khi đọc, server nối E + H..DB lại.
const E_ID = 1, E_NAME = 2, E_TYPE = 3, E_PARENT = 4, E_CONTENT = 5,
  E_CREATED = 6, E_DELETED = 7,
  E_CONTENT2 = 8; // H
// Nếu chạy Drive mode, tái sử dụng H..L làm metadata:
// H=driveFileId, I=mimeType, J=sizeBytes, K=storageStatus, L=updated_at
// (với row legacy chưa migrate, H..DB vẫn là overflow content như cũ).
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

function doOptions(e) {
  // Handle CORS preflight requests from mobile browsers
  // Google Apps Script auto-handles CORS when deployment access = "Anyone"
  return _json({ success: true, message: 'CORS preflight handled' });
}

function doPost(e) {
  try {
    // 🚀 Mobile CORS fix: Handle both application/json và text/plain
    const rawBody = e.postData.contents || '{}';
    const body = JSON.parse(rawBody);
    const action = body.action || '';

    switch (action) {
      // Feeding
      case 'addFeeding':     return _json(handleAddFeeding(body));
      case 'updateFeeding':  return _json(handleUpdateFeeding(body));
      case 'deleteFeeding':  return _json(handleDeleteFeeding(body));
      case 'getFeedings':    return _json(handleGetFeedings(body));
      case 'setBottlePrep':  return _json(handleSetBottlePrep(body));
      case 'clearBottlePrep':return _json(handleClearBottlePrep(body));
      case 'updateFeedingSettings': return _json(handleUpdateFeedingSettings(body));
      // Weight
      case 'addWeight':      return _json(handleAddWeight(body));
      case 'updateWeight':   return _json(handleUpdateWeight(body));
      case 'deleteWeight':   return _json(handleDeleteWeight(body));
      // Event / Lịch
      case 'addEvent':         return _json(handleAddEvent(body));
      case 'updateEvent':      return _json(handleUpdateEvent(body));
      case 'deleteEvent':      return _json(handleDeleteEvent(body));
      case 'acknowledgeEvent': return _json(handleAcknowledgeEvent(body));
      // Medical history V2
      case 'addMedicalHistory':    return _json(handleAddMedicalHistory(body));
      case 'updateMedicalHistory': return _json(handleUpdateMedicalHistory(body));
      case 'deleteMedicalHistory': return _json(handleDeleteMedicalHistory(body));
      // Explorer
      case 'addExplorer':    return _json(handleAddExplorer(body)); // Drive-first
      case 'updateExplorer': return _json(handleUpdateExplorer(body)); // Drive-first
      case 'deleteExplorer': return _json(handleDeleteExplorer(body)); // Drive-first
      case 'moveExplorer':   return _json(handleMoveExplorer(body)); // Drive-first
      case 'getExplorer':    return _json(handleGetExplorer(body)); // Drive-first
      case 'getExplorerFile': return _json(handleGetExplorerFile(body));
      case 'migrateExplorerToDrive': return _json(handleMigrateExplorerToDrive(body));
      case 'cleanupExplorerLegacyContent': return _json(handleCleanupExplorerLegacyContent(body));
      // Log (activity history)
      case 'addLog':         return _json(handleAddLog(body));
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

/**
 * Ghi ô G1:K1 — thông tin pha sữa (K = ISO để app đọc lại chính xác).
 */
function handleSetBottlePrep(body) {
  var sheet = _getSheet(FEED_SHEET);
  var user = String(body.user || '').toLowerCase().trim();
  var volume = parseInt(body.volumeMl, 10) || 0;
  var time = _normalizeTime(String(body.time || '').trim());
  var atIso = String(body.atIso || '').trim();
  if (!user || volume <= 0 || !time || !atIso) {
    throw new Error('Thiếu user, volumeMl, time hoặc atIso (pha sữa).');
  }
  sheet.getRange(1, F_BOTTLE_LABEL_COL).setValue(F_BOTTLE_LABEL_TEXT);
  sheet.getRange(1, F_BOTTLE_USER_COL).setValue(user);
  sheet.getRange(1, F_BOTTLE_VOL_COL).setValue(volume + 'ml');
  sheet.getRange(1, F_BOTTLE_TIME_COL).setValue(time);
  sheet.getRange(1, F_BOTTLE_AT_ISO_COL).setValue(atIso);
  return { success: true, message: 'Đã cập nhật thông tin pha sữa (G1:K1)' };
}

/** Xoá H1:K1 khi user xoá pha sữa trong app. */
function handleClearBottlePrep(body) {
  var sheet = _getSheet(FEED_SHEET);
  sheet.getRange(1, F_BOTTLE_USER_COL, 1, F_BOTTLE_AT_ISO_COL).clearContent();
  return { success: true, message: 'Đã xoá H1:K1 (pha sữa)' };
}

/**
 * Tab `Settings`: hàng 1 = header. Cột A = **ID**, B = tên, C = **Giá trị**, D = đơn vị, E = kiểu.
 * Body: `{ updates: [{ id, value, name?, unit?, dataType? }, ...] }`
 * — so khớp `id` với cột A: có thì ghi cột C; **không có thì append** một dòng A:E
 * (dùng `name`/`unit`/`dataType` từ client nếu có, mặc định name = id, dataType = "Số").
 */
function handleUpdateFeedingSettings(body) {
  var sheet = _getSheet(SETTINGS_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error('Tab Settings trống (cần hàng header A:E).');

  var updates = body.updates || [];
  if (!updates.length) throw new Error('Thiếu mảng updates.');

  function readColA() {
    var lr = sheet.getLastRow();
    if (lr < 2) return [];
    return sheet.getRange(2, 1, lr, 1).getValues();
  }

  var touched = 0;

  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    var id = String(u.id || '').trim();
    if (!id) continue;

    var colA = readColA();
    var row = -1;
    for (var r = 0; r < colA.length; r++) {
      if (String(colA[r][0] || '').trim() === id) {
        row = r + 2;
        break;
      }
    }

    var val = u.value;
    var cellVal =
      typeof val === 'number' && isFinite(val)
        ? val
        : String(val != null ? val : '');

    if (row < 2) {
      var nm = String(u.name != null ? u.name : '').trim() || id;
      var unit = String(u.unit != null ? u.unit : '').trim();
      var dt = String(u.dataType != null ? u.dataType : '').trim() || 'Số';
      sheet.appendRow([id, nm, cellVal, unit, dt]);
      touched++;
      continue;
    }

    if (typeof val === 'number' && isFinite(val)) {
      sheet.getRange(row, 3).setValue(val);
    } else {
      sheet.getRange(row, 3).setValue(String(val != null ? val : ''));
    }
    touched++;
  }

  if (!touched) {
    throw new Error('Không có bản ghi hợp lệ (updates rỗng hoặc id trống).');
  }
  return { success: true, message: 'Đã cập nhật / thêm ' + touched + ' dòng Settings' };
}

/* =========================
 * Weight handlers
 * ========================= */

function _parseWeightKg(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return isNaN(n) || n <= 0 ? null : n;
}

function _parseHeightCm(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(n) || n <= 0) return null;
  if (n < 30 || n > 130) return null;
  return n;
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
  var hRaw = log.height_cm;
  if (hRaw === undefined || hRaw === null) hRaw = log.heightCm;
  const h = _parseHeightCm(hRaw);

  if (!user || !dateIso || w === null) {
    throw new Error('Thiếu trường bắt buộc (user, date, weight_kg).');
  }

  const dateStr = _isoToDdMmYyyy(dateIso);
  if (!dateStr) throw new Error('Ngày không hợp lệ (YYYY-MM-DD).');

  sheet.appendRow([user, dateStr, w, h === null ? '' : h, note]);

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
  var ph = patch.height_cm;
  if (ph === undefined || ph === null) ph = patch.heightCm;
  if (ph !== undefined) {
    if (ph === '' || ph === null) {
      sheet.getRange(row, W_HEIGHT).setValue('');
    } else {
      var hn = _parseHeightCm(ph);
      if (hn === null) throw new Error('Chiều cao không hợp lệ');
      sheet.getRange(row, W_HEIGHT).setValue(hn);
    }
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
 * Event / Lịch handlers (tab `Event`)
 * ========================= */

function handleAddEvent(body) {
  const sheet = _getSheet(EVENT_SHEET);
  const log = body.log || {};
  const user = String(log.user || '').toLowerCase().trim();
  const dateIso = String(log.date || '').trim();
  const time = _normalizeTime(String(log.time || '').trim());
  const title = String(log.title || '').trim();
  const note = String(log.note != null ? log.note : '').trim();
  const place = String(log.place != null ? log.place : '').trim();

  if (!user || !dateIso || !time || !title) {
    throw new Error('Thiếu trường bắt buộc (user, date, time, title).');
  }
  const dateStr = _isoToDdMmYyyy(dateIso);
  if (!dateStr) throw new Error('Ngày không hợp lệ (YYYY-MM-DD).');

  sheet.appendRow([user, dateStr, time, title, note, place, false]);
  return { success: true, rowIndex: sheet.getLastRow() };
}

function handleUpdateEvent(body) {
  const sheet = _getSheet(EVENT_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');
  const patch = body.patch || {};
  if (patch.date != null) {
    var iso = String(patch.date).trim();
    var d = _isoToDdMmYyyy(iso);
    if (!d) throw new Error('Ngày không hợp lệ');
    sheet.getRange(row, EV_DATE).setValue(d);
  }
  if (patch.time != null) {
    sheet.getRange(row, EV_TIME).setValue(_normalizeTime(String(patch.time).trim()));
  }
  if (patch.title != null) {
    var t = String(patch.title).trim();
    if (!t) throw new Error('Tên sự kiện không được để trống');
    sheet.getRange(row, EV_TITLE).setValue(t);
  }
  if (patch.note != null) sheet.getRange(row, EV_NOTE).setValue(String(patch.note));
  if (patch.place != null) sheet.getRange(row, EV_PLACE).setValue(String(patch.place));
  return { success: true, rowIndex: row };
}

function handleDeleteEvent(body) {
  const sheet = _getSheet(EVENT_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');
  sheet.deleteRow(row);
  return { success: true };
}

function handleAcknowledgeEvent(body) {
  const sheet = _getSheet(EVENT_SHEET);
  var row = parseInt(body.row, 10);
  if (!row || row < 2) throw new Error('Thiếu row hợp lệ');
  sheet.getRange(row, EV_ACK).setValue(true);
  return { success: true, rowIndex: row };
}

/* =========================
 * Medical history V2 handlers
 * ========================= */

function _normalizeMedicalKind(k) {
  var s = String(k || '').trim().toLowerCase();
  var allowed = [
    'vaccine', 'checkup', 'medication', 'illness', 'lab',
    'allergy', 'dental', 'ent', 'dermatology', 'vision', 'hearing',
    'emergency', 'surgery', 'therapy', 'nutrition', 'screening', 'mental',
    'home_care', 'follow_up', 'other'
  ];
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

  var attachRaw = log.attachment_id;
  if (attachRaw === undefined || attachRaw === null) attachRaw = log.attachmentId;
  var attachmentCell = attachRaw !== undefined && attachRaw !== null && String(attachRaw).trim() !== ''
    ? String(attachRaw).trim()
    : '';

  sheet.appendRow([user, dateStr, kind, title, detail, place, attachmentCell]);

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
  var pa = patch.attachment_id;
  if (pa === undefined || pa === null) pa = patch.attachmentId;
  if (pa !== undefined && pa !== null) {
    sheet.getRange(row, M_ATTACHMENT).setValue(pa === '' ? '' : String(pa).trim());
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
 * Explorer handlers (Drive-first, không dùng tab Explorer trong Sheet)
 * ========================= */

/**
 * NOTE:
 * - Từ phiên bản này, Explorer tree + metadata được lưu trên Drive/App properties,
 *   không đọc/ghi tab Explorer trong Google Sheet nữa.
 * - Các action giữ nguyên tên để tương thích frontend hiện có.
 *
 * Bạn hãy dùng bộ implement Drive-first đã gửi ở chat:
 *   handleAddExplorer
 *   handleUpdateExplorer
 *   handleDeleteExplorer
 *   handleMoveExplorer
 *   handleGetExplorer
 *   handleGetExplorerFile
 *   handleMigrateExplorerToDrive
 *   handleCleanupExplorerLegacyContent
 *   handleDeleteExplorerSheetAfterMigration
 *
 * Và bảo đảm KHÔNG có dòng nào gọi _getSheet('Explorer').
 */

/***********************
 * Explorer Drive-first
 ***********************/
const EXPL_DRIVE_FOLDER_ID = '13-JG78DpOegDQUiwK0Hu0Hg6vIYsfHxy';
const EXPL_STORE_KEY = 'EXPLORER_V2_STORE';

// Legacy sheet constants (chỉ dùng khi migrate/cleanup)
const EXPL_SHEET_LEGACY = 'Explorer';

/** Thêm trong doPost:
 * case 'addExplorer': return _json(handleAddExplorer(body));
 * case 'updateExplorer': return _json(handleUpdateExplorer(body));
 * case 'deleteExplorer': return _json(handleDeleteExplorer(body));
 * case 'moveExplorer': return _json(handleMoveExplorer(body));
 * case 'getExplorer': return _json(handleGetExplorer(body));
 * case 'getExplorerFile': return _json(handleGetExplorerFile(body));
 * case 'migrateExplorerToDrive': return _json(handleMigrateExplorerToDrive(body));
 * case 'cleanupExplorerLegacyContent': return _json(handleCleanupExplorerLegacyContent(body));
 * case 'deleteExplorerSheetAfterMigration': return _json(handleDeleteExplorerSheetAfterMigration(body));
 */

function _explNowIso() {
  return new Date().toISOString();
}

function _toIntOrNullLocal(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

function _safeName(name, fallback) {
  const s = String(name || '').trim();
  return s || (fallback || 'untitled');
}

function _normalizeType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t !== 'folder' && t !== 'file') throw new Error('type phải là "folder" hoặc "file"');
  return t;
}

function _getDriveRootFolder() {
  if (!EXPL_DRIVE_FOLDER_ID) throw new Error('Thiếu EXPL_DRIVE_FOLDER_ID');
  return DriveApp.getFolderById(EXPL_DRIVE_FOLDER_ID);
}

function _blobFromDataUrl(dataUrl, fileName, mimeOverride) {
  const s = String(dataUrl || '');
  const i = s.indexOf(',');
  if (i < 0) throw new Error('Data URL không hợp lệ');
  const header = s.slice(0, i);
  const payload = s.slice(i + 1);
  if (!/;base64/i.test(header)) throw new Error('Chỉ hỗ trợ data URL base64');
  const m = header.match(/^data:([^;]+)/i);
  const mime = String(mimeOverride || (m ? m[1] : 'application/octet-stream'));
  const bytes = Utilities.base64Decode(payload);
  return Utilities.newBlob(bytes, mime, fileName || 'file.bin');
}

function _readExplorerStore() {
  const raw = PropertiesService.getScriptProperties().getProperty(EXPL_STORE_KEY);
  if (!raw) return _createDefaultStore();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return _createDefaultStore();
    const store = {
      version: 2,
      nextId: Math.max(2, parseInt(parsed.nextId, 10) || 2),
      entries: parsed.entries
    };
    _ensureRootEntry(store);
    return store;
  } catch (e) {
    return _createDefaultStore();
  }
}

function _writeExplorerStore(store) {
  _ensureRootEntry(store);
  const maxId = store.entries.reduce(function (m, e) { return Math.max(m, e.id || 0); }, 1);
  store.nextId = Math.max(store.nextId || 2, maxId + 1);
  PropertiesService.getScriptProperties().setProperty(EXPL_STORE_KEY, JSON.stringify(store));
}

function _createDefaultStore() {
  return {
    version: 2,
    nextId: 2,
    entries: [{
      id: 1,
      name: 'root',
      type: 'folder',
      parentId: null,
      createdAt: _explNowIso(),
      driveFileId: EXPL_DRIVE_FOLDER_ID,
      mimeType: 'application/vnd.google-apps.folder',
      sizeBytes: 0,
      storageStatus: 'drive',
      deleted: false
    }]
  };
}

function _ensureRootEntry(store) {
  let root = store.entries.find(function (e) { return e.id === 1; });
  if (!root) {
    root = {
      id: 1,
      name: 'root',
      type: 'folder',
      parentId: null,
      createdAt: _explNowIso(),
      driveFileId: EXPL_DRIVE_FOLDER_ID,
      mimeType: 'application/vnd.google-apps.folder',
      sizeBytes: 0,
      storageStatus: 'drive',
      deleted: false
    };
    store.entries.unshift(root);
  }
  root.type = 'folder';
  root.parentId = null;
  root.deleted = false;
  if (!root.driveFileId) root.driveFileId = EXPL_DRIVE_FOLDER_ID;
}

function _activeEntries(store) {
  return store.entries.filter(function (e) { return !e.deleted; });
}

function _entryById(store, id, includeDeleted) {
  return store.entries.find(function (e) {
    if (e.id !== id) return false;
    if (!includeDeleted && e.deleted) return false;
    return true;
  }) || null;
}

function _childrenOf(store, parentId, includeDeleted) {
  return store.entries.filter(function (e) {
    if (e.parentId !== parentId) return false;
    if (!includeDeleted && e.deleted) return false;
    return true;
  });
}

function _requireParentFolder(store, parentId) {
  const parent = _entryById(store, parentId, false);
  if (!parent) throw new Error('Folder cha không tồn tại: ' + parentId);
  if (parent.type !== 'folder') throw new Error('parentId không phải folder');
  if (!parent.driveFileId) throw new Error('Folder cha thiếu driveFileId');
  return parent;
}

function _folderObjByEntry(entry) {
  return DriveApp.getFolderById(entry.driveFileId);
}

function _fileObjByEntry(entry) {
  return DriveApp.getFileById(entry.driveFileId);
}

function _collectDescendants(store, rootId) {
  const out = [];
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift();
    const kids = _childrenOf(store, cur, true);
    kids.forEach(function (k) {
      out.push(k);
      if (k.type === 'folder') queue.push(k.id);
    });
  }
  return out;
}

function _isAncestor(store, maybeAncestorId, nodeId) {
  let cur = _entryById(store, nodeId, true);
  let safety = 128;
  while (cur && safety-- > 0) {
    if (cur.parentId === null) return false;
    if (cur.parentId === maybeAncestorId) return true;
    cur = _entryById(store, cur.parentId, true);
  }
  return false;
}

/** addExplorer */
function handleAddExplorer(body) {
  const store = _readExplorerStore();
  const entry = (body && body.entry) || {};
  const name = _safeName(entry.name, '');
  const type = _normalizeType(entry.type);
  if (!name) throw new Error('Thiếu name');

  const parentId = _toIntOrNullLocal(entry.parent_id);
  if (type === 'file' && parentId === null) throw new Error('File phải có parent_id');

  let parentEntry = null;
  let parentFolder = _getDriveRootFolder();
  if (parentId !== null) {
    parentEntry = _requireParentFolder(store, parentId);
    parentFolder = _folderObjByEntry(parentEntry);
  }

  const createdAt = _explNowIso();
  const id = store.nextId++;

  let driveFileId = '';
  let mimeType = '';
  let sizeBytes = 0;

  if (type === 'folder') {
    const f = parentFolder.createFolder(name);
    driveFileId = f.getId();
    mimeType = 'application/vnd.google-apps.folder';
  } else {
    const content = String(entry.content || '');
    if (!content) throw new Error('Thiếu content cho file');
    const blob = _blobFromDataUrl(content, name, entry.mimeType || '');
    const file = parentFolder.createFile(blob);
    driveFileId = file.getId();
    mimeType = blob.getContentType() || 'application/octet-stream';
    sizeBytes = Number(entry.sizeBytes || blob.getBytes().length || 0);
  }

  store.entries.push({
    id: id,
    name: name,
    type: type,
    parentId: parentId,
    createdAt: createdAt,
    driveFileId: driveFileId,
    mimeType: mimeType,
    sizeBytes: sizeBytes,
    storageStatus: 'drive',
    deleted: false
  });

  _writeExplorerStore(store);
  return { success: true, id: id, createdAt: createdAt };
}

/** updateExplorer */
function handleUpdateExplorer(body) {
  const store = _readExplorerStore();
  const id = _toIntOrNullLocal(body && body.id);
  if (id === null) throw new Error('Thiếu id');
  const e = _entryById(store, id, false);
  if (!e) throw new Error('Không tìm thấy entry id=' + id);

  const patch = (body && body.patch) || {};

  if (patch.name != null) {
    const newName = _safeName(patch.name, '');
    if (!newName) throw new Error('Tên không hợp lệ');
    if (e.type === 'folder') _folderObjByEntry(e).setName(newName);
    else _fileObjByEntry(e).setName(newName);
    e.name = newName;
  }

  if (patch.content != null) {
    if (e.type !== 'file') throw new Error('Chỉ file mới có content');
    const parent = e.parentId === null ? null : _entryById(store, e.parentId, false);
    const parentFolder = parent ? _folderObjByEntry(parent) : _getDriveRootFolder();
    const blob = _blobFromDataUrl(String(patch.content), e.name, patch.mimeType || e.mimeType || '');
    const newFile = parentFolder.createFile(blob);

    try { _fileObjByEntry(e).setTrashed(true); } catch (ex) {}
    e.driveFileId = newFile.getId();
    e.mimeType = blob.getContentType() || 'application/octet-stream';
    e.sizeBytes = Number(patch.sizeBytes || blob.getBytes().length || 0);
    e.storageStatus = 'drive';
  }

  _writeExplorerStore(store);
  return { success: true, id: id };
}

/** deleteExplorer (soft delete + trash Drive objects) */
function handleDeleteExplorer(body) {
  const store = _readExplorerStore();
  const id = _toIntOrNullLocal(body && body.id);
  if (id === null) throw new Error('Thiếu id');
  if (id === 1) throw new Error('Không được xoá root');

  const root = _entryById(store, id, false);
  if (!root) throw new Error('Không tìm thấy entry id=' + id);

  const targets = [root].concat(_collectDescendants(store, id));
  let deletedCount = 0;

  targets.forEach(function (x) {
    if (x.deleted) return;
    x.deleted = true;
    deletedCount++;
    try {
      if (x.driveFileId) {
        if (x.type === 'folder') DriveApp.getFolderById(x.driveFileId).setTrashed(true);
        else DriveApp.getFileById(x.driveFileId).setTrashed(true);
      }
    } catch (e) {}
  });

  _writeExplorerStore(store);
  return { success: true, deletedCount: deletedCount, softDelete: true };
}

/** moveExplorer */
function handleMoveExplorer(body) {
  const store = _readExplorerStore();
  const ids = ((body && body.ids) || []).map(function (x) { return parseInt(x, 10); }).filter(Boolean);
  const newParentId = _toIntOrNullLocal(body && body.parentId);
  if (newParentId === null) throw new Error('Thiếu parentId');
  if (ids.length === 0) throw new Error('Không có id để move');

  const parent = _requireParentFolder(store, newParentId);
  const parentFolder = _folderObjByEntry(parent);

  let moved = 0, skipped = 0;
  ids.forEach(function (id) {
    if (id === 1) { skipped++; return; }
    const e = _entryById(store, id, false);
    if (!e) { skipped++; return; }
    if (e.parentId === newParentId) { skipped++; return; }
    if (e.type === 'folder' && (newParentId === e.id || _isAncestor(store, e.id, newParentId))) {
      skipped++;
      return;
    }

    try {
      if (e.type === 'folder') _folderObjByEntry(e).moveTo(parentFolder);
      else _fileObjByEntry(e).moveTo(parentFolder);
      e.parentId = newParentId;
      moved++;
    } catch (err) {
      skipped++;
    }
  });

  _writeExplorerStore(store);
  return { success: true, movedCount: moved, skippedCount: skipped };
}

/** getExplorer */
function handleGetExplorer(_body) {
  const store = _readExplorerStore();
  const entries = _activeEntries(store).map(function (e) {
    return {
      id: e.id,
      name: e.name,
      type: e.type,
      parentId: e.parentId,
      createdAt: e.createdAt,
      driveFileId: e.driveFileId || '',
      mimeType: e.mimeType || '',
      sizeBytes: Number(e.sizeBytes || 0),
      storageStatus: e.storageStatus || 'drive',
      content: '' // lazy load qua getExplorerFile
    };
  });
  return { success: true, entries: entries };
}

/** getExplorerFile */
function handleGetExplorerFile(body) {
  const store = _readExplorerStore();
  const id = _toIntOrNullLocal(body && body.id);
  let driveFileId = String((body && body.driveFileId) || '').trim();

  let e = null;
  if (!driveFileId) {
    if (id === null) throw new Error('Thiếu id hoặc driveFileId');
    e = _entryById(store, id, false);
    if (!e) throw new Error('Không tìm thấy entry');
    if (e.type !== 'file') throw new Error('Entry không phải file');
    driveFileId = String(e.driveFileId || '').trim();
  }

  if (!driveFileId) throw new Error('Thiếu driveFileId');

  const f = DriveApp.getFileById(driveFileId);
  const blob = f.getBlob();
  const bytes = blob.getBytes();
  const mimeType = blob.getContentType() || 'application/octet-stream';
  const dataUrl = 'data:' + mimeType + ';base64,' + Utilities.base64Encode(bytes);

  return {
    success: true,
    name: f.getName(),
    mimeType: mimeType,
    sizeBytes: bytes.length,
    dataUrl: dataUrl
  };
}

/** migrateExplorerToDrive: copy full folder tree + files từ tab Explorer legacy */
function handleMigrateExplorerToDrive(body) {
  const limit = Math.max(1, Math.min(200, parseInt((body && body.limit) || 20, 10)));
  const legacy = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPL_SHEET_LEGACY);
  if (!legacy) return { success: true, migratedCount: 0, hasMore: false, message: 'Không có tab Explorer legacy' };

  const store = _readExplorerStore();
  const rootFolder = _getDriveRootFolder();

  const lastRow = legacy.getLastRow();
  if (lastRow < 2) return { success: true, migratedCount: 0, hasMore: false, message: 'Explorer legacy rỗng' };

  const rows = legacy.getRange(2, 1, lastRow - 1, E_LAST_CONTENT_COL).getValues();
  const legacyEntries = rows.map(function (r, idx) {
    return {
      rowIndex: idx + 2,
      id: parseInt(r[E_ID - 1], 10) || 0,
      name: String(r[E_NAME - 1] || '').trim(),
      type: String(r[E_TYPE - 1] || '').toLowerCase(),
      parentId: _toIntOrNullLocal(r[E_PARENT - 1]),
      createdAt: String(r[E_CREATED - 1] || _explNowIso()),
      deleted: _toBool(r[E_DELETED - 1]),
      content: (function () {
        let s = String(r[E_CONTENT - 1] || '');
        for (let c = E_LEGACY_OVERFLOW_START; c <= E_LAST_CONTENT_COL; c++) s += String(r[c - 1] || '');
        return s;
      })()
    };
  }).filter(function (e) {
    return e.id > 0 && e.name && (e.type === 'folder' || e.type === 'file') && !e.deleted;
  }).sort(function (a, b) { return a.id - b.id; });

  const byLegacyId = {};
  legacyEntries.forEach(function (e) { byLegacyId[e.id] = e; });

  // map legacyId -> store entry (same id ưu tiên để tương thích medical attachment)
  const storeById = {};
  store.entries.forEach(function (e) { storeById[e.id] = e; });

  function ensureFolder(legacyEntry) {
    if (!legacyEntry || legacyEntry.type !== 'folder') throw new Error('Folder không hợp lệ');
    if (storeById[legacyEntry.id] && !storeById[legacyEntry.id].deleted) return storeById[legacyEntry.id];

    let parentStore = null;
    if (legacyEntry.id === 1 || legacyEntry.parentId === null) {
      parentStore = _entryById(store, 1, false);
    } else {
      const parentLegacy = byLegacyId[legacyEntry.parentId];
      parentStore = parentLegacy ? ensureFolder(parentLegacy) : _entryById(store, 1, false);
    }

    const parentFolder = parentStore && parentStore.driveFileId
      ? DriveApp.getFolderById(parentStore.driveFileId)
      : rootFolder;
    const newFolder = parentFolder.createFolder(legacyEntry.name);

    const nextId = Math.max(store.nextId, legacyEntry.id + 1);
    store.nextId = nextId;
    const entry = {
      id: legacyEntry.id,
      name: legacyEntry.name,
      type: 'folder',
      parentId: parentStore ? parentStore.id : null,
      createdAt: legacyEntry.createdAt || _explNowIso(),
      driveFileId: newFolder.getId(),
      mimeType: 'application/vnd.google-apps.folder',
      sizeBytes: 0,
      storageStatus: 'migrated',
      deleted: false
    };

    // replace nếu id đã tồn tại (trường hợp deleted)
    const idx = store.entries.findIndex(function (x) { return x.id === entry.id; });
    if (idx >= 0) store.entries[idx] = entry;
    else store.entries.push(entry);

    storeById[entry.id] = entry;
    return entry;
  }

  let migrated = 0;
  let failed = 0;
  let lastProcessedId = 0;

  for (let i = 0; i < legacyEntries.length; i++) {
    if (migrated >= limit) break;
    const le = legacyEntries[i];
    lastProcessedId = le.id;

    if (storeById[le.id] && !storeById[le.id].deleted) {
      continue; // đã migrate trước đó
    }

    try {
      if (le.type === 'folder') {
        ensureFolder(le);
        migrated++;
      } else {
        const parentLegacy = le.parentId ? byLegacyId[le.parentId] : null;
        const parentStore = parentLegacy ? ensureFolder(parentLegacy) : _entryById(store, 1, false);
        const parentFolder = parentStore && parentStore.driveFileId
          ? DriveApp.getFolderById(parentStore.driveFileId)
          : rootFolder;

        if (!le.content) throw new Error('File legacy không có content');
        const blob = _blobFromDataUrl(le.content, le.name, '');
        const f = parentFolder.createFile(blob);

        const entry = {
          id: le.id,
          name: le.name,
          type: 'file',
          parentId: parentStore ? parentStore.id : null,
          createdAt: le.createdAt || _explNowIso(),
          driveFileId: f.getId(),
          mimeType: blob.getContentType() || 'application/octet-stream',
          sizeBytes: blob.getBytes().length,
          storageStatus: 'migrated',
          deleted: false
        };

        const idx = store.entries.findIndex(function (x) { return x.id === entry.id; });
        if (idx >= 0) store.entries[idx] = entry;
        else store.entries.push(entry);
        storeById[entry.id] = entry;
        migrated++;
      }
    } catch (e) {
      failed++;
    }
  }

  _writeExplorerStore(store);

  const hasMore = legacyEntries.some(function (x) {
    return !storeById[x.id] || storeById[x.id].deleted;
  });

  return {
    success: true,
    migratedCount: migrated,
    failedCount: failed,
    hasMore: hasMore,
    lastProcessedId: lastProcessedId
  };
}

/** cleanup legacy content in Explorer sheet */
function handleCleanupExplorerLegacyContent(body) {
  const limit = Math.max(1, Math.min(1000, parseInt((body && body.limit) || 300, 10)));
  const legacy = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPL_SHEET_LEGACY);
  if (!legacy) return { success: true, cleanedCount: 0, hasMore: false };

  const lastRow = legacy.getLastRow();
  if (lastRow < 2) return { success: true, cleanedCount: 0, hasMore: false };

  const rows = legacy.getRange(2, 1, lastRow - 1, E_LAST_CONTENT_COL).getValues();
  let cleaned = 0;

  for (let i = 0; i < rows.length && cleaned < limit; i++) {
    const r = rows[i];
    const id = parseInt(r[E_ID - 1], 10) || 0;
    const type = String(r[E_TYPE - 1] || '').toLowerCase();
    const deleted = _toBool(r[E_DELETED - 1]);
    if (!id || type !== 'file' || deleted) continue;

    // clear E..DB
    legacy.getRange(i + 2, E_CONTENT, 1, E_LAST_CONTENT_COL - E_CONTENT + 1).clearContent();
    cleaned++;
  }

  const hasMore = cleaned === limit;
  return { success: true, cleanedCount: cleaned, hasMore: hasMore };
}

/** delete Explorer sheet permanently after migration */
function handleDeleteExplorerSheetAfterMigration(_body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const legacy = ss.getSheetByName(EXPL_SHEET_LEGACY);
  if (!legacy) return { success: true, message: 'Explorer sheet đã không tồn tại' };

  // safety: chỉ xoá khi store có dữ liệu > root
  const store = _readExplorerStore();
  const activeCount = _activeEntries(store).length;
  if (activeCount <= 1) {
    throw new Error('Chưa thể xoá tab Explorer: chưa thấy dữ liệu đã migrate');
  }

  ss.deleteSheet(legacy);
  return { success: true, message: 'Đã xoá tab Explorer legacy' };
}


/* =========================
 * Log (activity history) handlers
 * ========================= */

/**
 * Thêm log entry mới vào tab `Log`.
 * Body: { log: { id, user, type, content, timestamp } }
 * - id: unique ID (client tự sinh)
 * - user: ai thực hiện thao tác
 * - type: loại event (FEEDING_ADDED, WEIGHT_UPDATED, etc.)
 * - content: nội dung user-friendly
 * - timestamp: ISO string (client truyền hoặc server auto)
 */
function handleAddLog(body) {
  const sheet = _getSheet(LOG_SHEET);
  const log = body.log || {};
  const id = String(log.id || '').trim();
  const user = String(log.user || '').toLowerCase().trim();
  const type = String(log.type || '').trim().toUpperCase();
  const content = String(log.content || '').trim();
  const timestamp = String(log.timestamp || '').trim() || new Date().toISOString();

  if (!id || !user || !type || !content) {
    throw new Error('Thiếu trường bắt buộc (id, user, type, content).');
  }

  sheet.appendRow([id, user, type, content, timestamp]);

  // Đảm bảo timestamp là plain text
  try {
    sheet.getRange(sheet.getLastRow(), L_TIMESTAMP).setNumberFormat('@');
  } catch (e) {
    // Bỏ qua nếu không có quyền
  }

  return { success: true, message: 'Đã ghi log', rowIndex: sheet.getLastRow() };
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

function testAddLog() {
  const result = handleAddLog({
    log: {
      id: 'log-' + Date.now() + '-test',
      user: 'phat',
      type: 'FEEDING_ADDED',
      content: "Thêm cữ bú '100ml' vào lúc '08:30'",
      timestamp: new Date().toISOString()
    }
  });
  Logger.log(JSON.stringify(result));
}

function authorizeDriveAccess() {
  return DriveApp.getFolderById(EXPL_DRIVE_FOLDER_ID).getName();
}

function authorizeDriveWrite() {
  const root = DriveApp.getFolderById(EXPL_DRIVE_FOLDER_ID);
  const tmp = root.createFolder('tmp-auth-' + Date.now());
  tmp.setTrashed(true);
  return 'ok';
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
   - **Who has access**: **Anyone** *(QUAN TRỌNG: không phải "Anyone with Google account" – sẽ bị CORS errors trên mobile)*.
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

## 6.5 Drive private mode (2 account)

Mô hình áp dụng:

- **Acc A**: owner Google Sheet + Apps Script.
- **Acc B**: owner folder Google Drive lưu file thật.
- Folder acc B phải share quyền **Editor** cho email acc A.

Checklist cấu hình:

1. Acc B tạo folder, copy folder ID.
2. Dán ID vào `EXPL_DRIVE_FOLDER_ID`.
3. Deploy lại Apps Script (new version).
4. Từ app, upload thử 1 file và kiểm tra:
   - Row mới ở tab `Explorer` có `driveFileId`.
   - File xuất hiện trong folder Drive acc B.
5. Chạy migrate xong thì xoá hoàn toàn tab `Explorer` bằng action finalize (không dùng sheet tree nữa).

Các handler cần có trong Apps Script Explorer:

- `handleGetExplorerFile(body)`:
  - Input: `id` hoặc `driveFileId`.
  - Output: `{ success, name, mimeType, sizeBytes, dataUrl }`.
- `handleMigrateExplorerToDrive(body)`:
  - Input gợi ý: `limit`, `startAfterId` (optional).
  - Duyệt toàn bộ cây cũ trong sheet và **copy nguyên cấu trúc folder** sang Drive đích.
  - Với mỗi folder: tạo folder Drive tương ứng dưới đúng parent mới.
  - Với mỗi file: tạo file Drive tương ứng vào đúng folder Drive vừa map.
  - Lưu mapping `oldExplorerId -> driveFileId/driveFolderId` để idempotent khi chạy nhiều batch.
  - Trả count thành công/thất bại để chạy batch nhiều lần.
- `handleCleanupExplorerLegacyContent(body)`:
  - Xoá `E + H..DB` cho row đã có `driveFileId` và `storageStatus` hợp lệ.
  - Chỉ chạy sau khi verify migrate.
- `handleDeleteExplorerSheetAfterMigration(body)`:
  - Chỉ cho phép khi đã verify migrate hoàn tất (`hasMore=false`, không còn orphan).
  - Xoá hẳn tab `Explorer` khỏi Google Sheet.

Gợi ý helper:

- `_getExplorerDriveFolder()`:
  - `DriveApp.getFolderById(EXPL_DRIVE_FOLDER_ID)` và throw lỗi rõ nếu không truy cập được.
- `_dataUrlToBlob(dataUrl, filename, mimeTypeOverride)`:
  - Parse header + payload base64, convert ra blob để `folder.createFile(blob)`.
- `_isDriveMetaCell(value)`:
  - Nhận diện row đã chuyển Drive để tránh nhầm với overflow chunk legacy.
- `_ensureDriveFolderPath(...)`:
  - Bảo đảm folder tree trên Drive tồn tại đúng cấu trúc cũ trước khi copy file.

Lưu ý timeout:

- Apps Script dễ timeout khi migrate nhiều file lớn; chạy batch nhỏ (`limit=5..20`) và gọi lặp lại tới khi hết.
- Không xoá tab `Explorer` ngay ở batch đầu. Luôn test preview + download trên app trước.
- Chỉ gọi `deleteExplorerSheetAfterMigration` sau khi migrate xong toàn bộ và verify dữ liệu.

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
  - Bấm **+ Thêm file** → chọn ảnh hoặc tài liệu.
  - Ảnh sẽ được nén trước khi gửi; file thường giữ nguyên và lưu vào Drive private.
  - Bấm vào file ảnh → xem preview fullscreen. File không phải ảnh sẽ tải xuống.
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
| Mobile CORS errors (`Status code: 405`)          | 1. Apps Script deployment → **Who has access** = **Anyone** (không phải "Anyone with Google account"). 2. Redeploy Apps Script với new version. 3. Mobile browsers có stricter CORS policies. |
| File upload thất bại với lỗi "quá lớn"           | App giới hạn upload để phù hợp free-tier và Apps Script runtime (mặc định 10MB/file). Hãy giảm kích thước file rồi thử lại. |
| Không tải được preview/download từ Explorer      | Thường do Apps Script chưa có action `getExplorerFile`, hoặc endpoint prod không đi qua proxy `/api/feeding-apps-script` nên không đọc được JSON response. |
| Không xoá được folder                            | Folder đó là root logic của Explorer (`id=1`) hoặc folder Drive tương ứng bị khoá quyền. Kiểm tra quyền của acc A trên folder Drive acc B.                                      |
| Đã migrate xong nhưng chưa xoá được tab Explorer | Hãy chạy migrate đến khi `hasMore=false`, sau đó gọi action `deleteExplorerSheetAfterMigration`. Nếu còn file lỗi migrate, action sẽ từ chối xoá tab để tránh mất dữ liệu.     |
| Mới upload xong mà refresh thấy biến mất         | Có thể row đó đang có cột G = `TRUE` (do bug data cũ). Vào sheet kiểm tra cột G, đặt lại `FALSE` hoặc xoá cell.                                                              |
| Ngày trong Feeding bị format số/lệch              | Cột B của Feeding đang là Number/Date. Chọn cột B → Format → Number → **Plain text**.                                                                                              |
| Log không ghi / không đọc được                   | Tab `Log` chưa tồn tại hoặc tên sai chữ hoa/thường. Kiểm tra lại header (A:E) và cột A, E nên là **Plain text**.                                                                     |

---

## 9. Sơ đồ luồng dữ liệu

```text
[Browser /feeding?user=quyen]
        │
        │  GET (read)
        ├──────► Google Sheets API v4 (API Key)
        │        ├─ Feeding!A2:E
        │        ├─ (legacy) Explorer!A2:DB chỉ dùng trong giai đoạn migrate
        │        └─ Log!A2:E         (lịch sử hoạt động — reload every 5 mins)
        │
        │  POST {action, ...}
        └──────► Proxy /api/feeding-apps-script (dev)
                 hoặc googleFeedingAppsScriptUrl (prod)
                 → doPost
                   ├─ Feeding:  add / update / delete (hard) / get
                   ├─ Explorer: add / update / delete / move / get (Drive-first tree)
                   │            getExplorerFile / migrateExplorerToDrive
                   │            cleanupExplorerLegacyContent / deleteExplorerSheetAfterMigration
                   └─ Log:      addLog (ghi activity event)
```
