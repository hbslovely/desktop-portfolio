import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  FeedingTip,
  MONTH_GUIDES,
  WEEK_GUIDES,
  getCategoryMeta,
  resolveGuide,
} from './feeding-tips.data';
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
  editing = signal<boolean>(true);
  activeCategory = signal<FeedingTip['category'] | 'all'>('all');

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
  tipsDialogOpen = signal<boolean>(false);
  tipsGuideIndex = signal<number>(0);
  chartTab = signal<'volume' | 'count' | 'hourly'>('volume');

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
    const totalMonths = days / 30.4375;
    const months = Math.floor(totalMonths);
    const weeks = Math.floor(days / 7);
    const remainingDays = days - weeks * 7;
    const years = Math.floor(months / 12);
    const remainingMonths = months - years * 12;
    return { days, weeks, months, remainingDays, years, remainingMonths };
  });

  currentGuide = computed(() => {
    const days = this.ageInDays();
    if (days === null) return null;
    return resolveGuide(days);
  });

  filteredTips = computed(() => {
    const guide = this.currentGuide();
    if (!guide) return [];
    const cat = this.activeCategory();
    if (cat === 'all') return guide.period.tips;
    return guide.period.tips.filter((t) => t.category === cat);
  });

  availableCategories = computed<Array<FeedingTip['category']>>(() => {
    const guide = this.currentGuide();
    if (!guide) return [];
    const set = new Set<FeedingTip['category']>();
    guide.period.tips.forEach((t) => set.add(t.category));
    return Array.from(set);
  });

  getCategoryMeta = getCategoryMeta;

  /** Toàn bộ giai đoạn (week 1-4 + month 1-24) đã sort theo tuổi tăng dần */
  allGuides = computed(() => {
    const list: Array<{ key: string; label: string; guide: any }> = [];
    Object.entries(WEEK_GUIDES).forEach(([k, v]) =>
      list.push({ key: `week-${k}`, label: v.label, guide: v })
    );
    Object.entries(MONTH_GUIDES).forEach(([k, v]) =>
      list.push({ key: `month-${k}`, label: v.label, guide: v })
    );
    return list;
  });

  currentGuideIndex = computed<number>(() => {
    const current = this.currentGuide();
    if (!current) return 0;
    const all = this.allGuides();
    const idx = all.findIndex((g) => g.key === current.key);
    return idx >= 0 ? idx : 0;
  });

  selectedGuide = computed(() => {
    const all = this.allGuides();
    const i = Math.max(0, Math.min(all.length - 1, this.tipsGuideIndex()));
    return all[i] || null;
  });

  upcomingGuides = computed(() => {
    const guide = this.currentGuide();
    if (!guide) return [];
    const allKeys: Array<{ key: string; label: string }> = [];
    Object.entries(WEEK_GUIDES).forEach(([k, v]) =>
      allKeys.push({ key: `week-${k}`, label: v.label })
    );
    Object.entries(MONTH_GUIDES).forEach(([k, v]) =>
      allKeys.push({ key: `month-${k}`, label: v.label })
    );
    const currentIdx = allKeys.findIndex((g) => g.key === guide.key);
    if (currentIdx === -1) return [];
    return allKeys.slice(currentIdx + 1, currentIdx + 4);
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

  // ===== History (last 7 days) =====
  weeklySummary = computed<DailySummary[]>(() =>
    getDailySummaries(this.logs(), 7, this.now())
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

  /** Line chart: tổng sữa 7 ngày */
  weeklyLineChart = computed(() => {
    const data = this.weeklySummary();
    const max = Math.max(...data.map((d) => d.total), 1);
    const W = 700, H = 300, PAD_L = 44, PAD_R = 16, PAD_T = 24, PAD_B = 44;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;

    const points = data.map((d, i) => {
      const x = PAD_L + i * stepX;
      const y = PAD_T + chartH - (d.total / max) * chartH;
      return { x, y, d };
    });

    const linePath = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath =
      points.length > 0
        ? `M ${points[0].x},${PAD_T + chartH} ` +
          points.map((p) => `L ${p.x},${p.y}`).join(' ') +
          ` L ${points[points.length - 1].x},${PAD_T + chartH} Z`
        : '';

    const gridLines = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: Math.round(max * r),
    }));

    return { points, linePath, areaPath, gridLines, W, H, PAD_L, PAD_B };
  });

  /** Bar chart: số cữ bú/ngày trong 7 ngày */
  weeklyCountChart = computed(() => {
    const data = this.weeklySummary();
    const max = Math.max(...data.map((d) => d.count), 1);
    const W = 700, H = 300, PAD_L = 44, PAD_R = 16, PAD_T = 24, PAD_B = 44;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const barCount = data.length;
    const slot = chartW / barCount;
    const barW = slot * 0.6;

    const bars = data.map((d, i) => {
      const x = PAD_L + i * slot + (slot - barW) / 2;
      const h = (d.count / max) * chartH;
      const y = PAD_T + chartH - h;
      const cx = x + barW / 2;
      return { x, y, h, barW, cx, d };
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: (max * r).toFixed(r === 1 ? 0 : 1).replace(/\.0$/, ''),
    }));

    return { bars, gridLines, W, H, PAD_L, PAD_B, max };
  });

  /** Hourly distribution: 24 cột, gom theo giờ bú (30 ngày gần nhất) */
  hourlyDistribution = computed(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: 0,
      total: 0,
      avg: 0,
    }));

    const cutoff = this.now().getTime() - 30 * 86400000;
    for (const log of this.logs()) {
      const [y, mo, d] = log.date.split('-').map((n) => parseInt(n, 10));
      const [hh, mm] = log.time.split(':').map((n) => parseInt(n, 10));
      const ts = new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0).getTime();
      if (ts < cutoff) continue;
      const hr = hh || 0;
      buckets[hr].count++;
      buckets[hr].total += log.volume;
    }
    for (const b of buckets) {
      b.avg = b.count > 0 ? Math.round(b.total / b.count) : 0;
    }

    const max = Math.max(...buckets.map((b) => b.count), 1);
    const W = 700, H = 300, PAD_L = 44, PAD_R = 16, PAD_T = 24, PAD_B = 44;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const slot = chartW / 24;
    const barW = slot * 0.7;

    const bars = buckets.map((b, i) => {
      const x = PAD_L + i * slot + (slot - barW) / 2;
      const h = b.count > 0 ? Math.max(2, (b.count / max) * chartH) : 0;
      const y = PAD_T + chartH - h;
      const cx = x + barW / 2;
      return { x, y, h, barW, cx, b };
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: Math.round(max * r),
    }));

    // Tick labels ở trục X: 0h, 6h, 12h, 18h, 23h
    const xTicks = [0, 6, 12, 18, 23].map((h) => ({
      hour: h,
      x: PAD_L + h * slot + slot / 2,
    }));

    return {
      bars,
      gridLines,
      xTicks,
      W,
      H,
      PAD_L,
      PAD_B,
      totalFeeds: buckets.reduce((s, b) => s + b.count, 0),
    };
  });

  /** Tất cả cữ bú gom theo ngày (cho dialog) */
  feedingsByDate = computed(() => {
    const groups = new Map<string, FeedingLog[]>();
    for (const log of this.logs()) {
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

    setInterval(() => this.now.set(new Date()), 60_000);
  }

  // ===== Profile management =====
  private loadProfile(user: string) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + user);
      if (raw) {
        const parsed = JSON.parse(raw) as Profile;
        this.profile.set(parsed);
        this.draft.set({ ...parsed });
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
      weightKg: d.weightKg && d.weightKg > 0 ? d.weightKg : undefined,
    };

    localStorage.setItem(STORAGE_PREFIX + this.user(), JSON.stringify(clean));
    this.profile.set(clean);
    this.editing.set(false);
  }

  clearProfile() {
    if (!confirm('Bạn có chắc muốn xóa profile của bé?')) return;
    localStorage.removeItem(STORAGE_PREFIX + this.user());
    this.profile.set(null);
    this.draft.set({ babyName: '', birthDate: '', gender: '' });
    this.editing.set(true);
  }

  selectCategory(cat: FeedingTip['category'] | 'all') {
    this.activeCategory.set(cat);
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
  updateDraftWeight(value: string | number) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    this.draft.update((d) => ({
      ...d,
      weightKg: isNaN(num) || num <= 0 ? undefined : num,
    }));
  }

  // ===== Feeding log management =====
  loadLogs() {
    const user = this.user();
    if (!user) return;
    this.loadingLogs.set(true);
    this.syncError.set('');

    this.feedingLogService.getLogs(user).subscribe({
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
        this.loadLogs();
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
        this.loadLogs();
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

  setChartTab(tab: 'volume' | 'count' | 'hourly') {
    this.chartTab.set(tab);
  }

  openTipsDialog() {
    this.tipsGuideIndex.set(this.currentGuideIndex());
    this.tipsDialogOpen.set(true);
  }

  closeTipsDialog() {
    this.tipsDialogOpen.set(false);
  }

  prevGuide() {
    this.tipsGuideIndex.update((i) => Math.max(0, i - 1));
  }

  nextGuide() {
    const max = this.allGuides().length - 1;
    this.tipsGuideIndex.update((i) => Math.min(max, i + 1));
  }

  jumpToCurrentGuide() {
    this.tipsGuideIndex.set(this.currentGuideIndex());
  }

  get canPrevGuide(): boolean {
    return this.tipsGuideIndex() > 0;
  }

  get canNextGuide(): boolean {
    return this.tipsGuideIndex() < this.allGuides().length - 1;
  }

  openHistoryDialog() {
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
    }
    this.syncError.set('');
    this.syncMessage.set('');
    this.logDialogOpen.set(true);
  }

  closeLogDialog() {
    this.logDialogOpen.set(false);
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

  get todayStr(): string {
    const d = this.now();
    return d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  get maxBirthDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
