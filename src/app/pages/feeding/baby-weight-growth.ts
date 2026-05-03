/**
 * Đánh giá cân nặng theo tuần tuổi — nội suy từ chuẩn tăng trưởng WHO (0–2 tuổi).
 * Việt Nam: chương trình quốc gia thường áp dụng Chuẩn tăng trưởng trẻ em của WHO
 * (cân theo tuổi, 0–24 tháng) — app dùng cùng nguồn tham chiếu cho biểu đồ so sánh.
 * Chỉ mang tính tham khảo; không thay cho đo tại cơ sở y tế.
 */

/** Mã quốc gia — dữ liệu chuẩn trong app = WHO (khuyến nghị tại VN) */
export const GROWTH_REFERENCE_REGION_VN = 'VN' as const;

export const GROWTH_REFERENCE_CAPTION_VI =
  'Chuẩn tăng trưởng WHO (ứng dụng phổ biến cho trẻ em tại Việt Nam)';

export type WeightGrowthSex = 'male' | 'female';

export type WeightGrowthStatus =
  | 'very_low'
  | 'low'
  | 'normal'
  | 'high'
  | 'very_high'
  | 'unknown';

export interface WeightGrowthEvaluation {
  weeks: number;
  /** Tuần đầy đủ hiển thị */
  weeksLabel: string;
  medianKg: number;
  sdKg: number;
  zScore: number;
  status: WeightGrowthStatus;
  statusLabel: string;
  detail: string;
}

/** Trục tuần (0 → 104) — trung vị cân (kg), nam — nội suy từ WHO Child Growth Standards */
const BOY_MEDIAN_WEEKS: readonly [number, number][] = [
  [0, 3.35],
  [4, 4.47],
  [8, 5.67],
  [12, 6.39],
  [16, 6.95],
  [20, 7.38],
  [24, 7.74],
  [28, 8.04],
  [32, 8.3],
  [36, 8.54],
  [40, 8.75],
  [44, 8.95],
  [48, 9.12],
  [52, 9.28],
  [56, 9.42],
  [60, 9.55],
  [64, 9.66],
  [68, 9.77],
  [72, 9.88],
  [76, 9.98],
  [80, 10.08],
  [84, 10.19],
  [88, 10.3],
  [92, 10.42],
  [96, 10.55],
  [100, 10.69],
  [104, 10.84],
];

const GIRL_MEDIAN_WEEKS: readonly [number, number][] = [
  [0, 3.24],
  [4, 4.19],
  [8, 5.33],
  [12, 6.02],
  [16, 6.56],
  [20, 6.99],
  [24, 7.34],
  [28, 7.64],
  [32, 7.9],
  [36, 8.14],
  [40, 8.36],
  [44, 8.56],
  [48, 8.75],
  [52, 8.93],
  [56, 9.1],
  [60, 9.26],
  [64, 9.41],
  [68, 9.56],
  [72, 9.71],
  [76, 9.86],
  [80, 10.01],
  [84, 10.17],
  [88, 10.34],
  [92, 10.52],
  [96, 10.71],
  [100, 10.92],
  [104, 11.15],
];

function tableForSex(sex: WeightGrowthSex): readonly [number, number][] {
  return sex === 'male' ? BOY_MEDIAN_WEEKS : GIRL_MEDIAN_WEEKS;
}

/** Nội suy tuyến tính median (kg) theo tuần hoàn chỉnh */
export interface WhoWeightBandSample {
  daysSinceBirth: number;
  weeksAge: number;
  medianKg: number;
  minus2SdKg: number;
  plus2SdKg: number;
}

/**
 * Mẫu điểm đường chuẩn (trung vị, ±2SD) theo ngày tuổi — để vẽ biểu đồ.
 * maxDaysInclusive tối đa 728 (104 tuần).
 */
export function sampleWhoWeightBandByDay(
  maxDaysInclusive: number,
  sex: WeightGrowthSex,
  maxSamples = 140
): WhoWeightBandSample[] {
  const cap = Math.min(728, Math.max(7, Math.floor(maxDaysInclusive)));
  const step = Math.max(1, Math.ceil(cap / maxSamples));
  const out: WhoWeightBandSample[] = [];

  const push = (d: number) => {
    const w = Math.min(104, d / 7);
    const m = medianWeightKgAtWeeks(w, sex);
    const sd = approxSdKgAtWeeks(w, sex);
    out.push({
      daysSinceBirth: d,
      weeksAge: w,
      medianKg: m,
      minus2SdKg: Math.max(0.1, m - 2 * sd),
      plus2SdKg: m + 2 * sd,
    });
  };

  for (let d = 0; d < cap; d += step) {
    push(d);
  }
  if (out.length === 0 || out[out.length - 1].daysSinceBirth !== cap) {
    push(cap);
  }
  return out;
}

