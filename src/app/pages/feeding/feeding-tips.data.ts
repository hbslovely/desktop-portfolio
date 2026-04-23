export interface FeedingTip {
  category: 'feeding' | 'sleep' | 'development' | 'health' | 'mom' | 'activity';
  title: string;
  content: string;
}

export interface PeriodGuide {
  label: string;
  summary: string;
  feedingSchedule: string;
  sleepSchedule: string;
  tips: FeedingTip[];
}

const CAT_LABEL: Record<FeedingTip['category'], { label: string; icon: string; color: string }> = {
  feeding: { label: 'Ăn / Bú', icon: 'pi pi-apple', color: '#10b981' },
  sleep: { label: 'Ngủ', icon: 'pi pi-moon', color: '#6366f1' },
  development: { label: 'Phát triển', icon: 'pi pi-chart-line', color: '#f59e0b' },
  health: { label: 'Sức khỏe', icon: 'pi pi-heart-fill', color: '#ef4444' },
  mom: { label: 'Lưu ý cho Mẹ', icon: 'pi pi-star-fill', color: '#ec4899' },
  activity: { label: 'Hoạt động', icon: 'pi pi-sparkles', color: '#0ea5e9' },
};

export function getCategoryMeta(cat: FeedingTip['category']) {
  return CAT_LABEL[cat];
}

