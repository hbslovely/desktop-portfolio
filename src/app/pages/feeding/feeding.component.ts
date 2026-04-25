import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  FeedingLog,
  FeedingLogService,
} from '../../services/feeding-log.service';
import {
  DailySummary,
  getDailySummaries,
  predictNextFeeding,
} from './feeding-prediction';
import {
  evaluateNutrition,
  getNutritionTarget,
  NutritionEvaluation,
  NutritionTarget,
} from './feeding-nutrition';
import {
  POSTPARTUM_STAGES,
  PostpartumStage,
  resolvePostpartumStage,
} from './postpartum-food.data';
import {
  BABY_TIMELINE,
  TimelineMilestone,
  MoodType,
  getCurrentMilestone,
  getMilestoneState,
} from './baby-timeline.data';

interface Profile {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
  /** Cân nặng hiện tại của bé (kg) */
  weightKg?: number;
}

interface LogDraft {
  date: string;
  time: string;
  volume: number | null;
  note: string;
}

interface DayStats {
  date: string;
  total: number;
  count: number;
  avg: number;
  max: number;
  min: number;
  firstTime: string;
  lastTime: string;
}

const STORAGE_PREFIX = 'feeding-profile::';

@Component({
  selector: 'app-feeding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding.component.html',
  styleUrls: ['./feeding.component.scss'],
})
export class FeedingComponent {
  private route = inject(ActivatedRoute);
  private feedingLogService = inject(FeedingLogService);

  Math = Math;

  user = signal<string>('guest');
  profile = signal<Profile | null>(null);
  draft = signal<Profile>({
    babyName: '',
    birthDate: '',
    gender: '',
    weightKg: undefined,
  });
  /** Raw text của input cân nặng — giữ nguyên để không bị mất số khi đang gõ "3." */
  weightInput = signal<string>('');
  editing = signal<boolean>(true);

  now = signal<Date>(new Date());

  // ===== Feeding log state =====
  logs = signal<FeedingLog[]>([]);
  loadingLogs = signal<boolean>(false);
  saving = signal<boolean>(false);
  syncError = signal<string>('');
  syncMessage = signal<string>('');

  logDraft = signal<LogDraft>({
    date: this.toDateStr(new Date()),
    time: this.toTimeStr(new Date()),
    volume: null,
    note: '',
  });

  logDialogOpen = signal<boolean>(false);
  historyDialogOpen = signal<boolean>(false);
  historyFilter = signal<'all' | 'today' | 'yesterday'>('all');
  chartTab = signal<'volume' | 'count' | 'timeline'>('volume');
  /** Số ngày hiển thị trong biểu đồ phân tích (7 / 14 / 30) */
  chartRange = signal<7 | 14 | 30>(7);
  timelineDialogOpen = signal<boolean>(false);
  timelineView = signal<'list' | 'chart'>('list');
  selectedTimelineId = signal<string | null>(null);

  // ===== Bình sữa đã pha (persistent) =====
  bottlePrep = signal<{ volumeMl: number; at: string } | null>(null);
  bottlePrepDraft = signal<string>('');
  bottlePrepEditing = signal<boolean>(false);

  /** Trong log dialog: chỉ 1 input cho "sữa còn lại" */
  remainingInput = signal<string>('');
  calcResult = computed<number | null>(() => {
    const prep = this.bottlePrep();
    if (!prep) return null;
    const r = parseFloat(this.remainingInput());
    if (isNaN(r) || r < 0) return null;
    const consumed = prep.volumeMl - r;
    if (consumed <= 0) return null;
    return Math.round(consumed);
  });

  ageInDays = computed<number | null>(() => {
    const p = this.profile();
    if (!p?.birthDate) return null;
    const birth = new Date(p.birthDate);
    if (isNaN(birth.getTime())) return null;
    const diffMs = this.now().getTime() - birth.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  });

  ageBreakdown = computed(() => {
    const days = this.ageInDays();
    if (days === null) return null;

    const p = this.profile();
    const birth = p?.birthDate ? new Date(p.birthDate) : null;
    const now = this.now();

    let years = 0;
    let months = 0;
    let remDaysInMonth = days; // fallback nếu không parse được birthDate

    if (birth && !isNaN(birth.getTime())) {
      // Calendar-aware: đếm theo tháng dương lịch
      years = now.getFullYear() - birth.getFullYear();
      months = now.getMonth() - birth.getMonth();
      let d = now.getDate() - birth.getDate();
      if (d < 0) {
        // Mượn ngày từ tháng trước
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        d += prevMonth.getDate();
        months -= 1;
      }
      if (months < 0) {
        months += 12;
        years -= 1;
      }
      remDaysInMonth = d;
    }

    // Tách tuần/ngày trong phần dư sau tháng
    const weeksInMonth = Math.floor(remDaysInMonth / 7);
    const remainingDays = remDaysInMonth - weeksInMonth * 7;
    const totalWeeks = Math.floor(days / 7);

    return {
      days,
      weeks: totalWeeks,
      months: years * 12 + months,
      remainingMonths: months,
      years,
      weeksInMonth,
      remainingDays,
    };
  });

