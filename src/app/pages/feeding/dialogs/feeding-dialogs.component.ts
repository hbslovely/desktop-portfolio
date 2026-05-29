import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  BottlePrepFromSheet,
  FEEDING_SETTING_ID,
  FeedingLog,
  FeedingLogService,
  FeedingSettingsResolved,
} from '../../../services/feeding-log.service';
import { ActivityLogService } from '../../../services/activity-log.service';
import { FeedingPrediction } from '../feeding-prediction';
import {
  FeedingViewGroup,
  groupLogsByProximity,
} from '../feeding-view-group';

interface LogDraft {
  date: string;
  time: string;
  volume: number | null;
  note: string;
}

interface DayStatsSlice {
  total: number;
  count: number;
}

type FeedDetailCompareKind = 'gap' | 'position' | 'average' | 'next';

interface FeedDetailCompareRow {
  label: string;
  text: string;
  warn?: boolean;
  icon: string;
  kind: FeedDetailCompareKind;
  position?: {
    index: number;
    total: number;
    totalMl: number;
    dayTotalMl: number;
    dayLabel: string;
  };
  average?: {
    refMl: number;
    diffMl: number;
    refLabel: string;
    feedCount: number;
  };
  next?: {
    time: string;
    volume: number;
    gapLabel: string;
  };
  gapPrev?: {
    prevTime: string;
    prevVolume: number;
    prevDateIso?: string;
    gapLabel: string;
    volDiffMl: number;
  };
}

interface FeedDetailView {
  log: FeedingLog;
  ageLabel: string;
  volumeStatus: 'low' | 'high' | 'ok';
  compares: FeedDetailCompareRow[];
  note: string;
}

