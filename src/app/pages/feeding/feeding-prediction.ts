import { FeedingLog } from '../../services/feeding-log.service';

export interface DailySummary {
  date: string;
  total: number;
  count: number;
  avg: number;
}

export interface FeedingPrediction {
  hasData: boolean;
  samples: number;
  /** ISO time "HH:mm" dự đoán cữ kế tiếp */
  nextTime?: string;
  /** Date object đầy đủ của cữ dự đoán */
  nextAt?: Date;
  /** Dung tích dự đoán (ml, làm tròn 5ml) */
  nextVolume?: number;
  /** Khoảng dung tích tin cậy [low, high] */
  volumeRange?: [number, number];
  /** Phút trung vị giữa các cữ gần đây */
  medianIntervalMinutes?: number;
  /** 'low' | 'medium' | 'high' */
  confidence: 'low' | 'medium' | 'high';
  /** Giải thích ngắn gọn các yếu tố */
  reasoning: string[];
}

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * Parse "YYYY-MM-DD" + "HH:mm" → Date object (local timezone)
 */
function toDate(log: FeedingLog): Date {
  const [y, mo, d] = log.date.split('-').map((n) => parseInt(n, 10));
  const [h, mi] = log.time.split(':').map((n) => parseInt(n, 10));
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0, 0);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = mean(nums.map((n) => (n - m) ** 2));
  return Math.sqrt(v);
}

/**
 * Lấy bucket giờ trong ngày:
 *  0-5 đêm, 6-10 sáng, 11-14 trưa, 15-18 chiều, 19-23 tối
 */
function hourBucket(hour: number): string {
  if (hour < 6) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 15) return 'noon';
  if (hour < 19) return 'afternoon';
  return 'evening';
}

/**
 * Predict next feeding time & volume.
 *
 * Heuristics (lightweight time-series):
 *  - nextTime = lastFeed + median(last N intervals, ≤14 ngày)
 *  - nextVolume =
 *      0.6 * EMA(volumes, α=0.35)            // xu hướng gần đây
 *    + 0.4 * meanVolumeInSameHourBucket()    // pattern theo giờ trong ngày
 *  - confidence dựa trên số sample + coefficient of variation
 */
