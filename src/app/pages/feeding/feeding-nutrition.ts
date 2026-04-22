/**
 * Nutrition target & evaluation based on baby's weight + age.
 *
 * References:
 *  - AAP (American Academy of Pediatrics): 150-200 ml/kg/day for <6mo (formula)
 *  - WHO: babies regulate intake themselves, but typical formula/mixed ranges
 *  - Vietnam MOH pediatric guidelines
 *
 * Disclaimer: These are averages for formula/mixed feeding. EBF babies
 * self-regulate and may differ significantly. Always consult your pediatrician.
 */

export interface NutritionTarget {
  /** Min dung tích/ngày (ml) */
  dailyMlMin: number;
  /** Max dung tích/ngày (ml) */
  dailyMlMax: number;
  /** Gợi ý ml mỗi cữ (min) */
  perFeedMin: number;
  /** Gợi ý ml mỗi cữ (max) */
  perFeedMax: number;
  /** Số cữ/ngày gợi ý (min) */
  feedsPerDayMin: number;
  /** Số cữ/ngày gợi ý (max) */
  feedsPerDayMax: number;
  /** Hệ số ml/kg/ngày (trung bình) */
  perKgFactor: number;
  ageLabel: string;
  note: string;
}

export type NutritionStatus =
  | 'no-data'
  | 'low'      // thấp hơn khuyến nghị > 15%
  | 'under'    // dưới khoảng khuyến nghị (nhẹ)
  | 'ok'       // trong khoảng khuyến nghị
  | 'over'     // hơi trên khoảng
  | 'high';    // cao hơn > 15%

export interface NutritionEvaluation {
  target: NutritionTarget;
  actualMl: number;
  actualCount: number;
  /** % so với trung điểm khoảng khuyến nghị */
  percentOfTarget: number;
  /** % so với min khuyến nghị */
  percentOfMin: number;
  status: NutritionStatus;
  statusLabel: string;
  advice: string;
  /** Dung tích còn cần để đạt min khuyến nghị */
  remainingToMin: number;
  /** Dung tích còn cần để đạt max khuyến nghị */
  remainingToMax: number;
}

/**
 * Compute recommended daily milk intake based on weight (kg) and age (days).
 *
 * Week 1: linearly ramps up from day 1 (very small) to day 7 (~150ml/kg)
 *   - Rule of thumb: day N × 10-15ml per feed × 8-12 feeds
 */
export function getNutritionTarget(
  weightKg: number,
  ageInDays: number
): NutritionTarget | null {
  if (!weightKg || weightKg <= 0 || ageInDays < 0) return null;

  let perKgMin = 150;
  let perKgMax = 180;
  let perFeedMin = 60;
  let perFeedMax = 90;
  let feedsPerDayMin = 8;
  let feedsPerDayMax = 12;
  let ageLabel = '';
  let note = '';

  if (ageInDays < 7) {
    // Tuần đầu: tăng dần mỗi ngày
    const day = ageInDays + 1; // 1..7
    perKgMin = Math.min(150, 30 + (day - 1) * 20);
    perKgMax = Math.min(180, 50 + (day - 1) * 22);
    perFeedMin = Math.min(60, 10 + (day - 1) * 8);
    perFeedMax = Math.min(90, 20 + (day - 1) * 12);
    feedsPerDayMin = 8;
    feedsPerDayMax = 12;
    ageLabel = `Tuần đầu · ngày ${day}`;
    note =
      'Dạ dày bé rất nhỏ, đừng lo nếu bé bú ít. Ưu tiên sữa non/sữa mẹ, bú theo nhu cầu.';
  } else if (ageInDays < 30) {
    perKgMin = 150;
    perKgMax = 180;
    perFeedMin = 60;
    perFeedMax = 120;
    feedsPerDayMin = 8;
    feedsPerDayMax = 10;
    ageLabel = 'Tuần 2-4';
    note = 'Bé nên tăng khoảng 150-200g/tuần. Kiểm tra tã ướt 6+ lần/ngày.';
  } else if (ageInDays < 90) {
    perKgMin = 150;
    perKgMax = 180;
    perFeedMin = 90;
    perFeedMax = 150;
    feedsPerDayMin = 6;
    feedsPerDayMax = 8;
    ageLabel = '1-3 tháng';
    note = 'Bé bắt đầu dài giấc đêm. Bú theo nhu cầu, không ép quá mức.';
  } else if (ageInDays < 180) {
    perKgMin = 130;
    perKgMax = 150;
    perFeedMin = 120;
    perFeedMax = 180;
    feedsPerDayMin = 5;
    feedsPerDayMax = 7;
    ageLabel = '3-6 tháng';
    note = 'Chuẩn bị ăn dặm từ ~6 tháng. Sữa vẫn là nguồn dinh dưỡng chính.';
  } else if (ageInDays < 365) {
    perKgMin = 100;
    perKgMax = 130;
    perFeedMin = 180;
    perFeedMax = 240;
    feedsPerDayMin = 4;
    feedsPerDayMax = 6;
    ageLabel = '6-12 tháng';
    note =
      'Kết hợp ăn dặm 2-3 bữa/ngày + sữa. Tổng sữa khoảng 500-800ml/ngày.';
  } else {
    perKgMin = 70;
    perKgMax = 90;
    perFeedMin = 180;
    perFeedMax = 240;
    feedsPerDayMin = 2;
    feedsPerDayMax = 4;
    ageLabel = 'Trên 1 tuổi';
    note =
      'Bữa ăn chính là thức ăn đặc, sữa chỉ 2-3 cữ/ngày (500-600ml).';
  }

  const dailyMlMin = Math.round(weightKg * perKgMin);
  const dailyMlMax = Math.round(weightKg * perKgMax);

  return {
    dailyMlMin,
    dailyMlMax,
    perFeedMin,
    perFeedMax,
    feedsPerDayMin,
    feedsPerDayMax,
    perKgFactor: Math.round((perKgMin + perKgMax) / 2),
    ageLabel,
    note,
  };
}