export const WEEK_GUIDES: Record<number, PeriodGuide> = {
  1: {
    label: 'Tuần 1 – Làm quen thế giới',
    summary: 'Bé vừa chào đời, đang thích nghi với môi trường bên ngoài. Thời gian này bé ngủ rất nhiều và bú mẹ gần như liên tục. Sụt 5–10% cân nặng là bình thường trong 3–5 ngày đầu.',
    feedingSchedule: 'Bú mẹ theo nhu cầu (8–12 cữ/ngày), mỗi cữ cách nhau ~2 giờ. Ngày 1–2: sữa non 5–15ml/cữ. Ngày 3–7: 30–60ml/cữ nếu dùng sữa công thức.',
    sleepSchedule: 'Ngủ 16–18 giờ/ngày, mỗi giấc 2–3 giờ, chưa phân biệt ngày đêm.',
    tips: [
      { category: 'feeding', title: 'Cho bú sớm & da tiếp da', content: 'Cho bé bú trong vòng 1 giờ sau sinh và duy trì da tiếp da (skin-to-skin) để kích sữa non — loại "vàng lỏng" giàu kháng thể.' },
      { category: 'feeding', title: 'Đánh thức bú nếu ngủ quá 3 giờ', content: 'Trong tuần đầu bé có thể ngủ quên bú. Mẹ nhẹ nhàng đánh thức nếu cữ bú cách nhau hơn 3 giờ để tránh tụt cân.' },
      { category: 'feeding', title: 'Growth spurt đầu tiên (7–10 ngày)', content: 'Khoảng ngày 7–10 bé có đợt tăng trưởng nhỏ đầu tiên: đòi bú liên tục 1–2 ngày. Cho bú theo nhu cầu, không cần thêm sữa công thức.' },
      { category: 'health', title: 'Bổ sung Vitamin D (bú mẹ)', content: 'AAP khuyến cáo bé bú mẹ hoàn toàn cần bổ sung 400 IU vitamin D/ngày từ vài ngày sau sinh. Sữa công thức đã có sẵn nên thường không cần.' },
      { category: 'health', title: 'Theo dõi tã ướt', content: 'Ngày 1 ít nhất 1 tã ướt, đến ngày 5–6 nên có 6+ tã ướt/ngày. Phân chuyển từ phân su đen → vàng hoa cà hoa cải.' },
      { category: 'health', title: 'Vàng da sinh lý', content: 'Vàng da nhẹ thường xuất hiện ngày 2–4. Nếu da vàng đến bụng/đùi, bé bú kém hoặc ngủ li bì → đi khám ngay.' },
      { category: 'mom', title: 'Nghỉ ngơi song song với bé', content: 'Ngủ khi bé ngủ. Đừng cố làm việc nhà. Cơ thể mẹ cần hồi phục sau sinh — đây là tuần vàng cho việc "ở cữ".' },
      { category: 'mom', title: 'Uống đủ nước & ăn ấm', content: 'Uống 2.5–3 lít nước/ngày, ăn cháo móng giò, cá hồi, rau xanh để gọi sữa. Tránh đồ lạnh và đồ cay.' },
      { category: 'development', title: 'Phản xạ sơ sinh', content: 'Bé có phản xạ Moro (giật mình), phản xạ mút, nắm tay. Có thể quấn khăn (swaddle) để bé ngủ sâu hơn.' },
    ],
  },
  2: {
    label: 'Tuần 2 – Hồi phục cân nặng',
    summary: 'Bé bắt đầu lấy lại cân nặng lúc sinh và tăng ~15–30g/ngày. Mắt bé nhìn rõ dần trong khoảng cách 20–30cm.',
    feedingSchedule: 'Bú 8–12 cữ/ngày, mỗi cữ 60–90ml sữa công thức hoặc 10–15 phút mỗi bên ngực.',
    sleepSchedule: 'Ngủ 15–17 giờ/ngày, giấc đêm có thể kéo dài 3–4 giờ.',
    tips: [
      { category: 'feeding', title: 'Kiểm tra khớp ngậm', content: 'Bé ngậm sâu (cằm chạm ngực, môi dưới lật ra, quầng vú trong miệng). Ngậm nông khiến mẹ đau và bé bú không hiệu quả.' },
      { category: 'health', title: 'Rụng cuống rốn', content: 'Cuống rốn thường rụng tuần 1–3. Giữ khô, không băng kín. Nếu có mùi hôi, mủ, da xung quanh đỏ → đi khám.' },
      { category: 'mom', title: 'Tắc tia sữa', content: 'Nếu ngực cứng, đau, có cục → chườm ấm + massage + cho bé bú bên đau trước. Không xử lý sớm có thể thành áp xe vú.' },
      { category: 'development', title: 'Giao tiếp bằng mắt', content: 'Bé bắt đầu nhìn chăm chú vào mặt mẹ. Hãy nói chuyện, hát ru — bé đang học ngôn ngữ từ bây giờ.' },
    ],
  },
  3: {
    label: 'Tuần 3 – Growth spurt thể chất',
    summary: 'Đợt tăng trưởng thể chất đáng kể (growth spurt). Bé đòi bú liên tục để tăng cân 20–30g/ngày, chu vi vòng đầu tăng nhanh. KHÁC với Wonder Week (bước nhảy nhận thức — Leap 1 rơi vào tuần 5).',
    feedingSchedule: 'Cluster feeding (bú dồn) thường xuyên, đặc biệt buổi tối. Bé có thể đòi bú mỗi 1–1.5 giờ trong 2–3 ngày.',
    sleepSchedule: 'Ngủ 16–18 giờ/ngày, mỗi giấc 3–4 giờ. Có thể ngủ ít hơn chút trong đợt growth spurt.',
    tips: [
      { category: 'feeding', title: 'Growth spurt — bú theo nhu cầu', content: 'Các growth spurt xếp theo thứ tự: 7–10 ngày, tuần 3, tuần 6, tháng 3, 6, 9. Bé đòi bú liên tục — đừng nghĩ mình thiếu sữa, hãy cho bú theo nhu cầu để kích sữa.' },
      { category: 'development', title: 'Chưa phải Wonder Week', content: 'Growth spurt khác với Wonder Week: đợt này bé TĂNG CÂN nhanh, bú nhiều. Wonder Week đầu tiên (nhảy vọt giác quan) sẽ đến ở tuần 5.' },
      { category: 'health', title: 'Đau bụng colic có thể bắt đầu', content: '~15–20% trẻ sơ sinh bắt đầu có cơn colic (khóc không lý do, thường buổi tối, kéo dài 2–3 giờ) từ tuần 3. Thường hết sau 3 tháng.' },
      { category: 'mom', title: 'Baby blues', content: 'Nếu mẹ buồn vô cớ, khóc, lo âu → bình thường do thay đổi hormone. Nếu kéo dài > 2 tuần → cần tư vấn về trầm cảm sau sinh.' },
      { category: 'activity', title: 'Tummy time', content: 'Mỗi ngày 2–3 lần, mỗi lần 3–5 phút cho bé nằm sấp khi thức để cứng cổ. Luôn giám sát.' },
    ],
  },
  4: {
    label: 'Tuần 4 – Nụ cười đầu tiên',
    summary: 'Bé có thể mỉm cười xã giao khi thấy khuôn mặt quen. Biết hóng chuyện và ê a nhẹ. Chuẩn bị cho Wonder Week 1 vào tuần 5.',
    feedingSchedule: 'Bú 7–9 cữ/ngày, mỗi cữ 90–120ml sữa công thức.',
    sleepSchedule: 'Ngủ 14–16 giờ/ngày, một giấc đêm có thể kéo dài 4–5 giờ.',
    tips: [
      { category: 'development', title: 'Kích thích giác quan', content: 'Treo đồ chơi đen-trắng trên nôi, cho bé nghe nhạc nhẹ, mát-xa chân tay mỗi ngày.' },
      { category: 'development', title: 'Sắp Wonder Week 1', content: 'Tuần 5 là leap 1 — "World of Changing Sensations". Dấu hiệu báo trước: bé có thể quấy hơn, bám mẹ hơn, ngủ kém vài ngày trước.' },
      { category: 'health', title: 'Chuẩn bị tiêm chủng', content: 'Chuẩn bị lịch tiêm 2 tháng (5in1/6in1, Rota, Phế cầu). Hỏi bác sĩ trước nếu bé có dấu hiệu bất thường.' },
      { category: 'mom', title: 'Đi khám hậu sản 6 tuần', content: 'Lên lịch khám hậu sản để kiểm tra tử cung, vết mổ/rạch và tư vấn tránh thai.' },
    ],
  },
  5: {
    label: 'Tuần 5 – Wonder Week 1 (Giác quan thay đổi)',
    summary: 'Leap 1 — "World of Changing Sensations". Bước nhảy nhận thức đầu tiên: giác quan bé bỗng rõ ràng hơn, có thể quấy 3–5 ngày ("fussy period"). Sau leap bé nhìn – nghe – cảm nhận thế giới tinh tế hơn.',
    feedingSchedule: 'Bú 7–9 cữ/ngày, mỗi cữ 90–120ml. Có thể đòi bú dồn để tự trấn an.',
    sleepSchedule: 'Ngủ 14–16 giờ/ngày nhưng giấc ngắn, dễ tỉnh. Thường kéo dài ~1 tuần.',
    tips: [
      { category: 'development', title: 'Dấu hiệu Wonder Week 1', content: '3 chữ C: Crying (khóc nhiều hơn), Clinginess (bám mẹ), Crankiness (cáu kỉnh). Là bình thường — bé đang tập tích hợp cảm giác mới.' },
      { category: 'development', title: 'Sau leap bé làm được gì?', content: 'Nhìn theo đồ vật rõ hơn, phản ứng với tiếng động đa dạng, cười xã giao rõ hơn, nhận ra giọng mẹ trong nhiều giọng khác.' },
      { category: 'activity', title: 'Cách hỗ trợ', content: 'Ôm ấp, skin-to-skin, nói chuyện nhẹ nhàng. Tránh kích thích quá mức (đông người, đèn quá sáng). Duy trì routine ổn định.' },
      { category: 'feeding', title: 'Bú nhiều hơn bình thường', content: 'Không phải thiếu sữa — bé dùng bú để an tâm. Cho bú theo nhu cầu, mẹ ăn đủ, nghỉ đủ.' },
      { category: 'mom', title: 'Mẹ đừng lo lắng', content: 'Giai đoạn fussy chỉ kéo dài vài ngày. Sau đó bé "nhảy" sang kỹ năng mới. Đừng vội nghĩ bé ốm hay mình sai.' },
    ],
  },
};

