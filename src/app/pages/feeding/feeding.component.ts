import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  FeedingLog,
  FeedingLogService,
} from '../../services/feeding-log.service';
import { WeightLogService } from '../../services/weight-log.service';
import {
  DailySummary,
  getDailySummaries,
  predictNextFeeding,
} from './feeding-prediction';
import {
  computeNutritionPace,
  evaluateNutrition,
  getNutritionTarget,
  NutritionEvaluation,
  NutritionPaceInfo,
  NutritionTarget,
} from './feeding-nutrition';
import {
  POSTPARTUM_STAGES,
  PostpartumStage,
  resolvePostpartumStage,
} from './postpartum-food.data';
import { resolveGuide } from './feeding-tips.data';
import { MOM_WELLNESS_CARDS } from './mom-wellness.data';
import { DocumentsComponent } from './documents/documents.component';
import { MedicalHistoryComponent } from './medical-history/medical-history.component';
import { WeightComponent } from './weight/weight.component';

interface Profile {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
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
  /** Trung bình số học (ml/cữ). */
  avg: number;
  /** Trung vị thể tích một cữ (ml) — ổn định hơn khi có cữ rất nhỏ. */
  medianMl: number;
  /**
   * Giá trị dùng khi so khuyến nghị: trung vị nếu ≥3 cữ (ít nhạy cữ “lắt nhắt”),
   * ngược lại trùng TB.
   */
  typicalFeedMl: number;
  max: number;
  min: number;
  firstTime: string;
  lastTime: string;
}

const STORAGE_PREFIX = 'feeding-profile::';

@Component({
  selector: 'app-feeding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DocumentsComponent,
    MedicalHistoryComponent,
    WeightComponent,
  ],
  templateUrl: './feeding.component.html',
  styleUrls: ['./feeding.component.scss'],
})
export class FeedingComponent {
  private route = inject(ActivatedRoute);
  private feedingLogService = inject(FeedingLogService);
  private weightLogService = inject(WeightLogService);

  /** Vùng cuộn thật của trang (`.feeding-page`), không phải `document`. */
  @ViewChild('feedingPage', { static: true })
  private feedingPageRef?: ElementRef<HTMLElement>;

  Math = Math;

  /** Tab nav phía dưới: feeding | weight | mom | medical | documents. */
  bottomTab = signal<
    'feeding' | 'weight' | 'mom' | 'medical' | 'documents'
  >('feeding');

  setBottomTab(
    tab: 'feeding' | 'weight' | 'mom' | 'medical' | 'documents'
  ) {
    this.bottomTab.set(tab);
    this.scrollFeedingShellToTop();
    if (tab === 'feeding') {
      this.loadWeightLogs();
    }
  }