export function medianWeightKgAtWeeks(
  weeks: number,
  sex: WeightGrowthSex
): number {
  const t = tableForSex(sex);
  const w = Math.max(0, Math.min(104, weeks));
  if (w <= t[0][0]) return t[0][1];
  if (w >= t[t.length - 1][0]) return t[t.length - 1][1];

  let i = 0;
  while (i < t.length - 1 && t[i + 1][0] < w) i++;
  const [w0, k0] = t[i];
  const [w1, k1] = t[i + 1];
  const r = (w - w0) / (w1 - w0);
  return k0 + r * (k1 - k0);
}

/** Ước lượng độ lệch chuẩn (kg) — ~11% median trừ sơ sinh */
export function approxSdKgAtWeeks(weeks: number, sex: WeightGrowthSex): number {
  const m = medianWeightKgAtWeeks(weeks, sex);
  const factor = weeks <= 8 ? 0.1 : 0.11;
  return Math.max(0.12, m * factor);
}

export function ageDaysAtDate(birthIso: string, dateIso: string): number | null {
  const b = parseIsoLocal(birthIso);
  const e = parseIsoLocal(dateIso);
  if (!b || !e) return null;
  const ms = e.getTime() - b.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function weeksFromDays(days: number): number {
  return Math.floor(days / 7);
}

function parseIsoLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

export function evaluateWeightForAge(
  weeks: number,
  weightKg: number,
  sex: WeightGrowthSex
): WeightGrowthEvaluation | null {
  if (
    !Number.isFinite(weeks) ||
    !Number.isFinite(weightKg) ||
    weightKg <= 0
  ) {
    return null;
  }

  if (weeks > 104) {
    return {
      weeks,
      weeksLabel: `${weeks} tuần`,
      medianKg: medianWeightKgAtWeeks(104, sex),
      sdKg: approxSdKgAtWeeks(104, sex),
      zScore: 0,
      status: 'unknown',
      statusLabel: 'Ngoài biểu đồ chuẩn',
      detail:
        'Chuẩn WHO trong app áp dụng tới 2 tuổi (104 tuần). Hãy tham khảo bác sĩ hoặc biểu đồ riêng cho trẻ lớn.',
    };
  }

  const median = medianWeightKgAtWeeks(weeks, sex);
  const sd = approxSdKgAtWeeks(weeks, sex);
  const z = sd > 0 ? (weightKg - median) / sd : 0;

  let status: WeightGrowthStatus;
  let statusLabel: string;
  let detail: string;

  if (z < -2) {
    status = 'very_low';
    statusLabel = 'Thấp đáng lưu ý';
    detail =
      'Cân nặng thấp hơn nhiều so với trung vị cùng tuần tuổi (ước lượng theo WHO). Nên trao đổi với bác sĩ/nhi khoa.';
  } else if (z < -1) {
    status = 'low';
    statusLabel = 'Hơi thấp';
    detail =
      'Dưới mức trung bình nhẹ. Theo dõi cữ bú và cân định kỳ; nếu bé bú kém hoặc có dấu hiệu bất thường, khám sớm.';
  } else if (z <= 1) {
    status = 'normal';
    statusLabel = 'Phù hợp tuần tuổi';
    detail =
      'Cân nặng nằm trong vùng phổ biến so với trung vị cùng tuần tuổi (ước lượng). Tiếp tục theo dõi định kỳ.';
  } else if (z <= 2) {
    status = 'high';
    statusLabel = 'Hơi cao';
    detail =
      'Trên mức trung bình. Thường là biến thể lành tính; theo dõi xu hướng dài hạn.';
  } else {
    status = 'very_high';
    statusLabel = 'Cao đáng lưu ý';
    detail =
      'Cân nặng cao hơn rõ so với trung vị cùng tuần. Trao đổi khi khám để loại trừ bệnh lý hoặc điều chỉnh dinh dưỡng.';
  }

  return {
    weeks,
    weeksLabel: `${weeks} tuần`,
    medianKg: Math.round(median * 100) / 100,
    sdKg: Math.round(sd * 1000) / 1000,
    zScore: Math.round(z * 100) / 100,
    status,
    statusLabel,
    detail,
  };
}

/** Điểm cho đường trung vị trên biểu đồ (theo ngày đo) */
export function medianCurvePoints(
  birthIso: string,
  datesIso: readonly string[],
  sex: WeightGrowthSex
): Array<{ date: string; kg: number; weeks: number }> {
  const out: Array<{ date: string; kg: number; weeks: number }> = [];
  for (const d of datesIso) {
    const days = ageDaysAtDate(birthIso, d);
    if (days === null) continue;
    const w = weeksFromDays(days);
    if (w > 104) continue;
    out.push({
      date: d,
      kg: Math.round(medianWeightKgAtWeeks(w, sex) * 100) / 100,
      weeks: w,
    });
  }
  return out;
}
