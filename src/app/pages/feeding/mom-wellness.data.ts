/**
 * Thẻ tham khảo nhanh cho mẹ — bổ sung nội dung động (tips tuần, món ăn).
 * Mang tính giáo dục sức khỏe, không thay cho bác sĩ.
 *
 * Tham chiếu tổng quát: AAP/HealthyChildren (cho con bú, an toàn ngủ, sàng lọc),
 * WHO (dinh dưỡng cho bà mẹ cho con bú), CDC (sức khỏe tinh thần sau sinh).
 */

export interface MomWellnessCard {
  id: string;
  icon: string;
  title: string;
  body: string;
}

export const MOM_WELLNESS_CARDS: MomWellnessCard[] = [
  {
    id: 'hydration',
    icon: 'pi pi-tint',
    title: 'Uống đủ trước khi khát',
    body:
      'Cho con bú hoặc hút sữa khiến cơ thể mất nước nhanh. Để sẵn bình nước ấm ở mọi chỗ bế bé — mục tiêu ~2–2.5 lít/ngày (điều chỉnh theo bác sĩ nếu có bệnh thận tim).',
  },
  {
    id: 'sleep-debt',
    icon: 'pi pi-moon',
    title: 'Ngủ chồng lên giấc của bé',
    body:
      'Không cố gắng làm việc nhà khi bé ngủ trưa — trả “nợ ngủ” 15–30 phút cũng có ích. Tránh màn hình trước khi ngủ để dễ vào giấc hơn.',
  },
  {
    id: 'breast-comfort',
    icon: 'pi pi-heart-fill',
    title: 'Ngực căng & quầng thâm',
    body:
      'Thay miếng lót thấm sữa đủ thường xuyên; áo bra rộng vừa phải, không gọng cứng cấn vào tuyến sữa. Đau kéo dài, sốt — cần khám loại trừ viêm tuyến sữa.',
  },
  {
    id: 'pelvic',
    icon: 'pi pi-bolt',
    title: 'Sàn đáy khung chậu',
    body:
      'Sau ổn định vết mổ/rạch (theo chỉ định BS), kegel nhẹ giúp giảm tiểu són khi ho/cười. Nếu cảm giác “tụt” khung chậu — nên gặp phụ khoa/vật lý trị liệu sàn khung chậu.',
  },
  {
    id: 'mental',
    icon: 'pi pi-comments',
    title: 'Tâm lý & baby blues',
    body:
      'Buồn, hay khóc tuần đầu — khá phổ biến. Nếu buồn kéo >2 tuần, mất ngủ hoặc có ý nghĩ làm hại bản thân/con — gọi người thân và cần hỗ trợ chuyên môn ngay.',
  },
  {
    id: 'nutrition-balance',
    icon: 'pi pi-apple',
    title: 'Ăn đủ bữa, không kiêng tuyệt đối',
    body:
      'Cần protein (thịt/cá/trứng/đậu), rau xanh, tinh bột hấp/luộc. Giảm đồ chiên rán, đồ ngọt — không nhịn bữa để “lấy lại dáng” quá sớm khi đang cho bú nhiều.',
  },
  {
    id: 'support',
    icon: 'pi pi-users',
    title: 'Nhờ giúp đỡ là bình thường',
    body:
      'San sẻ bế bé, rửa bình, nấu bữa… giúp mẹ phục hồi và giữ sữa. Nói rõ nhu cầu với gia đình thay vì gánh một mình.',
  },
  {
    id: 'contraception',
    icon: 'pi pi-shield',
    title: 'Tránh thai sau sinh',
    body:
      'Rụng trứng có thể xảy ra trước khi có kinh lại — trao đổi với BS về thuốc tương thích cho con bú, màng ngăn, hoặc vòng nội tiết khi phù hợp.',
  },
  {
    id: 'caffeine',
    icon: 'pi pi-coffee',
    title: 'Caffeine khi cho con bú',
    body:
      'Nhiều hướng dẫn (gồm AAP) cho phép caffeine vừa phải khoảng ~200–300 mg/ngày; quan sát bé có khó ngủ/quấy hơn bình thường không. Tránh năng lượng tổng hợp, trà lá không rõ nguồn.',
  },
  {
    id: 'iron-folate',
    icon: 'pi pi-tablet',
    title: 'Sắt / acid folic sau sinh',
    body:
      'Nếu bác sĩ kê tiếp sắt/acid folic sau đẻ — uống đúng liều, xa giờ sắt với canxi/sữa 2–4 giờ để hấp thu tốt hơn. Ăn thịt nạc, cá, đậu, rau xanh đậm bổ sung thực phẩm.',
  },
  {
    id: 'walk-recovery',
    icon: 'pi pi-compass',
    title: 'Vận động nhẹ sau khi BS cho phép',
    body:
      'Đi bộ ngắn trong nhà rồi tăng dần giúp tuần hoàn và tâm trạng. Sau mổ: chỉ tăng gắng sức theo lịch tái khám; đau bất thường, sốt, ra máu nhiều — liên hệ y tế.',
  },
  {
    id: 'pump-hygiene',
    icon: 'pi pi-sync',
    title: 'Vệ sinh máy hút / bình sữa',
    body:
      'Rửa tay trước khi hút; phụ kiện tiếp xúc sữa rửa nóng hoặc theo hướng dẫn nhà sản xuất; sữa để phòng tủ lạnh đúng thời gian an toàn địa phương khuyến cáo.',
  },
  {
    id: 'dental-mom',
    icon: 'pi pi-sun',
    title: 'Răng miệng mẹ',
    body:
      'Viêm nướu / sâu răng tăng nguy cơ vi khuẩn truyền sang bé. Đánh răng fluoride 2 lần/ngày, khám nha định kỳ; tránh dùng chung thìa khi mẹ đang viêm họng.',
  },
  {
    id: 'screening',
    icon: 'pi pi-heart',
    title: 'Không bỏ qua tái khám',
    body:
      'Khám hậu sản và các mốc sàng lọc theo lịch địa phương (huyết áp, tiểu đường thai kỳ, tuyến giáp nếu có chỉ định). Kể cho BS về đau ngực, khó thở, nhức đầu dữ dội.',
  },
];
