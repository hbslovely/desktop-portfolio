/**
 * Thẻ tham khảo nhanh cho mẹ — bổ sung nội dung động (tips tuần, món ăn).
 * Mang tính giáo dục sức khỏe, không thay cho bác sĩ.
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
];
