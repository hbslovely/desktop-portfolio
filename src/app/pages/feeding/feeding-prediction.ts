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

/** Số phút tính từ 00:00 của ngày đó */
function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Khoảng cách vòng (tính cả đêm) giữa 2 phút-trong-ngày */
function circularDiff(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

/**
 * Dự đoán thông minh dung tích dựa vào các cữ tương tự trong tuần qua
 */
function predictVolumeBasedOnSimilarTime(
  sample: { log: FeedingLog; at: Date }[],
  currentMinute: number
): number | null {
  const oneWeekAgo = Date.now() - 7 * MS_PER_DAY;
  
  // Lọc các cữ trong tuần qua
  const weekSamples = sample.filter(x => x.at.getTime() >= oneWeekAgo);
  
  if (weekSamples.length < 2) {
    return null; // Không đủ dữ liệu
  }
  
  // Tìm các cữ có thời gian tương tự (sai lệch <= 60 phút)
  const similarFeedings: number[] = [];
  
  for (const feed of weekSamples) {
    const feedMinute = minuteOfDay(feed.at);
    const timeDiff = circularDiff(feedMinute, currentMinute);
    
    // Nếu thời gian tương tự (trong vòng 1 giờ)
    if (timeDiff <= 60) {
      similarFeedings.push(feed.log.volume);
    }
  }
  
  if (similarFeedings.length === 0) {
    return null;
  }
  
  // Loại bỏ các giá trị ngoại lệ (quá nhỏ hoặc quá lớn)
  const sorted = [...similarFeedings].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Loại bỏ outliers theo quy tắc IQR
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const filtered = similarFeedings.filter(vol => vol >= lowerBound && vol <= upperBound);
  
  if (filtered.length === 0) {
    // Nếu tất cả đều bị loại, dùng lại toàn bộ
    return mean(similarFeedings);
  }
  
  // Trả về trung bình của các giá trị hợp lệ
  return mean(filtered);
}

/**
 * Predict next feeding time & volume bằng **pattern-matching theo giờ trong ngày**.
 *
 * Ý tưởng: cữ cuối xảy ra lúc T (vd: hôm nay 3:00). Đi tìm các cặp
 *   (cữ trước, cữ kế tiếp)  trong lịch sử
 * mà "cữ trước" có **giờ-trong-ngày gần T**. Lấy median của:
 *   - interval → dự đoán GIỜ cữ tiếp theo
 *   - volume cữ kế tiếp → dự đoán DUNG TÍCH
 *
 * VD: hôm qua 3:05 bú → 4:10 bú 40ml, hôm kia 2:55 bú → 4:05 bú 45ml.
 * Hôm nay 3:00 vừa bú → pattern gợi ý ~1h5p nữa, ~40ml.
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

  // Chỉ dùng 30 ngày gần nhất cho pattern
  const cutoff = now.getTime() - 30 * MS_PER_DAY;
  const recent = withDates.filter((x) => x.at.getTime() >= cutoff);
  const sample = recent.length >= 4 ? recent : withDates;

  if (sample.length < 2) {
    const only = sample[0];
    return {
      hasData: true,
      samples: sample.length,
      nextVolume: only ? Math.round(only.log.volume / 5) * 5 : undefined,
      volumeRange: only ? [only.log.volume, only.log.volume] : undefined,
      confidence: 'low',
      reasoning: [
        `Mới có ${sample.length} cữ bú, chưa đủ để dự đoán giờ. Sẽ tốt hơn sau khi có 4-5 cữ.`,
      ],
    };
  }

  const lastFeed = sample[sample.length - 1];
  const lastMinute = minuteOfDay(lastFeed.at);

  // ===== 1. BUILD ADJACENT PAIRS =====
  // Mỗi pair: (cữ trước, cữ kế tiếp) — chỉ giữ khi interval nằm 15p..8h
  interface Pair {
    prevMinute: number; // giờ-trong-ngày của cữ trước (phút)
    intervalMin: number; // khoảng thời gian → cữ tiếp theo
    nextVolume: number; // dung tích cữ tiếp theo
  }
  const allPairs: Pair[] = [];
  for (let i = 0; i < sample.length - 1; i++) {
    const prev = sample[i];
    const next = sample[i + 1];
    const iv = (next.at.getTime() - prev.at.getTime()) / MS_PER_MIN;
    if (iv < 15 || iv > 8 * 60) continue;
    allPairs.push({
      prevMinute: minuteOfDay(prev.at),
      intervalMin: iv,
      nextVolume: next.log.volume,
    });
  }

  if (allPairs.length === 0) {
    // Không có cặp hợp lệ → fallback tối thiểu
    return {
      hasData: true,
      samples: sample.length,
      nextVolume: Math.round(lastFeed.log.volume / 5) * 5,
      volumeRange: [lastFeed.log.volume, lastFeed.log.volume],
      confidence: 'low',
      reasoning: ['Chưa có cặp cữ liên tiếp trong 8 tiếng để học pattern.'],
    };
  }

  // ===== 2. MATCH BY TIME-OF-DAY =====
  // Mở rộng cửa sổ dần nếu không đủ mẫu: ±45p → ±75p → ±120p → full.
  const windows = [45, 75, 120, Infinity];
  let matched: Pair[] = [];
  let usedWindowMin = 0;
  for (const w of windows) {
    matched = allPairs.filter(
      (p) => w === Infinity || circularDiff(p.prevMinute, lastMinute) <= w
    );
    if (matched.length >= 3 || w === Infinity) {
      usedWindowMin = w === Infinity ? 0 : w;
      break;
    }
  }

  // Nếu số match quá ít (<2) ta fallback về allPairs
  if (matched.length < 2) {
    matched = allPairs;
    usedWindowMin = 0;
  }

  const intervals = matched.map((p) => p.intervalMin);
  const vols = matched.map((p) => p.nextVolume);

  // Kết hợp với EMA toàn cục để tránh bị lệch do cửa sổ hẹp
  const allVolumes = sample.map((x) => x.log.volume);
  let ema = allVolumes[0];
  const alpha = 0.35;
  for (let i = 1; i < allVolumes.length; i++) {
    ema = alpha * allVolumes[i] + (1 - alpha) * ema;
  }

  const medIv = median(intervals);
  const medVolMatched = median(vols);

  // ===== 3. COMBINE =====
  // Interval: chỉ dựa trên median matched (thuần pattern theo giờ)
  const predictedAt =
    medIv > 0 ? new Date(lastFeed.at.getTime() + medIv * MS_PER_MIN) : undefined;

  // Smart volume prediction: tìm các cữ tương tự trong tuần qua
  const smartVolume = predictVolumeBasedOnSimilarTime(sample, lastMinute);
  
  // Nếu có smart prediction, dùng nó; không thì fallback về logic cũ
  let predictedVolumeRaw: number;
  if (smartVolume !== null) {
    predictedVolumeRaw = smartVolume;
  } else {
    // Volume: trộn 70% pattern + 30% EMA (để không quá bám sample hẹp)
    predictedVolumeRaw = 0.7 * medVolMatched + 0.3 * ema;
  }
  const predictedVolume = Math.max(10, Math.round(predictedVolumeRaw / 5) * 5);

  const stdVol = stddev(vols.length >= 2 ? vols : allVolumes);
  const low = Math.max(10, Math.round((predictedVolumeRaw - stdVol) / 5) * 5);
  const high = Math.round((predictedVolumeRaw + stdVol) / 5) * 5;

  const stdIv = stddev(intervals);
  const cvIv = medIv > 0 ? stdIv / medIv : 1;

  // ===== 4. CONFIDENCE =====
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (matched.length >= 8 && cvIv < 0.3) confidence = 'high';
  else if (matched.length >= 4 && cvIv < 0.45) confidence = 'medium';
  else confidence = 'low';

  // ===== 5. REASONING =====
  const reasoning: string[] = [];
  const lastH = lastFeed.at.getHours().toString().padStart(2, '0');
  const lastM = lastFeed.at.getMinutes().toString().padStart(2, '0');
  if (usedWindowMin > 0) {
    reasoning.push(
      `So khớp ${matched.length} cặp cữ trước–sau có giờ tương tự ${lastH}:${lastM} (±${usedWindowMin}p) trong ${sample.length} cữ gần đây.`
    );
  } else {
    reasoning.push(
      `Dựa trên ${matched.length} cặp cữ trong ${sample.length} cữ gần đây (pattern theo giờ chưa đủ, dùng toàn bộ).`
    );
  }
  if (medIv > 0) {
    const h = Math.floor(medIv / 60);
    const m = Math.round(medIv % 60);
    reasoning.push(
      `Cữ kế tiếp thường cách khoảng ${h > 0 ? `${h}h ` : ''}${m}p.`
    );
  }
  if (smartVolume !== null) {
    reasoning.push(
      `Dung tích dự kiến: ${Math.round(smartVolume)}ml (TB các cữ tương tự trong tuần qua, đã loại ngoại lệ).`
    );
  } else {
    reasoning.push(
      `Dung tích trong pattern: ${Math.round(medVolMatched)}ml · EMA toàn cục: ${Math.round(ema)}ml.`
    );
  }
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
    samples: matched.length,
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
