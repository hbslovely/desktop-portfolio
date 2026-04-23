/**
 * Dòng thời gian phát triển của trẻ — tổng hợp từ các nguồn y khoa:
 *  - AAP HealthyChildren.org (developmental milestones)
 *  - CDC "Learn the Signs. Act Early." milestones
 *  - WHO Child Growth Standards
 *  - The Wonder Weeks (Dr. Hetty van de Rijt & Dr. Frans Plooij)
 *  - La Leche League / AAP (stomach size by age)
 *  - Vinmec Vietnam (bài tuần tuổi)
 */

export type MoodType =
  | 'calm' // Bình thường, học thích nghi
  | 'happy' // Giai đoạn "thiên thần"
  | 'growth' // Growth spurt — bú nhiều, tăng cân
  | 'leap' // Wonder Week — quấy, nhảy vọt nhận thức
  | 'milestone'; // Cột mốc lớn (nụ cười, ngồi, đi, nói...)

export interface StomachSize {
  /** Mô tả so sánh: "quả anh đào", "quả óc chó"... */
  compareTo: string;
  /** "5–7ml", "22–27ml"... */
  volumeMl: string;
  /** Emoji trực quan (hoa quả tương tự) */
  emoji: string;
  /** Scale vòng tròn visualization (0.2 → 1.5) */
  scale: number;
}

export interface TimelineMilestone {
  id: string;
  /** "Tuần 1", "Tuần 5", "Tháng 4"... */
  periodLabel: string;
  /** Tóm tắt 1 dòng (hiển thị cạnh period label) */
  tagline: string;
  /** Ngày tuổi bắt đầu (inclusive) */
  ageFromDays: number;
  /** Ngày tuổi kết thúc (inclusive) */
  ageToDays: number;
  /** Emoji chủ đạo cho giai đoạn */
  heroEmoji: string;
  /** Kích thước dạ dày */
  stomach: StomachSize;
  /** Tâm trạng chung */
  mood: MoodType;
  /** Nhãn tâm trạng (hiện trên badge) */
  moodLabel: string;
  /** 2-4 sự thật thú vị */
  funFacts: string[];
  /** Kỹ năng bé có/đang học (optional) */
  skills?: string[];
  /** 2-3 lưu ý cho ba mẹ */
  parentNotes: string[];
  /** Tone màu */
  accent: 'rose' | 'peach' | 'mint' | 'lavender' | 'amber' | 'sky' | 'coral' | 'plum';
}

