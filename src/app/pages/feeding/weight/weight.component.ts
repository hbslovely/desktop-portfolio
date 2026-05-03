import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  WeightLog,
  WeightLogService,
} from '../../../services/weight-log.service';
import {
  BABY_TIMELINE,
  TimelineMilestone,
  MoodType,
  getCurrentMilestone,
  getMilestoneState,
} from '../baby-timeline.data';
import {
  GROWTH_REFERENCE_CAPTION_VI,
  GROWTH_REFERENCE_REGION_VN,
  WeightGrowthSex,
  ageDaysAtDate,
  evaluateWeightForAge,
  sampleWhoWeightBandByDay,
  weeksFromDays,
} from '../baby-weight-growth';

interface WeightDraft {
  date: string;
  weightInput: string;
  note: string;
}

@Component({
  selector: 'app-weight',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weight.component.html',
  styleUrls: ['./weight.component.scss', '../development-timeline.dialog.scss'],
})
export class WeightComponent {
  private weightLogService = inject(WeightLogService);
  private destroyRef = inject(DestroyRef);

  /** Cùng user với trang feeding (`?user=`) */
  user = input<string>('guest');
  /** Ngày sinh (YYYY-MM-DD) — để tính tuần tuổi & timeline */
  birthDate = input<string | undefined>(undefined);
  gender = input<'boy' | 'girl' | '' | undefined>(undefined);
  babyName = input<string | undefined>(undefined);

  BABY_TIMELINE = BABY_TIMELINE;

  logs = signal<WeightLog[]>([]);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  draft = signal<WeightDraft>(this.defaultDraft());
  addDialogOpen = signal<boolean>(false);

  editingLog = signal<WeightLog | null>(null);
  editDraft = signal<WeightDraft>(this.defaultDraft());

  now = signal<Date>(new Date());

  timelineDialogOpen = signal<boolean>(false);
  timelineView = signal<'list' | 'chart'>('list');
  selectedTimelineId = signal<string | null>(null);

