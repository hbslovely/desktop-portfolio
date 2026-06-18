import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { finalize, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import {
  BottlePrepFromSheet,
  FeedingLog,
  FeedingLogService,
  FeedingSettingsResolved,
  parseFeedingSettingsFromRows,
} from '../../services/feeding-log.service';
import { WeightLogService } from '../../services/weight-log.service';
import { EventLogService } from '../../services/event-log.service';
import { predictNextFeeding } from './feeding-prediction';
import { getNutritionTarget, NutritionTarget } from './feeding-nutrition';
import { FeedingNutritionComponent } from './nutrition/feeding-nutrition.component';
import { DocumentsComponent } from './documents/documents.component';
import { FeedingMomComponent } from './mom/feeding-mom.component';
import { FeedingChartsComponent } from './charts/feeding-charts.component';
import { FeedingProfileComponent } from './profile/feeding-profile.component';
import { FeedingDialogsComponent } from './dialogs/feeding-dialogs.component';
import { FeedingDailyComponent } from './daily/feeding-daily.component';
import { MedicalHistoryComponent } from './medical-history/medical-history.component';
import { WeightComponent } from './weight/weight.component';
import { FeedingScheduleComponent } from './schedule/feeding-schedule.component';
import { groupLogsByProximity } from './feeding-view-group';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import {
  ActivityLogService,
  formatLogContent,
  ACTIVITY_EVENT,
} from '../../services/activity-log.service';
import { NotificationLog, NotificationLogService } from '../../services/notification-log.service';
import { APP_INFO_TOKEN } from '../../app-info';
import { environment } from '../../../environments/environment';

interface Profile {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
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
const INITIAL_NOTIFICATION_VISIBLE = 2;

@Component({
  selector: 'app-feeding',
  standalone: true,
  imports: [
    CommonModule,
    DocumentsComponent,
    MedicalHistoryComponent,
    WeightComponent,
    ActivityLogComponent,
    FeedingScheduleComponent,
    FeedingMomComponent,
    FeedingChartsComponent,
    FeedingNutritionComponent,
    FeedingProfileComponent,
    FeedingDialogsComponent,
    FeedingDailyComponent,
  ],
  templateUrl: './feeding.component.html',
  styleUrls: ['./feeding.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingComponent {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private feedingLogService = inject(FeedingLogService);
  private weightLogService = inject(WeightLogService);
  private activityLogService = inject(ActivityLogService);
  private eventLogService = inject(EventLogService);
  private notificationLogService = inject(NotificationLogService);
  readonly appInfo = inject(APP_INFO_TOKEN);

  /** Controlled by NG_APP_ENABLE_EXPLORER env var. When false, the Documents
   *  tab is hidden and no Drive/Apps Script calls are made. */
  readonly explorerEnabled = environment.enableExplorer;

  aboutDialogOpen = signal(false);

  /** Vùng cuộn thật của trang (`.feeding-page`), không phải `document`. */
  @ViewChild('feedingPage', { static: true })
  private feedingPageRef?: ElementRef<HTMLElement>;

  Math = Math;

  /** Tab nav phía dưới: feeding | weight | schedule | mom | medical | documents. */
  bottomTab = signal<'feeding' | 'weight' | 'schedule' | 'mom' | 'medical' | 'documents'>(
    'feeding'
  );

  readonly navTabs = computed(() => [
    { id: 'feeding' as const, icon: 'pi-heart-fill', label: 'Cữ bú' },
    { id: 'weight' as const, icon: 'pi-chart-line', label: 'Thể trạng' },
    { id: 'schedule' as const, icon: 'pi-calendar', label: 'Lịch' },
    { id: 'mom' as const, icon: 'pi-sun', label: 'Mẹ' },
    { id: 'medical' as const, icon: 'pi-book', label: 'Y tế' },
    ...(this.explorerEnabled
      ? [{ id: 'documents' as const, icon: 'pi-folder', label: 'Tài liệu' }]
      : []),
  ]);

  readonly activeTabIndex = computed(() =>
    this.navTabs().findIndex((t) => t.id === this.bottomTab())
  );

  setBottomTab(tab: 'feeding' | 'weight' | 'schedule' | 'mom' | 'medical' | 'documents') {
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
  syncError = signal<string>('');
  lastContentLoadTime = signal<Date | null>(null);
  syncMessage = signal<string>('');

  /** Đồng bộ từ `app-feeding-dialogs` — ẩn toast lỗi khi dialog log đang mở. */
  logDialogOpen = signal<boolean>(false);

  /** Bumped on `refreshAll()` so daily reloads bottle prep. */
  dailyRefreshToken = signal(0);

  /** Đọc từ tab Sheet `Settings` — key theo `FEEDING_SETTING_ID`. */
  feedingSettings = signal<FeedingSettingsResolved>(
    parseFeedingSettingsFromRows([]) // This will use DEFAULT_FEEDING_SETTINGS as fallback
  );

  /** Nhắc sự kiện lịch (toàn cục) — trong cửa sổ Settings + sheet Event */
  eventReminderDialogOpen = signal(false);
  eventReminderAckSaving = signal(false);
  /** Đã bấm «Đã hiểu» — chỉ ẩn đến khi tải lại trang (F5 mở lại dialog). */
  private eventReminderSessionDismissed = signal(false);
  /** Đã hiện/đóng dialog trong phiên tải trang — tránh mở lại khi `now` tick. */
  private eventReminderHandledThisLoad = signal(false);
  /** Synced from daily + dialogs (log calc). */
  bottlePrep = signal<BottlePrepFromSheet | null>(null);
  notificationDraft = signal('');
  notificationSaving = signal(false);
  notificationListDialogOpen = signal(false);
  notificationError = signal('');
  notificationComposerDialogOpen = signal(false);

  /** Ngày đang xem trên card lịch sử (mặc định: hôm qua). */
  ageInDays = computed<number | null>(() => {
    const p = this.profile();
    if (!p?.birthDate) return null;
    const birth = new Date(p.birthDate);
    if (isNaN(birth.getTime())) return null;
    const diffMs = this.now().getTime() - birth.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  });

  /**
   * Sự kiện trong cửa sổ nhắc: từ (now) đã vào khoảng [T - lead, T), chưa Acknowledge, T > now.
   */
  scheduleReminderEvents = computed(() => {
    const s = this.feedingSettings();
    const leadMs = (s.eventReminderDays * 24 + s.eventReminderHours) * 3600 * 1000;
    const nowMs = this.now().getTime();
    return this.eventLogService.events().filter((e) => {
      if (e.acknowledged) return false;
      const dt = EventLogService.eventDateTime(e)?.getTime();
      if (dt === undefined || dt === null || Number.isNaN(dt)) return false;
      if (dt <= nowMs) return false;
      const windowStart = dt - leadMs;
      return nowMs >= windowStart;
    });
  });

  visibleNotifications = computed<NotificationLog[]>(() => {
    const currentUser = this.user().trim().toLowerCase();
    if (!currentUser) return [];
    return this.notificationLogService
      .notifications()
      .filter((item) => !item.acknowledgeUsers.includes(currentUser));
  });

  displayedNotifications = computed<NotificationLog[]>(() => {
    return this.visibleNotifications().slice(0, INITIAL_NOTIFICATION_VISIBLE);
  });

  hiddenNotificationCount = computed<number>(() => {
    const hidden = this.visibleNotifications().length - this.displayedNotifications().length;
    return hidden > 0 ? hidden : 0;
  });

  /** Hero gộp tóm tắt profile (bỏ card overview riêng). */
  profileHeroWeightLabel = computed(() => {
    const s = this.formatSheetWeightKg(this.latestWeightKgFromSheet());
    return s ? `${s} kg` : null;
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

  // ===== Stats =====
  todayStats = computed<DayStats>(() => this.computeDayStats(this.todayDateStr()));
  yesterdayStats = computed<DayStats>(() => this.computeDayStats(this.yesterdayDateStr()));

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

  // ===== ML prediction =====
  prediction = computed(() => predictNextFeeding(this.logs(), this.now()));

  /** Cữ bú gần nhất (toàn bộ lịch sử, không chỉ hôm nay) */
  // ===== Nutrition target & evaluation (weight + age based) =====
  nutritionTarget = computed<NutritionTarget | null>(() => {
    const w = this.latestWeightKgFromSheet();
    const days = this.ageInDays();
    if (w === undefined || w <= 0 || days === null) return null;
    return getNutritionTarget(w, days);
  });

  lastActivityTime = computed(() => {
    const date = this.lastContentLoadTime();
    if (!date) return 'đang tải...';
    const now = this.now();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return 'vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `lúc ${h}:${m}`;
  });

  constructor() {
    try {
      localStorage.removeItem('feeding:bottle-prep');
    } catch {
      /* ignore */
    }

    // Load settings immediately with default values
    this.loadFeedingSettings();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      const user = (qp.get('user') || 'guest').toLowerCase().trim() || 'guest';
      this.user.set(user);
      this.loadProfile(user);
      this.loadLogs();
      this.loadFeedingSettings(); // Load again with user context
      this.loadWeightLogs();
      this.loadScheduleEvents();
      this.loadNotifications();
    });

    const clockId = window.setInterval(() => this.now.set(new Date()), 60_000);
    this.destroyRef.onDestroy(() => window.clearInterval(clockId));

    effect(
      () => {
        this.eventLogService.events();
        this.eventLogService.loading();
        this.feedingSettings();
        this.tryOpenEventReminderAfterLoad();
      },
      { allowSignalWrites: true }
    );
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
          gender: g === 'boy' || g === 'girl' || g === '' ? (g as Profile['gender']) : '',
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

  /** Đóng menu bánh răng trên hero merged (dùng sau khi chọn mục). */
  closeProfileActionsMenu(menu: HTMLDetailsElement): void {
    menu.removeAttribute('open');
  }

  openAboutDialog(): void {
    this.aboutDialogOpen.set(true);
  }

  closeAboutDialog(): void {
    this.aboutDialogOpen.set(false);
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
        this.lastContentLoadTime.set(new Date());
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

  /** Đọc tab Google Sheet `Settings` (cột A = ID) và áp dụng vào UI. */
  loadFeedingSettings(): void {
    this.feedingLogService.getFeedingSettings().subscribe({
      next: (rows) => {
        const settings = parseFeedingSettingsFromRows(rows);
        this.feedingSettings.set(settings);
        // Update activity log refresh interval
        this.activityLogService.setRefreshInterval(settings.activityLogRefreshMinutes);
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  onFeedingLogsChanged(): void {
    setTimeout(() => this.loadLogs(), 900);
  }

  onFeedingSettingsChanged(s: FeedingSettingsResolved): void {
    this.feedingSettings.set(s);
    this.activityLogService.setRefreshInterval(s.activityLogRefreshMinutes);
    setTimeout(() => this.loadFeedingSettings(), 600);
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

  loadScheduleEvents(options?: { checkReminder?: boolean }): void {
    const checkReminder = options?.checkReminder ?? true;
    this.eventLogService.loadEvents().subscribe({
      next: () => {
        if (checkReminder) {
          this.tryOpenEventReminderAfterLoad({ markHandledIfEmpty: true });
        }
      },
      error: () => {
        /* Sheet/Event có thể chưa tồn tại — không chặn app */
      },
    });
  }

  loadNotifications(): void {
    this.notificationError.set('');
    this.notificationLogService.loadNotifications().subscribe({
      next: () => {},
      error: () => {
        this.notificationError.set(
          'Không tải được tab Notification. Kiểm tra tên tab và quyền truy cập.'
        );
      },
    });
  }

  updateNotificationDraft(value: string): void {
    this.notificationDraft.set(value);
  }

  openNotificationComposerDialog(): void {
    this.notificationError.set('');
    this.notificationComposerDialogOpen.set(true);
  }

  closeNotificationComposerDialog(): void {
    if (this.notificationSaving()) return;
    this.notificationComposerDialogOpen.set(false);
  }

  openNotificationListDialog(): void {
    this.notificationListDialogOpen.set(true);
  }

  closeNotificationListDialog(): void {
    if (this.notificationSaving()) return;
    this.notificationListDialogOpen.set(false);
  }

  createNotification(): void {
    const content = this.notificationDraft().trim();
    if (!content || this.notificationSaving()) return;

    this.notificationSaving.set(true);
    this.notificationError.set('');
    const actor = this.user().trim().toLowerCase() || 'guest';

    this.notificationLogService
      .addNotification({ user: actor, content })
      .pipe(finalize(() => this.notificationSaving.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success === false) {
            this.notificationError.set(res.error || 'Tạo thông báo thất bại.');
            return;
          }
          this.notificationDraft.set('');
          this.logNotificationAction('create', content);
          this.notificationComposerDialogOpen.set(false);
          this.loadNotifications();
        },
        error: () => {
          this.notificationError.set('Tạo thông báo thất bại. Vui lòng thử lại.');
        },
      });
  }

  acknowledgeNotification(item: NotificationLog): void {
    if (!item.rowIndex || this.notificationSaving()) return;
    const actor = this.user().trim().toLowerCase() || 'guest';
    const previous = this.notificationLogService.notifications();

    // Optimistic UI: ẩn thông báo ngay khi user bấm acknowledge.
    this.notificationLogService.notifications.update((rows) =>
      rows.map((row) => {
        if (row.rowIndex !== item.rowIndex) return row;
        if (row.acknowledgeUsers.includes(actor)) return row;
        return { ...row, acknowledgeUsers: [...row.acknowledgeUsers, actor] };
      })
    );

    this.notificationSaving.set(true);
    this.notificationError.set('');
    this.notificationLogService
      .acknowledgeNotification(item.rowIndex, actor)
      .pipe(finalize(() => this.notificationSaving.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success === false) {
            this.notificationLogService.notifications.set(previous);
            this.notificationError.set(res.error || 'Không thể xác nhận đã đọc thông báo.');
            return;
          }
          this.logNotificationAction('ack', item.content, item.user);
          this.loadNotifications();
        },
        error: () => {
          this.notificationLogService.notifications.set(previous);
          this.notificationError.set('Không thể xác nhận đã đọc thông báo.');
        },
      });
  }

  deleteNotification(item: NotificationLog): void {
    if (!item.rowIndex || !this.canDeleteNotification(item) || this.notificationSaving()) return;
    if (!confirm('Bạn có chắc muốn xóa thông báo này?')) return;

    const actor = this.user().trim().toLowerCase() || 'guest';
    this.notificationSaving.set(true);
    this.notificationError.set('');

    this.notificationLogService
      .deleteNotification(item.rowIndex, actor)
      .pipe(finalize(() => this.notificationSaving.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success === false) {
            this.notificationError.set(
              res.error || 'Chỉ người tạo thông báo mới được phép xóa thông báo.'
            );
            return;
          }
          this.logNotificationAction('delete', item.content, item.user);
          this.loadNotifications();
        },
        error: () => {
          this.notificationError.set('Xóa thông báo thất bại.');
        },
      });
  }

  canDeleteNotification(item: NotificationLog): boolean {
    return item.user === (this.user().trim().toLowerCase() || 'guest');
  }

  acknowledgeAllNotifications(): void {
    const actor = this.user().trim().toLowerCase() || 'guest';
    const rows = this.visibleNotifications().filter((item) => !!item.rowIndex);
    if (rows.length === 0 || this.notificationSaving()) return;

    const previous = this.notificationLogService.notifications();
    this.notificationError.set('');
    this.notificationSaving.set(true);

    // Optimistic UI: ẩn toàn bộ thông báo ngay khi user bấm "đã đọc tất cả".
    this.notificationLogService.notifications.update((allRows) =>
      allRows.map((row) => {
        if (!row.rowIndex) return row;
        const target = rows.find((item) => item.rowIndex === row.rowIndex);
        if (!target) return row;
        if (row.acknowledgeUsers.includes(actor)) return row;
        return { ...row, acknowledgeUsers: [...row.acknowledgeUsers, actor] };
      })
    );

    forkJoin(
      rows.map((item) =>
        this.notificationLogService
          .acknowledgeNotification(item.rowIndex as number, actor)
          .pipe(catchError(() => of({ success: false })))
      )
    )
      .pipe(finalize(() => this.notificationSaving.set(false)))
      .subscribe((results) => {
        const hasFailed = results.some((res) => res.success === false);
        if (hasFailed) {
          this.notificationLogService.notifications.set(previous);
          this.notificationError.set('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.');
          return;
        }

        rows.forEach((item) => this.logNotificationAction('ack', item.content, item.user));
        this.loadNotifications();
      });
  }

  formatNotificationCreatedAt(value?: string): string {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('vi-VN', {
      hour12: false,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private logNotificationAction(
    action: 'create' | 'ack' | 'delete',
    content: string,
    owner?: string
  ): void {
    const actor = this.user().trim().toLowerCase() || 'guest';
    if (!content) return;

    let eventType: (typeof ACTIVITY_EVENT)[keyof typeof ACTIVITY_EVENT] =
      ACTIVITY_EVENT.NOTIFICATION_CREATED;
    if (action === 'ack') eventType = ACTIVITY_EVENT.NOTIFICATION_ACKNOWLEDGED;
    if (action === 'delete') eventType = ACTIVITY_EVENT.NOTIFICATION_DELETED;

    const message = formatLogContent(eventType, { content, owner });
    this.activityLogService
      .addLog({
        user: actor,
        eventType,
        content: message,
      })
      .subscribe();
  }

  /** Giống F5 — cho phép kiểm tra và mở lại dialog nhắc sự kiện. */
  private resetEventReminderSessionForReload(): void {
    this.eventReminderHandledThisLoad.set(false);
    this.eventReminderSessionDismissed.set(false);
    this.eventReminderDialogOpen.set(false);
  }

  private tryOpenEventReminderAfterLoad(options?: { markHandledIfEmpty?: boolean }): void {
    if (this.eventReminderHandledThisLoad()) return;
    if (this.eventReminderSessionDismissed()) return;
    if (this.eventLogService.loading()) return;

    const pending = this.scheduleReminderEvents();
    if (pending.length > 0) {
      this.eventReminderHandledThisLoad.set(true);
      this.eventReminderDialogOpen.set(true);
      return;
    }

    if (options?.markHandledIfEmpty) {
      this.eventReminderHandledThisLoad.set(true);
    }
  }

  closeEventReminderDialog(): void {
    this.eventReminderDialogOpen.set(false);
    this.eventReminderHandledThisLoad.set(true);
  }

  skipEventReminderSession(): void {
    this.eventReminderSessionDismissed.set(true);
    this.eventReminderHandledThisLoad.set(true);
    this.closeEventReminderDialog();
  }

  acknowledgeEventReminderRow(rowIndex: number): void {
    if (!rowIndex) return;
    this.eventReminderAckSaving.set(true);
    this.eventLogService
      .acknowledgeEvent(rowIndex)
      .pipe(
        catchError(() => of({ success: false })),
        finalize(() => this.eventReminderAckSaving.set(false))
      )
      .subscribe(() => {
        this.eventLogService.loadEvents().subscribe({
          next: () => {
            if (this.scheduleReminderEvents().length === 0) {
              this.closeEventReminderDialog();
            }
          },
        });
      });
  }

  acknowledgeAllEventReminders(): void {
    const rows = this.scheduleReminderEvents()
      .map((e) => e.rowIndex)
      .filter((r): r is number => typeof r === 'number' && r >= 2);

    this.eventReminderHandledThisLoad.set(true);
    this.closeEventReminderDialog();

    if (rows.length === 0) return;

    // 🚀 Acknowledge each event independently - không đợi nhau
    let completedCount = 0;
    const totalCount = rows.length;

    rows.forEach((row) => {
      this.eventLogService
        .acknowledgeEvent(row)
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          completedCount++;

          // Reload events after all completed (hoặc có thể reload ngay sau từng cái)
          if (completedCount === totalCount) {
            this.eventLogService.loadEvents().subscribe();
          }
        });
    });
  }

  formatReminderEventWhen(ev: { date: string; time: string }): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ev.date);
    if (!m) return ev.date;

    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    const hour = this.parseReminderHour(ev.time);
    const period = this.reminderTimePeriod(hour);

    const now = new Date();
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startEv = new Date(y, mo - 1, d);
    const diff = Math.round((startEv.getTime() - startNow.getTime()) / 86_400_000);

    if (diff === 0) {
      if (period === 'sáng') return 'Sáng nay';
      if (period === 'trưa') return 'Trưa nay';
      if (period === 'chiều') return 'Chiều nay';
      if (period === 'tối') return 'Tối nay';
      return 'Hôm nay';
    }

    if (diff === 1) {
      if (period === 'sáng') return 'Sáng mai';
      if (period === 'trưa') return 'Trưa mai';
      if (period === 'chiều') return 'Chiều mai';
      if (period === 'tối') return 'Tối mai';
      return 'Ngày mai';
    }

    if (diff === 2) {
      if (period === 'sáng') return 'Sáng mốt';
      if (period === 'trưa') return 'Trưa mốt';
      if (period === 'chiều') return 'Chiều mốt';
      if (period === 'tối') return 'Tối mốt';
      return 'Ngày mốt';
    }

    if (diff > 2) return `${diff} ngày nữa`;

    return `ngày ${d} tháng ${mo} năm ${y}`;
  }

  formatReminderEventTime(time: string): string {
    return time;
  }

  private parseReminderHour(time: string): number {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim());
    if (!m) return 12;
    return Math.min(23, Math.max(0, parseInt(m[1], 10)));
  }

  private reminderTimePeriod(hour: number): 'sáng' | 'trưa' | 'chiều' | 'tối' | null {
    if (hour >= 5 && hour < 12) return 'sáng';
    if (hour >= 12 && hour < 13) return 'trưa';
    if (hour >= 13 && hour < 18) return 'chiều';
    if (hour >= 18 && hour < 23) return 'tối';
    return null;
  }

  /** Dialog log calc — clear sheet prep; daily reloads via `dailyRefreshToken`. */
  clearBottlePrep(): void {
    this.bottlePrep.set(null);
    this.feedingLogService.clearBottlePrepOnSheet().subscribe({
      next: () => this.dailyRefreshToken.update((n) => n + 1),
      error: () => this.dailyRefreshToken.update((n) => n + 1),
    });
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
    this.loadFeedingSettings();
    this.loadWeightLogs();
    this.dailyRefreshToken.update((n) => n + 1);
    this.weightCmp?.refresh();
    this.medicalCmp?.refresh();
    this.documentsCmp?.refresh();
    this.resetEventReminderSessionForReload();
    this.loadScheduleEvents({ checkReminder: true });
    this.loadNotifications();
  }

  /** Khi có activity mới từ user khác — reload toàn bộ dữ liệu */
  onActivityChanged() {
    this.refreshAll();
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
      (this.documentsCmp?.loading() ?? false) ||
      (this.eventLogService.loading() ?? false)
  );

  // ===== Helpers =====
  private logTimestamp(l: FeedingLog): number {
    const [y, m, d] = (l.date || '').split('-').map(Number);
    const [hh, mm] = (l.time || '').split(':').map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return 0;
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }

  private dayLogsGroupedStats(date: string, logs: FeedingLog[]): DayStats {
    const gap = this.feedingSettings().feedGroupGapMinutes;
    const groups = groupLogsByProximity(logs, gap, (l) => this.logTimestamp(l));
    const pseudo = groups.map((g) => {
      const anchor = g.members.reduce((a, b) =>
        this.logTimestamp(a) >= this.logTimestamp(b) ? a : b
      );
      const volume = g.members.reduce((s, m) => s + (m.volume || 0), 0);
      return { ...anchor, volume };
    });
    return this.statsFromList(date, pseudo);
  }

  private computeDayStats(date: string): DayStats {
    const logs = this.logs().filter((l) => l.date === date);
    return this.dayLogsGroupedStats(date, logs);
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
    const list = this.logs().filter((l) => l.date === dateStr && l.time <= nowTime);
    return this.dayLogsGroupedStats(dateStr, list);
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

  /** Cân sheet Weight — hiển thị trong hero (cùng logic feeding-profile). */
  formatSheetWeightKg(kg: number | undefined): string {
    if (kg === undefined || !Number.isFinite(kg) || kg <= 0) return '';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);
  }
}