export const BABY_TIMELINE: TimelineMilestone[] = [
  {
    id: 'w1',
    periodLabel: 'Tuần 1',
    tagline: 'Làm quen thế giới',
    ageFromDays: 0,
    ageToDays: 6,
    heroEmoji: '👶',
    stomach: { compareTo: 'quả anh đào → óc chó', volumeMl: '5–27ml', emoji: '🍒', scale: 0.25 },
    mood: 'calm',
    moodLabel: 'Bình yên • Tuần ở cữ',
    funFacts: [
      'Dạ dày chỉ bằng quả anh đào ngày đầu — sữa non 5–7ml là vừa đủ.',
      'Bé nhận ra giọng mẹ ngay từ trong bụng; thính giác gần như hoàn chỉnh.',
      'Sụt 5–10% cân nặng trong 3–5 ngày đầu là bình thường — lấy lại sau ~10–14 ngày.',
      'Nước mắt chưa chảy dù khóc: tuyến lệ chỉ mở hoàn toàn sau 3 tuần.',
    ],
    skills: ['Phản xạ Moro, mút, nắm tay', 'Nhìn rõ khoảng cách 20–30cm'],
    parentNotes: [
      'Bú theo nhu cầu 8–12 cữ/ngày, đánh thức nếu ngủ >3 giờ.',
      'Da kề da để ổn định nhịp tim bé + kích sữa non.',
      'Bú mẹ: bổ sung vitamin D 400 IU/ngày cho bé.',
    ],
    accent: 'rose',
  },
  {
    id: 'w2',
    periodLabel: 'Tuần 2',
    tagline: 'Hồi phục cân nặng',
    ageFromDays: 7,
    ageToDays: 13,
    heroEmoji: '🌱',
    stomach: { compareTo: 'quả mơ', volumeMl: '45–60ml', emoji: '🍑', scale: 0.4 },
    mood: 'calm',
    moodLabel: 'Bình yên',
    funFacts: [
      'Rụng cuống rốn thường xảy ra tuần này (5–15 ngày sau sinh).',
      'Bé có thể mỉm cười "phản xạ" khi ngủ — chưa phải cười xã giao.',
      'Tăng 20–30g/ngày, chu vi đầu tăng rõ.',
      'Growth spurt nhỏ ngày 7–10: đòi bú liên tục 1–2 ngày.',
    ],
    skills: ['Nhìn theo vật chuyển động ngắn', 'Giao tiếp bằng mắt với mẹ'],
    parentNotes: [
      'Kiểm tra khớp ngậm: cằm chạm ngực, môi dưới lật ra.',
      'Giữ cuống rốn khô — không băng kín, quan sát dấu hiệu nhiễm trùng.',
      'Mẹ theo dõi tắc tia sữa (ngực cứng đau) → chườm ấm + cho bé bú bên đau trước.',
    ],
    accent: 'peach',
  },
  {
    id: 'w3',
    periodLabel: 'Tuần 3',
    tagline: 'Growth spurt thể chất',
    ageFromDays: 14,
    ageToDays: 20,
    heroEmoji: '🌸',
    stomach: { compareTo: 'quả trứng gà', volumeMl: '80–100ml', emoji: '🥚', scale: 0.5 },
    mood: 'growth',
    moodLabel: 'Growth spurt • Cluster feeding',
    funFacts: [
      'Đợt tăng trưởng đáng kể: bé đòi bú mỗi 1–1.5 giờ.',
      'Khoảng 15–20% trẻ bắt đầu có cơn colic (khóc không rõ nguyên nhân, thường buổi tối).',
      'Bắt đầu nhấc đầu vài giây khi nằm sấp.',
      'Nhận biết khuôn mặt quen — thường nhìn chăm chú mẹ hơn.',
    ],
    skills: ['Nhấc đầu 1–3 giây', 'Nhìn theo vật di chuyển'],
    parentNotes: [
      'Cluster feeding là bình thường — KHÔNG phải "mẹ thiếu sữa".',
      'Chưa phải Wonder Week: growth spurt = TĂNG CÂN nhanh; Wonder Week (bước nhảy nhận thức) đến tuần 5.',
      'Mẹ coi chừng baby blues — nếu buồn >2 tuần, tìm tư vấn.',
    ],
    accent: 'coral',
  },
  {
    id: 'w4',
    periodLabel: 'Tuần 4',
    tagline: 'Nụ cười xã giao đầu tiên',
    ageFromDays: 21,
    ageToDays: 27,
    heroEmoji: '😊',
    stomach: { compareTo: 'quả trứng lớn', volumeMl: '90–120ml', emoji: '🥚', scale: 0.55 },
    mood: 'happy',
    moodLabel: 'Happy • Nụ cười đầu tiên',
    funFacts: [
      '🎉 Nụ cười xã giao đầu tiên — KHÔNG phải phản xạ, bé cười khi thấy mặt mẹ!',
      'Ê a nguyên âm: "a-a", "ơ-ơ".',
      'Một giấc đêm có thể dài 4–5 giờ.',
      'Mắt bắt đầu phối hợp — hết "lác sinh lý".',
    ],
    skills: ['Cười xã giao', 'Ê a âm nguyên', 'Nhấc đầu 45° ngắn'],
    parentNotes: [
      'Đáp lại tiếng bé như hội thoại thật — nền tảng ngôn ngữ.',
      'Chuẩn bị lịch tiêm 2 tháng: 6in1, Rota, PCV.',
      'Mẹ đi khám hậu sản 6 tuần.',
    ],
    accent: 'amber',
  },
  {
    id: 'w5',
    periodLabel: 'Tuần 5',
    tagline: 'Wonder Week 1 — Giác quan thay đổi',
    ageFromDays: 28,
    ageToDays: 34,
    heroEmoji: '🌩️',
    stomach: { compareTo: 'quả trứng to', volumeMl: '120–150ml', emoji: '🥚', scale: 0.6 },
    mood: 'leap',
    moodLabel: 'Leap 1 • Tuần khủng hoảng',
    funFacts: [
      'Leap 1 "World of Changing Sensations" — bước nhảy nhận thức đầu tiên.',
      '3 chữ C: Crying (khóc), Clinginess (bám), Crankiness (cáu) — kéo dài 1–2 tuần.',
      'Sau leap: giác quan nhạy hơn, phản ứng đa dạng với âm thanh + ánh sáng.',
      'Nhận ra giọng mẹ trong đám đông.',
    ],
    skills: ['Phối hợp mắt-tai', 'Phản ứng chi tiết với ngoại cảnh'],
    parentNotes: [
      'Đừng hoảng: giai đoạn fussy chỉ vài ngày → vài tuần.',
      'Ôm ấp nhiều hơn, giảm kích thích mạnh (đám đông, đèn chói).',
      'Bé bú nhiều hơn để tự trấn an — không phải thiếu sữa.',
    ],
    accent: 'plum',
  },
  {
    id: 'w6',
    periodLabel: 'Tuần 6',
    tagline: 'Post-leap glow + Growth spurt',
    ageFromDays: 35,
    ageToDays: 48,
    heroEmoji: '✨',
    stomach: { compareTo: 'quả chanh', volumeMl: '120–150ml', emoji: '🍋', scale: 0.65 },
    mood: 'growth',
    moodLabel: 'Growth spurt #2 • Cười nhiều',
    funFacts: [
      'Đợt tăng trưởng tiếp theo (tuần 6) — đòi bú tăng đột ngột.',
      'Tiếng cười thành âm thanh, không chỉ cười mắt.',
      'Theo dõi bằng mắt chính xác hơn, thích đồ đen-trắng tương phản.',
      'Nhiều bé bắt đầu ngủ đêm liền mạch 5 giờ.',
    ],
    skills: ['Cười thành tiếng nhẹ', 'Nhấc đầu khi nằm sấp vài giây'],
    parentNotes: [
      'Cho bú theo nhu cầu — đừng hoảng vì bú tăng đột ngột.',
      'Tummy time 2–3 lần/ngày, mỗi lần 3–5 phút.',
      'Bắt đầu routine ngủ nhẹ: tắm → bú → ru.',
    ],
    accent: 'sky',
  },
  {
    id: 'w8',
    periodLabel: 'Tuần 8',
    tagline: 'Wonder Week 2 — Mẫu hình',
    ageFromDays: 49,
    ageToDays: 62,
    heroEmoji: '🧩',
    stomach: { compareTo: 'quả chanh', volumeMl: '150ml', emoji: '🍋', scale: 0.7 },
    mood: 'leap',
    moodLabel: 'Leap 2 • World of Patterns',
    funFacts: [
      'Leap 2 "World of Patterns" — bé nhận ra mẫu hình lặp lại.',
      'Bắt đầu ngắm tay mình như khám phá đồ vật mới.',
      'Soi gương, chú ý khuôn mặt lâu hơn.',
      'Nhấc đầu 45° khi nằm sấp.',
    ],
    skills: ['Nhận diện mẫu hình', 'Hóng chuyện chăm chú', 'Cầm lục lạc ngắn'],
    parentNotes: [
      '⚠️ Tiêm chủng 2 tháng: 6in1 (bạch hầu/ho gà/uốn ván/bại liệt/Hib/viêm gan B), Rota, PCV.',
      'Đọc sách tương phản, treo di động trên nôi.',
      'Routine ngủ ổn định hơn.',
    ],
    accent: 'lavender',
  },
  {
    id: 'w10',
    periodLabel: 'Tuần 10',
    tagline: 'Giai đoạn thiên thần',
    ageFromDays: 63,
    ageToDays: 76,
    heroEmoji: '🌈',
    stomach: { compareTo: 'quả chanh to', volumeMl: '150–180ml', emoji: '🍋', scale: 0.75 },
    mood: 'happy',
    moodLabel: 'Happy • Ít colic hơn',
    funFacts: [
      'Colic thường dịu đi sau 10 tuần — mẹ thở phào!',
      'Với tay chạm đồ chơi, đưa tay vào miệng khám phá.',
      'Ngủ đêm dài hơn, nhịp ngày-đêm rõ ràng.',
      'Bắt đầu "hội thoại" với mẹ: ê a → chờ phản hồi → ê a tiếp.',
    ],
    skills: ['Phối hợp tay-mắt sơ khai', 'Ê a đa âm'],
    parentNotes: [
      'Cho bé cầm khăn mềm, đồ chơi chất liệu khác nhau.',
      'Đọc sách to mỗi ngày 5–10 phút.',
      'Routine tắm-bú-ngủ buổi tối.',
    ],
    accent: 'mint',
  },
  {
    id: 'w12',
    periodLabel: 'Tuần 12',
    tagline: 'Wonder Week 3 — Chuyển động mượt',
    ageFromDays: 77,
    ageToDays: 104,
    heroEmoji: '🎶',
    stomach: { compareTo: 'quả cam nhỏ', volumeMl: '150–180ml', emoji: '🍊', scale: 0.8 },
    mood: 'leap',
    moodLabel: 'Leap 3 • Smooth Transitions',
    funFacts: [
      'Leap 3 "World of Smooth Transitions" — nhận ra chuyển động và âm thanh mượt.',
      'Tiếng cười to rõ ràng — "giggle".',
      'Giọng nói có ngữ điệu, tay chân phối hợp mượt hơn.',
      'Một số bé ngủ liền 6 giờ đêm.',
    ],
    skills: ['Cười thành tiếng', 'Xoay đầu theo âm thanh', 'Cầm nắm chắc hơn'],
    parentNotes: [
      'Dành thời gian chơi tương tác: ú òa, đùa nhẹ.',
      'Chuẩn bị tâm lý cho 4-month sleep regression (sắp tới).',
      'Hệ tiêu hóa CHƯA sẵn sàng ăn dặm — kiên nhẫn tới 6 tháng.',
    ],
    accent: 'lavender',
  },
  {
    id: 'm4',
    periodLabel: 'Tháng 4',
    tagline: 'Leap 4 + Sleep regression',
    ageFromDays: 105,
    ageToDays: 135,
    heroEmoji: '🔄',
    stomach: { compareTo: 'quả cam', volumeMl: '180ml', emoji: '🍊', scale: 0.85 },
    mood: 'leap',
    moodLabel: 'Leap 4 • 4-month regression',
    funFacts: [
      'Leap 4 "World of Events" (tuần 19) — bước nhảy lớn nhất giai đoạn sơ sinh.',
      '"4-month sleep regression": bé thức dậy nhiều lần/đêm, ngủ ngắn ban ngày.',
      'Bắt đầu lẫy từ ngửa sang sấp — không để bé một mình trên giường cao.',
      'Chảy nước dãi, cắn đồ: mọc răng có thể đến.',
    ],
    skills: ['Lật người', 'Cầm đồ 2 tay', 'Phản ứng cảm xúc đa dạng'],
    parentNotes: [
      'Giữ routine ổn định, cho bé học "drowsy but awake".',
      'Chưa ép ăn dặm — đợi dấu hiệu sẵn sàng + 6 tháng tuổi.',
      'Tiêm chủng 4 tháng (nhắc lại 6in1, Rota, PCV).',
    ],
    accent: 'plum',
  },
  {
    id: 'm5',
    periodLabel: 'Tháng 5',
    tagline: 'Sẵn sàng khám phá',
    ageFromDays: 136,
    ageToDays: 166,
    heroEmoji: '🧸',
    stomach: { compareTo: 'quả cam lớn', volumeMl: '180–210ml', emoji: '🍊', scale: 0.9 },
    mood: 'happy',
    moodLabel: 'Happy • Tò mò mãnh liệt',
    funFacts: [
      'Lẫy cả 2 chiều thành thạo, ngồi có đỡ.',
      'Với đồ vật chính xác, chuyển đồ giữa 2 tay.',
      'Nhận biết tên riêng — quay đầu khi gọi tên.',
      'Có thể mọc răng đầu tiên (thường răng cửa dưới).',
    ],
    skills: ['Nhận biết tên', 'Ngồi có đỡ', 'Kéo đồ về mình'],
    parentNotes: [
      'Quan sát dấu hiệu sẵn sàng ăn dặm: ngồi vững có đỡ, hết phản xạ đẩy lưỡi, quan tâm thức ăn người lớn.',
      'Chơi "ú òa" — phát triển "object permanence".',
      'Mua ghế ăn, yếm, thìa silicon.',
    ],
    accent: 'mint',
  },
  {
    id: 'm6',
    periodLabel: 'Tháng 6',
    tagline: 'Leap 5 + Ăn dặm!',
    ageFromDays: 167,
    ageToDays: 197,
    heroEmoji: '🥄',
    stomach: { compareTo: 'quả cam', volumeMl: '200–240ml', emoji: '🍊', scale: 1.0 },
    mood: 'milestone',
    moodLabel: 'Cột mốc • Bắt đầu ăn dặm',
    funFacts: [
      '🎉 Leap 5 "World of Relationships" (tuần 26) — nhận ra khoảng cách, quan hệ.',
      'BẮT ĐẦU ĂN DẶM — cột mốc lớn! WHO: 6 tháng đầu bú sữa hoàn toàn.',
      'Ngồi không cần đỡ, bò trườn, có thể đổi đồ giữa 2 tay.',
      'Dự trữ sắt từ thai kỳ bắt đầu cạn — ăn dặm cần thực phẩm giàu sắt.',
    ],
    skills: ['Ngồi vững', 'Bò/trườn', 'Bắt đầu ăn dặm'],
    parentNotes: [
      'Nguyên tắc 3 ngày 1 món mới để phát hiện dị ứng.',
      'Thực phẩm an toàn: cháo loãng, khoai lang, bí đỏ, chuối, bơ.',
      '🚫 Tránh: muối, đường, mật ong, sữa bò tươi.',
    ],
    accent: 'amber',
  },
  {
    id: 'm7',
    periodLabel: 'Tháng 7',
    tagline: 'Đa dạng vị giác',
    ageFromDays: 198,
    ageToDays: 228,
    heroEmoji: '🍽️',
    stomach: { compareTo: 'quả cam', volumeMl: '~250ml', emoji: '🍊', scale: 1.05 },
    mood: 'happy',
    moodLabel: 'Happy • Khám phá',
    funFacts: [
      'Ăn dặm 2 bữa/ngày, nhiều loại rau củ hơn.',
      'Bò thành thạo, có thể tự đứng vịn.',
      'Bập bẹ "ba-ba", "ma-ma" chưa có nghĩa.',
      'Răng đầu tiên thường xuất hiện.',
    ],
    skills: ['Finger food', 'Đứng vịn', 'Bập bẹ đa âm'],
    parentNotes: [
      'Finger food: chuối mềm, bánh gạo, súp lơ luộc — phát triển cầm nắm.',
      'Vệ sinh răng bằng gạc ẩm sau bú/ăn.',
      'Không cho ngậm bình khi ngủ — sâu răng bú bình.',
    ],
    accent: 'peach',
  },
  {
    id: 'm8',
    periodLabel: 'Tháng 8',
    tagline: 'Sợ người lạ',
    ageFromDays: 229,
    ageToDays: 258,
    heroEmoji: '🫂',
    stomach: { compareTo: 'quả cam lớn', volumeMl: '~250ml', emoji: '🍊', scale: 1.1 },
    mood: 'calm',
    moodLabel: 'Calm • Gắn bó an toàn',
    funFacts: [
      'Bắt đầu "sợ người lạ" (stranger anxiety) — bám mẹ. Bình thường 8–10 tháng.',
      'Hiểu object permanence: đồ vẫn tồn tại khi khuất tầm nhìn.',
      'Có thể bò thành thạo, đứng vịn lâu hơn.',
      'Ăn sữa chua, phô mai tươi được rồi.',
    ],
    skills: ['Bò thành thạo', 'Đứng vịn', 'Hiểu object permanence'],
    parentNotes: [
      'Không ép bé ôm người lạ — tôn trọng cảm xúc.',
      'Chơi trò tìm đồ dưới khăn — phát triển trí nhớ.',
      'Bữa phụ: trái cây, sữa chua không đường.',
    ],
    accent: 'mint',
  },
  {
    id: 'm9',
    periodLabel: 'Tháng 9',
    tagline: 'Leap 6 + Vịn đứng',
    ageFromDays: 259,
    ageToDays: 289,
    heroEmoji: '🧠',
    stomach: { compareTo: 'quả cam to', volumeMl: '~250ml', emoji: '🍊', scale: 1.1 },
    mood: 'leap',
    moodLabel: 'Leap 6 • Categories',
    funFacts: [
      'Leap 6 "World of Categories" (tuần 37) — bé phân loại đồ vật.',
      'Vịn đứng, men ghế — sắp đi!',
      'Hiểu lệnh đơn giản: "không", "vẫy tay bye".',
      'Có thể có 4–6 răng.',
    ],
    skills: ['Vịn đứng', 'Men ghế', 'Hiểu lệnh đơn giản'],
    parentNotes: [
      'Dọn nhà an toàn: che ổ cắm, góc bàn, cầu thang.',
      '9-month well visit — khám tổng quát + tiêm nhắc.',
      'Bữa ăn đa dạng: 3 bữa chính + 1–2 bữa phụ.',
    ],
    accent: 'sky',
  },
  {
    id: 'm10',
    periodLabel: 'Tháng 10',
    tagline: 'Leap 7 — Chuỗi hành động',
    ageFromDays: 290,
    ageToDays: 319,
    heroEmoji: '🎯',
    stomach: { compareTo: 'quả cam to', volumeMl: '250–300ml', emoji: '🍊', scale: 1.15 },
    mood: 'leap',
    moodLabel: 'Leap 7 • Sequences',
    funFacts: [
      'Leap 7 "World of Sequences" (tuần 46) — hiểu chuỗi hành động.',
      'Chỉ vào đồ vật để yêu cầu (pointing).',
      'Có thể đi vài bước có đỡ.',
      'Mô phỏng: vẫy tay, vỗ tay theo mẹ.',
    ],
    skills: ['Pointing', 'Đi vịn', 'Mô phỏng hành động'],
    parentNotes: [
      'Khen ngợi khi bé cố gắng — củng cố tự tin.',
      'Chưa nên cho xem màn hình (AAP khuyến cáo <18 tháng).',
      'Cho bé tự xúc, chấp nhận bừa bộn.',
    ],
    accent: 'coral',
  },
  {
    id: 'm11',
    periodLabel: 'Tháng 11',
    tagline: 'Sắp biết đi',
    ageFromDays: 320,
    ageToDays: 349,
    heroEmoji: '🚶',
    stomach: { compareTo: 'quả cam', volumeMl: '~300ml', emoji: '🍊', scale: 1.2 },
    mood: 'happy',
    moodLabel: 'Happy • Tiền vận động',
    funFacts: [
      'Cruising: đi vịn quanh đồ đạc.',
      'Từ đơn đầu tiên có thể xuất hiện: "ba", "mẹ".',
      'Cầm đồ bằng ngón cái + ngón trỏ (pincer grasp).',
      'Thức dậy vui vẻ, vẫy tay chào.',
    ],
    skills: ['Pincer grasp', 'Cruising', 'Từ đơn đầu tiên'],
    parentNotes: [
      'Cho bé đi chân đất ở nơi an toàn — tốt cho phát triển bàn chân.',
      'Giảm lượng sữa, tăng bữa ăn.',
      'Duy trì giấc ngủ trưa 2 giấc.',
    ],
    accent: 'amber',
  },
  {
    id: 'm12',
    periodLabel: 'Tháng 12',
    tagline: '🎂 Cột mốc 1 tuổi',
    ageFromDays: 350,
    ageToDays: 410,
    heroEmoji: '🎂',
    stomach: { compareTo: 'quả bưởi nhỏ', volumeMl: '~300ml', emoji: '🍈', scale: 1.25 },
    mood: 'milestone',
    moodLabel: 'Cột mốc • Sinh nhật 1 tuổi',
    funFacts: [
      'Leap 8 "World of Programs" (tuần 55) thường rơi vào tháng 13.',
      '🎉 Bước đi đầu tiên (hầu hết bé 9–15 tháng).',
      'Từ có nghĩa đầu tiên, hiểu ~50 từ.',
      'Có thể chuyển dần sang sữa bò tươi nguyên kem (AAP).',
    ],
    skills: ['Bước đi đầu tiên', '1–3 từ có nghĩa', 'Uống bằng cốc'],
    parentNotes: [
      'Khám 12 tháng: tiêm sởi-quai bị-rubella (MMR), thủy đậu, viêm não Nhật Bản.',
      'Chuyển từ bình sang cốc tập uống.',
      'Bắt đầu đọc sách có cốt truyện đơn giản.',
    ],
    accent: 'rose',
  },
  {
    id: 'm15',
    periodLabel: 'Tháng 15',
    tagline: 'Leap 9 + Đi vững',
    ageFromDays: 411,
    ageToDays: 532,
    heroEmoji: '🏃',
    stomach: { compareTo: 'quả bưởi', volumeMl: '~350ml', emoji: '🍈', scale: 1.3 },
    mood: 'milestone',
    moodLabel: 'Phát triển ngôn ngữ',
    funFacts: [
      'Leap 9 "World of Principles" (tuần 64) — hiểu nguyên tắc.',
      'Đi vững, thử chạy nhẹ.',
      'Vốn từ 3–10 từ, hiểu hàng chục từ khác.',
      'Bắt đầu "nói không" — khẳng định bản thân.',
    ],
    skills: ['Đi vững', 'Xếp khối 2–3 tầng', 'Chỉ bộ phận cơ thể'],
    parentNotes: [
      'Cho bé tự chọn 2 option để phát triển tự lập.',
      'Đọc sách tranh mỗi ngày, lặp lại từ mới.',
      'Kiên nhẫn với tantrum — bé chưa đủ ngôn ngữ để diễn đạt.',
    ],
    accent: 'lavender',
  },
  {
    id: 'm18',
    periodLabel: 'Tháng 18',
    tagline: 'Bùng nổ ngôn ngữ',
    ageFromDays: 533,
    ageToDays: 653,
    heroEmoji: '💬',
    stomach: { compareTo: 'quả bưởi', volumeMl: '~400ml', emoji: '🍈', scale: 1.35 },
    mood: 'happy',
    moodLabel: 'Happy • Ngôn ngữ bùng nổ',
    funFacts: [
      'Vốn từ 10–25+ (từng bé rất khác nhau).',
      'Chạy, leo trèo, đá bóng.',
      'Bắt đầu chơi tưởng tượng (cho búp bê ăn).',
      'Thích "tự làm" — kéo khóa, đi giày.',
    ],
    skills: ['Chạy', 'Câu 2 từ', 'Chơi tưởng tượng'],
    parentNotes: [
      'Hạn chế màn hình: AAP <1 giờ/ngày, chất lượng cao, xem cùng bé.',
      'Cho bé giúp việc nhỏ: dọn đồ chơi, bỏ rác.',
      'Kiểm tra 18 tháng: tầm soát tự kỷ (M-CHAT).',
    ],
    accent: 'sky',
  },
  {
    id: 'm24',
    periodLabel: 'Tháng 24',
    tagline: 'Leap 10 + Câu đơn',
    ageFromDays: 654,
    ageToDays: 900,
    heroEmoji: '🌟',
    stomach: { compareTo: 'bưởi lớn', volumeMl: '~500ml', emoji: '🍈', scale: 1.45 },
    mood: 'milestone',
    moodLabel: 'Cột mốc • 2 tuổi',
    funFacts: [
      'Leap 10 "World of Systems" (tuần 75) — leap cuối của The Wonder Weeks.',
      'Vốn từ 50–100+, nói câu 2–3 từ.',
      'Chạy, nhảy 2 chân, đạp xe 3 bánh (một số bé).',
      'Giai đoạn "terrible twos" — tantrum là cách bé xử lý cảm xúc.',
    ],
    skills: ['Câu 2–3 từ', 'Nhảy 2 chân', 'Tập dùng bô'],
    parentNotes: [
      'Gọi tên cảm xúc của bé — giúp bé học điều tiết.',
      'Khám 24 tháng: tầm soát tự kỷ lần 2, đánh giá ngôn ngữ.',
      'Có thể bắt đầu tập bô — không ép nếu bé chưa sẵn sàng.',
    ],
    accent: 'plum',
  },
];

/** Trả về milestone hiện tại dựa theo ngày tuổi */
export function getCurrentMilestone(
  ageInDays: number
): TimelineMilestone | null {
  if (ageInDays < 0) return null;
  return (
    BABY_TIMELINE.find(
      (m) => ageInDays >= m.ageFromDays && ageInDays <= m.ageToDays
    ) || null
  );
}

/** Trạng thái của milestone so với ngày tuổi hiện tại */
export function getMilestoneState(
  milestone: TimelineMilestone,
  ageInDays: number | null
): 'past' | 'current' | 'future' {
  if (ageInDays === null) return 'future';
  if (ageInDays > milestone.ageToDays) return 'past';
  if (ageInDays >= milestone.ageFromDays) return 'current';
  return 'future';
}
