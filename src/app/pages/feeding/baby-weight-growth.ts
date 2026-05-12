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

/** 
 * Trục tuần (0 → 104) — trung vị cân (kg), nam — cập nhật theo WHO Child Growth Standards
 * Nguồn tham khảo: WHO Growth Standards và bảng chuẩn Bibomart (2024)
 */
const BOY_MEDIAN_WEEKS: readonly [number, number][] = [
  [0, 3.3],     // Sơ sinh: 3.3kg (theo bảng WHO chuẩn VN)
  [4, 4.5],     // 1 tháng: 4.5kg 
  [8, 5.6],     // 2 tháng: 5.6kg
  [12, 6.4],    // 3 tháng: 6.4kg
  [16, 7.0],    // 4 tháng: 7.0kg
  [20, 7.5],    // 5 tháng: 7.5kg
  [24, 7.9],    // 6 tháng: 7.9kg
  [28, 8.3],    // 7 tháng: 8.3kg
  [32, 8.6],    // 8 tháng: 8.6kg
  [36, 8.9],    // 9 tháng: 8.9kg
  [40, 9.2],    // 10 tháng: 9.2kg
  [44, 9.4],    // 11 tháng: 9.4kg
  [48, 9.6],    // 12 tháng (1 tuổi): 9.6kg
  [52, 9.8],    // 13 tháng
  [56, 10.0],   // 14 tháng
  [60, 10.3],   // 15 tháng: 10.3kg (theo bảng)
  [64, 10.5],   // 16 tháng
  [68, 10.7],   // 17 tháng
  [72, 10.9],   // 18 tháng: 10.9kg (theo bảng)
  [76, 11.1],   // 19 tháng
  [80, 11.3],   // 20 tháng
  [84, 11.5],   // 21 tháng: 11.5kg (theo bảng)
  [88, 11.8],   // 22 tháng
  [92, 12.0],   // 23 tháng
  [96, 12.2],   // 24 tháng (2 tuổi): 12.2kg (theo bảng)
  [100, 12.5],  // 2.5 tuổi
  [104, 12.8],  // Ngoại suy cho giai đoạn sau 2 tuổi
];

/** 
 * Trục tuần (0 → 104) — trung vị cân (kg), nữ — cập nhật theo WHO Child Growth Standards
 * Nguồn tham khảo: WHO Growth Standards và bảng chuẩn Bibomart (2024)
 */
const GIRL_MEDIAN_WEEKS: readonly [number, number][] = [
  [0, 3.2],     // Sơ sinh: 3.2kg (theo bảng WHO chuẩn VN)
  [4, 4.2],     // 1 tháng: 4.2kg
  [8, 5.1],     // 2 tháng: 5.1kg
  [12, 5.8],    // 3 tháng: 5.8kg
  [16, 6.4],    // 4 tháng: 6.4kg
  [20, 6.9],    // 5 tháng: 6.9kg
  [24, 7.3],    // 6 tháng: 7.3kg
  [28, 7.6],    // 7 tháng: 7.6kg
  [32, 7.9],    // 8 tháng: 7.9kg
  [36, 8.2],    // 9 tháng: 8.2kg
  [40, 8.5],    // 10 tháng: 8.5kg
  [44, 8.7],    // 11 tháng: 8.7kg
  [48, 8.9],    // 12 tháng (1 tuổi): 8.9kg
  [52, 9.1],    // 13 tháng
  [56, 9.3],    // 14 tháng
  [60, 9.6],    // 15 tháng: 9.6kg (theo bảng)
  [64, 9.8],    // 16 tháng
  [68, 10.0],   // 17 tháng
  [72, 10.2],   // 18 tháng: 10.2kg (theo bảng)
  [76, 10.4],   // 19 tháng
  [80, 10.6],   // 20 tháng
  [84, 10.9],   // 21 tháng: 10.9kg (theo bảng)
  [88, 11.1],   // 22 tháng
  [92, 11.3],   // 23 tháng
  [96, 11.5],   // 24 tháng (2 tuổi): 11.5kg (theo bảng)
  [100, 11.8],  // 2.5 tuổi
  [104, 12.0],  // Ngoại suy cho giai đoạn sau 2 tuổi
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
export function medianWeightKgAtWeeks(
  weeks: number,
  sex: WeightGrowthSex
): number {
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
  const m = medianWeightKgAtWeeks(weeks, sex);
  let factor: number;
  
  if (weeks <= 8) {
    factor = 0.10; // Sơ sinh - 2 tháng: 10%
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

  // Mở rộng hỗ trợ tới 10 tuổi (khoảng 520 tuần)
  if (weeks > 520) {
    return {
      weeks,
      weeksLabel: `${Math.floor(weeks / 52.1775)} tuổi`,
      medianKg: medianWeightKgAtWeeks(520, sex),
      sdKg: approxSdKgAtWeeks(520, sex),
      zScore: 0,
      status: 'unknown',
      statusLabel: 'Ngoài độ tuổi hỗ trợ',
      detail:
        'App hỗ trợ đánh giá tới 10 tuổi. Với trẻ lớn hơn, hãy tham khảo bác sĩ nhi khoa để có biểu đồ tăng trưởng phù hợp.',
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

  const weeksLabel = weeks > 104 
    ? `${Math.floor(weeks / 52.1775)} tuổi`
    : `${weeks} tuần`;

  return {
    weeks,
    weeksLabel,
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