  constructor() {
    this.load();
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(new Date()));
  }

  refresh() {
    this.load();
  }

  growthSex = computed<WeightGrowthSex>(() =>
    this.gender() === 'girl' ? 'female' : 'male'
  );

  ageInDays = computed<number | null>(() => {
    const b = this.birthDate();
    if (!b) return null;
    const birth = new Date(b);
    if (isNaN(birth.getTime())) return null;
    const diffMs = this.now().getTime() - birth.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  });

  sortedLogsAsc = computed(() =>
    [...this.logs()].sort((a, b) => a.date.localeCompare(b.date))
  );

  sortedLogsDesc = computed(() =>
    [...this.logs()].sort((a, b) => b.date.localeCompare(a.date))
  );

  /** Khoảng cách ngày giữa hai mốc ISO (YYYY-MM-DD), làm tròn theo ngày. */
  private diffDaysIso(earlierIso: string, laterIso: string): number {
    const a = new Date(`${earlierIso}T12:00:00`);
    const b = new Date(`${laterIso}T12:00:00`);
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
  }

  /** Các đoạn giữa hai lần cân liên tiếp (theo ngày tăng dần). */
  weightLogIntervals = computed(() => {
    const logs = this.sortedLogsAsc();
    const segs: Array<{
      fromDate: string;
      toDate: string;
      days: number;
      deltaKg: number;
      gPerDay: number | null;
      labelShort: string;
    }> = [];
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const cur = logs[i];
      const days = this.diffDaysIso(prev.date, cur.date);
      const deltaKg = cur.weightKg - prev.weightKg;
      segs.push({
        fromDate: prev.date,
        toDate: cur.date,
        days,
        deltaKg,
        gPerDay:
          days > 0
            ? Math.round(((1000 * deltaKg) / days) * 10) / 10
            : null,
        labelShort: `${this.formatDateShort(prev.date)}→${this.formatDateShort(cur.date)}`,
      });
    }
    return segs;
  });

  latestGrowthEval = computed(() => {
    const birth = this.birthDate();
    const latest = this.sortedLogsDesc()[0];
    if (!birth || !latest) return null;
    const days = ageDaysAtDate(birth, latest.date);
    if (days === null) return null;
    const w = weeksFromDays(days);
    return evaluateWeightForAge(w, latest.weightKg, this.growthSex());
  });

  readonly noteQuickTags = [
    'Có tã',
    'Không tã',
    'Sau khi thức dậy',
    'Trước khi bú',
    'Buổi sáng',
    'Buổi tối',
  ] as const;

  weightTrendChart = computed(() => {
    const logs = this.sortedLogsAsc();
    if (logs.length === 0) return null;

    const PAD_L = 48;
    const PAD_R = 20;
    const PAD_T = 20;
    const PAD_B = 52;
    const H = 268;
    const n = logs.length;

    const kgVals = logs.map((l) => l.weightKg);
    let minKg = Math.min(...kgVals);
    let maxKg = Math.max(...kgVals);
    const span = maxKg - minKg;
    const pad = span < 0.05 ? 0.25 : Math.max(0.08, span * 0.15);
    minKg = Math.max(0.1, minKg - pad);
    maxKg = maxKg + pad;
    const range = Math.max(0.2, maxKg - minKg);

    const innerW = Math.max(320, Math.max(n - 1, 1) * 72);
    const W = PAD_L + innerW + PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const bottomY = PAD_T + chartH;

    const xOf = (i: number) =>
      PAD_L + (n === 1 ? innerW / 2 : (i / Math.max(1, n - 1)) * innerW);
    const yOf = (kg: number) =>
      PAD_T + chartH - ((kg - minKg) / range) * chartH;

    let pathActual = '';
    const pts: Array<{
      log: WeightLog;
      x: number;
      y: number;
      showXLabel: boolean;
      showKgLabel: boolean;
    }> = [];

    const labelStep = n <= 8 ? 1 : Math.max(1, Math.ceil(n / 7));

    logs.forEach((l, i) => {
      const x = xOf(i);
      const y = yOf(l.weightKg);
      pathActual += i === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
      pts.push({
        log: l,
        x,
        y,
        showXLabel: i === 0 || i === n - 1 || i % labelStep === 0,
        showKgLabel: true,
      });
    });

    let areaPath = '';
    if (pts.length > 0) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      areaPath = `${pathActual} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
    }

    const gridLines = [0, 1 / 3, 2 / 3, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: (minKg + r * range).toFixed(2).replace('.', ','),
    }));

    return {
      W,
      H,
      PAD_L,
      PAD_R,
      PAD_T,
      PAD_B,
      bottomY,
      pathActual,
      areaPath,
      pts,
      gridLines,
      minKg,
      maxKg,
    };
  });

  /**
   * Biểu đồ theo tuổi (ngày): so sánh đường bé với chuẩn WHO (VN).
   * Cân “lúc sinh” = bản ghi cân đầu tiên (ngày sớm nhất) trong bảng.
   */
  weightVsStandardChart = computed(() => {
    const birthIso = this.birthDate();
    const logs = this.sortedLogsAsc();
    if (!birthIso || logs.length === 0) return null;

    const sex = this.growthSex();
    type DayPt = { log: WeightLog; days: number };
    const raw: DayPt[] = [];
    for (const log of logs) {
      const days = ageDaysAtDate(birthIso, log.date);
      if (days !== null) raw.push({ log, days });
    }
    if (raw.length === 0) return null;

    const maxDaysData = Math.max(...raw.map((p) => p.days));
    const maxDays = Math.min(728, Math.max(7, maxDaysData));

    const ref = sampleWhoWeightBandByDay(maxDays, sex, 140);

    const kgFromLogs = raw.map((p) => p.log.weightKg);
    const kgFromRef = ref.flatMap((r) => [
      r.medianKg,
      r.minus2SdKg,
      r.plus2SdKg,
    ]);
    let minKg = Math.min(...kgFromLogs, ...kgFromRef);
    let maxKg = Math.max(...kgFromLogs, ...kgFromRef);
    const span = maxKg - minKg;
    const pad = span < 0.05 ? 0.25 : Math.max(0.08, span * 0.12);
    minKg = Math.max(0.1, minKg - pad);
    maxKg = maxKg + pad;
    const range = Math.max(0.2, maxKg - minKg);

    const PAD_L = 52;
    const PAD_R = 18;
    const PAD_T = 20;
    const PAD_B = 50;
    const H = 292;
    const innerW = Math.max(360, Math.min(780, 320 + maxDays * 0.85));
    const W = PAD_L + innerW + PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const bottomY = PAD_T + chartH;

    const minD = 0;
    const maxD = maxDays;
    const spanD = Math.max(1, maxD - minD);
    const xOfDays = (d: number) => PAD_L + ((d - minD) / spanD) * innerW;
    const yOfKg = (kg: number) =>
      PAD_T + chartH - ((kg - minKg) / range) * chartH;

    let pathMedian = '';
    let pathLow = '';
    let pathHigh = '';
    ref.forEach((r, i) => {
      const x = xOfDays(r.daysSinceBirth);
      const ym = yOfKg(r.medianKg);
      const yl = yOfKg(r.minus2SdKg);
      const yh = yOfKg(r.plus2SdKg);
      pathMedian += i === 0 ? `M ${x},${ym}` : ` L ${x},${ym}`;
      pathLow += i === 0 ? `M ${x},${yl}` : ` L ${x},${yl}`;
      pathHigh += i === 0 ? `M ${x},${yh}` : ` L ${x},${yh}`;
    });

    let bandPath = '';
    if (ref.length > 0) {
      let d = `M ${xOfDays(ref[0].daysSinceBirth)},${yOfKg(ref[0].plus2SdKg)}`;
      for (let i = 1; i < ref.length; i++) {
        const r = ref[i];
        d += ` L ${xOfDays(r.daysSinceBirth)},${yOfKg(r.plus2SdKg)}`;
      }
      for (let i = ref.length - 1; i >= 0; i--) {
        const r = ref[i];
        d += ` L ${xOfDays(r.daysSinceBirth)},${yOfKg(r.minus2SdKg)}`;
      }
      d += ' Z';
      bandPath = d;
    }

    const sorted = [...raw].sort((a, b) => {
      if (a.days !== b.days) return a.days - b.days;
      return a.log.date.localeCompare(b.log.date);
    });

    let pathActual = '';
    const n = sorted.length;
    const labelStep = n <= 8 ? 1 : Math.max(1, Math.ceil(n / 6));

    const pts: Array<{
      log: WeightLog;
      days: number;
      x: number;
      y: number;
      showKgLabel: boolean;
      showXLabel: boolean;
      ageLabel: string;
    }> = [];

    sorted.forEach((p, i) => {
      const x = xOfDays(p.days);
      const y = yOfKg(p.log.weightKg);
      pathActual += i === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
      pts.push({
        ...p,
        x,
        y,
        showKgLabel: true,
        showXLabel: i === 0 || i === n - 1 || i % labelStep === 0,
        ageLabel: this.formatAgeShortVi(p.days),
      });
    });

    const gridLines = [0, 1 / 3, 2 / 3, 1].map((r) => ({
      y: PAD_T + chartH - r * chartH,
      label: (minKg + r * range).toFixed(2).replace('.', ','),
    }));

    const weekStep = maxDays > 180 ? 8 : maxDays > 90 ? 4 : 2;
    const xTicks: Array<{ x: number; label: string }> = [];
    for (let w = 0; w * 7 <= maxD; w += weekStep) {
      const d = w * 7;
      xTicks.push({
        x: xOfDays(d),
        label: w === 0 ? 'Sinh' : `${w} tuần`,
      });
    }

    const firstLog = logs[0];
    const birthRecordLine = `${this.formatKg(firstLog.weightKg)} kg — ${this.formatDateDisplay(firstLog.date)}`;

    return {
      regionCode: GROWTH_REFERENCE_REGION_VN,
      referenceCaption: GROWTH_REFERENCE_CAPTION_VI,
      W,
      H,
      PAD_L,
      PAD_R,
      PAD_T,
      PAD_B,
      bottomY,
      pathMedian,
      pathLow,
      pathHigh,
      bandPath,
      pathActual,
      pts,
      gridLines,
      xTicks,
      minKg,
      maxKg,
      birthRecordLine,
      sexLabelVi:
        this.gender() === 'girl'
          ? 'Nữ (theo profile)'
          : this.gender() === 'boy'
            ? 'Nam (theo profile)'
            : 'Nam (mặc định khi chưa chọn)',
    };
  });

  /**
   * Đường tốc độ tăng (g/ngày) giữa các cặp lần cân liên tiếp (chỉ khoảng ≥1 ngày).
   */
  weightVelocityLineChart = computed(() => {
    const intervals = this.weightLogIntervals().filter((s) => s.gPerDay !== null);
    if (intervals.length === 0) return null;

    const vals = intervals.map((s) => s.gPerDay as number);
    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);
    minV = Math.min(minV, 0);
    maxV = Math.max(maxV, 0);
    const span = maxV - minV;
    const pad = span < 1 ? 8 : Math.max(4, span * 0.14);
    minV -= pad;
    maxV += pad;
    const range = Math.max(12, maxV - minV);

    const PAD_L = 46;
    const PAD_R = 12;
    const PAD_T = 14;
    const PAD_B = 44;
    const H = 204;
    const n = intervals.length;
    const innerW = Math.max(280, Math.max(n - 1, 1) * 58);
    const W = PAD_L + innerW + PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const yOf = (v: number) =>
      PAD_T + chartH - ((v - minV) / range) * chartH;
    const xOf = (i: number) =>
      PAD_L + (n === 1 ? innerW / 2 : (i / Math.max(1, n - 1)) * innerW);
    const zeroY = yOf(0);
    const bottomY = PAD_T + chartH;
    const showZeroLine = zeroY >= PAD_T - 0.5 && zeroY <= bottomY + 0.5;

    let pathLine = '';
    const pts = intervals.map((seg, i) => {
      const g = seg.gPerDay as number;
      const x = xOf(i);
      const y = yOf(g);
      pathLine += i === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
      const labelStep = n <= 8 ? 1 : Math.max(1, Math.ceil(n / 6));
      return {
        x,
        y,
        gPerDay: g,
        label: seg.labelShort,
        showValue: true,
        showXLabel: i === 0 || i === n - 1 || i % labelStep === 0,
      };
    });

    const gridLines = [0, 0.5, 1].map((t) => ({
      y: PAD_T + chartH - t * chartH,
      label: `${Math.round(minV + (1 - t) * range)} g/ngày`,
    }));

    return {
      W,
      H,
      PAD_L,
      innerW,
      PAD_T,
      PAD_B,
      pathLine,
      pts,
      gridLines,
      zeroY,
      showZeroLine,
    };
  });

  // ===== Timeline phát triển =====
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
    };
  });

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

    const moodRatio: Record<MoodType, number> = {
      happy: 0.12,
      milestone: 0.22,
      calm: 0.45,
      growth: 0.7,
      leap: 0.88,
    };

    const points = entries.map((e, i) => {
      const x = PAD_L + i * SPACING;
      const y = PAD_T + moodRatio[e.milestone.mood] * PLOT_H;
      return { x, y, entry: e, index: i };
    });

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

    const moodGuides: Array<{ y: number; label: string; mood: MoodType }> = [
      { mood: 'happy', label: 'Vui vẻ', y: PAD_T + moodRatio.happy * PLOT_H },
      { mood: 'calm', label: 'Bình yên', y: PAD_T + moodRatio.calm * PLOT_H },
      {
        mood: 'growth',
        label: 'Tăng trưởng',
        y: PAD_T + moodRatio.growth * PLOT_H,
      },
      { mood: 'leap', label: 'Leap / WW', y: PAD_T + moodRatio.leap * PLOT_H },
    ];

    return {
      W,
      H,
      PAD_L,
      PAD_R,
      PAD_T,
      PAD_B,
      PLOT_H,
      points,
      linePath,
      areaPath,
      moodGuides,
    };
  });

  selectedTimelineEntry = computed(() => {
    const id = this.selectedTimelineId();
    const entries = this.timelineEntries();
    if (id) {
      const found = entries.find((e) => e.milestone.id === id);
      if (found) return found;
    }
    return (
      entries.find((e) => e.state === 'current') || entries[0] || null
    );
  });

  selectedTimelineIndex = computed(() => {
    const id = this.selectedTimelineId();
    const entries = this.timelineEntries();
    if (!id) {
      const curIdx = entries.findIndex((e) => e.state === 'current');
      return curIdx >= 0 ? curIdx : 0;
    }
    const idx = entries.findIndex((e) => e.milestone.id === id);
    return idx >= 0 ? idx : 0;
  });

  setTimelineView(view: 'list' | 'chart') {
    this.timelineView.set(view);
  }

  selectTimelineNode(id: string) {
    this.selectedTimelineId.set(id);
  }

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
    const cur = this.currentTimelineMilestone();
    if (cur) this.selectedTimelineId.set(cur.id);
    setTimeout(() => {
      if (this.timelineView() === 'list') {
        const el = document.getElementById('timeline-current');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const el = document.querySelector('.tl-chart-scroll [data-current="true"]');
        if (el)
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 150);
  }

  closeTimelineDialog() {
    this.timelineDialogOpen.set(false);
  }

  get maxBirthDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  load() {
    this.loading.set(true);
    this.errorMsg.set('');

    this.weightLogService.getLogs().subscribe({
      next: (rows) => {
        this.logs.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.errorMsg.set(
          'Không tải được dữ liệu. Kiểm tra Sheet có tab "Weight" và quyền đọc public.'
        );
      },
    });
  }

  openAddDialog() {
    this.draft.set(this.defaultDraft());
    this.errorMsg.set('');
    this.successMsg.set('');
    this.addDialogOpen.set(true);
  }

  closeAddDialog() {
    this.addDialogOpen.set(false);
  }

  updateDraftDate(v: string) {
    this.draft.update((d) => ({ ...d, date: v }));
  }

  updateDraftWeight(v: string) {
    const cleaned = String(v ?? '').replace(/,/g, '.');
    this.draft.update((d) => ({ ...d, weightInput: cleaned }));
  }

  updateDraftNote(v: string) {
    this.draft.update((d) => ({ ...d, note: v }));
  }

  private parseDraftKg(raw: string): number | null {
    const s = raw.trim().replace(/,/g, '.');
    if (!s) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  submitAdd() {
    const d = this.draft();
    const kg = this.parseDraftKg(d.weightInput);
    if (!d.date || kg === null) {
      this.errorMsg.set('Vui lòng nhập ngày và cân nặng (kg) hợp lệ.');
      return;
    }

    const log: WeightLog = {
      user: String(this.user() || 'guest').toLowerCase().trim() || 'guest',
      date: d.date,
      weightKg: kg,
      note: d.note.trim() || undefined,
    };

    this.saving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    this.weightLogService.addLog(log).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set(
          `Đã lưu ${this.formatKg(kg)} kg ngày ${this.formatDateDisplay(log.date)}`
        );
        setTimeout(() => this.successMsg.set(''), 4000);
        this.closeAddDialog();
        setTimeout(() => this.load(), 900);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(
          err?.message || 'Lưu thất bại. Kiểm tra Apps Script đã có action addWeight.'
        );
      },
    });
  }

  openEdit(log: WeightLog) {
    if (!log.rowIndex) return;
    this.editingLog.set(log);
    this.editDraft.set({
      date: log.date,
      weightInput: this.formatKg(log.weightKg),
      note: log.note || '',
    });
    this.errorMsg.set('');
  }

  cancelEdit() {
    this.editingLog.set(null);
    this.editDraft.set(this.defaultDraft());
  }

  updateEditDate(v: string) {
    this.editDraft.update((d) => ({ ...d, date: v }));
  }

  updateEditWeight(v: string) {
    const cleaned = String(v ?? '').replace(/,/g, '.');
    this.editDraft.update((d) => ({ ...d, weightInput: cleaned }));
  }

  updateEditNote(v: string) {
    this.editDraft.update((d) => ({ ...d, note: v }));
  }

  noteHasTag(note: string, tag: string): boolean {
    return note
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .includes(tag);
  }

  private toggleTagInNote(note: string, tag: string): string {
    const parts = note
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const i = parts.indexOf(tag);
    if (i >= 0) {
      parts.splice(i, 1);
    } else {
      parts.push(tag);
    }
    return parts.join(', ');
  }

  toggleDraftNoteTag(tag: string) {
    this.draft.update((d) => ({
      ...d,
      note: this.toggleTagInNote(d.note, tag),
    }));
  }

  toggleEditNoteTag(tag: string) {
    this.editDraft.update((d) => ({
      ...d,
      note: this.toggleTagInNote(d.note, tag),
    }));
  }

  submitEdit() {
    const orig = this.editingLog();
    if (!orig?.rowIndex) return;

    const d = this.editDraft();
    const kg = this.parseDraftKg(d.weightInput);
    if (!d.date || kg === null) {
      this.errorMsg.set('Vui lòng nhập ngày và cân nặng hợp lệ.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');

    this.weightLogService
      .updateLog(orig.rowIndex, {
        date: d.date,
        weightKg: kg,
        note: d.note.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMsg.set('Đã cập nhật.');
          setTimeout(() => this.successMsg.set(''), 3000);
          this.cancelEdit();
          setTimeout(() => this.load(), 900);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(
            err?.message ||
              'Cập nhật thất bại. Kiểm tra Apps Script đã có action updateWeight.'
          );
        },
      });
  }

  deleteLog(log: WeightLog) {
    if (!log.rowIndex) return;
    if (
      !confirm(
        `Xoá ghi nhận ${this.formatKg(log.weightKg)} kg ngày ${this.formatDateDisplay(log.date)}?`
      )
    ) {
      return;
    }

    this.weightLogService.deleteLog(log.rowIndex).subscribe({
      next: () => {
        this.successMsg.set('Đã xoá.');
        setTimeout(() => this.successMsg.set(''), 3000);
        if (this.editingLog()?.rowIndex === log.rowIndex) this.cancelEdit();
        setTimeout(() => this.load(), 900);
      },
      error: (err) => {
        this.errorMsg.set(err?.message || 'Xoá thất bại.');
      },
    });
  }

  formatDateDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  formatDateShort(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  formatKg(n: number): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  }

  formatGPerDay(n: number): string {
    const s = new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(n);
    return `${n > 0 ? '+' : ''}${s}`;
  }

  /** Nhãn tuổi trên trục ngang biểu đồ so sánh */
  formatAgeShortVi(days: number): string {
    const w = Math.floor(days / 7);
    const d = days % 7;
    if (w === 0) {
      return `${days} ngày`;
    }
    return d === 0 ? `${w} tuần` : `${w}t${d}n`;
  }

  growthStatusClass(status: string): string {
    switch (status) {
      case 'very_low':
      case 'very_high':
        return 'warn';
      case 'low':
      case 'high':
        return 'mid';
      case 'normal':
        return 'ok';
      default:
        return 'neutral';
    }
  }

  private defaultDraft(): WeightDraft {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return {
      date: `${y}-${m}-${d}`,
      weightInput: '',
      note: '',
    };
  }
}