interface DayStatsFull {
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

@Component({
  selector: 'app-feeding-dialogs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding-dialogs.component.html',
  styleUrls: ['./feeding-dialogs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingDialogsComponent {
  private feedingLogService = inject(FeedingLogService);
  private activityLogService = inject(ActivityLogService);

  logs = input.required<FeedingLog[]>();
  user = input.required<string>();
  now = input.required<Date>();
  bottlePrep = input<BottlePrepFromSheet | null>(null);
  feedingSettings = input.required<FeedingSettingsResolved>();
  prediction = input.required<FeedingPrediction>();
  todayStats = input.required<DayStatsSlice>();
  yesterdayStats = input.required<DayStatsSlice>();
  todayLogs = input.required<FeedingLog[]>();
  yesterdayLogs = input.required<FeedingLog[]>();
  maxBirthDate = input.required<string>();
  syncError = input('');
  syncMessage = input('');

  readonly feedingDeleteReasonQuickTags = [
    'Nhập nhầm',
    'Trùng cữ',
    'Sai giờ',
    'Sai ml',
    'Bé không bú',
    'Log thử',
  ] as const;

  logsChanged = output<void>();
  settingsChanged = output<FeedingSettingsResolved>();
  syncErrorChange = output<string>();
  syncMessageChange = output<string>();
  logDialogOpenChange = output<boolean>();
  bottlePrepClearRequested = output<void>();

  logDraft = signal<LogDraft>({
    date: this.toDateStr(new Date()),
    time: this.toTimeStr(new Date()),
    volume: null,
    note: '',
  });
  logDialogOpen = signal(false);
  saving = signal(false);

  editingLog = signal<FeedingLog | null>(null);
  editLogDraft = signal<{ time: string; volume: number | null; note: string }>({
    time: '',
    volume: null,
    note: '',
  });
  editSaving = signal(false);

  feedingSettingsDialogOpen = signal(false);
  settingsDraft = signal<{
    timeWarningHours: number;
    warningMl: number;
    groupGapMinutes: number;
    notificationMinutes: number;
    burpDurationMinutes: number;
    eventReminderDays: number;
    eventReminderHours: number;
    activityLogRefreshMinutes: number;
  } | null>(null);
  settingsSaving = signal(false);
  settingsFormError = signal('');
  settingsSuccess = signal('');

  historyDialogOpen = signal(false);
  feedDetailView = signal<FeedDetailView | null>(null);
  feedGroupDetail = signal<FeedingViewGroup | null>(null);
  feedingDeleteConfirmLog = signal<FeedingLog | null>(null);
  feedingDeleteReasonDraft = signal('');
  feedingDeleteSaving = signal(false);
  feedGroupDetailMembersDesc = computed<FeedingLog[]>(() => {
    const g = this.feedGroupDetail();
    if (!g?.members?.length) return [];
    return [...g.members].sort((a, b) => {
      const ka = `${a.date}T${a.time}`;
      const kb = `${b.date}T${b.time}`;
      return kb.localeCompare(ka);
    });
  });

  historyFilter = signal<'all' | 'today' | 'yesterday' | 'date'>('all');
  historyFilterDate = signal('');
  historyFeedDisplayLimit = signal(100);
  private lastHistoryInfiniteScrollAt = 0;

  remainingInput = signal('');
  /** Đã dùng tính từ sữa đã pha; khi lưu cữ bú thành công sẽ ghi log «System đã …» (activity log). */
  bottlePrepClearPendingLog = signal(false);
  pendingClearedPrepVolumeMl = signal<number | null>(null);

  calcResult = computed<number | null>(() => {
    const prep = this.bottlePrep();
    if (!prep) return null;
    const r = parseFloat(this.remainingInput());
    if (isNaN(r) || r < 0) return null;
    const consumed = prep.volumeMl - r;
    if (consumed <= 0) return null;
    return Math.round(consumed);
  });

  historyLogsFilteredSorted = computed(() => {
    const filter = this.historyFilter();
    const todayStr = this.todayDateStr();
    const yesterdayStr = this.yesterdayDateStr();
    const dateStr = this.historyFilterDate();
    const out: FeedingLog[] = [];
    for (const log of this.logs()) {
      if (filter === 'today' && log.date !== todayStr) continue;
      if (filter === 'yesterday' && log.date !== yesterdayStr) continue;
      if (filter === 'date' && dateStr && log.date !== dateStr) continue;
      out.push(log);
    }
    out.sort((a, b) => {
      const ka = `${a.date}T${a.time}`;
      const kb = `${b.date}T${b.time}`;
      return kb.localeCompare(ka);
    });
    return out;
  });

  historyFilteredFeedTotal = computed(
    () => this.historyLogsFilteredSorted().length
  );

  historyDisplayedFeedCount = computed(() =>
    Math.min(this.historyFeedDisplayLimit(), this.historyFilteredFeedTotal())
  );

  historyHasMoreFeeds = computed(
    () => this.historyFilteredFeedTotal() > this.historyFeedDisplayLimit()
  );

  feedingsByDate = computed(() => {
    const flat = this.historyLogsFilteredSorted();
    const limit = this.historyFeedDisplayLimit();
    const sliced = flat.slice(0, limit);
    const gap = this.feedingSettings().feedGroupGapMinutes;
    const groups = new Map<string, FeedingLog[]>();
    for (const log of sliced) {
      if (!groups.has(log.date)) groups.set(log.date, []);
      groups.get(log.date)!.push(log);
    }
    return Array.from(groups.entries())
      .map(([date, dayLogs]) => {
        const viewRows = groupLogsByProximity(dayLogs, gap, (l) =>
          this.logTimestamp(l)
        );
        const count = viewRows.length;
        const total = viewRows.reduce(
          (s, g) => s + this.viewGroupDisplayVolume(g),
          0
        );
        return {
          date,
          logs: dayLogs.sort((a, b) => b.time.localeCompare(a.time)),
          viewRows,
          total,
          count,
          avg: count > 0 ? Math.round(total / count) : 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  trackFeedingViewGroup = (_index: number, g: FeedingViewGroup): string =>
    this.viewGroupKey(g);

  trackHistoryGroup(_index: number, g: { date: string }): string {
    return g.date;
  }

  trackFeedingLogRow(_index: number, l: FeedingLog): string {
    return l.rowIndex != null ? `r${l.rowIndex}` : `${l.date}|${l.time}`;
  }

  // —— Public API (called from parent template via template ref) ——

  openLogDialog(resetTime = true): void {
    if (resetTime) {
      this.bottlePrepClearPendingLog.set(false);
      this.pendingClearedPrepVolumeMl.set(null);
      const nowD = new Date();
      this.logDraft.set({
        date: this.toDateStr(nowD),
        time: this.toTimeStr(nowD),
        volume: null,
        note: '',
      });
      this.resetRemaining();
    }
    this.syncErrorChange.emit('');
    this.syncMessageChange.emit('');
    this.logDialogOpen.set(true);
    this.logDialogOpenChange.emit(true);
  }

  closeLogDialog(): void {
    this.logDialogOpen.set(false);
    this.logDialogOpenChange.emit(false);
    this.resetRemaining();
  }

  openEditDialog(log: FeedingLog): void {
    if (!log.rowIndex) return;
    this.editingLog.set(log);
    this.editLogDraft.set({
      time: log.time,
      volume: log.volume,
      note: log.note || '',
    });
    this.syncErrorChange.emit('');
    this.syncMessageChange.emit('');
  }

  closeEditDialog(): void {
    this.editingLog.set(null);
    this.editLogDraft.set({ time: '', volume: null, note: '' });
  }

  openHistoryDialog(
    filter: 'all' | 'today' | 'yesterday' | 'date' = 'all',
    dateStr?: string
  ): void {
    this.historyFilter.set(filter);
    this.historyFilterDate.set(filter === 'date' && dateStr ? dateStr : '');
    this.historyFeedDisplayLimit.set(100);
    this.historyDialogOpen.set(true);
  }

  closeHistoryDialog(): void {
    this.historyDialogOpen.set(false);
  }

  openFeedingSettingsDialog(): void {
    const s = this.feedingSettings();
    this.settingsFormError.set('');
    this.settingsSuccess.set('');
    this.settingsDraft.set({
      timeWarningHours: s.feedTimeWarningHours,
      warningMl: s.feedWarningMl,
      groupGapMinutes: s.feedGroupGapMinutes,
      notificationMinutes: s.feedingNotificationMinutes,
      burpDurationMinutes: s.burpDurationMinutes,
      eventReminderDays: s.eventReminderDays,
      eventReminderHours: s.eventReminderHours,
      activityLogRefreshMinutes: s.activityLogRefreshMinutes,
    });
    this.feedingSettingsDialogOpen.set(true);
  }

  closeFeedingSettingsDialog(): void {
    this.feedingSettingsDialogOpen.set(false);
    this.settingsDraft.set(null);
    this.settingsFormError.set('');
  }

  onFeedRowClick(g: FeedingViewGroup): void {
    if (g.members.length > 1) {
      this.openFeedGroupDetail(g);
      return;
    }
    const log = g.members[0];
    if (log) this.openFeedDetail(log);
  }

  openFeedGroupDetail(g: FeedingViewGroup): void {
    if (g.members.length < 2) return;
    this.closeFeedDetail();
    this.feedGroupDetail.set(g);
  }

  closeFeedGroupDetail(): void {
    this.feedDetailView.set(null);
    this.feedGroupDetail.set(null);
  }

  openFeedDetailFromGroupMember(log: FeedingLog): void {
    this.feedDetailView.set(this.buildFeedDetailView(log));
  }

  closeFeedDetail(): void {
    this.feedDetailView.set(null);
  }

  openEditFromFeedDetail(): void {
    const log = this.feedDetailView()?.log;
    if (!log?.rowIndex) return;
    this.closeFeedDetail();
    this.openEditDialog(log);
  }

  deleteLog(log: FeedingLog): void {
    if (!log.rowIndex) return;
    this.feedingDeleteConfirmLog.set(log);
    this.feedingDeleteReasonDraft.set('');
    this.syncErrorChange.emit('');
    this.syncMessageChange.emit('');
  }

  closeFeedingDeleteConfirm(): void {
    if (this.feedingDeleteSaving()) return;
    this.feedingDeleteConfirmLog.set(null);
    this.feedingDeleteReasonDraft.set('');
  }

  updateFeedingDeleteReason(v: string): void {
    this.feedingDeleteReasonDraft.set(v);
  }

  toggleFeedingDeleteReasonQuickTag(tag: string): void {
    const cur = this.feedingDeleteReasonDraft().trim();
    this.feedingDeleteReasonDraft.set(cur === tag ? '' : tag);
  }

  confirmDeleteFeedingLog(): void {
    const log = this.feedingDeleteConfirmLog();
    if (!log?.rowIndex || this.feedingDeleteSaving()) return;

    const reason = this.feedingDeleteReasonDraft().trim();
    this.feedingDeleteSaving.set(true);
    this.feedingLogService
      .deleteLog(log.rowIndex)
      .pipe(finalize(() => this.feedingDeleteSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedingDeleteConfirmLog.set(null);
          this.feedingDeleteReasonDraft.set('');
          this.closeFeedGroupDetail();
          this.syncMessageChange.emit('Đã xoá cữ bú.');
          this.activityLogService
            .logFeeding(this.user(), 'FEEDING_DELETED', {
              time: log.time,
              volume: log.volume,
              reason: reason || undefined,
            })
            .subscribe();
          setTimeout(() => this.syncMessageChange.emit(''), 3000);
          this.logsChanged.emit();
        },
        error: (err) => {
          this.syncErrorChange.emit(err?.message || 'Xoá thất bại.');
        },
      });
  }

  usePredictionValues(): void {
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

  // —— Log form ——

  updateLogDate(v: string): void {
    this.logDraft.update((d) => ({ ...d, date: v }));
  }

  updateLogTime(v: string): void {
    this.logDraft.update((d) => ({ ...d, time: v }));
  }

  updateLogVolume(v: string): void {
    const num = parseInt(v, 10);
    this.logDraft.update((d) => ({
      ...d,
      volume: isNaN(num) ? null : num,
    }));
  }

  updateLogNote(v: string): void {
    this.logDraft.update((d) => ({ ...d, note: v }));
  }

  setLogNow(): void {
    const n = new Date();
    this.logDraft.set({
      date: this.toDateStr(n),
      time: this.toTimeStr(n),
      volume: this.logDraft().volume,
      note: this.logDraft().note,
    });
  }

  quickVolume(v: number): void {
    this.logDraft.update((d) => ({ ...d, volume: v }));
  }

  quickNote(tag: string): void {
    this.logDraft.update((d) => ({
      ...d,
      note: d.note === tag ? '' : tag,
    }));
  }

  hasQuickNote(tag: string): boolean {
    return this.logDraft().note === tag;
  }

  updateRemaining(v: string): void {
    this.remainingInput.set(String(v ?? '').replace(/[^\d]/g, ''));
  }

  applyCalcVolume(): void {
    const r = this.calcResult();
    if (r === null) return;
    const prep = this.bottlePrep();
    if (prep && prep.volumeMl > 0) {
      this.bottlePrepClearPendingLog.set(true);
      this.pendingClearedPrepVolumeMl.set(prep.volumeMl);
    }
    this.logDraft.update((d) => ({ ...d, volume: r }));
    this.bottlePrepClearRequested.emit();
    this.remainingInput.set('');
  }

  submitLog(): void {
    const d = this.logDraft();
    if (!d.date || !d.time || !d.volume || d.volume <= 0) {
      this.syncErrorChange.emit('Vui lòng nhập đủ ngày, giờ và dung tích sữa.');
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
    this.syncErrorChange.emit('');
    this.syncMessageChange.emit('');

    this.feedingLogService.addLog(log).subscribe({
      next: () => {
        this.saving.set(false);
        this.syncMessageChange.emit(
          `Đã lưu cữ ${log.volume}ml lúc ${log.time} ngày ${this.formatDateDisplay(log.date)}`
        );
        this.activityLogService
          .logFeeding(this.user(), 'FEEDING_ADDED', {
            time: log.time,
            volume: log.volume,
          })
          .subscribe();
        if (this.bottlePrepClearPendingLog()) {
          const prepVol = this.pendingClearedPrepVolumeMl();
          if (prepVol != null && prepVol > 0) {
            this.activityLogService.logBottlePrepClearedAfterFeed(prepVol).subscribe();
          }
          this.bottlePrepClearPendingLog.set(false);
          this.pendingClearedPrepVolumeMl.set(null);
        }
        const nowT = this.toTimeStr(new Date());
        this.logDraft.set({
          date: d.date,
          time: nowT,
          volume: null,
          note: '',
        });
        setTimeout(() => this.syncMessageChange.emit(''), 4000);
        this.closeLogDialog();
        this.logsChanged.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.syncErrorChange.emit(
          err?.message || 'Lưu thất bại. Vui lòng kiểm tra cấu hình Apps Script.'
        );
      },
    });
  }

  // —— Edit log ——

  updateEditTime(v: string): void {
    this.editLogDraft.update((d) => ({ ...d, time: v }));
  }

  updateEditVolume(v: string): void {
    const num = parseInt(v, 10);
    this.editLogDraft.update((d) => ({
      ...d,
      volume: isNaN(num) ? null : num,
    }));
  }

  updateEditNote(v: string): void {
    this.editLogDraft.update((d) => ({ ...d, note: v }));
  }

  quickEditVolume(v: number): void {
    this.editLogDraft.update((d) => ({ ...d, volume: v }));
  }

  quickEditNote(tag: string): void {
    this.editLogDraft.update((d) => ({
      ...d,
      note: d.note === tag ? '' : tag,
    }));
  }

  hasEditNote(tag: string): boolean {
    return this.editLogDraft().note === tag;
  }

  submitEditLog(): void {
    const original = this.editingLog();
    const d = this.editLogDraft();
    if (!original?.rowIndex) return;
    if (!d.time || !d.volume || d.volume <= 0) {
      this.syncErrorChange.emit('Vui lòng nhập đủ giờ và dung tích sữa.');
      return;
    }

    this.editSaving.set(true);
    this.syncErrorChange.emit('');
    this.syncMessageChange.emit('');

    this.feedingLogService
      .updateLog(original.rowIndex, {
        time: d.time,
        volume: d.volume,
        note: d.note?.trim() || '',
      })
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.syncMessageChange.emit(
            `Đã cập nhật cữ ${d.volume}ml lúc ${d.time} ngày ${this.formatDateDisplay(original.date)}`
          );
          this.activityLogService
            .logFeeding(this.user(), 'FEEDING_UPDATED', {
              time: d.time,
              oldTime: original.time,
              newTime: d.time,
              oldVolume: original.volume,
              newVolume: d.volume ?? undefined,
            })
            .subscribe();
          setTimeout(() => this.syncMessageChange.emit(''), 4000);
          this.closeEditDialog();
          this.logsChanged.emit();
        },
        error: (err) => {
          this.editSaving.set(false);
          this.syncErrorChange.emit(
            err?.message || 'Cập nhật thất bại. Vui lòng kiểm tra cấu hình Apps Script.'
          );
        },
      });
  }

  // —— Settings ——

  updateSettingsDraftTimeWarning(v: string): void {
    const n = parseFloat(String(v).replace(',', '.'));
    this.settingsDraft.update((d) =>
      d && Number.isFinite(n) ? { ...d, timeWarningHours: n } : d
    );
  }

  updateSettingsDraftWarning(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, warningMl: n } : d
    );
  }

  updateSettingsDraftGroupGap(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, groupGapMinutes: n } : d
    );
  }

  updateSettingsDraftNotification(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, notificationMinutes: n } : d
    );
  }