  /** Đưa cuộn về đầu khi đổi tab (shell `.feeding-page` + window dự phòng). */
  private scrollFeedingShellToTop(): void {
    if (typeof window === 'undefined') return;
    const el = this.feedingPageRef?.nativeElement;
    if (el) {
      el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      el.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  user = signal<string>('guest');
  profile = signal<Profile | null>(null);
  draft = signal<Profile>({
    babyName: '',
    birthDate: '',
    gender: '',
  });
  /**
   * Cân mới nhất từ sheet Weight (bản ghi ngày mới nhất toàn sheet).
   * Cột user chỉ để biết ai log — không lọc theo user khi lấy giá trị này.
   */
  latestWeightKgFromSheet = signal<number | undefined>(undefined);

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

  // ===== Edit log dialog state =====
  /** Cữ bú đang được edit (giữ reference tới row trong sheet) */
  editingLog = signal<FeedingLog | null>(null);
  /**
   * Draft cho edit dialog. **KHÔNG có `date`** vì nghiệp vụ yêu cầu
   * không cho phép đổi ngày của cữ bú đã ghi (chỉ chỉnh giờ / ml / note).
   */
  editLogDraft = signal<{ time: string; volume: number | null; note: string }>({
    time: '',
    volume: null,
    note: '',
  });
  editSaving = signal<boolean>(false);

  historyDialogOpen = signal<boolean>(false);
  historyFilter = signal<'all' | 'today' | 'yesterday'>('all');
  chartTab = signal<'volume' | 'count' | 'timeline'>('volume');
  /** Số ngày hiển thị trong biểu đồ phân tích (7 / 14 / 30) */
  chartRange = signal<7 | 14 | 30>(7);

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

  /** Thẻ chăm sóc cố định — hiển thị tab Mẹ */
  momWellnessCards = MOM_WELLNESS_CARDS;

  /** Nhãn giai đoạn (tuần/tháng của bé) để đồng bộ gợi ý */
  momPeriodContext = computed(() => {
    const days = this.ageInDays();
    if (days === null) return null;
    const r = resolveGuide(days);
    if (!r) return null;
    return {
      label: r.period.label,
      summary: r.period.summary,
    };
  });

  /** Tips trong WEEK/MONTH_GUIDES có category «mom», theo tuổi bé hiện tại */
  momTipsThisPeriod = computed(() => {
    const days = this.ageInDays();
    if (days === null) return [];
    const r = resolveGuide(days);
    if (!r) return [];
    return r.period.tips.filter((t) => t.category === 'mom');
  });

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

  /**
   * Trung bình tổng ml (và cữ) tới cùng giờ hiện tại của 3 ngày liền trước
   * (hôm qua, hôm kia, 3 ngày trước) — song song với so sánh chỉ hôm qua.
   */
  priorThreeDaysUpToNowAvg = computed(() => {
    const s1 = this.statsUpToNowForDate(this.dateStrDaysAgo(1));
    const s2 = this.statsUpToNowForDate(this.dateStrDaysAgo(2));
    const s3 = this.statsUpToNowForDate(this.dateStrDaysAgo(3));
    const avgTotal = Math.round((s1.total + s2.total + s3.total) / 3);
    const avgCount = Math.round((s1.count + s2.count + s3.count) / 3);
    return { avgTotal, avgCount, s1, s2, s3 };
  });

  comparison = computed(() => {
    const t = this.todayStats();
    const y = this.yesterdayUpToNowStats();
    const totalDiff = t.total - y.total;
    const countDiff = t.count - y.count;
    const pct = y.total > 0 ? Math.round((totalDiff / y.total) * 100) : null;
    return { totalDiff, countDiff, pct };
  });

  /** So hôm nay vs TB 3 ngày trước (cùng mốc giờ trong ngày). */
  comparisonVsPrior3Avg = computed(() => {
    const t = this.todayStats();
    const p = this.priorThreeDaysUpToNowAvg();
    const totalDiff = t.total - p.avgTotal;
    const pct =
      p.avgTotal > 0 ? Math.round((totalDiff / p.avgTotal) * 100) : null;
    return { totalDiff, pct, avgTotal: p.avgTotal };
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
    const w = this.latestWeightKgFromSheet();
    const days = this.ageInDays();
    if (w === undefined || w <= 0 || days === null) return null;
    return getNutritionTarget(w, days);
  });

  nutritionEval = computed<NutritionEvaluation | null>(() => {
    const target = this.nutritionTarget();
    if (!target) return null;
    const today = this.todayStats();
    return evaluateNutrition(target, today.total, today.count);
  });

  /** Tiến độ hiện tại: so với phân bổ đều theo KN cả ngày (theo thời điểm trong ngày). */
  nutritionPace = computed<NutritionPaceInfo | null>(() => {
    const target = this.nutritionTarget();
    if (!target) return null;
    return computeNutritionPace(target, this.todayStats().total, this.now());
  });

  /**
   * Ba chỉ số theo **tiến độ hiện tại** (phân bổ đều trong ngày),
   * không so cả ngày KN.
   */
  nutritionMetricsStatus = computed<{
    avgPerFeed: 'met' | 'partial' | 'unmet';
    feedsByNow: 'met' | 'partial' | 'unmet';
    volumeByNow: 'met' | 'partial' | 'unmet';
    modelAvgMl: number;
    feedsLow: number;
    feedsHigh: number;
    pctPaceMid: number;
  } | null>(() => {
    const ev = this.nutritionEval();
    const pace = this.nutritionPace();
    if (!ev || !pace) return null;
    const today = this.todayStats();
    const t = ev.target;
    /** So khuyến nghị: trung vị cữ (≥3 cữ) thay vì TB — bớt lệch khi có cữ rất nhỏ. */
    const typicalMl = today.typicalFeedMl || 0;
    const count = today.count || 0;
    const frac = pace.dayFraction;

    const feedsMidDaily = (t.feedsPerDayMin + t.feedsPerDayMax) / 2;
    const expFeedsMid = Math.max(0.35, feedsMidDaily * frac);
    const modelAvgMl = pace.expectedMidMl / expFeedsMid;

    // 1. ml/cữ điển hình (trung vị hoặc TB) so với mức «vừa vặn» nếu bú đều đến lúc này
    let avgPerFeed: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      avgPerFeed = frac < 0.05 ? 'partial' : 'unmet';
    } else if (typicalMl >= modelAvgMl * 0.88 && typicalMl <= modelAvgMl * 1.14) {
      avgPerFeed = 'met';
    } else if (typicalMl >= modelAvgMl * 0.75 && typicalMl <= modelAvgMl * 1.28) {
      avgPerFeed = 'partial';
    } else if (typicalMl >= t.perFeedMin * 0.72 && typicalMl <= t.perFeedMax * 1.32) {
      avgPerFeed = 'partial';
    }

    const effMinF = t.feedsPerDayMin * frac;
    const effMaxF = t.feedsPerDayMax * frac;
    const feedsLow = Math.max(0, Math.floor(effMinF));
    const feedsHigh = Math.max(feedsLow, Math.ceil(effMaxF));

    let feedsByNow: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      feedsByNow = frac < 0.05 ? 'partial' : 'unmet';
    } else if (count >= feedsLow && count <= feedsHigh + 1) {
      feedsByNow = 'met';
    } else if (count >= feedsLow - 1 && count <= feedsHigh + 2) {
      feedsByNow = 'partial';
    } else if (count < feedsLow - 1) {
      feedsByNow = 'unmet';
    } else {
      feedsByNow = 'partial';
    }

    const pct = pace.percentOfPaceMid;
    let volumeByNow: 'met' | 'partial' | 'unmet' = 'unmet';
    if (pace.paceStatus === 'on-track') {
      volumeByNow = 'met';
    } else if (pace.paceStatus === 'ahead') {
      volumeByNow = pct > 125 ? 'partial' : 'met';
    } else {
      volumeByNow = pct >= 72 ? 'partial' : 'unmet';
    }

    return {
      avgPerFeed,
      feedsByNow,
      volumeByNow,
      modelAvgMl: Math.round(modelAvgMl),
      feedsLow,
      feedsHigh,
      pctPaceMid: pct,
    };
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
    const roundedMax = Math.round(scaleMax);
    const pointerPct = Math.max(
      0,
      Math.min(100, (ev.actualMl / roundedMax) * 100)
    );
    const pointerVisPct =
      pointerPct < 5 ? 5 : pointerPct > 95 ? 95 : pointerPct;
    return {
      minLabel: min,
      maxLabel: max,
      scaleMax: roundedMax,
      pointerPct,
      pointerVisPct,
    };
  });

