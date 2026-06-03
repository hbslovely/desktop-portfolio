/**
 * Đánh giá cân nặng theo tuần tuổi — dựa trên chuẩn tăng trưởng WHO (0–10 tuổi).
 *
 * Việt Nam: chương trình quốc gia áp dụng Chuẩn tăng trưởng trẻ em của WHO.
 * App được cập nhật theo bảng chuẩn WHO 2024 và dữ liệu tham khảo từ Bibomart.
 *
 * Phạm vi hỗ trợ:
 * - 0-24 tháng: Theo tuần tuổi (độ chính xác cao)
 * - 2.5-10 tuổi: Theo năm tuổi (mở rộng hỗ trợ)
 *
 * Lưu ý: Chỉ mang tính tham khảo, không thay cho đo đạc và tư vấn tại cơ sở y tế.
 *
 * Nguồn tham khảo:
 * - WHO Child Growth Standards 2024
 * - Bảng chiều cao cân nặng chuẩn Bibomart (https://bibomart.com.vn/camnang/bang-chieu-cao-can-nang-cua-tre/)
 * - Chương trình quốc gia theo dõi tăng trưởng trẻ em Việt Nam
 */

/** Mã vùng — dữ liệu chuẩn WHO được áp dụng rộng rãi tại Việt Nam */
export const GROWTH_REFERENCE_REGION_VN = 'VN' as const;

export const GROWTH_REFERENCE_CAPTION_VI =
  'Chuẩn WHO 2024 (cập nhật từ Bibomart & khuyến nghị quốc gia VN)';

export type WeightGrowthSex = 'male' | 'female';

export type WeightGrowthStatus = 'very_low' | 'low' | 'normal' | 'high' | 'very_high' | 'unknown';

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
  estimate: WeightWeekEstimate;
}

export interface WeightWeekEstimate {
  weekAge: number;
  currentWeightKg: number;
  medianKg: number;
  severeUnderweightMaxKg: number; // < -2SD
  underweightMaxKg: number; // < -1SD
  standardMinKg: number; // >= -1SD
  standardMaxKg: number; // <= +1SD
  overweightMinKg: number; // > +1SD
  highWeightMinKg: number; // > +2SD
  deltaFromMedianKg: number;
}

/**
 * Trục tuần (0 → 104) — trung vị cân (kg), nam — cập nhật theo WHO Child Growth Standards
 * Nguồn tham khảo: WHO Growth Standards và bảng chuẩn Bibomart (2024)
 */
const BOY_MEDIAN_WEEKS: readonly [number, number][] = [
  [0, 3.3], // Sơ sinh: 3.3kg (theo bảng WHO chuẩn VN)
  [4, 4.5], // 1 tháng: 4.5kg
  [8, 5.6], // 2 tháng: 5.6kg
  [12, 6.4], // 3 tháng: 6.4kg
  [16, 7.0], // 4 tháng: 7.0kg
  [20, 7.5], // 5 tháng: 7.5kg
  [24, 7.9], // 6 tháng: 7.9kg
  [28, 8.3], // 7 tháng: 8.3kg
  [32, 8.6], // 8 tháng: 8.6kg
  [36, 8.9], // 9 tháng: 8.9kg
  [40, 9.2], // 10 tháng: 9.2kg
  [44, 9.4], // 11 tháng: 9.4kg
  [48, 9.6], // 12 tháng (1 tuổi): 9.6kg
  [52, 9.8], // 13 tháng
  [56, 10.0], // 14 tháng
  [60, 10.3], // 15 tháng: 10.3kg (theo bảng)
  [64, 10.5], // 16 tháng
  [68, 10.7], // 17 tháng
  [72, 10.9], // 18 tháng: 10.9kg (theo bảng)
  [76, 11.1], // 19 tháng
  [80, 11.3], // 20 tháng
  [84, 11.5], // 21 tháng: 11.5kg (theo bảng)
  [88, 11.8], // 22 tháng
  [92, 12.0], // 23 tháng
  [96, 12.2], // 24 tháng (2 tuổi): 12.2kg (theo bảng)
  [100, 12.5], // 2.5 tuổi
  [104, 12.8], // Ngoại suy cho giai đoạn sau 2 tuổi
];

/**
 * Trục tuần (0 → 104) — trung vị cân (kg), nữ — cập nhật theo WHO Child Growth Standards
 * Nguồn tham khảo: WHO Growth Standards và bảng chuẩn Bibomart (2024)
 */
