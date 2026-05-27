import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { finalize, concatMap } from 'rxjs/operators';
import {
  ACTIVITY_EVENT,
  ActivityLogService,
  formatLogContent,
} from '../../../services/activity-log.service';
import {
  BottlePrepFromSheet,
  FeedingLog,
  FeedingLogService,
  FeedingSettingsResolved,
} from '../../../services/feeding-log.service';
import { NutritionTarget } from '../feeding-nutrition';
import { predictNextFeeding } from '../feeding-prediction';
import {
  FeedingViewGroup,
  groupLogsByProximity,
} from '../feeding-view-group';
import {
  formatIntervalFromPrevViewGroup,
  isFeedTimeGapWarningViewGroup,
  isHighVolumeViewGroup,
  isLowVolumeViewGroup,
  viewGroupDisplayTime,
  viewGroupDisplayVolume,
  viewGroupKey,
  viewGroupNote,
} from '../feeding-display.helpers';

interface DayStats {
  date: string;
  total: number;
  count: number;
  avg: number;
  medianMl: number;
  typicalFeedMl: number;
  max: number;
  min: number;
  firstTime: string;
  lastTime: string;
}

function minutesToHumanShort(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}p`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}p`;
}

function minutesToVietnamese(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

@Component({
  selector: 'app-feeding-daily',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feeding-daily.component.html',
  styleUrls: ['./feeding-daily.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingDailyComponent implements AfterViewInit {
  private feedingLogService = inject(FeedingLogService);
  private activityLogService = inject(ActivityLogService);

  @ViewChild('pastDayStripScroller')
  private pastDayStripScroller?: ElementRef<HTMLElement>;

  Math = Math;

  logs = input.required<FeedingLog[]>();
  feedingSettings = input.required<FeedingSettingsResolved>();
  now = input.required<Date>();
  nutritionTarget = input<NutritionTarget | null>(null);
  user = input.required<string>();
  syncMessage = input('');
  syncError = input('');
  logDialogOpen = input(false);
  loadingLogs = input(false);
  /** Parent increments on `refreshAll()` to reload bottle prep. */
  refreshToken = input(0);

  logsChanged = output<void>();
  bottlePrepChange = output<BottlePrepFromSheet | null>();
  editLog = output<FeedingLog>();
  historyOpen = output<{
    filter: 'all' | 'today' | 'yesterday' | 'date';
    dateStr?: string;
  }>();
  feedRowClick = output<FeedingViewGroup>();

  private static readonly PAST_DAY_STRIP_MIN_DAYS = 30;
  private static readonly PAST_DAY_STRIP_MAX_DAYS = 120;

  /** Gợi ý lý do khi xóa / đổi sữa đã pha (dialog). */
  readonly bottlePrepReasonQuickTags = [
    'Sữa hỏng',
    'Bé ói',
    'Pha lại',
    'Đổ đi',
    'Hết hạn',
    'Bé uống ít',
    'Đổi loại sữa',
    'Đo lại ml',
  ] as const;

  bottlePrep = signal<BottlePrepFromSheet | null>(null);
  bottlePrepDraft = signal('');
  bottlePrepEditing = signal(false);
  bottlePrepSaving = signal(false);
  pastDayViewDate = signal('');

  bottlePrepClearConfirmOpen = signal(false);
  bottlePrepClearReasonDraft = signal('');

  bottlePrepEditConfirmOpen = signal(false);
  bottlePrepEditReasonDraft = signal('');
  bottlePrepEditPending = signal<{
    newVolume: number;
    time: string;
    atIso: string;
    oldVolume: number;
  } | null>(null);

  bottlePrepWarning = computed(() => {
    const prep = this.bottlePrep();
    if (!prep) {
      const p = this.prediction();
      if (!p?.nextAt) return null;
      const diffMin = Math.round(
        (p.nextAt.getTime() - this.now().getTime()) / 60000
      );
      const notifyMinutes = this.feedingSettings().feedingNotificationMinutes;
      const bottlePrepNotifyMinutes = notifyMinutes + 20;
      if (diffMin < 0) {
        return { type: 'no-prep-late' as const, minutes: Math.abs(diffMin) };
      }
      if (diffMin <= bottlePrepNotifyMinutes) {
        return { type: 'no-prep-soon' as const, minutes: diffMin };
      }
      return null;
    }
    const prepTime = new Date(prep.at);
    if (isNaN(prepTime.getTime())) return null;
    const expiryTime = new Date(prepTime.getTime() + 60 * 60 * 1000);
    const remainingMs = expiryTime.getTime() - this.now().getTime();
    const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
    if (remainingMinutes <= 0) {
      return { type: 'expired' as const, minutes: 0 };
    }
    if (remainingMinutes <= 30) {
      return { type: 'expiring-soon' as const, minutes: remainingMinutes };
    }
    return null;
  });

  /** % thời gian đã trôi trong cửa sổ 1h sau khi pha (0% = mới pha, 100% = hết/ quá hạn). */
  bottlePrepBarPct = computed(() => {
    const prep = this.bottlePrep();
    if (prep) {
      const prepTime = new Date(prep.at);
      if (isNaN(prepTime.getTime())) return 0;
      const windowMs = 60 * 60 * 1000;
      const elapsed = this.now().getTime() - prepTime.getTime();
      const pct = Math.round((elapsed / windowMs) * 100);
      return Math.min(100, Math.max(0, pct));
    }
    const w = this.bottlePrepWarning();
    if (!w) return 0;
    const notifyMinutes =
      this.feedingSettings().feedingNotificationMinutes + 20;
    if (w.type === 'no-prep-late') return 100;
    if (w.type === 'no-prep-soon') {
      if (w.minutes <= 0) return 100;
      return Math.min(
        100,
        Math.round((1 - w.minutes / notifyMinutes) * 100)
      );
    }
    return 0;
  });

  bottlePrepBarTone = computed((): 'calm' | 'soon' | 'danger' => {
    const w = this.bottlePrepWarning();
    if (!w) return 'calm';
    if (w.type === 'expired' || w.type === 'no-prep-late') return 'danger';
    if (w.type === 'expiring-soon' || w.type === 'no-prep-soon')
      return 'soon';
    return 'calm';
  });

  bottlePrepCountdownLine = computed((): string => {
    const prep = this.bottlePrep();
    const w = this.bottlePrepWarning();
    if (prep) {
      const t = new Date(prep.at);
      if (isNaN(t.getTime())) return '';
      const remMs = t.getTime() + 60 * 60 * 1000 - this.now().getTime();
      if (remMs <= 0) return 'Đã quá hạn 1 giờ — nên pha sữa mới.';
      const m = Math.max(1, Math.floor(remMs / 60000));
      return `Còn ${m} phút nữa là sữa hết hạn.`;
    }
    if (w?.type === 'no-prep-soon') {
      if (w.minutes <= 0)
        return 'Đến giờ bú — chưa có sữa đã pha trong bình.';
      return `Còn ${minutesToVietnamese(w.minutes)} tới cữ bú — chưa có sữa đã pha.`;
    }
    if (w?.type === 'no-prep-late') {
      if (w.minutes > 0)
        return `Đã trễ ${minutesToVietnamese(w.minutes)} so với giờ bú — chưa có sữa đã pha.`;
      return 'Đã trễ giờ bú — chưa có sữa đã pha.';
    }
    return '';
  });

  /** Prep quá hạn 1h: cùng nội dung countdown nhưng tách «trễ X phút» căn phải. */
  bottlePrepExpiredCountdownSplit = computed((): { main: string; lateMin: number } | null => {
    const prep = this.bottlePrep();
    if (!prep) return null;
    const t = new Date(prep.at);
    if (isNaN(t.getTime())) return null;
    const expiryMs = t.getTime() + 60 * 60 * 1000;
    const pastMs = this.now().getTime() - expiryMs;
    if (pastMs <= 0) return null;
    const lateMin = Math.max(1, Math.floor(pastMs / 60000));
    return {
      main: 'Đã quá hạn 1 giờ — nên pha sữa mới.',
      lateMin,
    };
  });

  todayStats = computed<DayStats>(() =>
    this.computeDayStats(this.todayDateStr())
  );

  todayLogs = computed(() =>
    this.logs()
      .filter((l) => l.date === this.todayDateStr())
      .sort((a, b) => b.time.localeCompare(a.time))
  );

  todayLogViewGroups = computed<FeedingViewGroup[]>(() =>
    groupLogsByProximity(
      this.todayLogs(),
      this.feedingSettings().feedGroupGapMinutes,
      (l) => this.logTimestamp(l)
    )
  );

  private logsByDateMap = computed(() => {
    const map = new Map<string, FeedingLog[]>();
    for (const log of this.logs()) {
      let bucket = map.get(log.date);
      if (!bucket) {
        bucket = [];
        map.set(log.date, bucket);
      }
      bucket.push(log);
    }
    for (const bucket of map.values()) {
      if (bucket.length > 1) {
        bucket.sort((a, b) => b.time.localeCompare(a.time));
      }
    }
    return map;
  });

  pastDayViewLogs = computed(
    () => this.logsByDateMap().get(this.pastDayViewDate()) ?? []
  );

  pastDayViewStats = computed<DayStats>(() => {
    const date = this.pastDayViewDate();
    return this.statsFromList(date, this.pastDayViewLogs());
  });

  pastDayViewLogViewGroups = computed<FeedingViewGroup[]>(() =>
    groupLogsByProximity(
      this.pastDayViewLogs(),
      this.feedingSettings().feedGroupGapMinutes,
      (l) => this.logTimestamp(l)
    )
  );

  pastDayStripItems = computed(() => {
    const map = this.logsByDateMap();
    const yesterday = this.yesterdayDateStr();
    const today = this.todayDateStr();
    const minStart = this.dateStrDaysAgo(
      FeedingDailyComponent.PAST_DAY_STRIP_MIN_DAYS
    );
    const maxStart = this.dateStrDaysAgo(
      FeedingDailyComponent.PAST_DAY_STRIP_MAX_DAYS
    );
    let earliest = minStart;
    for (const date of map.keys()) {
      if (date < today && date < earliest) {
        earliest = date;
      }
    }
    if (earliest < maxStart) {
      earliest = maxStart;
    }
    const items: Array<{
      date: string;
      dateLabel: string;
      mlLabel: string;
      total: number;
    }> = [];
    const cursor = new Date(earliest + 'T00:00:00');
    const end = new Date(yesterday + 'T00:00:00');
    while (cursor <= end) {
      const date = this.toDateStr(cursor);
      const dayLogs = map.get(date) ?? [];
      const total = dayLogs.reduce((sum, log) => sum + log.volume, 0);
      items.push({
        date,
        dateLabel: this.formatDateStrip(date),
        mlLabel: total > 0 ? `${total}ml` : '—',
        total,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return items;
  });

  yesterdayUpToNowStats = computed<DayStats>(() => {
    const nowTime = this.toTimeStr(this.now());
    const yDate = this.yesterdayDateStr();
    const list = this.logs().filter(
      (l) => l.date === yDate && l.time <= nowTime
    );
    return this.statsFromList(yDate, list);
  });

  priorThreeDaysUpToNowAvg = computed(() => {
    const s1 = this.statsUpToNowForDate(this.dateStrDaysAgo(1));
    const s2 = this.statsUpToNowForDate(this.dateStrDaysAgo(2));
    const s3 = this.statsUpToNowForDate(this.dateStrDaysAgo(3));
    const avgTotal = Math.round((s1.total + s2.total + s3.total) / 3);
    const avgCount = Math.round((s1.count + s2.count + s3.count) / 3);
    return { avgTotal, avgCount };
  });

  comparison = computed(() => {
    const t = this.todayStats();
    const y = this.yesterdayUpToNowStats();
    const totalDiff = t.total - y.total;
    const pct = y.total > 0 ? Math.round((totalDiff / y.total) * 100) : null;
    return { totalDiff, pct };
  });

  comparisonVsPrior3Avg = computed(() => {
    const t = this.todayStats();
    const p = this.priorThreeDaysUpToNowAvg();
    const totalDiff = t.total - p.avgTotal;
    const pct =
      p.avgTotal > 0 ? Math.round((totalDiff / p.avgTotal) * 100) : null;
    return { totalDiff, pct };
  });

  prediction = computed(() => predictNextFeeding(this.logs(), this.now()));

  lastFeeding = computed<FeedingLog | null>(() => {
    const all = this.logs();
    if (all.length === 0) return null;
    const sorted = [...all].sort((a, b) => {
      const ka = `${a.date}T${a.time}`;
      const kb = `${b.date}T${b.time}`;
      return kb.localeCompare(ka);
    });
    return sorted[0];
  });

  lastFeedingAgo = computed(() => {
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

  burpWarning = computed(() => {
    const last = this.lastFeeding();
    if (!last) return null;
    const burpDuration = this.feedingSettings().burpDurationMinutes;
    const [y, mo, d] = last.date.split('-').map((n) => parseInt(n, 10));
    const [h, mi] = last.time.split(':').map((n) => parseInt(n, 10));
    const feedAt = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0);
    const burpEndAt = new Date(feedAt.getTime() + burpDuration * 60 * 1000);
    const remainingMs = burpEndAt.getTime() - this.now().getTime();
    if (remainingMs <= 0) return null;
    return {
      remainingMinutes: Math.ceil(remainingMs / 60000),
      lastFeedTime: last.time,
      lastFeedVolume: last.volume,
      burpDuration,
    };
  });

  timeUntilNext = computed(() => {
    const p = this.prediction();
    if (!p?.nextAt) return '';
    const diffMin = Math.round(
      (p.nextAt.getTime() - this.now().getTime()) / 60000
    );
    const notifyMinutes = this.feedingSettings().feedingNotificationMinutes;
    if (diffMin < -5) return `đã trễ ${minutesToVietnamese(-diffMin)}`;
    if (diffMin < 0) return `đã trễ ${minutesToVietnamese(-diffMin)}`;
    if (diffMin <= notifyMinutes)
      return `trong ${minutesToVietnamese(diffMin)} nữa`;
    return `trong ${minutesToVietnamese(diffMin)} nữa`;
  });

  nextFeedingRecommendedMl = computed<number | null>(() => {
    const target = this.nutritionTarget();
    if (!target) return null;
    const avgMlPerFeed = Math.round(
      (target.dailyMlMin + target.dailyMlMax) /
        2 /
        ((target.feedsPerDayMin + target.feedsPerDayMax) / 2)
    );
    const clampedValue = Math.max(10, Math.min(300, avgMlPerFeed));
    const remainder = clampedValue % 10;
    if (remainder === 0) return clampedValue;
    if (remainder <= 5) {
      return clampedValue - remainder + (remainder >= 1 ? 5 : 0);
    }
    return clampedValue + (10 - remainder);
  });

  nextFeedingRecommendation = computed(() => {
    const target = this.nutritionTarget();
    const prediction = this.prediction();
    if (!target) {
      return {
        recommendedMl: 0,
        hasNutritionData: false,
      };
    }
    const todayTotal = this.todayStats().total;
    const todayCount = this.todayStats().count;
    const remainingDaily = Math.max(0, target.dailyMlMin - todayTotal);
    const remainingFeeds = Math.max(1, target.feedsPerDayMin - todayCount);
    const recommendedMl = this.nextFeedingRecommendedMl() ?? 0;
    return {
      recommendedMl,
      predictedMl: prediction?.nextVolume ?? null,
      remainingDaily,
      remainingFeeds,
      hasNutritionData: true,
    };
  });

  predictionMedianIntervalHuman = computed(() =>
    minutesToHumanShort(this.prediction().medianIntervalMinutes || 0)
  );

  countdownStatus = computed<'late' | 'now' | 'waiting'>(() => {
    const p = this.prediction();
    if (!p?.nextAt) return 'waiting';
    const diffMin = Math.round(
      (p.nextAt.getTime() - this.now().getTime()) / 60000
    );
    const notifyMinutes = this.feedingSettings().feedingNotificationMinutes;
    if (diffMin < -5) return 'late';
    if (diffMin <= notifyMinutes) return 'now';
    return 'waiting';
  });

  countdownProgress = computed(() => {
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
    return Math.max(
      0,
      Math.min(100, Math.round(((now - lastAt) / total) * 100))
    );
  });

  recentFeedViewGroups = computed<FeedingViewGroup[]>(() => {
    const gap = this.feedingSettings().feedGroupGapMinutes;
    const all = groupLogsByProximity(this.logs(), gap, (l) =>
      this.logTimestamp(l)
    );
    return all.slice(0, 5);
  });

  todayLogsPreview = computed(() => this.todayLogViewGroups().slice(0, 2));
  pastDayViewLogsPreview = computed(() =>
    this.pastDayViewLogViewGroups().slice(0, 2)
  );

  constructor() {
    effect(() => {
      this.user();
      this.refreshToken();
      this.loadBottlePrepFromSheet();
    });
    effect(() => {
      const date = this.pastDayViewDate();
      if (date) {
        queueMicrotask(() =>
          this.scrollPastDayStripIntoView(date, 'instant')
        );
      }
    });
  }

  ngAfterViewInit(): void {
    if (!this.pastDayViewDate()) {
      this.pastDayViewDate.set(this.yesterdayDateStr());
    }
    queueMicrotask(() =>
      this.scrollPastDayStripIntoView(this.pastDayViewDate(), 'instant')
    );
  }

  trackFeedingViewGroup = (_index: number, g: FeedingViewGroup): string =>
    viewGroupKey(g);

  trackPastDayStripItem(_index: number, item: { date: string }): string {
    return item.date;
  }

  viewGroupDisplayTime(g: FeedingViewGroup): string {
    return viewGroupDisplayTime(g, (d) => this.toTimeStr(d));
  }

  viewGroupDisplayVolume(g: FeedingViewGroup): number {
    return viewGroupDisplayVolume(g);
  }

  viewGroupNote(g: FeedingViewGroup): string {
    return viewGroupNote(g);
  }

  isLowVolumeViewGroup(g: FeedingViewGroup): boolean {
    return isLowVolumeViewGroup(g, this.feedingSettings());
  }

  isHighVolumeViewGroup(g: FeedingViewGroup): boolean {
    return isHighVolumeViewGroup(g);
  }

  formatIntervalFromPrevViewGroup(
    g: FeedingViewGroup,
    listDesc: FeedingViewGroup[]
  ): string {
    return formatIntervalFromPrevViewGroup(g, listDesc, this.logs());
  }

  isFeedTimeGapWarningViewGroup(
    g: FeedingViewGroup,
    listDesc: FeedingViewGroup[]
  ): boolean {
    return isFeedTimeGapWarningViewGroup(
      g,
      listDesc,
      this.logs(),
      this.feedingSettings()
    );
  }

  onFeedRowClick(g: FeedingViewGroup): void {
    this.feedRowClick.emit(g);
  }

  openHistoryDialog(
    filter: 'all' | 'today' | 'yesterday' | 'date' = 'all',
    dateStr?: string
  ): void {
    this.historyOpen.emit({
      filter,
      dateStr: filter === 'date' ? dateStr : undefined,
    });
  }

  openEditDialog(log: FeedingLog): void {
    this.editLog.emit(log);
  }

  openFeedGroupDetail(g: FeedingViewGroup): void {
    if (g.members.length < 2) return;
    this.feedRowClick.emit(g);
  }

  deleteLog(log: FeedingLog): void {
    if (!log.rowIndex) return;
    if (
      !confirm(
        `Xoá cữ ${log.volume}ml lúc ${log.time} ngày ${this.formatDateDisplay(log.date)}?`
      )
    ) {
      return;
    }
    this.feedingLogService.deleteLog(log.rowIndex).subscribe({
      next: () => {
        this.activityLogService
          .logFeeding(this.user(), 'FEEDING_DELETED', {
            time: log.time,
            volume: log.volume,
          })
          .subscribe();
        this.logsChanged.emit();
      },
      error: () => {
        /* parent shows syncError via reload failure if needed */
      },
    });
  }

  private loadBottlePrepFromSheet(): void {
    this.feedingLogService.getBottlePrep().subscribe({
      next: (prep) => {
        this.bottlePrep.set(prep);
        this.bottlePrepChange.emit(prep);
      },
    });
  }

  editBottlePrep(): void {
    const current = this.bottlePrep();
    this.bottlePrepDraft.set(current ? String(current.volumeMl) : '');
    this.bottlePrepEditing.set(true);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.bp-input');
      el?.focus();
      el?.select();
    }, 50);
  }

  cancelBottlePrep(): void {
    if (this.bottlePrepSaving()) return;
    this.bottlePrepEditing.set(false);
    this.bottlePrepDraft.set('');
  }

  updateBottlePrepDraft(v: string): void {
    this.bottlePrepDraft.set(String(v ?? '').replace(/[^\d]/g, ''));
  }

  setBottlePrepDraft(v: number): void {
    if (v <= 0) return;
    this.bottlePrepDraft.set(String(v));
  }

  adjustBottlePrepDraft(delta: number): void {
    const current = parseInt(this.bottlePrepDraft(), 10) || 0;
    const next = Math.max(0, Math.min(9999, current + delta));
    this.bottlePrepDraft.set(next ? String(next) : '');
  }

  saveBottlePrep(): void {
    if (this.bottlePrepSaving()) return;
    const n = parseInt(this.bottlePrepDraft(), 10);
    if (isNaN(n) || n <= 0) return;
    const oldPrep = this.bottlePrep();
    const warn = this.bottlePrepWarning();
    const atIso = new Date().toISOString();
    const t = this.toTimeStr(new Date(atIso));

    const isExpiryReplace =
      !!oldPrep &&
      !!warn &&
      (warn.type === 'expired' || warn.type === 'expiring-soon');

    if (oldPrep && n === oldPrep.volumeMl && !isExpiryReplace) {
      return;
    }

    const isEditVolumeOnly =
      !!oldPrep && n !== oldPrep.volumeMl && !isExpiryReplace;

    if (isEditVolumeOnly) {
      this.bottlePrepEditPending.set({
        newVolume: n,
        time: t,
        atIso,
        oldVolume: oldPrep.volumeMl,
      });
      this.bottlePrepEditReasonDraft.set('');
      this.bottlePrepEditConfirmOpen.set(true);
      return;
    }

    this.commitBottlePrepSheetSave(n, t, atIso, oldPrep, warn);
  }

  /** Lưu sheet + log pha mới / hết hạn (không qua dialog sửa ml). */
  private commitBottlePrepSheetSave(
    n: number,
    t: string,
    atIso: string,
    oldPrep: BottlePrepFromSheet | null,
    warn: { type: string; minutes: number } | null
  ): void {
    this.bottlePrepSaving.set(true);
    this.feedingLogService
      .setBottlePrepOnSheet({
        user: this.user(),
        volumeMl: n,
        time: t,
        atIso,
      })
      .pipe(finalize(() => this.bottlePrepSaving.set(false)))
      .subscribe({
        next: () => {
          this.bottlePrepEditing.set(false);
          this.bottlePrepDraft.set('');

          let expiryLog$ = of(true);
          if (
            oldPrep &&
            warn &&
            (warn.type === 'expired' || warn.type === 'expiring-soon')
          ) {
            if (warn.type === 'expired') {
              const prepTime = new Date(oldPrep.at);
              const expiryTime = new Date(prepTime.getTime() + 60 * 60 * 1000);
              const overdueMin = Math.max(
                1,
                Math.round((this.now().getTime() - expiryTime.getTime()) / 60000)
              );
              expiryLog$ = this.activityLogService.logBottlePrepClearedForExpiry(
                oldPrep.volumeMl,
                overdueMin,
                'expired'
              );
            } else {
              const remain = Math.max(0, warn.minutes);
              expiryLog$ = this.activityLogService.logBottlePrepClearedForExpiry(
                oldPrep.volumeMl,
                remain,
                'expiring'
              );
            }
          }

          expiryLog$
            .pipe(
              concatMap(() =>
                this.activityLogService.addLog({
                  user: this.user(),
                  eventType: ACTIVITY_EVENT.BOTTLE_PREP_ADDED,
                  content: formatLogContent(ACTIVITY_EVENT.BOTTLE_PREP_ADDED, {
                    volume: n,
                    time: t,
                  }),
                })
              )
            )
            .subscribe();

          setTimeout(() => this.loadBottlePrepFromSheet(), 450);
        },
        error: (err) =>
          console.warn('Đồng bộ thông tin pha sữa lên Google Sheet thất bại', err),
      });
  }

  closeBottlePrepEditConfirm(): void {
    this.bottlePrepEditConfirmOpen.set(false);
    this.bottlePrepEditReasonDraft.set('');
    this.bottlePrepEditPending.set(null);
  }

  updateBottlePrepEditReason(v: string): void {
    this.bottlePrepEditReasonDraft.set(v);
  }

  confirmBottlePrepEditSave(): void {
    const p = this.bottlePrepEditPending();
    if (!p) {
      this.closeBottlePrepEditConfirm();
      return;
    }
    const reason = this.bottlePrepEditReasonDraft().trim();
    // Đóng dialog ngay — không giữ overlay chặn UI trong lúc API + log chạy.
    this.bottlePrepEditConfirmOpen.set(false);
    this.bottlePrepEditReasonDraft.set('');
    this.bottlePrepEditPending.set(null);

    this.bottlePrepSaving.set(true);
    this.feedingLogService
      .setBottlePrepOnSheet({
        user: this.user(),
        volumeMl: p.newVolume,
        time: p.time,
        atIso: p.atIso,
      })
      .pipe(finalize(() => this.bottlePrepSaving.set(false)))
      .subscribe({
        next: () => {
          this.bottlePrepEditing.set(false);
          this.bottlePrepDraft.set('');
          this.activityLogService
            .addLog({
              user: this.user(),
              eventType: ACTIVITY_EVENT.BOTTLE_PREP_UPDATED,
              content: formatLogContent(ACTIVITY_EVENT.BOTTLE_PREP_UPDATED, {
                oldVolume: p.oldVolume,
                newVolume: p.newVolume,
                time: p.time,
                reason: reason || undefined,
              }),
            })
            .subscribe();
          setTimeout(() => this.loadBottlePrepFromSheet(), 450);
        },
        error: (err) =>
          console.warn('Đồng bộ thông tin pha sữa lên Google Sheet thất bại', err),
      });
  }

  openBottlePrepClearConfirm(): void {
    if (!this.bottlePrep()) return;
    this.bottlePrepClearReasonDraft.set('');
    this.bottlePrepClearConfirmOpen.set(true);
  }

  closeBottlePrepClearConfirm(): void {
    this.bottlePrepClearConfirmOpen.set(false);
    this.bottlePrepClearReasonDraft.set('');
  }

  updateBottlePrepClearReason(v: string): void {
    this.bottlePrepClearReasonDraft.set(v);
  }

  /** Gợi ý nhanh: chỉ 1 lý do; bấm lại cùng tag thì xóa; tag khác thì thay hết nội dung. */
  toggleBottlePrepClearReasonQuickTag(tag: string): void {
    const cur = this.bottlePrepClearReasonDraft().trim();
    if (cur === tag) {
      this.bottlePrepClearReasonDraft.set('');
    } else {
      this.bottlePrepClearReasonDraft.set(tag);
    }
  }

  toggleBottlePrepEditReasonQuickTag(tag: string): void {
    const cur = this.bottlePrepEditReasonDraft().trim();
    if (cur === tag) {
      this.bottlePrepEditReasonDraft.set('');
    } else {
      this.bottlePrepEditReasonDraft.set(tag);
    }
  }

  confirmClearBottlePrep(): void {
    const prep = this.bottlePrep();
    if (!prep) {
      this.closeBottlePrepClearConfirm();
      return;
    }
    const ml = prep.volumeMl;
    const reason = this.bottlePrepClearReasonDraft().trim();
    this.closeBottlePrepClearConfirm();
    this.bottlePrep.set(null);
    this.bottlePrepChange.emit(null);
    this.bottlePrepEditing.set(false);
    this.bottlePrepDraft.set('');
    this.feedingLogService.clearBottlePrepOnSheet().subscribe({
      next: () => {
        this.activityLogService
          .logBottlePrepManualClear(this.user(), ml, reason || undefined)
          .subscribe();
        setTimeout(() => this.loadBottlePrepFromSheet(), 450);
      },
      error: () => setTimeout(() => this.loadBottlePrepFromSheet(), 450),
    });
  }

  formatBottleAt(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return this.toTimeStr(d);
  }

  /** Giờ:phút mốc hết hạn 1h sau khi pha — dùng cho tag. */
  formatBottlePrepExpiryClock(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return this.toTimeStr(new Date(d.getTime() + 60 * 60 * 1000));
  }

  pastDayViewShowReset(): boolean {
    return this.pastDayViewDate() !== this.yesterdayDateStr();
  }

  selectPastDayView(date: string): void {
    this.pastDayViewDate.set(date);
  }

  pastDayViewCanSelectPrev(): boolean {
    const items = this.pastDayStripItems();
    const current = this.pastDayViewDate();
    return items.length > 0 && !!current && current > items[0].date;
  }

  pastDayViewCanSelectNext(): boolean {
    const current = this.pastDayViewDate();
    return !!current && current < this.yesterdayDateStr();
  }

  pastDayViewSelectPrev(): void {
    const current = this.pastDayViewDate();
    if (!current) return;
    const d = new Date(current + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const prev = this.toDateStr(d);
    const items = this.pastDayStripItems();
    if (!items.length || prev < items[0].date) return;
    this.pastDayViewDate.set(prev);
    this.scrollPastDayStripIntoView(prev);
  }

  pastDayViewSelectNext(): void {
    const current = this.pastDayViewDate();
    const yesterday = this.yesterdayDateStr();
    if (!current || current >= yesterday) return;
    const d = new Date(current + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const next = this.toDateStr(d);
    if (next > yesterday) return;
    this.pastDayViewDate.set(next);
    this.scrollPastDayStripIntoView(next);
  }

  pastDayViewReset(): void {
    const yesterday = this.yesterdayDateStr();
    this.pastDayViewDate.set(yesterday);
    this.scrollPastDayStripIntoView(yesterday);
  }

  pastDayRelativeLabel(dateStr = this.pastDayViewDate()): string {
    if (dateStr === this.yesterdayDateStr()) return 'Hôm qua';
    const d = new Date(this.todayDateStr() + 'T00:00:00');
    d.setDate(d.getDate() - 2);
    if (dateStr === this.toDateStr(d)) return 'Hôm kia';
    return `${this.formatDayLabel(dateStr)} · ${this.formatDateDisplay(dateStr)}`;
  }

  formatDateDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  formatDateShort(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  formatDateStrip(iso: string): string {
    const [, m, d] = iso.split('-').map(Number);
    return `${d}/${m}`;
  }

  formatDayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return dayNames[d.getDay()];
  }

  todayDateStr(): string {
    return this.toDateStr(this.now());
  }

  yesterdayDateStr(): string {
    const d = new Date(this.now());
    d.setDate(d.getDate() - 1);
    return this.toDateStr(d);
  }

  dateStrDaysAgo(daysBefore: number): string {
    const d = new Date(this.now());
    d.setDate(d.getDate() - daysBefore);
    return this.toDateStr(d);
  }

  private logTimestamp(l: FeedingLog): number {
    const [y, m, d] = (l.date || '').split('-').map(Number);
    const [hh, mm] = (l.time || '').split(':').map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return 0;
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }

  private computeDayStats(date: string): DayStats {
    const dayLogs = this.logs().filter((l) => l.date === date);
    return this.dayLogsGroupedStats(date, dayLogs);
  }

  private statsUpToNowForDate(dateStr: string): DayStats {
    const nowTime = this.toTimeStr(this.now());
    const list = this.logs().filter(
      (l) => l.date === dateStr && l.time <= nowTime
    );
    return this.dayLogsGroupedStats(dateStr, list);
  }

  private dayLogsGroupedStats(date: string, logs: FeedingLog[]): DayStats {
    const gap = this.feedingSettings().feedGroupGapMinutes;
    const groups = groupLogsByProximity(logs, gap, (l) => this.logTimestamp(l));
    return this.statsFromViewGroups(date, groups);
  }

  private pseudoLogsFromViewGroups(groups: FeedingViewGroup[]): FeedingLog[] {
    return groups.map((g) => {
      const anchor = g.members.reduce((a, b) =>
        this.logTimestamp(a) >= this.logTimestamp(b) ? a : b
      );
      return { ...anchor, volume: viewGroupDisplayVolume(g) };
    });
  }

  private statsFromViewGroups(
    date: string,
    groups: FeedingViewGroup[]
  ): DayStats {
    return this.statsFromList(date, this.pseudoLogsFromViewGroups(groups));
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

  private scrollPastDayStripIntoView(
    date: string,
    behavior: ScrollBehavior = 'smooth'
  ): void {
    if (!date) return;
    queueMicrotask(() => {
      const scroller = this.pastDayStripScroller?.nativeElement;
      if (!scroller) return;
      const el = scroller.querySelector(
        `[data-past-day="${date}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior });
    });
  }
}