  /** Thanh tiến độ hiện tại: thang ml 0 → scaleMax, dải kỳ vọng min–max theo % ngày. */
  nutritionPaceZones = computed(() => {
    const ev = this.nutritionEval();
    const pace = this.nutritionPace();
    if (!ev || !pace) return null;
    const min = pace.expectedMinMl;
    const max = pace.expectedMaxMl;
    const actual = ev.actualMl;
    const scaleMax = Math.max(
      Math.round(max * 1.2),
      actual + 20,
      Math.max(min + 30, 50)
    );
    const pointerPct = Math.max(0, Math.min(100, (actual / scaleMax) * 100));
    const pointerVisPct =
      pointerPct < 5 ? 5 : pointerPct > 95 ? 95 : pointerPct;
    const bandLeft = (min / scaleMax) * 100;
    const bandW = ((max - min) / scaleMax) * 100;
    const minTickPct = Math.max(0, Math.min(100, (min / scaleMax) * 100));
    const maxTickPct = Math.max(0, Math.min(100, (max / scaleMax) * 100));
    return {
      minLabel: min,
      maxLabel: max,
      scaleMax,
      bandLeftPct: Math.max(0, Math.min(100, bandLeft)),
      bandWidthPct: Math.max(0, Math.min(100 - bandLeft, bandW)),
      minTickPct,
      maxTickPct,
      pointerPct,
      pointerVisPct,
      paceStatus: pace.paceStatus,
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
      .map(([date, logs]) => {
        const total = logs.reduce((s, l) => s + l.volume, 0);
        const count = logs.length;
        return {
          date,
          logs: logs.sort((a, b) => b.time.localeCompare(a.time)),
          total,
          count,
          avg: count > 0 ? Math.round(total / count) : 0,
        };
      })
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
      this.loadWeightLogs();
    });

    setInterval(() => this.now.set(new Date()), 20_000);

    this.loadBottlePrep();
  }

