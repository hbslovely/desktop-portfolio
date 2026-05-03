/** Metadữ loại sự kiện — nguồn duy nhất cho union `MedicalEventKind` */
export const MEDICAL_KINDS = [
  {
    id: 'vaccine',
    label: 'Tiêm chủng / vaccine',
    shortLabel: 'Tiêm',
    icon: 'pi pi-shield',
    color: '#0ea5e9',
  },
  {
    id: 'checkup',
    label: 'Khám định kỳ / soi chiếu',
    shortLabel: 'Khám',
    icon: 'pi pi-user-plus',
    color: '#22c55e',
  },
  {
    id: 'medication',
    label: 'Thuốc / kê đơn',
    shortLabel: 'Thuốc',
    icon: 'pi pi-tablet',
    color: '#a855f7',
  },
  {
    id: 'illness',
    label: 'Ốm / sốt / triệu chứng',
    shortLabel: 'Ốm',
    icon: 'pi pi-exclamation-circle',
    color: '#f97316',
  },
  {
    id: 'lab',
    label: 'Xét nghiệm / kết quả',
    shortLabel: 'Xét nghiệm',
    icon: 'pi pi-chart-bar',
    color: '#6366f1',
  },
  {
    id: 'allergy',
    label: 'Dị ứng / phản ứng thuốc',
    shortLabel: 'Dị ứng',
    icon: 'pi pi-ban',
    color: '#dc2626',
  },
  {
    id: 'dental',
    label: 'Răng miệng / nha khoa',
    shortLabel: 'Nha',
    icon: 'pi pi-circle-fill',
    color: '#14b8a6',
  },
  {
    id: 'ent',
    label: 'Tai — Mũi — Họng',
    shortLabel: 'TMH',
    icon: 'pi pi-volume-up',
    color: '#0891b2',
  },
  {
    id: 'dermatology',
    label: 'Da liễu',
    shortLabel: 'Da',
    icon: 'pi pi-heart-fill',
    color: '#db2777',
  },
  {
    id: 'vision',
    label: 'Mắt / nhãn khoa',
    shortLabel: 'Mắt',
    icon: 'pi pi-eye',
    color: '#2563eb',
  },
  {
    id: 'hearing',
    label: 'Thính lực',
    shortLabel: 'Thính',
    icon: 'pi pi-volume-down',
    color: '#7c3aed',
  },
  {
    id: 'emergency',
    label: 'Cấp cứu / ER',
    shortLabel: 'Cấp cứu',
    icon: 'pi pi-bolt',
    color: '#b91c1c',
  },
  {
    id: 'surgery',
    label: 'Phẫu thuật / tiểu phẫu',
    shortLabel: 'PT',
    icon: 'pi pi-cog',
    color: '#475569',
  },
  {
    id: 'therapy',
    label: 'Vật lý trị liệu / PHCN',
    shortLabel: 'VLTL',
    icon: 'pi pi-replay',
    color: '#059669',
  },
  {
    id: 'nutrition',
    label: 'Dinh dưỡng / tư vấn sữa',
    shortLabel: 'Dinh dưỡng',
    icon: 'pi pi-apple',
    color: '#65a30d',
  },
  {
    id: 'screening',
    label: 'Sàng lọc / khám lưới',
    shortLabel: 'Sàng lọc',
    icon: 'pi pi-list-check',
    color: '#0284c7',
  },
  {
    id: 'mental',
    label: 'Tâm lý / thần kinh',
    shortLabel: 'Tâm lý',
    icon: 'pi pi-comments',
    color: '#8b5cf6',
  },
  {
    id: 'home_care',
    label: 'Chăm sóc tại nhà / điều dưỡng',
    shortLabel: 'Tại nhà',
    icon: 'pi pi-home',
    color: '#ca8a04',
  },
  {
    id: 'follow_up',
    label: 'Tái khám / theo dõi',
    shortLabel: 'Tái khám',
    icon: 'pi pi-calendar-plus',
    color: '#ea580c',
  },
  {
    id: 'other',
    label: 'Khác',
    shortLabel: 'Khác',
    icon: 'pi pi-bookmark',
    color: '#64748b',
  },
] as const;

export type MedicalEventKind = (typeof MEDICAL_KINDS)[number]['id'];
export type MedicalKindMeta = (typeof MEDICAL_KINDS)[number];

export function kindMeta(kind: MedicalEventKind): MedicalKindMeta {
  const found = MEDICAL_KINDS.find((k) => k.id === kind);
  return found ?? MEDICAL_KINDS[MEDICAL_KINDS.length - 1];
}
