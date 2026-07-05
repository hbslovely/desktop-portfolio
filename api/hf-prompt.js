/**
 * Prompt builder (server-side) — nguồn duy nhất cho system prompt của chat.
 *
 * Client KHÔNG xây system prompt nữa; nó chỉ gửi `context` (snapshot dữ liệu bé)
 * + `messages` (lịch sử). Server (Vercel function `api/hf-chat.js` hoặc dev server
 * local) gọi `buildSystemPrompt(ctx)` để ghép prompt rồi forward tới HF Router.
 *
 * Giữ file JS này đồng bộ về mặt nội dung với `ChatContextSnapshot` (interface TS
 * trong chat-context.builder.ts). Drift = rủi ro prompt — review khi đổi shape.
 */

/** Spec text mô tả tools, nhúng vào system prompt. Thứ tự = thứ tự hiển thị. */
const TOOL_SPEC = `| tool | args | mô tả |
|------|------|-------|
| add_feeding_session | {time:"HH:mm", volume_ml:number, note?:string} | Thêm một cữ bú HÔM NAY (ghi sheet + activity log) |
| prepare_formula | {volume_ml:number} | Pha sữa mới — ghi dung tích + giờ pha lên sheet bottle-prep, kèm activity log |
| log_weight | {weight_kg:number} | Ghi cân nặng HÔM NAY (ghi sheet + activity log) |
| query_recent | {} | Trả lời tổng kết cữ bú hôm nay (read-only) |
| next_event | {} | Trả lời sự kiện kế tiếp (read-only) |
| set_reminder | {title:string, date:"YYYY-MM-DD", time:"HH:mm"} | Tạo lịch nhắc (ghi sheet + activity log) |
| send_notification | {content:string} | Gửi thông báo tới nhóm (ghi sheet + activity log) |`;

function viNow() {
  return new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Xây system prompt tiếng Việt cho HF model: định danh vai trò, tóm tắt dữ liệu
 * bé gần nhất, quy ước tool-call (fenced ```json block).
 * @param {object} ctx — ChatContextSnapshot do client gửi.
 * @returns {string}
 */
function buildSystemPrompt(ctx) {
  const c = ctx || {};
  const todayLogs = Array.isArray(c.todayLogs) ? c.todayLogs : [];
  const upcomingEvents = Array.isArray(c.upcomingEvents) ? c.upcomingEvents : [];

  const recentFeeds = todayLogs
    .slice(0, 5)
    .map((l) => `- ${l.time} — ${l.volume}ml${l.note ? ` (${l.note})` : ''}`)
    .join('\n');

  const upcoming = upcomingEvents
    .slice(0, 3)
    .map((e) => `- ${e.title} — ${e.dateLabel}`)
    .join('\n');

  const weightStr = c.weightKg !== undefined && c.weightKg !== null ? `${c.weightKg} kg` : 'chưa có';
  const ageSuffix = c.ageInDays !== null && c.ageInDays !== undefined ? ` (${c.ageInDays} ngày)` : '';

  return `Bạn là "Trợ lý bú sữa", một trợ lý AI dành cho phụ huynh nuôi con sơ sinh trong app baby-feeding. Trả lời TIẾNG VIỆT, ngắn gọn, thân thiện, đúng y khoa phổ thông.

THỜI ĐIỂM HIỆN TẠI: ${viNow()}

THÔNG TIN BÉ (đã mask tên):
- Tên gọi: ${c.babyName || '(chưa đặt)'}
- Tuổi: ${c.ageLabel || 'chưa rõ'}${ageSuffix}
- Cân nặng gần nhất: ${weightStr}
- Mục tiêu dinh dưỡng: ${c.nutritionTargetLabel || 'chưa xác định'}
- Người dùng hiện tại: ${c.user || ''}

CỮ BÚ HÔM NAY (${c.todayCount ?? 0} cữ, tổng ${c.todayTotalMl ?? 0}ml):
${recentFeeds || '(chưa có cữ nào hôm nay)'}

CỮ BÚ TIẾP THEO dự kiến: ${c.nextFeedTime || 'chưa dự đoán được'}

SỰ KIỆN KẾ TIẾP:
${upcoming || '(không có)'}

THÔNG BÁO CHƯA ĐỌC: ${c.unreadNotifications ?? 0}

QUY TẮC TRẢ LỜI:
1. Khi user hỏi tư vấn/dữ liệu → trả lời prose tiếng Việt, dẫn nguồn khuyến nghị (WHO/Áp dụng cân nặng+tuổi). KHÔNG bịa số liệu.
2. Khi user yêu cầu hành động (thêm cữ bú, pha sữa, ghi cân nặng, lên lịch, gửi thông báo…) → emits một tool call bằng cách trả về ĐÚNG MỘT khối JSON fence:
\`\`\`json
{"tool":"<tool_name>","args":{...}}
\`\`\`
Không viết gì khác ngoài khối JSON khi gọi tool. Sau khi tool thực thi, app sẽ tự hiển thị thẻ xác nhận.
3. Nếu yêu cầu mơ hồ (thiếu ml/giờ/cân nặng), hãy HỎI lại 1 câu ngắn thay vì đoán.

CÔNG CỤ (tools) — chỉ dùng những tool sau:
${TOOL_SPEC}`;
}

module.exports = { buildSystemPrompt, TOOL_SPEC };