/**
 * Evaluate today's feeding progress vs target.
 *
 * Tolerance: ±15% around recommended range is still considered "ok" zone.
 */
export function evaluateNutrition(
  target: NutritionTarget | null,
  actualMl: number,
  actualCount: number
): NutritionEvaluation | null {
  if (!target) return null;

  const mid = (target.dailyMlMin + target.dailyMlMax) / 2;
  const percentOfTarget = Math.round((actualMl / mid) * 100);
  const percentOfMin = Math.round((actualMl / target.dailyMlMin) * 100);

  let status: NutritionStatus;
  let statusLabel: string;
  let advice: string;

  if (actualMl === 0 && actualCount === 0) {
    status = 'no-data';
    statusLabel = 'Chưa có dữ liệu';
    advice = `Chưa ghi cữ bú nào hôm nay. Mục tiêu: ${target.dailyMlMin}-${target.dailyMlMax}ml.`;
  } else if (actualMl < target.dailyMlMin * 0.85) {
    status = 'low';
    statusLabel = 'Dưới mức khuyến nghị';
    advice = `Bé đang bú ít hơn khuyến nghị. Cần thêm khoảng ${
      target.dailyMlMin - actualMl
    }ml để đạt mức tối thiểu.`;
  } else if (actualMl < target.dailyMlMin) {
    status = 'under';
    statusLabel = 'Gần đạt mức tối thiểu';
    advice = `Chỉ còn cần ${target.dailyMlMin - actualMl}ml nữa là đạt mức khuyến nghị tối thiểu.`;
  } else if (actualMl <= target.dailyMlMax) {
    status = 'ok';
    statusLabel = 'Phù hợp với khuyến nghị';
    advice = `Bé đang bú trong khoảng khuyến nghị. Rất tốt!`;
  } else if (actualMl <= target.dailyMlMax * 1.15) {
    status = 'over';
    statusLabel = 'Hơi cao hơn khuyến nghị';
    advice =
      'Bé bú hơi nhiều hơn khuyến nghị. Không đáng lo nếu bé không bị trớ/nôn, nhưng có thể giãn cữ ra một chút.';
  } else {
    status = 'high';
    statusLabel = 'Cao hơn khuyến nghị nhiều';
    advice =
      'Bé bú vượt khuyến nghị khá nhiều. Theo dõi dấu hiệu quá tải: nôn trớ, đầy bụng. Có thể đang tăng trưởng bứt phá.';
  }

  return {
    target,
    actualMl,
    actualCount,
    percentOfTarget,
    percentOfMin,
    status,
    statusLabel,
    advice,
    remainingToMin: Math.max(0, target.dailyMlMin - actualMl),
    remainingToMax: Math.max(0, target.dailyMlMax - actualMl),
  };
}

/**
 * Đánh giá 1 cữ bú đơn lẻ so với gợi ý per-feed
 */
export function evaluateSingleFeed(
  target: NutritionTarget | null,
  volumeMl: number
): { status: NutritionStatus; label: string } | null {
  if (!target) return null;
  if (volumeMl < target.perFeedMin * 0.6) {
    return { status: 'low', label: 'Cữ khá ít' };
  }
  if (volumeMl < target.perFeedMin) {
    return { status: 'under', label: 'Cữ hơi ít' };
  }
  if (volumeMl <= target.perFeedMax) {
    return { status: 'ok', label: 'Cữ phù hợp' };
  }
  if (volumeMl <= target.perFeedMax * 1.3) {
    return { status: 'over', label: 'Cữ hơi nhiều' };
  }
  return { status: 'high', label: 'Cữ nhiều' };
}