  // ===== Profile management =====
  private loadProfile(user: string) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + user);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const g = parsed['gender'];
        const profile: Profile = {
          babyName: String(parsed['babyName'] ?? '').trim(),
          birthDate: String(parsed['birthDate'] ?? '').trim(),
          gender:
            g === 'boy' || g === 'girl' || g === ''
              ? (g as Profile['gender'])
              : '',
        };
        this.profile.set(profile);
        this.draft.set({ ...profile });
        this.editing.set(false);
        return;
      }
    } catch (e) {
      console.warn('Could not load feeding profile', e);
    }
    this.profile.set(null);
    this.draft.set({ babyName: '', birthDate: '', gender: '' });
    this.editing.set(true);
  }

  startEdit() {
    const p = this.profile();
    this.draft.set(p ? { ...p } : { babyName: '', birthDate: '', gender: '' });
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

    const clean: Profile = {
      babyName: d.babyName.trim(),
      birthDate: d.birthDate,
      gender: d.gender || '',
    };

    localStorage.setItem(STORAGE_PREFIX + this.user(), JSON.stringify(clean));
    this.profile.set(clean);
    this.draft.set({ ...clean });
    this.editing.set(false);
  }

  clearProfile() {
    if (!confirm('Bạn có chắc muốn xóa profile của bé?')) return;
    localStorage.removeItem(STORAGE_PREFIX + this.user());
    this.profile.set(null);
    this.draft.set({ babyName: '', birthDate: '', gender: '' });
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

  /** Tải cân mới nhất từ sheet Weight (cùng nguồn với tab Cân nặng). */
  loadWeightLogs(): void {
    this.weightLogService.getLogs().subscribe({
      next: (rows) => {
        const latest = rows[0];
        this.latestWeightKgFromSheet.set(latest?.weightKg);
      },
      error: (err) => {
        console.error(err);
        this.latestWeightKgFromSheet.set(undefined);
      },
    });
  }

  /** Hiển thị kg (sheet Weight) trong UI tab Cữ bú. */
  formatWeightKgFromSheet(kg: number | undefined): string {
    if (kg === undefined || !Number.isFinite(kg) || kg <= 0) return '';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);
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

  nutritionPaceLabel(status: NutritionPaceInfo['paceStatus']): string {
    switch (status) {
      case 'ahead':
        return 'Nhanh hơn mức trung bình hiện tại';
      case 'on-track':
        return 'Đúng mức trung bình hiện tại';
      case 'behind':
      default:
        return 'Chậm hơn mức trung bình hiện tại';
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

  /**
   * Tham chiếu tới `<app-documents>` đang render trong tab Documents.
   * `*ngIf` của template khiến component có thể không tồn tại (khi đang ở
   * tab Cữ bú) → ViewChild sẽ trả `undefined`. Với `static: false` (mặc
   * định), Angular sẽ resolve lại sau mỗi change detection nên ViewChild
   * tự cập nhật khi user chuyển tab.
   */
  @ViewChild(DocumentsComponent) private documentsCmp?: DocumentsComponent;
  @ViewChild(MedicalHistoryComponent) private medicalCmp?: MedicalHistoryComponent;
  @ViewChild(WeightComponent) private weightCmp?: WeightComponent;

  /**
   * Reload đồng thời nhật ký bú, cân nặng, tiền sử y tế **và** documents.
   * Các child tab dùng `[hidden]` nên component có thể chưa mount —
   * `?.refresh()` bỏ qua an toàn.
   */
  refreshAll() {
    this.loadLogs();
    this.loadWeightLogs();
    this.weightCmp?.refresh();
    this.medicalCmp?.refresh();
    this.documentsCmp?.refresh();
  }

  /** Ảnh đính kèm trên timeline Y tế → tab Tài liệu + preview file Explorer. */
  openMedicalAttachmentInDocuments(explorerEntryId: number): void {
    this.setBottomTab('documents');
    setTimeout(() => {
      this.documentsCmp?.revealFileEntry(explorerEntryId);
    }, 0);
  }

  /** True khi một nguồn dữ liệu đang load — dùng cho icon spin. */
  isAnyLoading = computed<boolean>(
    () =>
      this.loadingLogs() ||
      (this.weightCmp?.loading() ?? false) ||
      (this.medicalCmp?.loading() ?? false) ||
      (this.documentsCmp?.loading() ?? false)
  );

  // ===== Edit log =====
  /**
   * Mở dialog chỉnh sửa cho 1 cữ bú đã có trên sheet.
   * - Date được giữ readonly (chỉ hiển thị, không edit).
   * - `editingLog` giữ reference để biết row nào đang sửa khi submit.
   */
  openEditDialog(log: FeedingLog) {
    if (!log.rowIndex) return;
    this.editingLog.set(log);
    this.editLogDraft.set({
      time: log.time,
      volume: log.volume,
      note: log.note || '',
    });
    this.syncError.set('');
    this.syncMessage.set('');
  }

  closeEditDialog() {
    this.editingLog.set(null);
    this.editLogDraft.set({ time: '', volume: null, note: '' });
  }

  updateEditTime(v: string) {
    this.editLogDraft.update((d) => ({ ...d, time: v }));
  }

  updateEditVolume(v: string) {
    const num = parseInt(v, 10);
    this.editLogDraft.update((d) => ({
      ...d,
      volume: isNaN(num) ? null : num,
    }));
  }

  updateEditNote(v: string) {
    this.editLogDraft.update((d) => ({ ...d, note: v }));
  }

  quickEditVolume(v: number) {
    this.editLogDraft.update((d) => ({ ...d, volume: v }));
  }

  quickEditNote(tag: string) {
    this.editLogDraft.update((d) => ({
      ...d,
      note: d.note === tag ? '' : tag,
    }));
  }

  hasEditNote(tag: string): boolean {
    return this.editLogDraft().note === tag;
  }

  submitEditLog() {
    const original = this.editingLog();
    const d = this.editLogDraft();
    if (!original || !original.rowIndex) return;
    if (!d.time || !d.volume || d.volume <= 0) {
      this.syncError.set('Vui lòng nhập đủ giờ và dung tích sữa.');
      return;
    }

    this.editSaving.set(true);
    this.syncError.set('');
    this.syncMessage.set('');

    this.feedingLogService
      .updateLog(original.rowIndex, {
        time: d.time,
        volume: d.volume,
        note: d.note?.trim() || '',
      })
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.syncMessage.set(
            `Đã cập nhật cữ ${d.volume}ml lúc ${d.time} ngày ${this.formatDateDisplay(original.date)}`
          );
          setTimeout(() => this.syncMessage.set(''), 4000);
          this.closeEditDialog();
          setTimeout(() => this.loadLogs(), 900);
        },
        error: (err) => {
          this.editSaving.set(false);
          this.syncError.set(
            err?.message || 'Cập nhật thất bại. Vui lòng kiểm tra cấu hình Apps Script.'
          );
        },
      });
  }

  // ===== Helpers =====
  private computeDayStats(date: string): DayStats {
    return this.statsFromList(date, this.logs().filter((l) => l.date === date));
  }

  /** ISO yyyy-mm-dd, `daysBefore` ngày so với «hôm nay» theo đồng hồ app. */
  dateStrDaysAgo(daysBefore: number): string {
    const d = new Date(this.now());
    d.setDate(d.getDate() - daysBefore);
    return this.toDateStr(d);
  }

  /** Tổng/cữ của 1 ngày chỉ tính tới cùng giờ hiện tại (so «ngang giờ»). */
  private statsUpToNowForDate(dateStr: string): DayStats {
    const nowTime = this.toTimeStr(this.now());
    const list = this.logs().filter(
      (l) => l.date === dateStr && l.time <= nowTime
    );
    return this.statsFromList(dateStr, list);
  }

  private statsFromList(date: string, list: FeedingLog[]): DayStats {
    if (list.length === 0) {
      return {
        date,
        total: 0,
        count: 0,
        avg: 0,
        medianMl: 0,
        typicalFeedMl: 0,
        max: 0,
        min: 0,
        firstTime: '',
        lastTime: '',
      };
    }
    const total = list.reduce((s, l) => s + l.volume, 0);
    const volumes = list.map((l) => l.volume);
    const times = list.map((l) => l.time).sort();
    const sortedVol = [...volumes].sort((a, b) => a - b);
    const mid = Math.floor(sortedVol.length / 2);
    const medianMl =
      sortedVol.length % 2 === 1
        ? sortedVol[mid]
        : Math.round((sortedVol[mid - 1] + sortedVol[mid]) / 2);
    const avg = Math.round(total / list.length);
    const typicalFeedMl = list.length >= 3 ? medianMl : avg;
    return {
      date,
      total,
      count: list.length,
      avg,
      medianMl,
      typicalFeedMl,
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

  /** Thứ (tiếng Việt) — hero */
  get heroWeekday(): string {
    return this.now().toLocaleDateString('vi-VN', { weekday: 'long' });
  }

  /** Ngày dd/mm/yyyy — hero, dễ quét */
  get heroDateNumeric(): string {
    const d = this.now();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /** Giờ hiện tại dạng HH:MM — dùng cho live clock ở hero */
  get currentTimeStr(): string {
    return this.toTimeStr(this.now());
  }

  get maxBirthDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
