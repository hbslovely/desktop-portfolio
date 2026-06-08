/** Shared formatters for weight tab UI (list + charts). */

export function formatWeightDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatWeightDateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function formatWeightKg(n: number): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatWeightGPerDay(n: number): string {
  const s = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
  return `${n > 0 ? '+' : ''}${s}`;
}

export function formatWeightCm(n: number): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
}

/** Nhãn tuổi trên trục ngang biểu đồ so sánh */
export function formatAgeShortVi(days: number): string {
  const w = Math.floor(days / 7);
  const d = days % 7;
  if (w === 0) {
    return `${days} ngày`;
  }
  return d === 0 ? `${w} tuần` : `${w}t${d}n`;
}

export function growthStatusClass(status: string): string {
  switch (status) {
    case 'very_low':
    case 'very_high':
      return 'warn';
    case 'low':
    case 'high':
      return 'mid';
    case 'normal':
      return 'ok';
    default:
      return 'neutral';
  }
}

/** Map WHO z-score (-2…+2) to horizontal position on the growth scale track. */
export function growthMarkerPosition(zScore: number): number {
  const z = Math.max(-2, Math.min(2, zScore));
  const pct = ((z + 2) / 4) * 100;
  return pct < 3 ? 3 : pct > 97 ? 97 : pct;
}

export function formatGrowthZScore(zScore: number): string {
  const sign = zScore >= 0 ? '+' : '';
  return `${sign}${zScore.toFixed(1)}`;
}
