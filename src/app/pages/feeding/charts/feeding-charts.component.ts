import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedingLog } from '../../../services/feeding-log.service';
import {
  DailySummary,
  getDailySummaries,
} from '../feeding-prediction';
import { NutritionTarget } from '../feeding-nutrition';

@Component({
  selector: 'app-feeding-charts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feeding-charts.component.html',
  styleUrls: ['./feeding-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingChartsComponent {
  logs = input<FeedingLog[]>([]);
  now = input<Date>(new Date());
  nutritionTarget = input<NutritionTarget | null>(null);

  chartTab = signal<'volume' | 'count' | 'timeline'>('volume');
  /** Số ngày hiển thị trong biểu đồ phân tích (7 / 14 / 30) */
  chartRange = signal<7 | 14 | 30>(7);

  /** Thu phóng trục thời gian — tab "Trong ngày" (cuộn ngang khi > 1×). */
  private static readonly TIMELINE_ZOOM_LEVELS = [1, 1.5, 2, 2.5] as const;
  timelineChartZoomIndex = signal(0);
  timelineChartZoom = computed(
    () =>
      FeedingChartsComponent.TIMELINE_ZOOM_LEVELS[this.timelineChartZoomIndex()]
  );

  timelineZoomIn(): void {
    this.timelineChartZoomIndex.update((i) =>
      Math.min(FeedingChartsComponent.TIMELINE_ZOOM_LEVELS.length - 1, i + 1)
    );
  }

  timelineZoomOut(): void {
    this.timelineChartZoomIndex.update((i) => Math.max(0, i - 1));
  }

  timelineZoomReset(): void {
    this.timelineChartZoomIndex.set(0);
  }

  // ===== History (range selectable: 7 / 14 / 30 days) =====
  weeklySummary = computed<DailySummary[]>(() =>
    getDailySummaries(this.logs(), this.chartRange(), this.now())
  );

  weeklyAverage = computed(() => {
    const arr = this.weeklySummary().filter((d) => d.total > 0);
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((s, d) => s + d.total, 0) / arr.length);
  });

  /** Thống kê tổng quát theo dải ngày đã chọn */
  chartStats = computed(() => {
    const arr = this.weeklySummary();
    const withData = arr.filter((d) => d.total > 0);
    if (arr.length === 0) {
      return {
        rangeDays: this.chartRange(),
        daysWithData: 0,
        totalMl: 0,
        avgMl: 0,
        maxMl: 0,
        maxDate: '',
        minMl: 0,
        minDate: '',
        avgCount: 0,
        maxCount: 0,
      };
    }

    const totalMl = withData.reduce((s, d) => s + d.total, 0);
    const totalCount = withData.reduce((s, d) => s + d.count, 0);
    const avgMl = withData.length > 0 ? Math.round(totalMl / withData.length) : 0;
    const avgCount =
      withData.length > 0 ? +(totalCount / withData.length).toFixed(1) : 0;

    let maxDay = withData[0];
    let minDay = withData[0];
    for (const d of withData) {
      if (d.total > maxDay.total) maxDay = d;
      if (d.total < minDay.total) minDay = d;
    }
    const maxCount = Math.max(0, ...withData.map((d) => d.count));

    return {
      rangeDays: this.chartRange(),
      daysWithData: withData.length,
      totalMl,
      avgMl,
      maxMl: maxDay?.total || 0,
      maxDate: maxDay?.date || '',
      minMl: minDay?.total || 0,
      minDate: minDay?.date || '',
      avgCount,
      maxCount,
    };
  });

  /**
   * Hỗ trợ co giãn chart theo số ngày: trả viewport SVG khá rộng cho 30 ngày
   * (cho phép cuộn ngang). Đồng thời quy định mật độ label hiển thị.
   */
  private chartLayout() {
    const range = this.chartRange();
    const H = 360;
    const PAD_L = 44,
      PAD_R = 16,
      PAD_T = 28,
      PAD_B = 48;
    let W = 700;
    if (range === 14) W = 760;
    if (range === 30) W = 1320;

    // Mật độ label trục X: hiển thị mỗi N cột
    let labelStep = 1;
    if (range === 14) labelStep = 1;
    if (range === 30) labelStep = 3;

    // Chỉ hiện số trên đỉnh cột nếu không quá nhiều cột
    const showBarValueOnAll = range <= 14;

    return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, labelStep, showBarValueOnAll };
  }

  /** Bar/Line chart: tổng sữa theo ngày (theo chartRange) — 30 ngày dùng line chart */
  weeklyLineChart = computed(() => {
    const data = this.weeklySummary();
    const max = Math.max(...data.map((d) => d.total), 1);
    const lay = this.chartLayout();
    const { W, H, PAD_L, PAD_R, PAD_T, PAD_B, labelStep, showBarValueOnAll } =
      lay;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const barCount = data.length;
    const slot = chartW / barCount;
    const barW = Math.max(8, slot * (this.chartRange() === 30 ? 0.7 : 0.62));
    const isLineChart = this.chartRange() === 30;

    const bars = data.map((d, i) => {
      const x = PAD_L + i * slot + (slot - barW) / 2;
      const h = (d.total / max) * chartH;
      const y = PAD_T + chartH - h;
      const cx = x + barW / 2;
      const showLabel = i % labelStep === 0 || i === barCount - 1;
      const showValue = showBarValueOnAll || (d.total > 0 && i % labelStep === 0);
      return { x, y, h, barW, cx, d, showLabel, showValue };
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: Math.round(max * r),
    }));

    let linePath = '';
    let areaPath = '';
    const points: Array<{
      x: number;
      y: number;
      d: (typeof data)[0];
      showLabel: boolean;
      showValue: boolean;
    }> = [];

    if (isLineChart && data.length > 0) {
      const bottomY = PAD_T + chartH;
      data.forEach((d, i) => {
        const cx = PAD_L + i * slot + slot / 2;
        const y =
          d.total > 0 ? PAD_T + chartH - (d.total / max) * chartH : bottomY;
        const showLabel = i % labelStep === 0 || i === barCount - 1;
        const showValue = d.total > 0 && (i % 3 === 0 || i === barCount - 1);
        points.push({ x: cx, y, d, showLabel, showValue });
        linePath += i === 0 ? `M ${cx},${y}` : ` L ${cx},${y}`;
      });
      if (points.length > 0) {
        const first = points[0];
        const last = points[points.length - 1];
        areaPath = `${linePath} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
      }
    }

    return {
      bars,
      gridLines,
      W,
      H,
      PAD_L,
      PAD_B,
      PAD_T,
      max,
      isLineChart,
      linePath,
      areaPath,
      points,
    };
  });

  /** Bar chart: số cữ bú/ngày */
  weeklyCountChart = computed(() => {
    const data = this.weeklySummary();
    const max = Math.max(...data.map((d) => d.count), 1);
    const lay = this.chartLayout();
    const { W, H, PAD_L, PAD_R, PAD_T, PAD_B, labelStep, showBarValueOnAll } =
      lay;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const barCount = data.length;
    const slot = chartW / barCount;
    const barW = Math.max(8, slot * (this.chartRange() === 30 ? 0.7 : 0.6));

    const bars = data.map((d, i) => {
      const x = PAD_L + i * slot + (slot - barW) / 2;
      const h = (d.count / max) * chartH;
      const y = PAD_T + chartH - h;
      const cx = x + barW / 2;
      const showLabel = i % labelStep === 0 || i === barCount - 1;
      const showValue = showBarValueOnAll || (d.count > 0 && i % labelStep === 0);
      return { x, y, h, barW, cx, d, showLabel, showValue };
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: (max * r).toFixed(r === 1 ? 0 : 1).replace(/\.0$/, ''),
    }));

    return { bars, gridLines, W, H, PAD_L, PAD_B, max };
  });

  /**
   * Timeline chart: cumulative ml theo thời gian trong ngày (0h → 24h)
   * 3 dataset:
   *  - Hôm nay (dừng ở giờ hiện tại)
   *  - Hôm qua (cả ngày)
   *  - Trung bình 3 ngày trước (2 ngày + hôm qua)
   * + Dải & đường KN (phân bổ đều) khi có `nutritionTarget` (cân từ tab Cân nặng).
   * Chiều ngang scale theo `timelineChartZoom` để cuộn xem chi tiết.
   */
  timelineChart = computed(() => {
    const zoom = this.timelineChartZoom();
    const BASE_W = 700;
    const W = Math.round(BASE_W * zoom);
    const H = 300,
      PAD_L = 44,
      PAD_R = 16,
      PAD_T = 24,
      PAD_B = 44;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const todayStr = this.todayDateStr();
    const yStr = this.yesterdayDateStr();

    // Group logs by date
    const logsByDate = new Map<string, FeedingLog[]>();
    for (const log of this.logs()) {
      const arr = logsByDate.get(log.date);
      if (arr) arr.push(log);
      else logsByDate.set(log.date, [log]);
    }

    const cumulativeAt = (dateStr: string, minute: number): number => {
      const dayLogs = logsByDate.get(dateStr);
      if (!dayLogs) return 0;
      let total = 0;
      for (const l of dayLogs) {
        const [h, m] = l.time.split(':').map((n) => parseInt(n, 10));
        const lm = (h || 0) * 60 + (m || 0);
        if (lm <= minute) total += l.volume;
      }
      return total;
    };

    // 3 previous days (day-1..day-3)
    const baseDate = new Date(this.now());
    baseDate.setHours(0, 0, 0, 0);
    const prev3Dates: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      prev3Dates.push(this.toDateStr(d));
    }
    const prev3WithData = prev3Dates.filter((ds) => logsByDate.has(ds));

    // Sample every 10 minutes
    const STEP = 10;
    const samples: number[] = [];
    for (let m = 0; m <= 1440; m += STEP) samples.push(m);

    const nowMinute =
      this.now().getHours() * 60 + this.now().getMinutes();

    const todayData = samples
      .filter((m) => m <= nowMinute)
      .map((m) => ({ m, v: cumulativeAt(todayStr, m) }));
    const yesterdayData = samples.map((m) => ({
      m,
      v: cumulativeAt(yStr, m),
    }));
    const avg3Data = samples.map((m) => {
      if (prev3WithData.length === 0) return { m, v: 0 };
      let sum = 0;
      for (const ds of prev3WithData) sum += cumulativeAt(ds, m);
      return { m, v: sum / prev3WithData.length };
    });

    const target = this.nutritionTarget();
    const recPtsMin: { m: number; v: number }[] = [];
    const recPtsMax: { m: number; v: number }[] = [];
    const recPtsMid: { m: number; v: number }[] = [];
    let hasRecommendation = false;
    let recRangeLabel = '';
    let recMidDailyRounded = 0;
    if (target) {
      hasRecommendation = true;
      const midDaily = (target.dailyMlMin + target.dailyMlMax) / 2;
      recMidDailyRounded = Math.round(midDaily);
      recRangeLabel = `${target.dailyMlMin}–${target.dailyMlMax} ml/ngày`;
      for (const m of samples) {
        const frac = m / 1440;
        recPtsMin.push({ m, v: target.dailyMlMin * frac });
        recPtsMax.push({ m, v: target.dailyMlMax * frac });
        recPtsMid.push({ m, v: midDaily * frac });
      }
    }

    const allVals = [
      ...todayData.map((p) => p.v),
      ...yesterdayData.map((p) => p.v),
      ...avg3Data.map((p) => p.v),
    ];
    if (recPtsMax.length > 0) {
      for (const p of recPtsMax) allVals.push(p.v);
      for (const p of recPtsMin) allVals.push(p.v);
    }
    const max = Math.max(...allVals, 100);

    const xOf = (m: number) => PAD_L + (m / 1440) * chartW;
    const yOf = (v: number) => PAD_T + chartH - (v / max) * chartH;

    const toLinearPath = (pts: { m: number; v: number }[]) => {
      if (pts.length === 0) return '';
      let d = `M ${xOf(pts[0].m)},${yOf(pts[0].v)}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${xOf(pts[i].m)},${yOf(pts[i].v)}`;
      }
      return d;
    };

    const buildRecBand = () => {
      if (recPtsMin.length === 0) return '';
      let d = `M ${xOf(recPtsMin[0].m)},${yOf(recPtsMin[0].v)}`;
      for (let i = 1; i < recPtsMin.length; i++) {
        d += ` L ${xOf(recPtsMin[i].m)},${yOf(recPtsMin[i].v)}`;
      }
      for (let i = recPtsMax.length - 1; i >= 0; i--) {
        d += ` L ${xOf(recPtsMax[i].m)},${yOf(recPtsMax[i].v)}`;
      }
      d += ' Z';
      return d;
    };

    /**
     * Mượt hoá đường cong bằng monotone cubic (Fritsch–Carlson):
     *   - Giữ tính đơn điệu (tích luỹ không bao giờ giảm).
     *   - Gộp các điểm trùng y liên tiếp để tránh "bậc thang" gây cong xấu
     *     tại các đoạn phẳng giữa các cữ bú.
     */
    const toPath = (pts: { m: number; v: number }[]) => {
      if (pts.length === 0) return '';

      // 1) Gộp các điểm có cùng y liên tiếp → chỉ giữ đầu và cuối của mỗi đoạn phẳng.
      const compacted: { m: number; v: number }[] = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const prev = compacted[compacted.length - 1];
        const next = pts[i + 1];
        if (prev && next && prev.v === p.v && next.v === p.v) continue;
        compacted.push(p);
      }

      if (compacted.length === 1) {
        const p = compacted[0];
        return `M ${xOf(p.m)},${yOf(p.v)}`;
      }

      const sp = compacted.map((p) => ({ x: xOf(p.m), y: yOf(p.v) }));
      const n = sp.length;

      // 2) Monotone cubic interpolation (Fritsch–Carlson).
      const dx: number[] = new Array(n - 1);
      const slope: number[] = new Array(n - 1);
      for (let i = 0; i < n - 1; i++) {
        dx[i] = sp[i + 1].x - sp[i].x;
        slope[i] = dx[i] === 0 ? 0 : (sp[i + 1].y - sp[i].y) / dx[i];
      }

      const t: number[] = new Array(n);
      t[0] = slope[0];
      t[n - 1] = slope[n - 2];
      for (let i = 1; i < n - 1; i++) {
        if (slope[i - 1] * slope[i] <= 0) {
          t[i] = 0;
        } else {
          t[i] = (slope[i - 1] + slope[i]) / 2;
        }
      }
      // Fritsch condition
      for (let i = 0; i < n - 1; i++) {
        if (slope[i] === 0) {
          t[i] = 0;
          t[i + 1] = 0;
          continue;
        }
        const a = t[i] / slope[i];
        const b = t[i + 1] / slope[i];
        const h = a * a + b * b;
        if (h > 9) {
          const s = 3 / Math.sqrt(h);
          t[i] = s * a * slope[i];
          t[i + 1] = s * b * slope[i];
        }
      }

      // 3) Dựng cubic bezier từ Hermite tangents.
      let d = `M ${sp[0].x},${sp[0].y}`;
      for (let i = 0; i < n - 1; i++) {
        const cp1x = sp[i].x + dx[i] / 3;
        const cp1y = sp[i].y + (t[i] * dx[i]) / 3;
        const cp2x = sp[i + 1].x - dx[i] / 3;
        const cp2y = sp[i + 1].y - (t[i + 1] * dx[i]) / 3;
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${sp[i + 1].x},${sp[i + 1].y}`;
      }
      return d;
    };

    const yGrid = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: Math.round(max * r),
    }));
    const xTicks = [0, 4, 8, 12, 16, 20, 24].map((h) => ({
      hour: h,
      x: xOf(h * 60),
    }));

    const lastToday =
      todayData.length > 0 ? todayData[todayData.length - 1] : null;
    const todayEndPoint = lastToday
      ? { x: xOf(lastToday.m), y: yOf(lastToday.v), v: Math.round(lastToday.v) }
      : null;

    const yesterdayTotal =
      yesterdayData.length > 0
        ? Math.round(yesterdayData[yesterdayData.length - 1].v)
        : 0;
    const avg3Total =
      avg3Data.length > 0 ? Math.round(avg3Data[avg3Data.length - 1].v) : 0;
    const todayTotal = lastToday ? Math.round(lastToday.v) : 0;

    return {
      W,
      H,
      PAD_L,
      PAD_B,
      yGrid,
      xTicks,
      todayPath: toPath(todayData),
      yesterdayPath: toPath(yesterdayData),
      avg3Path: toPath(avg3Data),
      hasRecommendation,
      recBandPath: hasRecommendation ? buildRecBand() : '',
      recMidPath: hasRecommendation ? toLinearPath(recPtsMid) : '',
      recRangeLabel,
      recMidDailyRounded,
      todayEndPoint,
      todayTotal,
      yesterdayTotal,
      avg3Total,
      prev3DaysCount: prev3WithData.length,
      nowMinute,
      nowX: xOf(nowMinute),
      chartTop: PAD_T,
      chartBottom: PAD_T + chartH,
    };
  });

  /** Tab timeline có đủ dữ liệu để vẽ đường (tránh hiện zoom/legend rỗng). */
  hasTimelineChartData = computed(() => {
    const t = this.timelineChart();
    return t.yesterdayTotal > 0 || t.avg3Total > 0 || t.todayTotal > 0;
  });

  setChartTab(tab: 'volume' | 'count' | 'timeline') {
    this.chartTab.set(tab);
    if (tab !== 'timeline') {
      this.timelineChartZoomIndex.set(0);
    }
  }

  setChartRange(r: 7 | 14 | 30) {
    this.chartRange.set(r);
  }

  todayDateStr(): string {
    return this.toDateStr(this.now());
  }

  yesterdayDateStr(): string {
    const d = new Date(this.now());
    d.setDate(d.getDate() - 1);
    return this.toDateStr(d);
  }

  formatDateShort(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  formatDayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return dayNames[d.getDay()];
  }

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
}