export const MONTH_GUIDES: Record<number, PeriodGuide> = {
  1: {
    label: 'Tháng 1 – Tháng làm quen',
    summary: 'Bé dành phần lớn thời gian để ăn và ngủ. Cuối tháng bé có thể nhấc đầu vài giây khi nằm sấp.',
    feedingSchedule: 'Bú mẹ/sữa công thức 7–10 cữ/ngày. Đầu tháng 60–90ml/cữ, cuối tháng 90–120ml/cữ. Tổng ~600–900ml/ngày (AAP: ~2.5oz/pound cân nặng).',
    sleepSchedule: '15–17 giờ/ngày, đêm ngủ 8–9 giờ với 2–3 lần thức bú.',
    tips: [
      { category: 'feeding', title: 'Chỉ bú sữa', content: 'WHO khuyến cáo bú mẹ hoàn toàn 6 tháng đầu. Không cho uống nước, nước ép, mật ong hoặc ăn dặm sớm.' },
      { category: 'development', title: 'Mốc phát triển', content: 'Nhấc đầu ngắn khi nằm sấp, mắt dõi theo vật di chuyển, phản ứng với tiếng động mạnh.' },
      { category: 'health', title: 'Không rung lắc mạnh', content: 'Hội chứng rung lắc (Shaken Baby Syndrome) có thể gây tử vong. Dỗ bé bằng cách quấn, đung đưa nhẹ.' },
      { category: 'mom', title: 'Hút sữa dự trữ', content: 'Bắt đầu hút sữa sau 3–4 tuần để tạo kho sữa và giúp cặp vú cân đối.' },
    ],
  },
  2: {
    label: 'Tháng 2 – Cười thành tiếng & Wonder Week 2',
    summary: 'Bé bắt đầu cười thành tiếng, hóng chuyện, ê a "a", "ơ". Nhấc đầu 45° khi nằm sấp. Leap 2 rơi vào tuần 8 — "World of Patterns" (nhận biết mẫu hình).',
    feedingSchedule: '7–9 cữ/ngày, mỗi cữ 120–150ml. Tổng ~700–900ml/ngày.',
    sleepSchedule: '14–16 giờ/ngày. Bắt đầu có nhịp ngày-đêm rõ hơn.',
    tips: [
      { category: 'development', title: 'Wonder Week 2 (tuần 8)', content: 'Leap 2 "World of Patterns": bé nhận ra mẫu hình lặp lại (ánh sáng, âm thanh, khuôn mặt). Dấu hiệu: quấy 1–2 tuần, ngắm tay mình, soi gương, chăm chú hơn.' },
      { category: 'health', title: 'Mũi tiêm 2 tháng', content: 'Lịch tiêm 5in1/6in1 (bạch hầu, ho gà, uốn ván, bại liệt, Hib, có thể thêm viêm gan B), Rota, Phế cầu.' },
      { category: 'development', title: 'Nói chuyện với bé', content: 'Đáp lại tiếng ê a của bé như hội thoại thật — đây là nền tảng ngôn ngữ.' },
      { category: 'activity', title: 'Tummy time dài hơn', content: '10–15 phút/ngày chia nhiều lần. Đặt gương hoặc đồ chơi trước mặt để bé ngẩng đầu.' },
      { category: 'mom', title: 'Khủng hoảng giấc ngủ', content: 'Có thể có "regression" nhẹ. Giữ routine ổn định: tắm → bú → ru ngủ.' },
    ],
  },
  3: {
    label: 'Tháng 3 – Wonder Week 3 & Bé đáng yêu',
    summary: 'Leap 3 rơi vào tuần 12 — "World of Smooth Transitions" (chuyển động mượt). Sau leap là giai đoạn "thiên thần": bé cười nhiều, ngủ ngon hơn, ít khóc colic.',
    feedingSchedule: '6–8 cữ/ngày, mỗi cữ 120–180ml. Tổng ~800–1000ml/ngày.',
    sleepSchedule: '14–15 giờ/ngày. Giấc đêm 9–10 giờ, có thể ngủ liền 5–6 giờ.',
    tips: [
      { category: 'development', title: 'Wonder Week 3 (tuần 12)', content: 'Leap 3 "World of Smooth Transitions": bé nhận ra các chuyển động/âm thanh mượt, liên tục. Tiếng cười rõ ràng, giọng nói có ngữ điệu, tay chân phối hợp mượt hơn.' },
      { category: 'development', title: 'Cầm nắm', content: 'Đưa bé cầm lục lạc nhẹ, khăn mềm. Bé bắt đầu đưa tay vào miệng — phản xạ khám phá.' },
      { category: 'feeding', title: 'Chưa ăn dặm', content: 'Dù bé có thể tỏ ra thích nhìn người lớn ăn, hệ tiêu hóa chưa sẵn sàng cho đồ ăn rắn.' },
      { category: 'activity', title: 'Đọc sách', content: 'Sách vải, sách tương phản đen-trắng hoặc màu sắc rực rỡ. Đọc to mỗi ngày 5–10 phút.' },
    ],
  },
  4: {
    label: 'Tháng 4 – Wonder Week 4 (leap lớn)',
    summary: 'Leap 4 rơi vào tuần 19 — "World of Events": bước nhảy nhận thức lớn. Kèm 4-month sleep regression: ngủ kém, bú ít, quấy nhiều.',
    feedingSchedule: '5–7 cữ/ngày, mỗi cữ 150–180ml. Tổng ~900–1100ml/ngày.',
    sleepSchedule: '13–15 giờ/ngày. Nhiều bé có "4 month sleep regression".',
    tips: [
      { category: 'sleep', title: 'Sleep regression', content: 'Bé thức giấc nhiều lần/đêm. Duy trì routine, cho bé học tự ngủ nhẹ (drowsy but awake).' },
      { category: 'development', title: 'Lật người', content: 'Bé bắt đầu lật từ ngửa sang sấp. Không để bé một mình trên giường/ghế sofa.' },
      { category: 'feeding', title: 'Chuẩn bị ăn dặm', content: 'Mua ghế ăn, yếm, thìa silicon, bát/đĩa. Tìm hiểu phương pháp: truyền thống, BLW, hoặc kết hợp.' },
    ],
  },
  5: {
    label: 'Tháng 5 – Sẵn sàng khám phá',
    summary: 'Bé có thể lẫy thành thạo, ngồi có đỡ, với đồ vật chính xác hơn. Bắt đầu quan tâm đến thức ăn của người lớn.',
    feedingSchedule: '5–6 cữ sữa/ngày, mỗi cữ 180–210ml. Tổng ~900–1200ml/ngày.',
    sleepSchedule: '13–14 giờ/ngày, giấc ngắn ban ngày còn 2–3 giấc.',
    tips: [
      { category: 'feeding', title: 'Dấu hiệu sẵn sàng ăn dặm', content: 'Ngồi vững có đỡ, không còn phản xạ đẩy lưỡi, với đồ vào miệng, quan tâm đồ ăn người lớn.' },
      { category: 'development', title: 'Nhận biết tên', content: 'Bé quay đầu khi nghe gọi tên. Trò chơi "ú òa" rất hiệu quả cho phát triển trí nhớ.' },
      { category: 'health', title: 'Mọc răng', content: 'Có thể mọc răng đầu tiên (răng cửa dưới). Chảy nước dãi, cắn đồ, cáu kỉnh là bình thường.' },
    ],
  },
  6: {
    label: 'Tháng 6 – Bắt đầu ăn dặm',
    summary: 'Cột mốc quan trọng: bắt đầu ăn dặm! Bé ngồi vững hơn, bò bụng, có thể có răng.',
    feedingSchedule: '5 cữ sữa + 1 bữa ăn dặm/ngày. Sữa vẫn là chính (~800–1000ml/ngày).',
    sleepSchedule: '13–14 giờ/ngày, 2 giấc ngày + 1 giấc đêm.',
    tips: [
      { category: 'feeding', title: 'Ăn dặm đúng cách', content: 'Bắt đầu bằng cháo loãng (1 gạo : 10 nước) hoặc bột ăn dặm. Thử 1 loại thực phẩm 3 ngày để phát hiện dị ứng.' },
      { category: 'feeding', title: 'Thực phẩm an toàn đầu tiên', content: 'Cháo gạo, khoai lang, cà rốt, bí đỏ, chuối, bơ. Tránh: muối, đường, mật ong, sữa bò tươi, hải sản có vỏ.' },
      { category: 'feeding', title: 'Nguyên tắc 1 mới – 3 ngày', content: 'Mỗi thực phẩm mới ăn 3 ngày liên tục trước khi thử món khác. Giúp phát hiện dị ứng/bất dung nạp.' },
      { category: 'development', title: 'Bò & ngồi', content: 'Bé bò trườn, ngồi không cần đỡ. Dọn nhà an toàn: che ổ cắm, góc bàn, cầu thang.' },
      { category: 'health', title: 'Tiêm 6 tháng & bổ sung sắt', content: 'Tiêm nhắc lại. Dự trữ sắt từ bào thai bắt đầu cạn — ăn dặm cần có thực phẩm giàu sắt (thịt đỏ, lòng đỏ trứng, rau lá xanh).' },
      { category: 'mom', title: 'Thiết lập bữa ăn gia đình', content: 'Cho bé ngồi ghế ăn cùng bàn với gia đình dù mới ăn được ít — giúp bé học văn hóa ăn uống.' },
    ],
  },
  7: {
    label: 'Tháng 7 – Khám phá vị giác',
    summary: 'Bé ăn dặm 2 bữa/ngày, nhiều loại rau củ hơn. Bò thành thạo, có thể tự đứng vịn.',
    feedingSchedule: '4–5 cữ sữa (~700–900ml) + 2 bữa ăn dặm.',
    sleepSchedule: '12–14 giờ/ngày, 2 giấc ngày.',
    tips: [
      { category: 'feeding', title: 'Đa dạng thực phẩm', content: 'Thêm thịt (gà, heo), cá trắng, đậu phụ, lòng đỏ trứng. Cháo đặc hơn (1:7). Tránh cho bé ăn gia vị.' },
      { category: 'feeding', title: 'Finger food', content: 'Cho bé tự bốc miếng mềm: chuối, bánh gạo, súp lơ luộc mềm — phát triển kỹ năng cầm nắm và tự lập.' },
      { category: 'development', title: 'Bập bẹ "ba-ba", "ma-ma"', content: 'Lặp lại từ đơn giản rõ ràng. Không quá kỳ vọng bé hiểu — bé đang tập phát âm.' },
      { category: 'health', title: 'Răng đầu tiên', content: 'Vệ sinh răng bằng gạc ẩm sau bú/ăn. Không cho bé ngậm bình khi ngủ để tránh sâu răng bú bình.' },
    ],
  },
  8: {
    label: 'Tháng 8 – Giai đoạn lo lạ',
    summary: 'Bé có thể bắt đầu "sợ người lạ" và bám mẹ. Đây là mốc gắn bó an toàn bình thường.',
    feedingSchedule: '3–4 cữ sữa (~600–800ml) + 2–3 bữa ăn dặm + 1 bữa phụ (trái cây/sữa chua).',
    sleepSchedule: '12–14 giờ/ngày.',
    tips: [
      { category: 'development', title: 'Sợ người lạ', content: 'Bình thường ở 8–10 tháng. Không ép bé ôm người lạ — tôn trọng cảm xúc của bé.' },
      { category: 'feeding', title: 'Sữa chua & phô mai', content: 'Có thể cho ăn sữa chua không đường, phô mai tươi. Vẫn tránh sữa bò tươi uống trực tiếp.' },
      { category: 'activity', title: 'Trò chơi tìm đồ', content: 'Giấu đồ chơi dưới khăn để bé lật tìm — phát triển nhận thức "đồ vật tồn tại khi khuất tầm nhìn".' },
    ],
  },
  9: {
    label: 'Tháng 9 – Vịn đứng',
    summary: 'Bé vịn đứng, men ghế. Hiểu lệnh đơn giản ("không", "vẫy tay bye-bye"). Có thể có 4–6 răng.',
    feedingSchedule: '3 cữ sữa (~600ml) + 3 bữa ăn dặm + 1–2 bữa phụ.',
    sleepSchedule: '11–14 giờ/ngày. Giấc ngày còn 2 giấc ngắn.',
    tips: [
      { category: 'feeding', title: 'Cháo đặc & cơm nát', content: 'Độ đặc tăng dần (1:5). Có thể bắt đầu thử cơm nát/mì mềm cho bé tập nhai.' },
      { category: 'development', title: 'Chỉ tay', content: 'Dạy bé chỉ vào đồ vật gọi tên. Kỹ năng "joint attention" quan trọng cho ngôn ngữ.' },
      { category: 'mom', title: 'Kiên nhẫn với ném đồ', content: 'Bé ném đồ không phải hư mà là học nguyên lý nhân-quả. Thay vì mắng, hãy chơi trò "cho-lấy".' },
    ],
  },
  10: {
    label: 'Tháng 10 – Sắp đi',
    summary: 'Bé men vòng, nhiều bé bắt đầu bước 1–2 bước tự tin. Hiểu nhiều từ đơn.',
    feedingSchedule: '2–3 cữ sữa (~500–600ml) + 3 bữa ăn dặm + 1–2 bữa phụ.',
    sleepSchedule: '11–13 giờ/ngày.',
    tips: [
      { category: 'activity', title: 'Khuyến khích vận động', content: 'Tạo không gian an toàn để bé men vịn. Không dùng xe tròn tập đi (có thể gây chậm biết đi).' },
      { category: 'feeding', title: 'Đa dạng kết cấu', content: 'Cho ăn thực phẩm có nhiều kết cấu: giòn, dai, mềm. Giúp bé tập nhai và không kén ăn sau này.' },
    ],
  },
  11: {
    label: 'Tháng 11 – Sẵn sàng bước đi',
    summary: 'Nhiều bé biết đi. Nói được 1–2 từ có nghĩa ("ba", "mẹ", "măm").',
    feedingSchedule: '2 cữ sữa (~500ml) + 3 bữa chính + 2 bữa phụ.',
    sleepSchedule: '11–13 giờ/ngày.',
    tips: [
      { category: 'development', title: 'Khen ngợi cụ thể', content: 'Thay vì "giỏi quá" chung chung, hãy "Con cầm thìa rất khéo!" — giúp bé hiểu được khen vì điều gì.' },
      { category: 'health', title: 'Chuẩn bị tiêm 12 tháng', content: 'Sởi-Quai bị-Rubella (MMR), Thủy đậu, Viêm não Nhật Bản.' },
    ],
  },
  12: {
    label: 'Tháng 12 – Sinh nhật đầu tiên',
    summary: 'Cột mốc 1 tuổi! Bé đi lững chững, nói 2–5 từ đơn. Có thể uống sữa bò nguyên kem.',
    feedingSchedule: '500ml sữa/ngày + 3 bữa chính + 2 bữa phụ. Có thể bắt đầu sữa bò tươi nguyên kem.',
    sleepSchedule: '11–14 giờ/ngày, 1–2 giấc ngày.',
    tips: [
      { category: 'feeding', title: 'Cai sữa hay tiếp tục?', content: 'WHO khuyến cáo bú mẹ đến 2 tuổi hoặc lâu hơn nếu mẹ con muốn. Không có áp lực phải cai.' },
      { category: 'feeding', title: 'Ăn cùng gia đình', content: 'Bé có thể ăn gần như mọi món (ít muối, cắt nhỏ). Hạn chế đồ ngọt, đồ chiên, nước trái cây đóng hộp.' },
      { category: 'development', title: 'Đọc sách mỗi ngày', content: '10–15 phút đọc sách với bé mỗi tối. Lợi ích gấp nhiều lần xem màn hình.' },
      { category: 'health', title: 'Không màn hình < 18 tháng', content: 'AAP khuyến cáo không TV/điện thoại dưới 18 tháng (trừ video call). Ảnh hưởng ngôn ngữ và giấc ngủ.' },
    ],
  },
  13: {
    label: 'Tháng 13–15 – Toddler giai đoạn đầu',
    summary: 'Đi vững hơn, khám phá mọi ngóc ngách. Vốn từ 5–20 từ. Biết chỉ tay để đòi.',
    feedingSchedule: '3 bữa chính + 2 bữa phụ + ~500ml sữa/ngày.',
    sleepSchedule: '11–14 giờ/ngày, chuyển dần về 1 giấc trưa.',
    tips: [
      { category: 'feeding', title: 'Kén ăn là bình thường', content: 'Bé giai đoạn này có thể đột nhiên từ chối món cũ yêu thích. Tiếp tục bày ra, không ép ăn — bé cần 10–15 lần tiếp xúc để chấp nhận món mới.' },
      { category: 'development', title: 'Quy định rõ ràng', content: 'Bé cần biên giới để cảm thấy an toàn. "Không đánh", "không ném" cần nhất quán từ cả bố và mẹ.' },
    ],
  },
  16: {
    label: 'Tháng 16–18 – Bùng nổ ngôn ngữ',
    summary: 'Vốn từ có thể bùng nổ (20–50 từ). Bé bắt đầu ghép 2 từ. Biết đòi tự làm.',
    feedingSchedule: '3 bữa + 2 bữa phụ + 400–500ml sữa. Khuyến khích tự xúc.',
    sleepSchedule: '11–13 giờ/ngày, 1 giấc trưa 1–2 giờ.',
    tips: [
      { category: 'development', title: 'Đặt câu hỏi', content: 'Đặt câu hỏi mở: "Con muốn áo đỏ hay xanh?" thay vì "Con mặc áo đỏ nhé?". Cho bé quyền lựa chọn nhỏ.' },
      { category: 'activity', title: 'Tập tự lập', content: 'Tự xúc ăn, tự cất giày, tự cầm cốc uống. Chấp nhận bừa bộn — đây là học.' },
    ],
  },
  19: {
    label: 'Tháng 19–24 – Gần 2 tuổi',
    summary: 'Chạy nhảy, leo trèo. Ghép 2–3 từ thành câu. Bắt đầu "khủng hoảng 2 tuổi" với từ "không".',
    feedingSchedule: '3 bữa + 1–2 bữa phụ. Sữa ~400ml/ngày. Ăn gần như người lớn nhưng ít gia vị.',
    sleepSchedule: '11–13 giờ/ngày, 1 giấc trưa.',
    tips: [
      { category: 'development', title: 'Tantrum (ăn vạ)', content: 'Không xấu hổ khi bé ăn vạ — đây là cách bé xử lý cảm xúc. Ngồi xuống, gọi tên cảm xúc: "Con đang buồn vì không được kẹo".' },
      { category: 'mom', title: 'Tập dùng bô', content: 'Nhiều bé sẵn sàng từ 18–24 tháng. Dấu hiệu: tã khô 2 giờ, biết báo "ị", tò mò khi bố mẹ đi vệ sinh. Không ép nếu bé chưa sẵn sàng.' },
      { category: 'health', title: 'Khám 24 tháng', content: 'Khám tổng quát, đo chiều cao-cân nặng, đánh giá phát triển ngôn ngữ và vận động.' },
    ],
  },
};

export function resolveGuide(ageInDays: number): { period: PeriodGuide; key: string } | null {
  if (ageInDays < 0) return null;
  const weeks = Math.floor(ageInDays / 7);
  const months = Math.floor(ageInDays / 30.4375);

  if (weeks < 6) {
    const wKey = Math.min(5, Math.max(1, weeks + 1));
    const guide = WEEK_GUIDES[wKey];
    if (guide) return { period: guide, key: `week-${wKey}` };
  }

  if (months <= 12) {
    const mKey = Math.max(1, months);
    const guide = MONTH_GUIDES[mKey];
    if (guide) return { period: guide, key: `month-${mKey}` };
  }

  let key = 13;
  if (months >= 19) key = 19;
  else if (months >= 16) key = 16;
  else if (months >= 13) key = 13;
  const guide = MONTH_GUIDES[key];
  if (guide) return { period: guide, key: `month-${key}` };

  return null;
}