  updateSettingsDraftBurpDuration(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, burpDurationMinutes: n } : d
    );
  }

  updateSettingsDraftEventReminderDays(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, eventReminderDays: n } : d
    );
  }

  updateSettingsDraftEventReminderHours(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, eventReminderHours: n } : d
    );
  }

  updateSettingsDraftActivityLogRefresh(v: string): void {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    this.settingsDraft.update((d) =>
      d && !isNaN(n) ? { ...d, activityLogRefreshMinutes: n } : d
    );
  }

  submitFeedingSettings(): void {
    const d = this.settingsDraft();
    if (!d) return;
    const th = d.timeWarningHours;
    const wm = d.warningMl;
    const gap = d.groupGapMinutes;
    const notify = d.notificationMinutes;
    const burp = d.burpDurationMinutes;
    const evDays = d.eventReminderDays;
    const evHours = d.eventReminderHours;
    const actLog = d.activityLogRefreshMinutes;
    if (!Number.isFinite(th) || th < 0.25 || th > 48) {
      this.settingsFormError.set('Ngưỡng giờ (FEED_TIME_WARNING): từ 0,25 đến 48.');
      return;
    }
    if (!Number.isFinite(wm) || wm < 1 || wm > 500) {
      this.settingsFormError.set('Ngưỡng ml (FEED_WARNING_AMOUNT): từ 1 đến 500.');
      return;
    }
    if (!Number.isFinite(gap) || gap < 0 || gap > 180) {
      this.settingsFormError.set(
        'Gom nhóm (FEED_GROUP_GAP_MINUTES): từ 0 (tắt) đến 180 phút.'
      );
      return;
    }
    if (!Number.isFinite(notify) || notify < 1 || notify > 180) {
      this.settingsFormError.set(
        'Thông báo sắp bú (FEEDING_NOTIFICATION_MINUTES): từ 1 đến 180 phút.'
      );
      return;
    }
    if (!Number.isFinite(burp) || burp < 1 || burp > 30) {
      this.settingsFormError.set(
        'Thời gian vỗ ợ (BURP_DURATION_MINUTES): từ 1 đến 30 phút.'
      );
      return;
    }
    if (!Number.isFinite(evDays) || evDays < 0 || evDays > 30) {
      this.settingsFormError.set(
        'Nhắc lịch — ngày (EVENT_REMINDER_DAYS): từ 0 đến 30.'
      );
      return;
    }
    if (!Number.isFinite(evHours) || evHours < 0 || evHours > 168) {
      this.settingsFormError.set(
        'Nhắc lịch — giờ (EVENT_REMINDER_HOURS): từ 0 đến 168.'
      );
      return;
    }
    if (!Number.isFinite(actLog) || actLog < 1 || actLog > 60) {
      this.settingsFormError.set('Tự động làm mới nhật ký: từ 1 đến 60 phút.');
      return;
    }
    this.settingsSaving.set(true);
    this.settingsFormError.set('');
    this.syncErrorChange.emit('');
    this.feedingLogService
      .saveFeedingSettings(
        [
          {
            id: FEEDING_SETTING_ID.FEED_TIME_WARNING,
            value: th,
            name: 'Ngưỡng cảnh báo khoảng cách cữ (giờ)',
            unit: 'giờ',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.FEED_WARNING_AMOUNT,
            value: wm,
            name: 'Ngưỡng ml cữ thấp (FEED_WARNING_AMOUNT)',
            unit: 'ml',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.FEED_GROUP_GAP_MINUTES,
            value: gap,
            name: 'Thời gian tối đa gom nhóm cữ (phút)',
            unit: 'phút',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.FEEDING_NOTIFICATION_MINUTES,
            value: notify,
            name: 'Thông báo sắp bú trước (phút)',
            unit: 'phút',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.BURP_DURATION_MINUTES,
            value: burp,
            name: 'Thời gian vỗ ợ sau cữ bú (phút)',
            unit: 'phút',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.EVENT_REMINDER_DAYS,
            value: evDays,
            name: 'Nhắc sự kiện lịch trước (ngày)',
            unit: 'ngày',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.EVENT_REMINDER_HOURS,
            value: evHours,
            name: 'Nhắc sự kiện lịch thêm (giờ)',
            unit: 'giờ',
            dataType: 'Số',
          },
          {
            id: FEEDING_SETTING_ID.ACTIVITY_LOG_REFRESH_MINUTES,
            value: actLog,
            name: 'Tự động làm mới nhật ký (phút)',
            unit: 'phút',
            dataType: 'Số',
          },
        ],
        { user: this.user() }
      )
      .pipe(finalize(() => this.settingsSaving.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp && resp.success === false) {
            this.settingsFormError.set(
              resp.error ||
                'Lưu thất bại. Cập nhật Apps Script (action updateFeedingSettings) theo docs/feeding/FEEDING_SETUP.md.'
            );
            return;
          }
          this.settingsFormError.set('');
          const resolved: FeedingSettingsResolved = {
            feedTimeWarningHours: th,
            feedWarningMl: wm,
            feedGroupGapMinutes: gap,
            feedingNotificationMinutes: notify,
            burpDurationMinutes: burp,
            eventReminderDays: evDays,
            eventReminderHours: evHours,
            activityLogRefreshMinutes: actLog,
          };
          this.settingsChanged.emit(resolved);
          this.settingsSuccess.set('Đã lưu cài đặt thành công!');
          this.activityLogService
            .logSettings(this.user(), 'Cài đặt ứng dụng')
            .subscribe({ error: () => {} });
          setTimeout(() => {
            this.closeFeedingSettingsDialog();
            this.settingsSuccess.set('');
          }, 1500);
        },
        error: (err) => {
          console.error('Settings save error:', err);
          this.settingsFormError.set(
            err?.message || 'Lưu thất bại. Kiểm tra cấu hình Apps Script.'
          );
        },
      });
  }

  loadMoreHistoryFeeds(): void {
    this.historyFeedDisplayLimit.update((n) => n + 100);
  }

  onHistoryBodyScroll(event: Event): void {
    if (!this.historyHasMoreFeeds()) return;
    const el = event.target as HTMLElement;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    if (!nearBottom) return;
    const t = Date.now();
    if (t - this.lastHistoryInfiniteScrollAt < 450) return;
    this.lastHistoryInfiniteScrollAt = t;
    this.loadMoreHistoryFeeds();
  }

  // —— View helpers (also used in history / detail dialogs) ——

  viewGroupKey(g: FeedingViewGroup): string {
    return g.members.map((m) => this.logRowKey(m)).join('>');
  }

  logRowKey(l: FeedingLog): string {
    return l.rowIndex != null ? `r${l.rowIndex}` : `${l.date}|${l.time}`;
  }

  logTimestamp(l: FeedingLog): number {
    const [y, m, d] = (l.date || '').split('-').map(Number);
    const [hh, mm] = (l.time || '').split(':').map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return 0;
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }

  viewGroupDisplayTime(g: FeedingViewGroup): string {
    const sum = g.members.reduce((s, m) => s + this.logTimestamp(m), 0);
    const avg = Math.round(sum / g.members.length);
    return this.toTimeStr(new Date(avg));
  }

  viewGroupDisplayVolume(g: FeedingViewGroup): number {
    return g.members.reduce((s, m) => s + (m.volume || 0), 0);
  }

  viewGroupNote(g: FeedingViewGroup): string {
    const parts = g.members
      .map((m) => (m.note || '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : '';
  }

  formatIntervalFromPrevViewGroup(
    g: FeedingViewGroup,
    listDesc: FeedingViewGroup[]
  ): string {
    const idx = listDesc.findIndex(
      (x) => this.viewGroupKey(x) === this.viewGroupKey(g)
    );
    let prev: FeedingLog | undefined;
    if (idx >= 0 && idx < listDesc.length - 1) {
      const older = listDesc[idx + 1];
      prev = older.members[older.members.length - 1];
    } else {
      prev = this.globalPrevLogBefore(g);
    }
    if (!prev) return '';
    const diffMs =
      this.logTimestamp(g.members[0]) - this.logTimestamp(prev);
    const diff = Math.round(diffMs / 60000);
    if (diff <= 0) return '';
    const hh = Math.floor(diff / 60);
    const mm = diff % 60;
    if (hh === 0) return `${mm}p`;
    if (mm === 0) return `${hh}h`;
    return `${hh}h${mm.toString().padStart(2, '0')}p`;
  }

  isFeedTimeGapWarningViewGroup(
    g: FeedingViewGroup,
    listDesc: FeedingViewGroup[]
  ): boolean {
    const idx = listDesc.findIndex(
      (x) => this.viewGroupKey(x) === this.viewGroupKey(g)
    );
    let prev: FeedingLog | undefined;
    if (idx >= 0 && idx < listDesc.length - 1) {
      const older = listDesc[idx + 1];
      prev = older.members[older.members.length - 1];
    } else {
      prev = this.globalPrevLogBefore(g);
    }
    if (!prev) return false;
    const diffMs =
      this.logTimestamp(g.members[0]) - this.logTimestamp(prev);
    const hours = diffMs / (1000 * 60 * 60);
    return hours >= this.feedingSettings().feedTimeWarningHours;
  }

  formatIntervalFromPrev(current: FeedingLog, listDesc: FeedingLog[]): string {
    let prev: FeedingLog | undefined;
    const idx = listDesc.findIndex(
      (l) => l.time === current.time && l.rowIndex === current.rowIndex
    );
    if (idx >= 0 && idx < listDesc.length - 1) {
      prev = listDesc[idx + 1];
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

  isFeedTimeGapWarning(current: FeedingLog, listDesc: FeedingLog[]): boolean {
    let prev: FeedingLog | undefined;
    const idx = listDesc.findIndex(
      (l) => l.time === current.time && l.rowIndex === current.rowIndex
    );
    if (idx >= 0 && idx < listDesc.length - 1) {
      prev = listDesc[idx + 1];
    }
    if (!prev) return false;
    const diffMs = this.logTimestamp(current) - this.logTimestamp(prev);
    const hours = diffMs / (1000 * 60 * 60);
    return hours >= this.feedingSettings().feedTimeWarningHours;
  }

  isLowVolume(volume: number): boolean {
    const max = this.feedingSettings().feedWarningMl;
    return volume > 0 && volume < max;
  }

  isHighVolume(volume: number): boolean {
    return volume > 200;
  }

  isLowVolumeViewGroup(g: FeedingViewGroup): boolean {
    return g.members.some((m) => this.isLowVolume(m.volume));
  }

  isHighVolumeViewGroup(g: FeedingViewGroup): boolean {
    const sum = this.viewGroupDisplayVolume(g);
    return sum > 200 || g.members.some((m) => this.isHighVolume(m.volume));
  }

  feedDetailStatusLabel(status: FeedDetailView['volumeStatus']): string {
    if (status === 'low') return 'Dung tích thấp';
    if (status === 'high') return 'Dung tích cao';
    return 'Trong ngưỡng';
  }

  feedDetailStatusIcon(status: FeedDetailView['volumeStatus']): string {
    if (status === 'low') return 'pi-exclamation-triangle';
    if (status === 'high') return 'pi-arrow-up';
    return 'pi-check-circle';
  }

  formatBottleAt(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return this.toTimeStr(d);
  }

  bottlePrepUseByMax(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const plus = new Date(d.getTime() + 60 * 60 * 1000);
    return this.toTimeStr(plus);
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

  todayDateStr(): string {
    return this.toDateStr(this.now());
  }

  yesterdayDateStr(): string {
    const d = new Date(this.now());
    d.setDate(d.getDate() - 1);
    return this.toDateStr(d);
  }

  private openFeedDetail(log: FeedingLog): void {
    this.closeFeedGroupDetail();
    this.feedDetailView.set(this.buildFeedDetailView(log));
  }

  private resetRemaining(): void {
    this.remainingInput.set('');
  }

  private globalPrevLogBefore(group: FeedingViewGroup): FeedingLog | undefined {
    const curTs = this.logTimestamp(group.members[0]);
    const memberKey = new Set(group.members.map((m) => this.logRowKey(m)));
    const all = this.logs();
    let best: FeedingLog | undefined;
    let bestTs = -Infinity;
    for (const l of all) {
      if (memberKey.has(this.logRowKey(l))) continue;
      const t = this.logTimestamp(l);
      if (t < curTs && t > bestTs) {
        bestTs = t;
        best = l;
      }
    }
    return best;
  }

  private buildFeedDetailView(log: FeedingLog): FeedDetailView {
    const warnHours = this.feedingSettings().feedTimeWarningHours;
    const gap = this.feedingSettings().feedGroupGapMinutes;
    const all = this.logs();
    const dayLogs: FeedingLog[] = [];
    for (const l of all) {
      if (l.date === log.date) dayLogs.push(l);
    }
    dayLogs.sort((a, b) => a.time.localeCompare(b.time));

    const allGroups = groupLogsByProximity(all, gap, (l) => this.logTimestamp(l));
    const dayGroups = groupLogsByProximity(dayLogs, gap, (l) =>
      this.logTimestamp(l)
    );
    const currentGroup = this.findViewGroupForLog(log, allGroups);
    const currentDayGroup = this.findViewGroupForLog(log, dayGroups);

    const curTs = this.logTimestamp(log);
    const effectiveTs = currentGroup
      ? this.viewGroupEndTs(currentGroup)
      : curTs;
    const currentVol = currentGroup
      ? this.viewGroupDisplayVolume(currentGroup)
      : log.volume;

    const upToDayGroupsDesc = dayGroups.filter(
      (g) => this.viewGroupEndTs(g) <= effectiveTs
    );
    const upToDayGroupsAsc = [...upToDayGroupsDesc].reverse();
    const dayToPoint = this.statsFromViewGroups(log.date, upToDayGroupsAsc);
    const dayFull =
      log.date === this.todayDateStr()
        ? dayToPoint
        : this.statsFromViewGroups(log.date, [...dayGroups].reverse());

    const compares: FeedDetailCompareRow[] = [];

    if (currentGroup) {
      const gi = allGroups.findIndex((g) => g === currentGroup);
      const prevGroup = gi >= 0 ? allGroups[gi + 1] : undefined;
      if (prevGroup) {
        const prevTs = this.viewGroupEndTs(prevGroup);
        const diffMs = effectiveTs - prevTs;
        const gapMin = Math.round(diffMs / 60000);
        const gapWarn = diffMs / (1000 * 60 * 60) >= warnHours;
        const gapText = this.formatGapMinutes(gapMin);
        const prevVol = this.viewGroupDisplayVolume(prevGroup);
        const volDiff = currentVol - prevVol;
        const prevAnchor = prevGroup.members.reduce((a, b) =>
          this.logTimestamp(a) >= this.logTimestamp(b) ? a : b
        );
        compares.push({
          label: 'So với cữ trước',
          text: `${this.viewGroupDisplayTime(prevGroup)} · ${prevVol}ml — cách ${gapText}`,
          warn: gapWarn,
          icon: 'pi-history',
          kind: 'gap',
          gapPrev: {
            prevTime: this.viewGroupDisplayTime(prevGroup),
            prevVolume: prevVol,
            ...(prevAnchor.date !== log.date ? { prevDateIso: prevAnchor.date } : {}),
            gapLabel: gapText,
            volDiffMl: volDiff,
          },
        });
      }
    }

    if (currentDayGroup && upToDayGroupsAsc.length > 0) {
      const idx =
        upToDayGroupsAsc.findIndex((g) => g === currentDayGroup) + 1;
      const totalSoFar = upToDayGroupsAsc.reduce(
        (s, g) => s + this.viewGroupDisplayVolume(g),
        0
      );
      const dayLabel =
        log.date === this.todayDateStr() ? 'hôm nay (tới lúc này)' : 'trong ngày';
      const dayTotal = dayFull.total || totalSoFar;
      compares.push({
        label: 'Vị trí trong ngày',
        text: `Cữ thứ ${idx}/${dayFull.count || upToDayGroupsAsc.length} ${dayLabel} · đã ${totalSoFar}ml`,
        icon: 'pi-th-large',
        kind: 'position',
        position: {
          index: idx,
          total: dayFull.count || upToDayGroupsAsc.length,
          totalMl: totalSoFar,
          dayTotalMl: dayTotal,
          dayLabel,
        },
      });
    }

    if (dayToPoint.count >= 1 && dayToPoint.avg > 0) {
      const ref =
        dayToPoint.count >= 3 ? dayToPoint.typicalFeedMl : dayToPoint.avg;
      const diffRef = currentVol - ref;
      const refLabel = dayToPoint.count >= 3 ? 'TB điển hình' : 'TB';
      const diffPart =
        diffRef === 0
          ? `bằng ${ref}ml/cữ`
          : `${diffRef > 0 ? '+' : ''}${diffRef}ml so với ${ref}ml/cữ`;
      compares.push({
        label: `So với ${refLabel} ngày`,
        text: `${diffPart} (${refLabel} ${dayToPoint.count} cữ)`,
        icon: 'pi-chart-line',
        kind: 'average',
        average: {
          refMl: ref,
          diffMl: diffRef,
          refLabel,
          feedCount: dayToPoint.count,
        },
      });
    }

    let nextDayGroup: FeedingViewGroup | undefined;
    let nextStart = Infinity;
    for (const g of dayGroups) {
      if (g === currentDayGroup) continue;
      const st = this.viewGroupStartTs(g);
      if (st > effectiveTs && st < nextStart) {
        nextStart = st;
        nextDayGroup = g;
      }
    }
    if (nextDayGroup) {
      const untilNext = Math.round((nextStart - effectiveTs) / 60000);
      const nextVol = this.viewGroupDisplayVolume(nextDayGroup);
      compares.push({
        label: 'Cữ tiếp theo trong ngày',
        text: `${this.viewGroupDisplayTime(nextDayGroup)} · ${nextVol}ml (sau ${this.formatGapMinutes(untilNext)})`,
        icon: 'pi-arrow-right',
        kind: 'next',
        next: {
          time: this.viewGroupDisplayTime(nextDayGroup),
          volume: nextVol,
          gapLabel: this.formatGapMinutes(untilNext),
        },
      });
    }

    const diffMsAge = this.now().getTime() - curTs;
    let ageLabel = '';
    if (diffMsAge < 0) {
      ageLabel = 'Sắp tới';
    } else {
      const diff = Math.round(diffMsAge / 60000);
      if (diff < 60) ageLabel = `Cách đây ${diff} phút`;
      else {
        const hh = Math.floor(diff / 60);
        const mm = diff % 60;
        ageLabel =
          mm === 0 ? `Cách đây ${hh} giờ` : `Cách đây ${hh} giờ ${mm} phút`;
      }
    }

    const volumeStatus: FeedDetailView['volumeStatus'] = this.isLowVolume(
      log.volume
    )
      ? 'low'
      : this.isHighVolume(log.volume)
        ? 'high'
        : 'ok';

    return {
      log,
      ageLabel,
      volumeStatus,
      compares,
      note: log.note?.trim() || '',
    };
  }

  private findViewGroupForLog(
    log: FeedingLog,
    groups: FeedingViewGroup[]
  ): FeedingViewGroup | undefined {
    const key = this.logRowKey(log);
    return groups.find((g) =>
      g.members.some((m) => this.logRowKey(m) === key)
    );
  }

  private viewGroupEndTs(g: FeedingViewGroup): number {
    return Math.max(...g.members.map((m) => this.logTimestamp(m)));
  }

  private viewGroupStartTs(g: FeedingViewGroup): number {
    return Math.min(...g.members.map((m) => this.logTimestamp(m)));
  }

  private pseudoLogsFromViewGroups(groups: FeedingViewGroup[]): FeedingLog[] {
    return groups.map((g) => {
      const anchor = g.members.reduce((a, b) =>
        this.logTimestamp(a) >= this.logTimestamp(b) ? a : b
      );
      return { ...anchor, volume: this.viewGroupDisplayVolume(g) };
    });
  }

  private statsFromViewGroups(
    date: string,
    groups: FeedingViewGroup[]
  ): DayStatsFull {
    return this.statsFromList(date, this.pseudoLogsFromViewGroups(groups));
  }

  private statsFromList(date: string, list: FeedingLog[]): DayStatsFull {
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

  private formatGapMinutes(diffMin: number): string {
    if (diffMin <= 0) return '0 phút';
    const hh = Math.floor(diffMin / 60);
    const mm = diffMin % 60;
    if (hh === 0) return `${mm} phút`;
    if (mm === 0) return `${hh} giờ`;
    return `${hh} giờ ${mm} phút`;
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
}