export function predictNextFeeding(
  logs: FeedingLog[],
  now: Date = new Date()
): FeedingPrediction {
  if (!logs || logs.length === 0) {
    return {
      hasData: false,
      samples: 0,
      confidence: 'low',
      reasoning: ['Chưa có dữ liệu để dự đoán.'],
    };
  }

  // Sort ascending by timestamp
  const withDates = logs
    .map((l) => ({ log: l, at: toDate(l) }))
    .filter((x) => !isNaN(x.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  // Chỉ dùng 14 ngày gần nhất để phản ánh xu hướng
  const cutoff = now.getTime() - 14 * MS_PER_DAY;
  const recent = withDates.filter((x) => x.at.getTime() >= cutoff);
  const sample = recent.length >= 4 ? recent : withDates;

  if (sample.length < 2) {
    // Chỉ có 1 cữ → không đủ để tính interval
    const only = sample[0];
    return {
      hasData: true,
      samples: sample.length,
      nextVolume: Math.round(only.log.volume / 5) * 5,
      volumeRange: [only.log.volume, only.log.volume],
      confidence: 'low',
      reasoning: [
        `Mới có 1 cữ bú, chưa đủ để dự đoán giờ. Sẽ tốt hơn sau khi có 4-5 cữ.`,
      ],
    };
  }

  // ===== 1. INTERVALS =====
  const intervalsMin: number[] = [];
  for (let i = 1; i < sample.length; i++) {
    const diff = (sample[i].at.getTime() - sample[i - 1].at.getTime()) / MS_PER_MIN;
    // Chỉ lấy interval hợp lý (15 phút – 8 giờ) để lọc outliers & gap giữa các ngày
    if (diff >= 15 && diff <= 8 * 60) {
      intervalsMin.push(diff);
    }
  }

  const medIv = median(intervalsMin);
  const stdIv = stddev(intervalsMin);
  const cvIv = medIv > 0 ? stdIv / medIv : 1;

  // ===== 2. VOLUMES =====
  const volumes = sample.map((x) => x.log.volume);
  // EMA α=0.35 – cữ mới nhất có trọng số cao nhất
  let ema = volumes[0];
  const alpha = 0.35;
  for (let i = 1; i < volumes.length; i++) {
    ema = alpha * volumes[i] + (1 - alpha) * ema;
  }

  // ===== 3. TIME-OF-DAY PATTERN =====
  const lastFeed = sample[sample.length - 1];
  const predictedAt = medIv > 0
    ? new Date(lastFeed.at.getTime() + medIv * MS_PER_MIN)
    : undefined;

  let bucketVolume = ema;
  if (predictedAt) {
    const bucket = hourBucket(predictedAt.getHours());
    const sameBucketVolumes = sample
      .filter((x) => hourBucket(x.at.getHours()) === bucket)
      .map((x) => x.log.volume);
    if (sameBucketVolumes.length >= 2) {
      bucketVolume = mean(sameBucketVolumes);
    }
  }

  // Trộn: 60% EMA + 40% same-bucket mean
  const predictedVolumeRaw = 0.6 * ema + 0.4 * bucketVolume;
  const predictedVolume = Math.max(10, Math.round(predictedVolumeRaw / 5) * 5);

  // Volume range = ± 1 std
  const stdVol = stddev(volumes);
  const low = Math.max(10, Math.round((predictedVolumeRaw - stdVol) / 5) * 5);
  const high = Math.round((predictedVolumeRaw + stdVol) / 5) * 5;

  // ===== 4. CONFIDENCE =====
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (sample.length >= 10 && cvIv < 0.35) confidence = 'high';
  else if (sample.length >= 5 && cvIv < 0.5) confidence = 'medium';
  else confidence = 'low';

  // ===== 5. REASONING =====
  const reasoning: string[] = [];
  reasoning.push(
    `Dựa trên ${sample.length} cữ bú gần đây${
      recent.length >= 4 ? ' (14 ngày)' : ''
    }.`
  );
  if (medIv > 0) {
    const h = Math.floor(medIv / 60);
    const m = Math.round(medIv % 60);
    reasoning.push(
      `Khoảng cách trung vị giữa các cữ: ${h > 0 ? `${h} giờ ` : ''}${m} phút.`
    );
  }
  reasoning.push(
    `Xu hướng gần đây (EMA): ${Math.round(ema)}ml · trung bình cùng khung giờ: ${Math.round(bucketVolume)}ml.`
  );
  if (confidence === 'low') {
    reasoning.push('Dữ liệu còn ít/biến động, hãy coi đây là tham khảo.');
  }

  const nextTimeStr = predictedAt
    ? `${predictedAt.getHours().toString().padStart(2, '0')}:${predictedAt
        .getMinutes()
        .toString()
        .padStart(2, '0')}`
    : undefined;

  return {
    hasData: true,
    samples: sample.length,
    nextTime: nextTimeStr,
    nextAt: predictedAt,
    nextVolume: predictedVolume,
    volumeRange: [low, high],
    medianIntervalMinutes: Math.round(medIv),
    confidence,
    reasoning,
  };
}

/**
 * Tổng hợp theo ngày cho N ngày gần nhất (bao gồm hôm nay)
 */
export function getDailySummaries(logs: FeedingLog[], days: number, now: Date = new Date()): DailySummary[] {
  const result: DailySummary[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const da = d.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${mo}-${da}`;

    const dayLogs = logs.filter((l) => l.date === dateStr);
    const total = dayLogs.reduce((s, l) => s + l.volume, 0);
    const count = dayLogs.length;
    const avg = count ? Math.round(total / count) : 0;

    result.push({ date: dateStr, total, count, avg });
  }
  return result;
}