  // ===== Timeline phát triển =====
  BABY_TIMELINE = BABY_TIMELINE;

  currentTimelineMilestone = computed<TimelineMilestone | null>(() => {
    const days = this.ageInDays();
    if (days === null) return null;
    return getCurrentMilestone(days);
  });

  timelineEntries = computed<
    Array<{ milestone: TimelineMilestone; state: 'past' | 'current' | 'future' }>
  >(() => {
    const days = this.ageInDays();
    return BABY_TIMELINE.map((m) => ({
      milestone: m,
      state: getMilestoneState(m, days),
    }));
  });

  timelineStats = computed(() => {
    const entries = this.timelineEntries();
    return {
      total: entries.length,
      past: entries.filter((e) => e.state === 'past').length,
      current: entries.filter((e) => e.state === 'current').length,
    };
  });

  /**
   * Dữ liệu cho biểu đồ đường tâm trạng:
   *  - X: tiến trình theo thứ tự milestone
   *  - Y: mood (happy cao nhất, leap thấp nhất - càng thấp càng "khó ở")
   */
  timelineChartData = computed(() => {
    const entries = this.timelineEntries();
    const n = entries.length;
    const SPACING = 58;
    const PAD_L = 36;
    const PAD_R = 36;
    const PAD_T = 40;
    const PAD_B = 60;
    const PLOT_H = 160;
    const H = PAD_T + PLOT_H + PAD_B;
    const W = PAD_L + PAD_R + (n - 1) * SPACING;

    // Mood → Y ratio (0 = top/happy, 1 = bottom/fussy)
    const moodRatio: Record<MoodType, number> = {
      happy: 0.12,
      milestone: 0.22,
      calm: 0.45,
      growth: 0.70,
      leap: 0.88,
    };

    const points = entries.map((e, i) => {
      const x = PAD_L + i * SPACING;
      const y = PAD_T + moodRatio[e.milestone.mood] * PLOT_H;
      return { x, y, entry: e, index: i };
    });

    // Smooth path (Catmull-Rom → cubic Bezier)
    let linePath = '';
    if (points.length > 0) {
      linePath = `M ${points[0].x},${points[0].y}`;
      const tension = 0.22;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
    }

    const areaPath =
      linePath && points.length > 0
        ? `${linePath} L ${points[points.length - 1].x},${PAD_T + PLOT_H} L ${points[0].x},${PAD_T + PLOT_H} Z`
        : '';

    // Mood reference lines (guides)
    const moodGuides: Array<{ y: number; label: string; mood: MoodType }> = [
      { mood: 'happy', label: 'Vui vẻ', y: PAD_T + moodRatio.happy * PLOT_H },
      { mood: 'calm', label: 'Bình yên', y: PAD_T + moodRatio.calm * PLOT_H },
      { mood: 'growth', label: 'Tăng trưởng', y: PAD_T + moodRatio.growth * PLOT_H },
      { mood: 'leap', label: 'Leap / WW', y: PAD_T + moodRatio.leap * PLOT_H },
    ];

    return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, PLOT_H, points, linePath, areaPath, moodGuides };
  });

  /** Entry đang được chọn (trong chart view) hoặc milestone hiện tại */
  selectedTimelineEntry = computed(() => {
    const id = this.selectedTimelineId();
    const entries = this.timelineEntries();
    if (id) {
      const found = entries.find((e) => e.milestone.id === id);
      if (found) return found;
    }
    return entries.find((e) => e.state === 'current') || entries[0] || null;
  });

  setTimelineView(view: 'list' | 'chart') {
    this.timelineView.set(view);
  }

  selectTimelineNode(id: string) {
    this.selectedTimelineId.set(id);
  }

  /** Index của milestone đang chọn (trong mảng BABY_TIMELINE) */
  selectedTimelineIndex = computed<number>(() => {
    const id = this.selectedTimelineId();
    const entries = this.timelineEntries();
    if (!id) {
      const curIdx = entries.findIndex((e) => e.state === 'current');
      return curIdx >= 0 ? curIdx : 0;
    }
    const idx = entries.findIndex((e) => e.milestone.id === id);
    return idx >= 0 ? idx : 0;
  });

  prevTimeline() {
    const entries = this.timelineEntries();
    const idx = this.selectedTimelineIndex();
    if (idx > 0) {
      this.selectedTimelineId.set(entries[idx - 1].milestone.id);
    }
  }

  nextTimeline() {
    const entries = this.timelineEntries();
    const idx = this.selectedTimelineIndex();
    if (idx < entries.length - 1) {
      this.selectedTimelineId.set(entries[idx + 1].milestone.id);
    }
  }

  goToCurrentTimeline() {
    const cur = this.currentTimelineMilestone();
    if (cur) this.selectedTimelineId.set(cur.id);
  }

  @HostListener('document:keydown', ['$event'])
  onTimelineKey(ev: KeyboardEvent) {
    if (!this.timelineDialogOpen()) return;
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.prevTimeline();
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.nextTimeline();
    } else if (ev.key === 'Escape') {
      this.closeTimelineDialog();
    }
  }

  openTimelineDialog() {
    this.timelineDialogOpen.set(true);
    // Mặc định chọn milestone hiện tại khi mở
    const cur = this.currentTimelineMilestone();
    if (cur) this.selectedTimelineId.set(cur.id);
    // Scroll tới milestone hiện tại sau khi dialog render (trong list view)
    setTimeout(() => {
      if (this.timelineView() === 'list') {
        const el = document.getElementById('timeline-current');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const el = document.querySelector('.tl-chart-scroll [data-current="true"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 150);
  }

  closeTimelineDialog() {
    this.timelineDialogOpen.set(false);
  }

  // ===== Postpartum food (món ăn cho mẹ) =====
  /** null = auto theo tuổi bé; number = override do user navigate */
  momFoodStageOverride = signal<number | null>(null);

  activeMomStage = computed<PostpartumStage>(() => {
    const override = this.momFoodStageOverride();
    if (override !== null) {
      const i = Math.max(0, Math.min(POSTPARTUM_STAGES.length - 1, override));
      return POSTPARTUM_STAGES[i];
    }
    const days = this.ageInDays() ?? 0;
    return resolvePostpartumStage(days);
  });

  activeMomStageIndex = computed<number>(() => {
    const stage = this.activeMomStage();
    return POSTPARTUM_STAGES.findIndex((s) => s.id === stage.id);
  });

  momStageTotal = POSTPARTUM_STAGES.length;

  currentMomStage = computed<PostpartumStage>(() => {
    const days = this.ageInDays() ?? 0;
    return resolvePostpartumStage(days);
  });

  isMomStageAuto = computed<boolean>(() => {
    if (this.momFoodStageOverride() === null) return true;
    return this.activeMomStage().id === this.currentMomStage().id;
  });

  prevMomStage() {
    const i = this.activeMomStageIndex();
    if (i > 0) this.momFoodStageOverride.set(i - 1);
  }

  nextMomStage() {
    const i = this.activeMomStageIndex();
    if (i < POSTPARTUM_STAGES.length - 1)
      this.momFoodStageOverride.set(i + 1);
  }

  resetMomStage() {
    this.momFoodStageOverride.set(null);
  }

  // ===== Stats =====
  todayStats = computed<DayStats>(() => this.computeDayStats(this.todayDateStr()));
  yesterdayStats = computed<DayStats>(() =>
    this.computeDayStats(this.yesterdayDateStr())
  );

  todayLogs = computed<FeedingLog[]>(() =>
    this.logs()
      .filter((l) => l.date === this.todayDateStr())
      .sort((a, b) => b.time.localeCompare(a.time))
  );

  yesterdayLogs = computed<FeedingLog[]>(() =>
    this.logs()
      .filter((l) => l.date === this.yesterdayDateStr())
      .sort((a, b) => b.time.localeCompare(a.time))
  );

  /**
   * Khoảng cách giữa cữ `current` và cữ ngay TRƯỚC nó (trong cùng ngày).
   *
   * `listDesc` là mảng đã sort theo thời gian giảm dần (mới nhất đầu tiên).
   * → cữ ngay trước về thời gian = `listDesc[index + 1]`.
   *
   * Trả về chuỗi dạng "2h30p", "45p" hoặc "" nếu không có cữ trước.
   */
  formatIntervalFromPrev(current: FeedingLog, listDesc: FeedingLog[]): string {
    let prev: FeedingLog | undefined;
    const idx = listDesc.findIndex(
      (l) => l.time === current.time && l.rowIndex === current.rowIndex
    );
    if (idx >= 0 && idx < listDesc.length - 1) {
      prev = listDesc[idx + 1];
    } else {
      // Fallback: find the most recent feeding strictly before `current` from full logs.
      const all = this.logs();
      const curTs = this.logTimestamp(current);
      let bestTs = -Infinity;
      for (const l of all) {
        if (l.rowIndex === current.rowIndex) continue;
        const t = this.logTimestamp(l);
        if (t < curTs && t > bestTs) {
          bestTs = t;
          prev = l;
        }
      }
    }
    if (!prev) return '';
    const diffMs = this.logTimestamp(current) - this.logTimestamp(prev);
    const diff = Math.round(diffMs / 60000);
    if (diff <= 0) return '';
    const hh = Math.floor(diff / 60);
    const mm = diff % 60;
    if (hh === 0) return `${mm}p`;
    if (mm === 0) return `${hh}h`;
    return `${hh}h${mm.toString().padStart(2, '0')}p`;
  }

  private logTimestamp(l: FeedingLog): number {
    const [y, m, d] = (l.date || '').split('-').map(Number);
    const [hh, mm] = (l.time || '').split(':').map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return 0;
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }

  /** Tổng hôm qua nhưng chỉ tính các cữ có giờ ≤ giờ hiện tại — để so sánh ngang giờ */
  yesterdayUpToNowStats = computed<DayStats>(() => {
    const nowTime = this.toTimeStr(this.now());
    const yDate = this.yesterdayDateStr();
    const list = this.logs().filter(
      (l) => l.date === yDate && l.time <= nowTime
    );
    return this.statsFromList(yDate, list);
  });

  comparison = computed(() => {
    const t = this.todayStats();
    const y = this.yesterdayUpToNowStats();
    const totalDiff = t.total - y.total;
    const countDiff = t.count - y.count;
    const pct = y.total > 0 ? Math.round((totalDiff / y.total) * 100) : null;
    return { totalDiff, countDiff, pct };
  });

  // ===== ML prediction =====
  prediction = computed(() => predictNextFeeding(this.logs(), this.now()));

  /** Cữ bú gần nhất (toàn bộ lịch sử, không chỉ hôm nay) */
  lastFeeding = computed<FeedingLog | null>(() => {
    const all = this.logs();
    if (all.length === 0) return null;
    // Sort by date+time desc, take first
    const sorted = [...all].sort((a, b) => {
      const ka = `${a.date}T${a.time}`;
      const kb = `${b.date}T${b.time}`;
      return kb.localeCompare(ka);
    });
    return sorted[0];
  });

  // ===== Nutrition target & evaluation (weight + age based) =====
  nutritionTarget = computed<NutritionTarget | null>(() => {
    const p = this.profile();
    const days = this.ageInDays();
    if (!p?.weightKg || days === null) return null;
    return getNutritionTarget(p.weightKg, days);
  });

  nutritionEval = computed<NutritionEvaluation | null>(() => {
    const target = this.nutritionTarget();
    if (!target) return null;
    const today = this.todayStats();
    return evaluateNutrition(target, today.total, today.count);
  });

  /**
   * Trạng thái đáp ứng của từng chỉ số dinh dưỡng hôm nay.
   * - 'met' (xanh): đáp ứng đủ khuyến nghị
   * - 'partial' (vàng): đáp ứng 1 phần / gần đạt
   * - 'unmet' (đỏ): chưa đáp ứng
   */
  nutritionMetricsStatus = computed<{
    perFeed: 'met' | 'partial' | 'unmet';
    feedsDay: 'met' | 'partial' | 'unmet';
    pctMin: 'met' | 'partial' | 'unmet';
  } | null>(() => {
    const ev = this.nutritionEval();
    if (!ev) return null;
    const today = this.todayStats();
    const t = ev.target;
    const avg = today.avg || 0;
    const count = today.count || 0;

    // 1. Gợi ý mỗi cữ (ml trung bình mỗi cữ so với range)
    let perFeed: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      perFeed = 'unmet';
    } else if (avg >= t.perFeedMin && avg <= t.perFeedMax) {
      perFeed = 'met';
    } else if (
      avg >= t.perFeedMin * 0.7 ||
      (avg > t.perFeedMax && avg <= t.perFeedMax * 1.3)
    ) {
      perFeed = 'partial';
    }

    // 2. Số cữ/ngày
    let feedsDay: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count >= t.feedsPerDayMin) {
      feedsDay = 'met';
    } else if (count >= Math.max(1, t.feedsPerDayMin - 1) || count >= t.feedsPerDayMin * 0.6) {
      feedsDay = 'partial';
    }

    // 3. % so với mức tối thiểu dung tích/ngày
    let pctMin: 'met' | 'partial' | 'unmet' = 'unmet';
    const pct = ev.percentOfMin || 0;
    if (pct >= 100) pctMin = 'met';
    else if (pct >= 60) pctMin = 'partial';

    return { perFeed, feedsDay, pctMin };
  });

  /**
   * Dữ liệu cho progress bar nutrition.
   * scaleMax = max * 1.2 hoặc actualMl (nếu vượt xa) để pointer luôn nằm trong track.
   * Cung cấp vị trí tick min/max và pointer (%) cho template bind style.
   */
  nutritionZones = computed(() => {
    const ev = this.nutritionEval();
    if (!ev) return null;
    const min = ev.target.dailyMlMin;
    const max = ev.target.dailyMlMax;
    const scaleMax = Math.max(max * 1.2, ev.actualMl + 10);
    return {
      minLabel: min,
      maxLabel: max,
      scaleMax: Math.round(scaleMax),
      lowPct: Math.max(0, (min / scaleMax) * 100),
      okPct: Math.max(0, ((max - min) / scaleMax) * 100),
      overPct: Math.max(0, ((scaleMax - max) / scaleMax) * 100),
      pointerPct: Math.max(0, Math.min(100, (ev.actualMl / scaleMax) * 100)),
    };
  });

  lastFeedingAgo = computed<string>(() => {
    const l = this.lastFeeding();
    if (!l) return '';
    const [y, mo, d] = l.date.split('-').map((n) => parseInt(n, 10));
    const [h, mi] = l.time.split(':').map((n) => parseInt(n, 10));
    const at = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0);
    const diffMin = Math.round((this.now().getTime() - at.getTime()) / 60000);
    if (diffMin < 1) return 'vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hrs < 24) return mins > 0 ? `${hrs}h${mins}p trước` : `${hrs}h trước`;
    const days = Math.floor(hrs / 24);
    return `${days} ngày trước`;
  });

  // ===== History (range selectable: 7 / 14 / 30 days) =====
  weeklySummary = computed<DailySummary[]>(() =>
    getDailySummaries(this.logs(), this.chartRange(), this.now())
  );

  maxDailyTotal = computed(() => {
    const arr = this.weeklySummary();
    const max = Math.max(...arr.map((d) => d.total), 1);
    return max;
  });

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
    const avgCount = withData.length > 0 ? +(totalCount / withData.length).toFixed(1) : 0;

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
    const PAD_L = 44, PAD_R = 16, PAD_T = 28, PAD_B = 48;
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

  /** Bar chart: tổng sữa theo ngày (theo chartRange) */
  weeklyLineChart = computed(() => {
    const data = this.weeklySummary();
    const max = Math.max(...data.map((d) => d.total), 1);
    const lay = this.chartLayout();
    const { W, H, PAD_L, PAD_R, PAD_T, PAD_B, labelStep, showBarValueOnAll } = lay;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const barCount = data.length;
    const slot = chartW / barCount;
    const barW = Math.max(8, slot * (this.chartRange() === 30 ? 0.7 : 0.62));

    const bars = data.map((d, i) => {
      const x = PAD_L + i * slot + (slot - barW) / 2;
      const h = (d.total / max) * chartH;
      const y = PAD_T + chartH - h;
      const cx = x + barW / 2;
      const showLabel = i % labelStep === 0 || i === barCount - 1;
      const showValue = showBarValueOnAll || (d.total > 0 && (i % labelStep === 0));
      return { x, y, h, barW, cx, d, showLabel, showValue };
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: Math.round(max * r),
    }));

    return { bars, gridLines, W, H, PAD_L, PAD_B, max };
  });

  /** Bar chart: số cữ bú/ngày */
  weeklyCountChart = computed(() => {
    const data = this.weeklySummary();
    const max = Math.max(...data.map((d) => d.count), 1);
    const lay = this.chartLayout();
    const { W, H, PAD_L, PAD_R, PAD_T, PAD_B, labelStep, showBarValueOnAll } = lay;
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
   */
  timelineChart = computed(() => {
    const W = 700, H = 300, PAD_L = 44, PAD_R = 16, PAD_T = 24, PAD_B = 44;
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
      const logs = logsByDate.get(dateStr);
      if (!logs) return 0;
      let total = 0;
      for (const l of logs) {
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

    const allVals = [
      ...todayData.map((p) => p.v),
      ...yesterdayData.map((p) => p.v),
      ...avg3Data.map((p) => p.v),
    ];
    const max = Math.max(...allVals, 100);

    const xOf = (m: number) => PAD_L + (m / 1440) * chartW;
    const yOf = (v: number) => PAD_T + chartH - (v / max) * chartH;

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

    const lastToday = todayData.length > 0 ? todayData[todayData.length - 1] : null;
    const todayEndPoint = lastToday
      ? { x: xOf(lastToday.m), y: yOf(lastToday.v), v: Math.round(lastToday.v) }
      : null;

    const yesterdayTotal =
      yesterdayData.length > 0
        ? Math.round(yesterdayData[yesterdayData.length - 1].v)
        : 0;
    const avg3Total =
      avg3Data.length > 0
        ? Math.round(avg3Data[avg3Data.length - 1].v)
        : 0;
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

  /** Tất cả cữ bú gom theo ngày (cho dialog) */
  feedingsByDate = computed(() => {
    const filter = this.historyFilter();
    const todayStr = this.todayDateStr();
    const yesterdayStr = this.yesterdayDateStr();
    const groups = new Map<string, FeedingLog[]>();
    for (const log of this.logs()) {
      if (filter === 'today' && log.date !== todayStr) continue;
      if (filter === 'yesterday' && log.date !== yesterdayStr) continue;
      if (!groups.has(log.date)) groups.set(log.date, []);
      groups.get(log.date)!.push(log);
    }
    return Array.from(groups.entries())
      .map(([date, logs]) => ({
        date,
        logs: logs.sort((a, b) => b.time.localeCompare(a.time)),
        total: logs.reduce((s, l) => s + l.volume, 0),
        count: logs.length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** 5 cữ bú gần nhất (cho compact list) */
  recentFeedings = computed<FeedingLog[]>(() => {
    return [...this.logs()]
      .sort((a, b) => {
        const ka = `${a.date}T${a.time}`;
        const kb = `${b.date}T${b.time}`;
        return kb.localeCompare(ka);
      })
      .slice(0, 5);
  });

  constructor() {
    this.route.queryParamMap.subscribe((qp) => {
      const user = (qp.get('user') || 'guest').toLowerCase().trim() || 'guest';
      this.user.set(user);
      this.loadProfile(user);
      this.loadLogs();
    });

    setInterval(() => this.now.set(new Date()), 20_000);

    this.loadBottlePrep();
  }

  // ===== Profile management =====
  private loadProfile(user: string) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + user);
      if (raw) {
        const parsed = JSON.parse(raw) as Profile;
        this.profile.set(parsed);
        this.draft.set({ ...parsed });
        this.weightInput.set(parsed.weightKg ? String(parsed.weightKg) : '');
        this.editing.set(false);
        return;
      }
    } catch (e) {
      console.warn('Could not load feeding profile', e);
    }
    this.profile.set(null);
    this.draft.set({ babyName: '', birthDate: '', gender: '' });
    this.weightInput.set('');
    this.editing.set(true);
  }

  startEdit() {
    const p = this.profile();
    this.draft.set(p ? { ...p } : { babyName: '', birthDate: '', gender: '' });
    this.weightInput.set(p?.weightKg ? String(p.weightKg) : '');
    this.editing.set(true);
  }

  cancelEdit() {
    if (this.profile()) {
      this.editing.set(false);
    }
  }

  save() {
    const d = this.draft();
    if (!d.babyName?.trim() || !d.birthDate) return;

    // Parse cân nặng từ raw text (cho phép "3", "3.", "3.8")
    const raw = this.weightInput().trim().replace(',', '.');
    const w = raw === '' ? NaN : parseFloat(raw);
    const weightKg = !isNaN(w) && w > 0 ? Math.round(w * 10) / 10 : undefined;

    const clean: Profile = {
      babyName: d.babyName.trim(),
      birthDate: d.birthDate,
      gender: d.gender || '',
      weightKg,
    };

    localStorage.setItem(STORAGE_PREFIX + this.user(), JSON.stringify(clean));
    this.profile.set(clean);
    this.draft.set({ ...clean });
    this.weightInput.set(weightKg ? String(weightKg) : '');
    this.editing.set(false);
  }

  clearProfile() {
    if (!confirm('Bạn có chắc muốn xóa profile của bé?')) return;
    localStorage.removeItem(STORAGE_PREFIX + this.user());
    this.profile.set(null);
    this.draft.set({ babyName: '', birthDate: '', gender: '' });
    this.weightInput.set('');
    this.editing.set(true);
  }

  updateDraftName(value: string) {
    this.draft.update((d) => ({ ...d, babyName: value }));
  }
  updateDraftBirth(value: string) {
    this.draft.update((d) => ({ ...d, birthDate: value }));
  }
  setDraftGender(gender: Profile['gender']) {
    this.draft.update((d) => ({ ...d, gender }));
  }
  updateDraftWeight(value: string) {
    // Chỉ giữ chữ số, dấu chấm, và dấu phẩy (đổi sang chấm).
    // Cho phép 1 dấu thập phân duy nhất. Giữ nguyên raw text để
    // không phá trạng thái khi user đang gõ dở "3." hoặc "3,".
    let s = String(value ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    this.weightInput.set(s);

    const num = parseFloat(s);
    this.draft.update((d) => ({
      ...d,
      weightKg: isNaN(num) || num <= 0 ? undefined : num,
    }));
  }

  // ===== Feeding log management =====
  loadLogs() {
    this.loadingLogs.set(true);
    this.syncError.set('');

    this.feedingLogService.getLogs().subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loadingLogs.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadingLogs.set(false);
        this.syncError.set(
          'Không tải được dữ liệu từ Google Sheet. Kiểm tra Sheet có tab "Feeding" và quyền truy cập.'
        );
      },
    });
  }

  updateLogDate(v: string) {
    this.logDraft.update((d) => ({ ...d, date: v }));
  }
  updateLogTime(v: string) {
    this.logDraft.update((d) => ({ ...d, time: v }));
  }
  updateLogVolume(v: string) {
    const num = parseInt(v, 10);
    this.logDraft.update((d) => ({
      ...d,
      volume: isNaN(num) ? null : num,
    }));
  }
  updateLogNote(v: string) {
    this.logDraft.update((d) => ({ ...d, note: v }));
  }

  setLogNow() {
    const now = new Date();
    this.logDraft.set({
      date: this.toDateStr(now),
      time: this.toTimeStr(now),
      volume: this.logDraft().volume,
      note: this.logDraft().note,
    });
  }

  quickVolume(v: number) {
    this.logDraft.update((d) => ({ ...d, volume: v }));
  }

  /** Icon PrimeIcon class cho từng trạng thái met/partial/unmet */
  metricStatusIcon(s: 'met' | 'partial' | 'unmet'): string {
    switch (s) {
      case 'met':
        return 'pi-check-circle';
      case 'partial':
        return 'pi-check-circle';
      case 'unmet':
      default:
        return 'pi-times-circle';
    }
  }

  metricStatusLabel(s: 'met' | 'partial' | 'unmet'): string {
    switch (s) {
      case 'met':
        return 'Đã đáp ứng';
      case 'partial':
        return 'Gần đạt';
      case 'unmet':
      default:
        return 'Chưa đáp ứng';
    }
  }

  /** Toggle ghi chú preset (VD: "Sữa công thức"). Bấm lần 2 để bỏ. */
  quickNote(tag: string) {
    this.logDraft.update((d) => ({
      ...d,
      note: d.note === tag ? '' : tag,
    }));
  }

  hasQuickNote(tag: string): boolean {
    return this.logDraft().note === tag;
  }

  // ===== Bottle prep (persistent) =====
  private readonly BOTTLE_PREP_KEY = 'feeding:bottle-prep';

  private loadBottlePrep() {
    try {
      const raw = localStorage.getItem(this.BOTTLE_PREP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { volumeMl: number; at: string };
      if (parsed?.volumeMl > 0) this.bottlePrep.set(parsed);
    } catch (e) {
      console.warn('Could not load bottle prep', e);
    }
  }

  editBottlePrep() {
    const current = this.bottlePrep();
    this.bottlePrepDraft.set(current ? String(current.volumeMl) : '');
    this.bottlePrepEditing.set(true);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.bp-input');
      if (el) {
        el.focus();
        el.select();
      }
    }, 50);
  }

  cancelBottlePrep() {
    this.bottlePrepEditing.set(false);
    this.bottlePrepDraft.set('');
  }

  updateBottlePrepDraft(v: string) {
    this.bottlePrepDraft.set(String(v ?? '').replace(/[^\d]/g, ''));
  }

  /** Đặt nhanh dung tích bình qua chip preset */
  setBottlePrepDraft(v: number) {
    if (v <= 0) return;
    this.bottlePrepDraft.set(String(v));
  }

  /** Cộng/trừ delta (ml) cho draft hiện tại, kẹp trong [0, 9999] */
  adjustBottlePrepDraft(delta: number) {
    const current = parseInt(this.bottlePrepDraft(), 10) || 0;
    const next = Math.max(0, Math.min(9999, current + delta));
    this.bottlePrepDraft.set(next ? String(next) : '');
  }

  saveBottlePrep() {
    const n = parseInt(this.bottlePrepDraft(), 10);
    if (isNaN(n) || n <= 0) return;
    const entry = { volumeMl: n, at: new Date().toISOString() };
    localStorage.setItem(this.BOTTLE_PREP_KEY, JSON.stringify(entry));
    this.bottlePrep.set(entry);
    this.bottlePrepEditing.set(false);
    this.bottlePrepDraft.set('');
  }

  clearBottlePrep() {
    localStorage.removeItem(this.BOTTLE_PREP_KEY);
    this.bottlePrep.set(null);
    this.bottlePrepEditing.set(false);
    this.bottlePrepDraft.set('');
  }

  /** "14:30" từ ISO timestamp */
  formatBottleAt(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return this.toTimeStr(d);
  }

  // ===== Log dialog: input "còn lại" =====
  updateRemaining(v: string) {
    this.remainingInput.set(String(v ?? '').replace(/[^\d]/g, ''));
  }

  applyCalcVolume() {
    const r = this.calcResult();
    if (r === null) return;
    this.logDraft.update((d) => ({ ...d, volume: r }));
    // Sau khi áp dụng, clear bình đã pha để lần sau cần lưu lại mới
    this.clearBottlePrep();
    this.remainingInput.set('');
  }

  private resetRemaining() {
    this.remainingInput.set('');
  }

  submitLog() {
    const d = this.logDraft();
    if (!d.date || !d.time || !d.volume || d.volume <= 0) {
      this.syncError.set('Vui lòng nhập đủ ngày, giờ và dung tích sữa.');
      return;
    }

    const log: FeedingLog = {
      user: this.user(),
      date: d.date,
      time: d.time,
      volume: d.volume,
      note: d.note?.trim() || undefined,
    };

    this.saving.set(true);
    this.syncError.set('');
    this.syncMessage.set('');

    this.feedingLogService.addLog(log).subscribe({
      next: () => {
        this.saving.set(false);
        this.syncMessage.set(
          `Đã lưu cữ ${log.volume}ml lúc ${log.time} ngày ${this.formatDateDisplay(log.date)}`
        );

        // Reset time/volume/note (keep date), then reload logs
        const nowT = this.toTimeStr(new Date());
        this.logDraft.set({
          date: d.date,
          time: nowT,
          volume: null,
          note: '',
        });

        setTimeout(() => this.syncMessage.set(''), 4000);
        this.logDialogOpen.set(false);
        // Delay nhẹ để GAS kịp ghi xong + Sheets API propagate trước khi reload
        setTimeout(() => this.loadLogs(), 900);
      },
      error: (err) => {
        this.saving.set(false);
        this.syncError.set(
          err?.message || 'Lưu thất bại. Vui lòng kiểm tra cấu hình Apps Script.'
        );
      },
    });
  }

  deleteLog(log: FeedingLog) {
    if (!log.rowIndex) return;
    if (
      !confirm(
        `Xoá cữ ${log.volume}ml lúc ${log.time} ngày ${this.formatDateDisplay(log.date)}?`
      )
    )
      return;

    this.feedingLogService.deleteLog(log.rowIndex).subscribe({
      next: () => {
        this.syncMessage.set('Đã xoá cữ bú.');
        setTimeout(() => this.syncMessage.set(''), 3000);
        setTimeout(() => this.loadLogs(), 900);
      },
      error: (err) => {
        this.syncError.set(err?.message || 'Xoá thất bại.');
      },
    });
  }

  refreshLogs() {
    this.loadLogs();
  }

  // ===== Helpers =====
  private computeDayStats(date: string): DayStats {
    return this.statsFromList(date, this.logs().filter((l) => l.date === date));
  }

  private statsFromList(date: string, list: FeedingLog[]): DayStats {
    if (list.length === 0) {
      return {
        date,
        total: 0,
        count: 0,
        avg: 0,
        max: 0,
        min: 0,
        firstTime: '',
        lastTime: '',
      };
    }
    const total = list.reduce((s, l) => s + l.volume, 0);
    const volumes = list.map((l) => l.volume);
    const times = list.map((l) => l.time).sort();
    return {
      date,
      total,
      count: list.length,
      avg: Math.round(total / list.length),
      max: Math.max(...volumes),
      min: Math.min(...volumes),
      firstTime: times[0],
      lastTime: times[times.length - 1],
    };
  }

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }

  private toTimeStr(d: Date): string {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  todayDateStr(): string {
    return this.toDateStr(this.now());
  }

  yesterdayDateStr(): string {
    const d = new Date(this.now());
    d.setDate(d.getDate() - 1);
    return this.toDateStr(d);
  }

  formatDateDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  formatDateShort(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  formatDayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return dayNames[d.getDay()];
  }

  usePredictionValues() {
    const p = this.prediction();
    if (!p?.nextTime || !p?.nextVolume) return;
    this.logDraft.update((d) => ({
      ...d,
      date: this.todayDateStr(),
      time: p.nextTime!,
      volume: p.nextVolume!,
    }));
    this.openLogDialog(false);
  }

  setChartTab(tab: 'volume' | 'count' | 'timeline') {
    this.chartTab.set(tab);
  }

  setChartRange(r: 7 | 14 | 30) {
    this.chartRange.set(r);
  }

  formatMinuteAsTime(m: number): string {
    const hh = Math.floor(m / 60)
      .toString()
      .padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  openHistoryDialog(filter: 'all' | 'today' | 'yesterday' = 'all') {
    this.historyFilter.set(filter);
    this.historyDialogOpen.set(true);
  }

  closeHistoryDialog() {
    this.historyDialogOpen.set(false);
  }

  formatHourLabel(h: number): string {
    return `${h.toString().padStart(2, '0')}h`;
  }

  openLogDialog(resetTime = true) {
    if (resetTime) {
      const nowD = new Date();
      this.logDraft.set({
        date: this.toDateStr(nowD),
        time: this.toTimeStr(nowD),
        volume: null,
        note: '',
      });
      this.resetRemaining();
    }
    this.syncError.set('');
    this.syncMessage.set('');
    this.logDialogOpen.set(true);
  }

  closeLogDialog() {
    this.logDialogOpen.set(false);
    this.resetRemaining();
  }

  minutesToHuman(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}p`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}p`;
  }

  getTimeUntilNext(): string {
    const p = this.prediction();
    if (!p?.nextAt) return '';
    const diffMin = Math.round((p.nextAt.getTime() - this.now().getTime()) / 60000);
    if (diffMin < -5) return `Đã trễ ${this.minutesToHuman(-diffMin)}`;
    if (diffMin <= 5) return 'Sắp tới giờ bú';
    return `Còn ${this.minutesToHuman(diffMin)}`;
  }

  /** Trạng thái countdown: 'now' (sắp/đã tới), 'late', hoặc 'waiting' */
  countdownStatus = computed<'late' | 'now' | 'waiting'>(() => {
    const p = this.prediction();
    if (!p?.nextAt) return 'waiting';
    const diffMin = Math.round((p.nextAt.getTime() - this.now().getTime()) / 60000);
    if (diffMin < -5) return 'late';
    if (diffMin <= 5) return 'now';
    return 'waiting';
  });

  /** % tiến độ từ cữ cuối → cữ dự đoán tiếp theo (0-100) */
  countdownProgress = computed<number>(() => {
    const p = this.prediction();
    const last = this.lastFeeding();
    if (!p?.nextAt || !last) return 0;
    const [y, mo, d] = last.date.split('-').map((n) => parseInt(n, 10));
    const [h, mi] = last.time.split(':').map((n) => parseInt(n, 10));
    const lastAt = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).getTime();
    const nextAt = p.nextAt.getTime();
    const now = this.now().getTime();
    const total = nextAt - lastAt;
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round(((now - lastAt) / total) * 100)));
  });

  /** 2 cữ bú hôm nay mới nhất (cho summary) */
  todayLogsPreview = computed<FeedingLog[]>(() => this.todayLogs().slice(0, 2));
  yesterdayLogsPreview = computed<FeedingLog[]>(() => this.yesterdayLogs().slice(0, 2));

  get todayStr(): string {
    const d = this.now();
    return d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Giờ hiện tại dạng HH:MM — dùng cho live clock ở hero */
  get currentTimeStr(): string {
    return this.toTimeStr(this.now());
  }

  get maxBirthDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