const GIRL_MEDIAN_WEEKS: readonly [number, number][] = [
  [0, 3.2], // Sơ sinh: 3.2kg (theo bảng WHO chuẩn VN)
  [4, 4.2], // 1 tháng: 4.2kg
  [8, 5.1], // 2 tháng: 5.1kg
  [12, 5.8], // 3 tháng: 5.8kg
  [16, 6.4], // 4 tháng: 6.4kg
  [20, 6.9], // 5 tháng: 6.9kg
  [24, 7.3], // 6 tháng: 7.3kg
  [28, 7.6], // 7 tháng: 7.6kg
  [32, 7.9], // 8 tháng: 7.9kg
  [36, 8.2], // 9 tháng: 8.2kg
  [40, 8.5], // 10 tháng: 8.5kg
  [44, 8.7], // 11 tháng: 8.7kg
  [48, 8.9], // 12 tháng (1 tuổi): 8.9kg
  [52, 9.1], // 13 tháng
  [56, 9.3], // 14 tháng
  [60, 9.6], // 15 tháng: 9.6kg (theo bảng)
  [64, 9.8], // 16 tháng
  [68, 10.0], // 17 tháng
  [72, 10.2], // 18 tháng: 10.2kg (theo bảng)
  [76, 10.4], // 19 tháng
  [80, 10.6], // 20 tháng
  [84, 10.9], // 21 tháng: 10.9kg (theo bảng)
  [88, 11.1], // 22 tháng
  [92, 11.3], // 23 tháng
  [96, 11.5], // 24 tháng (2 tuổi): 11.5kg (theo bảng)
  [100, 11.8], // 2.5 tuổi
  [104, 12.0], // Ngoại suy cho giai đoạn sau 2 tuổi
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

/**
 * Bảng cân nặng mở rộng cho trẻ lớn hơn 2 tuổi (theo năm tuổi)
 * Nguồn: WHO Growth Standards và bảng chuẩn VN 2024
 */
const BOY_EXTENDED_YEARS: readonly [number, number][] = [
  [2.5, 13.3], // 2.5 tuổi: 13.3kg
  [3.0, 14.3], // 3 tuổi: 14.3kg
  [3.5, 15.3], // 3.5 tuổi: 15.3kg
  [4.0, 16.3], // 4 tuổi: 16.3kg
  [4.5, 17.3], // 4.5 tuổi: 17.3kg
  [5.0, 18.3], // 5 tuổi: 18.3kg
  [5.5, 19.4], // 5.5 tuổi: 19.4kg
  [6.0, 20.5], // 6 tuổi: 20.5kg
  [6.5, 21.7], // 6.5 tuổi: 21.7kg
  [7.0, 22.9], // 7 tuổi: 22.9kg
  [7.5, 24.1], // 7.5 tuổi: 24.1kg
  [8.0, 25.4], // 8 tuổi: 25.4kg
  [8.5, 26.7], // 8.5 tuổi: 26.7kg
  [9.0, 28.1], // 9 tuổi: 28.1kg
  [9.5, 29.6], // 9.5 tuổi: 29.6kg
  [10.0, 31.2], // 10 tuổi: 31.2kg
];

const GIRL_EXTENDED_YEARS: readonly [number, number][] = [
  [2.5, 12.7], // 2.5 tuổi: 12.7kg
  [3.0, 13.9], // 3 tuổi: 13.9kg
  [3.5, 15.0], // 3.5 tuổi: 15.0kg
  [4.0, 16.1], // 4 tuổi: 16.1kg
  [4.5, 17.2], // 4.5 tuổi: 17.2kg (sửa từ 16.2 trong bảng gốc)
  [5.0, 18.2], // 5 tuổi: 18.2kg
  [5.5, 19.1], // 5.5 tuổi: 19.1kg
  [6.0, 20.2], // 6 tuổi: 20.2kg
  [6.5, 21.2], // 6.5 tuổi: 21.2kg
  [7.0, 22.4], // 7 tuổi: 22.4kg
  [7.5, 23.6], // 7.5 tuổi: 23.6kg
  [8.0, 25.0], // 8 tuổi: 25.0kg
  [8.5, 26.6], // 8.5 tuổi: 26.6kg
  [9.0, 28.2], // 9 tuổi: 28.2kg
  [9.5, 30.0], // 9.5 tuổi: 30.0kg
  [10.0, 31.9], // 10 tuổi: 31.9kg
];

/**
 * Tính cân nặng trung vị theo tuổi, hỗ trợ cả tuần (0-104) và năm (2.5-10)
 */
export function medianWeightKgAtWeeks(weeks: number, sex: WeightGrowthSex): number {
  if (sex === 'female') {
    const months = (Math.max(0, weeks) * 7) / 30.4375;
    return interpolateGirlReferenceByMonths(months, (row) => row.weightMedianKg);
  }

  // Nếu dưới 104 tuần (2 tuổi), dùng bảng tuần
  if (weeks <= 104) {
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

  // Trên 104 tuần, chuyển sang bảng năm tuổi
  const years = weeks / 52.1775; // Chính xác hơn 52 tuần/năm
  const yearTable = sex === 'male' ? BOY_EXTENDED_YEARS : GIRL_EXTENDED_YEARS;

  if (years <= yearTable[0][0]) return yearTable[0][1];
  if (years >= yearTable[yearTable.length - 1][0]) return yearTable[yearTable.length - 1][1];

  let i = 0;
  while (i < yearTable.length - 1 && yearTable[i + 1][0] < years) i++;
  const [y0, k0] = yearTable[i];
  const [y1, k1] = yearTable[i + 1];
  const r = (years - y0) / (y1 - y0);
  return k0 + r * (k1 - k0);
}

/**
 * Ước lượng độ lệch chuẩn (kg) — điều chỉnh theo độ tuổi
 * Sơ sinh: ~10%, sau đó tăng dần theo tuổi
 */
export function approxSdKgAtWeeks(weeks: number, sex: WeightGrowthSex): number {
  if (sex === 'female') {
    const months = (Math.max(0, weeks) * 7) / 30.4375;
    const min = interpolateGirlReferenceByMonths(months, (row) => row.weightMinus2SdKg);
    const max = interpolateGirlReferenceByMonths(months, (row) => row.weightPlus2SdKg);
    return Math.max(0.12, (max - min) / 4);
  }

  const m = medianWeightKgAtWeeks(weeks, sex);
  let factor: number;

  if (weeks <= 8) {
    factor = 0.1; // Sơ sinh - 2 tháng: 10%
  } else if (weeks <= 52) {
    factor = 0.11; // 2 tháng - 1 tuổi: 11%
  } else if (weeks <= 104) {
    factor = 0.12; // 1-2 tuổi: 12%
  } else {
    factor = 0.13; // Trên 2 tuổi: 13% (độ biến thiên lớn hơn)
  }

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

export function weeksFromDaysPrecise(days: number): number {
  return Math.max(0, days / 7);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatWeeksLabel(weeks: number): string {
  if (weeks > 104) {
    return `${Math.floor(weeks / 52.1775)} tuổi`;
  }
  const rounded = Math.round(weeks * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} tuần` : `${rounded} tuần`;
}

export function estimateWeightByWeek(
  weeks: number,
  currentWeightKg: number,
  sex: WeightGrowthSex
): WeightWeekEstimate | null {
  if (
    !Number.isFinite(weeks) ||
    weeks < 0 ||
    !Number.isFinite(currentWeightKg) ||
    currentWeightKg <= 0
  ) {
    return null;
  }

  const median = medianWeightKgAtWeeks(weeks, sex);
  const sd = approxSdKgAtWeeks(weeks, sex);

  const minus2 = median - 2 * sd;
  const minus1 = median - sd;
  const plus1 = median + sd;
  const plus2 = median + 2 * sd;

  return {
    weekAge: round2(weeks),
    currentWeightKg: round2(currentWeightKg),
    medianKg: round2(median),
    severeUnderweightMaxKg: round2(minus2),
    underweightMaxKg: round2(minus1),
    standardMinKg: round2(minus1),
    standardMaxKg: round2(plus1),
    overweightMinKg: round2(plus1),
    highWeightMinKg: round2(plus2),
    deltaFromMedianKg: round2(currentWeightKg - median),
  };
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
  if (!Number.isFinite(weeks) || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const estimate = estimateWeightByWeek(weeks, weightKg, sex);
  if (!estimate) return null;

  // Mở rộng hỗ trợ tới 10 tuổi (khoảng 520 tuần)
  if (weeks > 520) {
    return {
      weeks,
      weeksLabel: formatWeeksLabel(weeks),
      medianKg: medianWeightKgAtWeeks(520, sex),
      sdKg: approxSdKgAtWeeks(520, sex),
      zScore: 0,
      status: 'unknown',
      statusLabel: 'Ngoài độ tuổi hỗ trợ',
      detail:
        'App hỗ trợ đánh giá tới 10 tuổi. Với trẻ lớn hơn, hãy tham khảo bác sĩ nhi khoa để có biểu đồ tăng trưởng phù hợp.',
      estimate,
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
    detail = 'Trên mức trung bình. Thường là biến thể lành tính; theo dõi xu hướng dài hạn.';
  } else {
    status = 'very_high';
    statusLabel = 'Cao đáng lưu ý';
    detail =
      'Cân nặng cao hơn rõ so với trung vị cùng tuần. Trao đổi khi khám để loại trừ bệnh lý hoặc điều chỉnh dinh dưỡng.';
  }

  const weeksLabel = formatWeeksLabel(weeks);

  return {
    weeks,
    weeksLabel,
    medianKg: Math.round(median * 100) / 100,
    sdKg: Math.round(sd * 1000) / 1000,
    zScore: Math.round(z * 100) / 100,
    status,
    statusLabel,
    detail,
    estimate,
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

/**
 * Chiều dài/chiều cao trung vị WHO theo tháng đầy đủ (0-24).
 * Nguồn tham khảo: WHO Child Growth Standards (length/height-for-age, P50).
 */
const BOY_LENGTH_MEDIAN_CM_BY_MONTH: readonly number[] = [
  49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 76.9, 78.0, 79.2,
  80.3, 81.3, 82.3, 83.3, 84.2, 85.1, 86.0, 86.9, 87.8,
];

/**
 * Bé gái (P50) theo tháng đầy đủ (0-24).
 */
const GIRL_LENGTH_MEDIAN_CM_BY_MONTH: readonly number[] = [
  49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 75.2, 76.3, 77.5,
  78.6, 79.7, 80.7, 81.7, 82.7, 83.7, 84.6, 85.5, 86.4,
];

export interface WhoGirlVnReferenceRow {
  /** 0 = sơ sinh, 1…24 = tháng đầy đủ */
  monthIndex: number;
  monthLabelVi: string;
  weightMedianKg: number;
  heightMedianCm: number;
}

export interface WhoGirlRangeReferenceRow {
  /** tuổi theo tháng; 2.5 tuổi = 30 tháng */
  monthsAge: number;
  ageLabelVi: string;
  weightMinus2SdKg: number;
  weightMedianKg: number;
  weightPlus2SdKg: number;
  heightMinus2SdCm: number;
  heightMedianCm: number;
  heightPlus2SdCm: number;
}

const GIRL_WHO_RANGE_REFERENCE_TABLE: readonly WhoGirlRangeReferenceRow[] = [
  {
    monthsAge: 0,
    ageLabelVi: 'Sơ sinh',
    weightMinus2SdKg: 2.4,
    weightMedianKg: 3.2,
    weightPlus2SdKg: 4.2,
    heightMinus2SdCm: 45.4,
    heightMedianCm: 49.1,
    heightPlus2SdCm: 52.9,
  },
  {
    monthsAge: 1,
    ageLabelVi: '1 tháng',
    weightMinus2SdKg: 3.2,
    weightMedianKg: 4.2,
    weightPlus2SdKg: 5.5,
    heightMinus2SdCm: 49.8,
    heightMedianCm: 53.7,
    heightPlus2SdCm: 57.6,
  },
  {
    monthsAge: 2,
    ageLabelVi: '2 tháng',
    weightMinus2SdKg: 3.9,
    weightMedianKg: 5.1,
    weightPlus2SdKg: 6.6,
    heightMinus2SdCm: 53.0,
    heightMedianCm: 57.1,
    heightPlus2SdCm: 61.1,
  },
  {
    monthsAge: 3,
    ageLabelVi: '3 tháng',
    weightMinus2SdKg: 4.5,
    weightMedianKg: 5.8,
    weightPlus2SdKg: 7.5,
    heightMinus2SdCm: 55.6,
    heightMedianCm: 59.8,
    heightPlus2SdCm: 64.0,
  },
  {
    monthsAge: 4,
    ageLabelVi: '4 tháng',
    weightMinus2SdKg: 5.0,
    weightMedianKg: 6.4,
    weightPlus2SdKg: 8.2,
    heightMinus2SdCm: 57.8,
    heightMedianCm: 62.1,
    heightPlus2SdCm: 66.4,
  },
  {
    monthsAge: 5,
    ageLabelVi: '5 tháng',
    weightMinus2SdKg: 5.4,
    weightMedianKg: 6.9,
    weightPlus2SdKg: 8.8,
    heightMinus2SdCm: 59.6,
    heightMedianCm: 64.0,
    heightPlus2SdCm: 68.5,
  },
  {
    monthsAge: 6,
    ageLabelVi: '6 tháng',
    weightMinus2SdKg: 5.7,
    weightMedianKg: 7.3,
    weightPlus2SdKg: 9.3,
    heightMinus2SdCm: 61.2,
    heightMedianCm: 65.7,
    heightPlus2SdCm: 70.3,
  },
  {
    monthsAge: 7,
    ageLabelVi: '7 tháng',
    weightMinus2SdKg: 6.0,
    weightMedianKg: 7.6,
    weightPlus2SdKg: 9.8,
    heightMinus2SdCm: 62.7,
    heightMedianCm: 67.3,
    heightPlus2SdCm: 71.9,
  },
  {
    monthsAge: 8,
    ageLabelVi: '8 tháng',
    weightMinus2SdKg: 6.3,
    weightMedianKg: 7.9,
    weightPlus2SdKg: 10.2,
    heightMinus2SdCm: 64.0,
    heightMedianCm: 68.7,
    heightPlus2SdCm: 73.5,
  },
  {
    monthsAge: 9,
    ageLabelVi: '9 tháng',
    weightMinus2SdKg: 6.5,
    weightMedianKg: 8.2,
    weightPlus2SdKg: 10.5,
    heightMinus2SdCm: 65.3,
    heightMedianCm: 70.1,
    heightPlus2SdCm: 75.0,
  },
  {
    monthsAge: 10,
    ageLabelVi: '10 tháng',
    weightMinus2SdKg: 6.7,
    weightMedianKg: 8.5,
    weightPlus2SdKg: 10.9,
    heightMinus2SdCm: 66.5,
    heightMedianCm: 71.5,
    heightPlus2SdCm: 76.4,
  },
  {
    monthsAge: 11,
    ageLabelVi: '11 tháng',
    weightMinus2SdKg: 6.9,
    weightMedianKg: 8.7,
    weightPlus2SdKg: 11.2,
    heightMinus2SdCm: 67.7,
    heightMedianCm: 72.8,
    heightPlus2SdCm: 77.8,
  },
  {
    monthsAge: 12,
    ageLabelVi: '12 tháng',
    weightMinus2SdKg: 7.0,
    weightMedianKg: 8.9,
    weightPlus2SdKg: 11.5,
    heightMinus2SdCm: 68.9,
    heightMedianCm: 74.0,
    heightPlus2SdCm: 79.2,
  },
  {
    monthsAge: 15,
    ageLabelVi: '15 tháng',
    weightMinus2SdKg: 7.6,
    weightMedianKg: 9.6,
    weightPlus2SdKg: 12.4,
    heightMinus2SdCm: 72.0,
    heightMedianCm: 77.5,
    heightPlus2SdCm: 83.0,
  },
  {
    monthsAge: 18,
    ageLabelVi: '18 tháng',
    weightMinus2SdKg: 8.1,
    weightMedianKg: 10.2,
    weightPlus2SdKg: 13.2,
    heightMinus2SdCm: 74.9,
    heightMedianCm: 80.7,
    heightPlus2SdCm: 86.5,
  },
  {
    monthsAge: 21,
    ageLabelVi: '21 tháng',
    weightMinus2SdKg: 8.6,
    weightMedianKg: 10.9,
    weightPlus2SdKg: 14.0,
    heightMinus2SdCm: 77.5,
    heightMedianCm: 83.7,
    heightPlus2SdCm: 89.8,
  },
  {
    monthsAge: 24,
    ageLabelVi: '24 tháng',
    weightMinus2SdKg: 9.0,
    weightMedianKg: 11.5,
    weightPlus2SdKg: 14.8,
    heightMinus2SdCm: 80.0,
    heightMedianCm: 86.4,
    heightPlus2SdCm: 92.9,
  },
  {
    monthsAge: 30,
    ageLabelVi: '2.5 tuổi',
    weightMinus2SdKg: 10.0,
    weightMedianKg: 12.7,
    weightPlus2SdKg: 16.5,
    heightMinus2SdCm: 83.6,
    heightMedianCm: 90.7,
    heightPlus2SdCm: 97.7,
  },
  {
    monthsAge: 36,
    ageLabelVi: '3 tuổi',
    weightMinus2SdKg: 10.8,
    weightMedianKg: 13.9,
    weightPlus2SdKg: 18.1,
    heightMinus2SdCm: 87.4,
    heightMedianCm: 95.1,
    heightPlus2SdCm: 102.7,
  },
  {
    monthsAge: 42,
    ageLabelVi: '3.5 tuổi',
    weightMinus2SdKg: 11.6,
    weightMedianKg: 15.0,
    weightPlus2SdKg: 19.8,
    heightMinus2SdCm: 90.9,
    heightMedianCm: 99.0,
    heightPlus2SdCm: 107.2,
  },
  {
    monthsAge: 48,
    ageLabelVi: '4 tuổi',
    weightMinus2SdKg: 12.3,
    weightMedianKg: 16.1,
    weightPlus2SdKg: 21.5,
    heightMinus2SdCm: 94.1,
    heightMedianCm: 102.7,
    heightPlus2SdCm: 111.3,
  },
  {
    monthsAge: 54,
    ageLabelVi: '4.5 tuổi',
    weightMinus2SdKg: 13.0,
    weightMedianKg: 17.2,
    weightPlus2SdKg: 23.2,
    heightMinus2SdCm: 97.1,
    heightMedianCm: 106.2,
    heightPlus2SdCm: 115.2,
  },
  {
    monthsAge: 60,
    ageLabelVi: '5 tuổi',
    weightMinus2SdKg: 13.7,
    weightMedianKg: 18.2,
    weightPlus2SdKg: 24.9,
    heightMinus2SdCm: 99.9,
    heightMedianCm: 109.4,
    heightPlus2SdCm: 118.9,
  },
  {
    monthsAge: 66,
    ageLabelVi: '5.5 tuổi',
    weightMinus2SdKg: 14.6,
    weightMedianKg: 19.1,
    weightPlus2SdKg: 26.2,
    heightMinus2SdCm: 102.3,
    heightMedianCm: 112.2,
    heightPlus2SdCm: 122.0,
  },
  {
    monthsAge: 72,
    ageLabelVi: '6 tuổi',
    weightMinus2SdKg: 15.3,
    weightMedianKg: 20.2,
    weightPlus2SdKg: 27.8,
    heightMinus2SdCm: 104.9,
    heightMedianCm: 115.1,
    heightPlus2SdCm: 125.4,
  },
  {
    monthsAge: 78,
    ageLabelVi: '6.5 tuổi',
    weightMinus2SdKg: 16.0,
    weightMedianKg: 21.2,
    weightPlus2SdKg: 29.6,
    heightMinus2SdCm: 107.4,
    heightMedianCm: 118.0,
    heightPlus2SdCm: 128.6,
  },
  {
    monthsAge: 84,
    ageLabelVi: '7 tuổi',
    weightMinus2SdKg: 16.8,
    weightMedianKg: 22.4,
    weightPlus2SdKg: 31.4,
    heightMinus2SdCm: 109.9,
    heightMedianCm: 120.8,
    heightPlus2SdCm: 131.7,
  },
  {
    monthsAge: 90,
    ageLabelVi: '7.5 tuổi',
    weightMinus2SdKg: 17.6,
    weightMedianKg: 23.6,
    weightPlus2SdKg: 33.5,
    heightMinus2SdCm: 112.4,
    heightMedianCm: 123.7,
    heightPlus2SdCm: 134.9,
  },
  {
    monthsAge: 96,
    ageLabelVi: '8 tuổi',
    weightMinus2SdKg: 18.6,
    weightMedianKg: 25.0,
    weightPlus2SdKg: 35.8,
    heightMinus2SdCm: 115.0,
    heightMedianCm: 126.6,
    heightPlus2SdCm: 138.2,
  },
  {
    monthsAge: 102,
    ageLabelVi: '8.5 tuổi',
    weightMinus2SdKg: 19.6,
    weightMedianKg: 26.6,
    weightPlus2SdKg: 38.3,
    heightMinus2SdCm: 117.6,
    heightMedianCm: 129.5,
    heightPlus2SdCm: 141.4,
  },
  {
    monthsAge: 108,
    ageLabelVi: '9 tuổi',
    weightMinus2SdKg: 20.8,
    weightMedianKg: 28.2,
    weightPlus2SdKg: 41.1,
    heightMinus2SdCm: 120.3,
    heightMedianCm: 132.5,
    heightPlus2SdCm: 144.7,
  },
  {
    monthsAge: 114,
    ageLabelVi: '9.5 tuổi',
    weightMinus2SdKg: 20.0,
    weightMedianKg: 30.0,
    weightPlus2SdKg: 43.8,
    heightMinus2SdCm: 123.0,
    heightMedianCm: 135.5,
    heightPlus2SdCm: 148.1,
  },
  {
    monthsAge: 120,
    ageLabelVi: '10 tuổi',
    weightMinus2SdKg: 23.3,
    weightMedianKg: 31.9,
    weightPlus2SdKg: 46.9,
    heightMinus2SdCm: 125.8,
    heightMedianCm: 138.6,
    heightPlus2SdCm: 151.4,
  },
];

export function whoGirlRangeReferenceTable(): WhoGirlRangeReferenceRow[] {
  return GIRL_WHO_RANGE_REFERENCE_TABLE.map((r) => ({ ...r }));
}

function interpolateGirlReferenceByMonths(
  months: number,
  pick: (row: WhoGirlRangeReferenceRow) => number
): number {
  const rows = GIRL_WHO_RANGE_REFERENCE_TABLE;
  const m = Math.max(rows[0].monthsAge, Math.min(rows[rows.length - 1].monthsAge, months));
  if (m <= rows[0].monthsAge) return pick(rows[0]);
  if (m >= rows[rows.length - 1].monthsAge) return pick(rows[rows.length - 1]);
  let i = 0;
  while (i < rows.length - 1 && rows[i + 1].monthsAge < m) i++;
  const r0 = rows[i];
  const r1 = rows[i + 1];
  const ratio = (m - r0.monthsAge) / (r1.monthsAge - r0.monthsAge);
  return pick(r0) + ratio * (pick(r1) - pick(r0));
}

export interface HeightGrowthEvaluation {
  monthsAge: number;
  monthsLabel: string;
  medianCm: number;
  sdCm: number;
  zScore: number;
  percentile: number;
  status: WeightGrowthStatus;
  statusLabel: string;
  detail: string;
}

export interface WhoHeightBandSample {
  daysSinceBirth: number;
  monthsAge: number;
  medianCm: number;
  minus2SdCm: number;
  plus2SdCm: number;
}

function heightMedianTableForSex(sex: WeightGrowthSex): readonly number[] {
  return sex === 'male' ? BOY_LENGTH_MEDIAN_CM_BY_MONTH : GIRL_LENGTH_MEDIAN_CM_BY_MONTH;
}

function interpolateSeries(x: number, values: readonly number[]): number {
  if (!values.length) return 0;
  const clampedX = Math.max(0, Math.min(values.length - 1, x));
  const i0 = Math.floor(clampedX);
  const i1 = Math.min(values.length - 1, i0 + 1);
  const ratio = clampedX - i0;
  return values[i0] + (values[i1] - values[i0]) * ratio;
}

export function monthsFromDays(days: number): number {
  return Math.max(0, days / 30.4375);
}

export function medianHeightCmAtMonths(months: number, sex: WeightGrowthSex): number {
  if (sex === 'female') {
    return interpolateGirlReferenceByMonths(Math.max(0, months), (row) => row.heightMedianCm);
  }
  return interpolateSeries(months, heightMedianTableForSex(sex));
}

export function approxSdHeightCmAtMonths(months: number, sex: WeightGrowthSex): number {
  if (sex === 'female') {
    const m = Math.max(0, months);
    const min = interpolateGirlReferenceByMonths(m, (row) => row.heightMinus2SdCm);
    const max = interpolateGirlReferenceByMonths(m, (row) => row.heightPlus2SdCm);
    return Math.max(1.2, (max - min) / 4);
  }

  const median = medianHeightCmAtMonths(months, sex);
  // WHO spread tăng dần theo tuổi; xấp xỉ đủ dùng cho cảnh báo tham khảo.
  const factor = months <= 6 ? 0.028 : months <= 12 ? 0.029 : months <= 24 ? 0.03 : 0.031;
  return Math.max(1.2, median * factor);
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function percentileFromZScore(z: number): number {
  const p = 0.5 * (1 + erf(z / Math.SQRT2));
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

export function evaluateHeightForAge(
  days: number,
  heightCm: number,
  sex: WeightGrowthSex
): HeightGrowthEvaluation | null {
  if (!Number.isFinite(days) || days < 0) return null;
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  const months = monthsFromDays(days);
  if (months > 24) {
    return {
      monthsAge: months,
      monthsLabel: `${Math.floor(months)} tháng`,
      medianCm: Math.round(medianHeightCmAtMonths(24, sex) * 10) / 10,
      sdCm: Math.round(approxSdHeightCmAtMonths(24, sex) * 100) / 100,
      zScore: 0,
      percentile: 50,
      status: 'unknown',
      statusLabel: 'Ngoài độ tuổi hỗ trợ',
      detail:
        'Đánh giá chiều cao trong app đang tối ưu cho 0-24 tháng. Khi bé lớn hơn, nên theo dõi bằng biểu đồ chuyên khoa.',
    };
  }
  const median = medianHeightCmAtMonths(months, sex);
  const sd = approxSdHeightCmAtMonths(months, sex);
  const z = sd > 0 ? (heightCm - median) / sd : 0;
  const pct = percentileFromZScore(z);
  let status: WeightGrowthStatus;
  let statusLabel: string;
  let detail: string;
  if (z < -2) {
    status = 'very_low';
    statusLabel = 'Chiều cao thấp đáng lưu ý';
    detail =
      'Chiều cao đang thấp hơn nhiều so với trung vị WHO theo tuổi. Nên trao đổi thêm khi đi khám định kỳ.';
  } else if (z < -1) {
    status = 'low';
    statusLabel = 'Chiều cao hơi thấp';
    detail =
      'Chiều cao thấp hơn trung bình nhẹ. Theo dõi xu hướng dài hạn và cập nhật sau mỗi lần đo tại bệnh viện.';
  } else if (z <= 1) {
    status = 'normal';
    statusLabel = 'Chiều cao phù hợp tuổi';
    detail =
      'Chiều cao nằm trong vùng phổ biến theo chuẩn WHO. Tiếp tục theo dõi đều mỗi lần khám.';
  } else if (z <= 2) {
    status = 'high';
    statusLabel = 'Chiều cao hơi cao';
    detail =
      'Chiều cao nhỉnh hơn trung bình. Đây thường là biến thiên bình thường, nên xem xu hướng theo nhiều mốc đo.';
  } else {
    status = 'very_high';
    statusLabel = 'Chiều cao cao đáng lưu ý';
    detail =
      'Chiều cao cao hơn rõ so với trung vị WHO theo tuổi. Có thể trao đổi thêm với bác sĩ nếu có băn khoăn.';
  }
  const roundedMonths = Math.round(months * 10) / 10;
  return {
    monthsAge: roundedMonths,
    monthsLabel:
      roundedMonths < 1 ? `${Math.max(1, Math.floor(days))} ngày` : `${roundedMonths} tháng`,
    medianCm: Math.round(median * 10) / 10,
    sdCm: Math.round(sd * 100) / 100,
    zScore: Math.round(z * 100) / 100,
    percentile: pct,
    status,
    statusLabel,
    detail,
  };
}

export function sampleWhoHeightBandByDay(
  maxDaysInclusive: number,
  sex: WeightGrowthSex,
  maxSamples = 120
): WhoHeightBandSample[] {
  const cap = Math.min(731, Math.max(7, Math.floor(maxDaysInclusive)));
  const step = Math.max(1, Math.ceil(cap / maxSamples));
  const out: WhoHeightBandSample[] = [];
  const push = (d: number) => {
    const months = monthsFromDays(d);
    const median = medianHeightCmAtMonths(months, sex);
    const sd = approxSdHeightCmAtMonths(months, sex);
    out.push({
      daysSinceBirth: d,
      monthsAge: months,
      medianCm: Math.round(median * 10) / 10,
      minus2SdCm: Math.round(Math.max(30, median - 2 * sd) * 10) / 10,
      plus2SdCm: Math.round((median + 2 * sd) * 10) / 10,
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

export function whoVnReferenceTable(sex: WeightGrowthSex): WhoGirlVnReferenceRow[] {
  const hTable = heightMedianTableForSex(sex);
  return hTable.map((heightCm, monthIndex) => {
    const weeksApprox = monthIndex * (52 / 12);
    const wKg = medianWeightKgAtWeeks(weeksApprox, sex);
    return {
      monthIndex,
      monthLabelVi: monthIndex === 0 ? 'Sơ sinh' : `${monthIndex} tháng`,
      weightMedianKg: Math.round(wKg * 100) / 100,
      heightMedianCm: Math.round(heightCm * 10) / 10,
    };
  });
}

/**
 * Bảng tham chiếu cân nặng + chiều cao (trung vị) cho bé gái — chuẩn WHO,
 * cột cân nội suy từ bảng tuần tuổi trong app (cùng nguồn với biểu đồ).
 */
export function whoGirlVnReferenceTable(): WhoGirlVnReferenceRow[] {
  return whoVnReferenceTable('female');
}
