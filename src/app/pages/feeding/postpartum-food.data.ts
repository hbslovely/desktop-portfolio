/**
 * Postpartum food suggestions by stage.
 *
 * Stage mốc theo ngày tuổi của bé (~ số tuần sau sinh của mẹ).
 * Nội dung tổng hợp theo tài liệu dinh dưỡng sau sinh phổ biến tại VN +
 * khuyến cáo WHO/AAP về cho con bú. Mang tính tham khảo, không thay thế
 * chỉ định của bác sĩ / chuyên gia dinh dưỡng.
 */

export interface FoodItem {
  name: string;
  note?: string;
  /** Emoji minh họa */
  emoji?: string;
}

export interface PostpartumStage {
  id: string;
  label: string;
  /** inclusive, ngày tuổi bé */
  ageFromDays: number;
  /** exclusive */
  ageToDays: number;
  headline: string;
  description: string;
  encourage: FoodItem[];
  avoid: FoodItem[];
  tip?: string;
  accent: 'rose' | 'peach' | 'mint' | 'lavender' | 'amber';
}

export const POSTPARTUM_STAGES: PostpartumStage[] = [
  {
    id: 'week-1-2',
    label: 'Tuần 1–2 · Hồi phục sau sinh',
    ageFromDays: 0,
    ageToDays: 14,
    headline: 'Ưu tiên dễ tiêu · ấm bụng · gọi sữa về',
    description:
      'Dạ dày còn yếu, tập trung món ấm, lỏng, dễ tiêu. Chia nhỏ 5–6 bữa/ngày. Uống 2–2.5L nước ấm, hạn chế đồ lạnh – tanh – sống.',
    encourage: [
      { name: 'Cháo móng giò đu đủ xanh', note: 'Lợi sữa kinh điển · 1–2 bát/ngày', emoji: '🍲' },
      { name: 'Canh rau ngót thịt bằm', note: 'Giàu sắt, giúp tử cung co tốt', emoji: '🥣' },
      { name: 'Cá hồi hấp gừng', note: 'DHA cho bé, 2–3 bữa/tuần', emoji: '🐟' },
      { name: 'Trứng luộc / hấp', note: '1–2 quả/ngày', emoji: '🥚' },
      { name: 'Thịt bò kho gừng', note: 'Bổ máu, ấm bụng', emoji: '🍖' },
      { name: 'Chuối chín, đu đủ chín', note: 'Ngừa táo bón', emoji: '🍌' },
      { name: 'Nước ấm, trà gạo lứt, nước chè vằng', emoji: '🍵' },
      { name: 'Cháo yến mạch, cháo gạo lứt', note: 'Tiêu hóa nhẹ nhàng', emoji: '🥛' },
    ],
    avoid: [
      { name: 'Đồ lạnh, nước đá', note: 'Gây ê răng, lạnh bụng, ít sữa' },
      { name: 'Rau sống, gỏi, nem chua', note: 'Rủi ro nhiễm khuẩn' },
      { name: 'Hải sản tanh, mắm tôm', note: 'Có thể làm bé đầy hơi' },
      { name: 'Đồ cay nóng, tiêu ớt nhiều', note: 'Nóng sữa, bé quấy' },
      { name: 'Cà phê, trà đặc, nước ngọt có gas' },
      { name: 'Rượu, bia', note: 'Ảnh hưởng thần kinh của bé' },
      { name: 'Chiên rán ngập dầu', note: 'Khó tiêu, dễ tắc tia sữa' },
    ],
    tip: 'Ăn món còn ấm. Uống 1 cốc nước ấm trước mỗi cữ bú sẽ giúp sữa xuống nhanh hơn.',
    accent: 'rose',
  },
  {
    id: 'week-3-6',
    label: 'Tuần 3–6 · Ổn định & bứt tốc sữa',
    ageFromDays: 14,
    ageToDays: 42,
    headline: 'Đa dạng món · tăng lợi sữa · bổ máu',
    description:
      'Tiêu hóa tốt hơn, có thể ăn đa dạng. Tập trung protein chất lượng, rau xanh đậm, hạt & ngũ cốc nguyên cám để sữa đặc, nhiều.',
    encourage: [
      { name: 'Cá chép hầm đậu đỏ', note: 'Bổ máu, lợi sữa', emoji: '🐟' },
      { name: 'Gà ác hầm thuốc bắc', note: '1–2 lần/tuần', emoji: '🍗' },
      { name: 'Canh bí đỏ đậu xanh', note: 'Vitamin A · chất xơ', emoji: '🎃' },
      { name: 'Chè vừng đen', note: 'Canxi · lợi sữa', emoji: '🖤' },
      { name: 'Yến mạch, ngũ cốc nguyên cám', emoji: '🌾' },
      { name: 'Rau lang, rau ngót, rau dền luộc', emoji: '🥬' },
      { name: 'Sữa ấm, sữa hạt (óc chó, hạnh nhân)', emoji: '🥛' },
      { name: 'Nước ép cà rốt, táo, lê', note: 'Tươi, không đá', emoji: '🥕' },
    ],
    avoid: [
      { name: 'Măng chua, dưa chua quá mặn' },
      { name: 'Đồ ăn nhanh, xúc xích, thịt hộp' },
      { name: 'Bạc hà nhiều, lá lốt quá liều', note: 'Có thể làm giảm sữa' },
      { name: 'Cà phê > 1 ly/ngày' },
    ],
    tip: 'Ăn cá béo 2–3 bữa/tuần, bổ sung 1 nắm hạt mỗi ngày. Nghỉ ngơi + skin-to-skin giúp sữa về tốt.',
    accent: 'peach',
  },
  {
    id: 'month-2-3',
    label: 'Tháng 2–3 · Dinh dưỡng cân bằng',
    ageFromDays: 42,
    ageToDays: 90,
    headline: 'Đa dạng · bổ sung canxi – DHA · đủ nước',
    description:
      'Bé bú nhiều hơn, mẹ cần ~2200–2500 kcal/ngày. Cân bằng 4 nhóm: bột đường – đạm – béo tốt – vitamin & khoáng.',
    encourage: [
      { name: 'Cá hồi, cá thu nhỏ (cá lành)', note: '2–3 bữa/tuần (DHA)', emoji: '🐟' },
      { name: 'Thịt bò, thịt gà, trứng', note: 'Luân phiên mỗi ngày', emoji: '🥩' },
      { name: 'Sữa, sữa chua, phô mai', note: '2–3 đơn vị canxi/ngày', emoji: '🧀' },
      { name: 'Rau xanh đậm, bông cải xanh', emoji: '🥦' },
      { name: 'Trái cây: cam, kiwi, việt quất, đu đủ', emoji: '🍊' },
      { name: 'Hạt óc chó, hạnh nhân, hạt chia', note: '1 nắm/ngày', emoji: '🌰' },
      { name: 'Khoai lang, yến mạch, gạo lứt', emoji: '🍠' },
      { name: 'Đậu hũ, đậu nành (vừa phải)', emoji: '🫘' },
    ],
    avoid: [
      { name: 'Cá lớn chứa thủy ngân cao', note: 'Cá kiếm, cá ngừ đại dương' },
      { name: 'Caffeine > 200mg/ngày', note: '~1 ly cafe nhỏ' },
      { name: 'Rượu, bia', note: 'Nếu uống cần vắt bỏ cữ sau 2–3h' },
      { name: 'Đồ ăn chế biến sẵn nhiều muối' },
    ],
    tip: 'Đi vệ sinh > 6 lần/ngày và bé tăng ~150g/tuần là dấu hiệu mẹ ăn đủ, sữa đủ chất.',
    accent: 'mint',
  },
  {
    id: 'month-4-6',
    label: 'Tháng 4–6 · Duy trì sữa mẹ',
    ageFromDays: 90,
    ageToDays: 180,
    headline: 'Đa dạng · theo dõi dị ứng · giảm đường tinh',
    description:
      'Tiếp tục ăn đủ 4 nhóm, uống 2.5–3L nước/ngày. Để ý bé có nổi mẩn/tiêu chảy sau khi mẹ ăn món lạ (trứng, hải sản, đậu phộng).',
    encourage: [
      { name: 'Cá béo 2–3 lần/tuần (DHA)', emoji: '🐠' },
      { name: 'Rau củ nhiều màu', note: 'Mỗi bữa ≥ 1 loại rau', emoji: '🌈' },
      { name: 'Trái cây đa dạng, cả trái cây chua', emoji: '🍎' },
      { name: 'Yogurt không đường, kefir', note: 'Lợi khuẩn cho mẹ & bé', emoji: '🥛' },
      { name: 'Ngũ cốc nguyên cám, khoai lang', emoji: '🌾' },
      { name: 'Thịt nạc, trứng, đậu hạt', emoji: '🥚' },
      { name: 'Nước lọc, nước dừa', note: '2.5–3L/ngày', emoji: '💧' },
    ],
    avoid: [
      { name: 'Bánh kẹo, nước ngọt', note: 'Đường tinh luyện tăng cân nhanh' },
      { name: 'Món chiên ngập dầu thường xuyên' },
      { name: 'Thực phẩm bé có biểu hiện dị ứng', note: 'Ngưng 2–4 tuần rồi thử lại' },
      { name: 'Đồ uống có cồn', note: 'Nếu bắt buộc, vắt sữa trước' },
    ],
    tip: 'Bắt đầu nghĩ đến việc giảm cân khoa học: giảm tinh bột tinh, tăng protein + rau xanh, tập đi bộ 30 phút/ngày.',
    accent: 'lavender',
  },
  {
    id: 'month-6-plus',
    label: 'Trên 6 tháng · Kết hợp ăn dặm',
    ageFromDays: 180,
    ageToDays: 999999,
    headline: 'Đa dạng · giảm dần "khẩu phần cho 2" · giữ sữa tốt',
    description:
      'Bé bắt đầu ăn dặm nên sữa mẹ giảm lượng cần thiết. Mẹ có thể về chế độ ăn cân bằng cho người lớn bình thường + bổ sung canxi/omega-3.',
    encourage: [
      { name: 'Protein nạc · luân phiên nguồn', note: 'Cá, gà, đậu, trứng', emoji: '🍗' },
      { name: 'Rau xanh, trái cây ≥ 400g/ngày', emoji: '🥗' },
      { name: 'Sữa, sữa chua, phô mai', note: 'Duy trì canxi', emoji: '🧈' },
      { name: 'Dầu oliu, dầu cá, hạt', note: 'Omega-3 · béo lành', emoji: '🫒' },
      { name: 'Nước lọc · trà thảo mộc', emoji: '💧' },
    ],
    avoid: [
      { name: 'Kiêng khem cực đoan để giảm cân', note: 'Làm tụt sữa nhanh' },
      { name: 'Thực phẩm siêu chế biến, đường ẩn' },
      { name: 'Rượu, thuốc lá' },
    ],
    tip: 'Tiếp tục cho bú 2 năm theo khuyến nghị WHO. Tập thể dục 150 phút/tuần giúp giữ dáng và tinh thần tốt.',
    accent: 'amber',
  },
];

/**
 * Tìm giai đoạn phù hợp với tuổi bé (ngày).
 */
export function resolvePostpartumStage(ageInDays: number): PostpartumStage {
  for (const s of POSTPARTUM_STAGES) {
    if (ageInDays >= s.ageFromDays && ageInDays < s.ageToDays) return s;
  }
  return POSTPARTUM_STAGES[POSTPARTUM_STAGES.length - 1];
}
