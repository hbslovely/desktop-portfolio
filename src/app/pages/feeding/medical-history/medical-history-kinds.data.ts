import { MedicalEventKind } from '../../../services/medical-history.service';

export interface MedicalKindMeta {
  id: MedicalEventKind;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}

/** Metadữ loại sự kiện — Medical history V2 */
export const MEDICAL_KINDS: readonly MedicalKindMeta[] = [
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
    id: 'other',
    label: 'Khác',
    shortLabel: 'Khác',
    icon: 'pi pi-bookmark',
    color: '#64748b',
  },
] as const;

export function kindMeta(
  kind: MedicalEventKind
): MedicalKindMeta {
  return MEDICAL_KINDS.find((k) => k.id === kind) ?? MEDICAL_KINDS[MEDICAL_KINDS.length - 1];
}
