import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  output,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription, interval } from 'rxjs';
import {
  ActivityLogService,
  ActivityLogRow,
  buildActivityLogMessageHtml,
  getEventTypeLabel,
  getEventTypeIcon,
  getEventTypeColor,
} from '../../../services/activity-log.service';

type SortOrder = 'desc' | 'asc';
type FilterCategory = 'all' | 'feeding' | 'weight' | 'medical' | 'schedule' | 'document' | 'settings';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityLogComponent implements OnInit, OnDestroy {
  private activityLogService = inject(ActivityLogService);
  private sanitizer = inject(DomSanitizer);
  private checkSub?: Subscription;

  /** Emit when new activity detected - parent can reload data */
  activityChanged = output<void>();

  dialogOpen = signal(false);
  lastRefreshTime = signal<Date>(new Date());
  private nowTick = signal<number>(Date.now());

  private rawLogs = this.activityLogService.logs$;
  loading = this.activityLogService.loading$;
  unreadCount = this.activityLogService.unreadCount;
  hasNewActivity = this.activityLogService.hasNewActivity$;
  lastReadLogId = this.activityLogService.lastReadLogId$;

  /** Pagination */
  private readonly PAGE_SIZE = 20;
  displayCount = signal(this.PAGE_SIZE);

  /** Sort order */
  sortOrder: SortOrder = 'desc';
  private sortOrderSignal = signal<SortOrder>('desc');

  /** Filter category */
  filterCategory: FilterCategory = 'all';
  private filterCategorySignal = signal<FilterCategory>('all');
  /** Dialog activity: hiển thị giờ chính xác cho toàn bộ list. */
  private activityShowExactTime = signal(false);

  /** Category mapping for filter */
  private readonly categoryPrefixes: Record<FilterCategory, string[]> = {
    all: [],
    feeding: ['FEEDING_', 'BOTTLE_PREP_'],
    weight: ['WEIGHT_'],
    medical: ['MEDICAL_'],
    schedule: ['SCHEDULE_'],
    document: ['FILE_', 'FOLDER_'],
    settings: ['SETTINGS_', 'PROFILE_'],
  };

  /** All logs (sorted) */
  allLogs = computed(() => {
    const logs = [...this.rawLogs()];
    const order = this.sortOrderSignal();
    return logs.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return order === 'desc' ? tb - ta : ta - tb;
    });
  });

  /** Filtered logs */
  filteredLogs = computed(() => {
    const logs = this.allLogs();
    const category = this.filterCategorySignal();
    if (category === 'all') return logs;
    const prefixes = this.categoryPrefixes[category];
    return logs.filter(log => prefixes.some(p => log.eventType.startsWith(p)));
  });

  /** Displayed logs (limited by displayCount) */
  displayedLogs = computed(() => {
    return this.filteredLogs().slice(0, this.displayCount());
  });

  /**
   * Một dòng list: log + HTML đã build (parse + escape một lần khi logs / slice đổi).
   * Render bằng [innerHTML] thay vì *ngFor từng part.
   */
  parsedDisplayRows = computed(() => {
    return this.displayedLogs().map((log) => ({
      log,
      contentHtml: this.sanitizer.bypassSecurityTrustHtml(
        buildActivityLogMessageHtml(log.content)
      ),
    }));
  });

  /** Has more logs to load? */
  hasMore = computed(() => {
    return this.displayCount() < this.filteredLogs().length;
  });

  /** Remaining count */
  remainingCount = computed(() => {
    return Math.max(0, this.filteredLogs().length - this.displayCount());
  });

  private lastCheckHasNew = false;

  ngOnInit(): void {
    this.checkSub = interval(1000).subscribe(() => {
      const hasNew = this.hasNewActivity();
      if (hasNew && !this.lastCheckHasNew) {
        this.activityChanged.emit();
      }
      this.lastCheckHasNew = hasNew;
      // Chỉ bump nowTick khi dialog mở — tránh parse / render lại toàn list mỗi giây khi đóng.
      if (this.dialogOpen()) {
        this.nowTick.set(Date.now());
      }
    });
  }

  ngOnDestroy(): void {
    this.checkSub?.unsubscribe();
    // Restore body scroll if dialog was open
    if (this.dialogOpen()) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    }
  }

  openDialog(): void {
    this.dialogOpen.set(true);
    this.nowTick.set(Date.now());
    this.displayCount.set(this.PAGE_SIZE);
    this.filterCategory = 'all';
    this.filterCategorySignal.set('all');
    this.activityShowExactTime.set(false);
    this.refreshLogs();
    this.activityLogService.markAsRead();
    // Lock body scroll on mobile
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;
  }

  closeDialog(): void {
    // Restore body scroll
    const scrollY = document.body.style.top;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
    this.activityShowExactTime.set(false);
    this.dialogOpen.set(false);
  }

  refreshLogs(): void {
    this.displayCount.set(this.PAGE_SIZE);
    this.activityLogService.refresh();
    this.lastRefreshTime.set(new Date());
  }

  loadMore(): void {
    this.displayCount.update(c => c + this.PAGE_SIZE);
  }

  onSortChange(): void {
    this.sortOrderSignal.set(this.sortOrder);
    this.displayCount.set(this.PAGE_SIZE);
  }

  onFilterChange(): void {
    this.filterCategorySignal.set(this.filterCategory);
    this.displayCount.set(this.PAGE_SIZE);
  }

  trackByParsedRow(_: number, row: { log: ActivityLogRow }): string {
    return row.log.id;
  }

  getEventLabel(eventType: string) {
    return getEventTypeLabel(eventType as any);
  }

  getEventIcon(eventType: string) {
    return getEventTypeIcon(eventType as any);
  }

  getEventColor(eventType: string) {
    return getEventTypeColor(eventType as any);
  }

  /** Check if a log entry is unread */
  isUnread(logId: string): boolean {
    return this.activityLogService.isLogUnread(logId);
  }

  activityTimeText(timestamp: string): string {
    return this.isActivityTimeExact()
      ? this.formatExactTime(timestamp)
      : this.formatRelativeTime(timestamp);
  }

  activityTimeToggleTitle(): string {
    return this.isActivityTimeExact()
      ? 'Bấm để xem thời gian tương đối'
      : 'Bấm để xem giờ chính xác';
  }

  activityTimeToggleAriaLabel(): string {
    return this.isActivityTimeExact()
      ? 'Đang hiển thị giờ chính xác. Bấm để đổi sang thời gian tương đối.'
      : 'Đang hiển thị thời gian tương đối. Bấm để đổi sang giờ chính xác.';
  }

  toggleActivityTimeDisplay(event?: Event): void {
    event?.stopPropagation();
    this.activityShowExactTime.update((v) => !v);
  }

  private isActivityTimeExact(): boolean {
    return this.activityShowExactTime();
  }

  private formatRelativeTime(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    const diffMs = this.nowTick() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return `${diffDay} ngày trước`;
  }

  private formatExactTime(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${mi}`;
  }
}
