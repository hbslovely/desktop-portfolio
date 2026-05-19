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
import { Subscription, interval } from 'rxjs';
import {
  ActivityLogService,
  ActivityLogRow,
  parseContentWithBold,
  getEventTypeLabel,
  getEventTypeIcon,
  getEventTypeColor,
} from '../../services/activity-log.service';

type SortOrder = 'desc' | 'asc';
type FilterCategory = 'all' | 'feeding' | 'weight' | 'medical' | 'schedule' | 'document' | 'settings';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Activity Log Icon Button -->
    <button
      type="button"
      class="activity-log-btn"
      [class.has-unread]="unreadCount() > 0"
      (click)="openDialog()"
      title="Lịch sử hoạt động"
    >
      <i class="pi pi-history"></i>
      <span class="activity-badge" *ngIf="unreadCount() > 0">
        {{ unreadCount() > 9 ? '9+' : unreadCount() }}
      </span>
    </button>

    <!-- Dialog Overlay -->
    <div
      class="activity-dialog-overlay"
      *ngIf="dialogOpen()"
      (click)="closeDialog()"
      (touchmove)="$event.preventDefault()"
    >
      <div
        class="activity-dialog"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
      >
        <header class="activity-dialog__header">
          <div class="activity-dialog__title">
            <i class="pi pi-history"></i>
            <h2>Lịch sử hoạt động</h2>
          </div>
          <button
            type="button"
            class="activity-dialog__close"
            (click)="closeDialog()"
            aria-label="Đóng"
          >
            <i class="pi pi-times"></i>
          </button>
        </header>

        <!-- Filter & Sort Controls -->
        <div class="activity-dialog__toolbar">
          <div class="activity-toolbar__filters">
            <label class="activity-filter">
              <i class="pi pi-filter"></i>
              <select [(ngModel)]="filterCategory" (ngModelChange)="onFilterChange()">
                <option value="all">Tất cả</option>
                <option value="feeding">Cữ bú</option>
                <option value="weight">Cân nặng</option>
                <option value="medical">Y tế</option>
                <option value="schedule">Lịch hẹn</option>
                <option value="document">Tài liệu</option>
                <option value="settings">Cài đặt</option>
              </select>
            </label>
            <label class="activity-sort">
              <i class="pi pi-sort-alt"></i>
              <select [(ngModel)]="sortOrder" (ngModelChange)="onSortChange()">
                <option value="desc">Mới nhất</option>
                <option value="asc">Cũ nhất</option>
              </select>
            </label>
          </div>
          <span class="activity-count" *ngIf="filteredLogs().length > 0">
            {{ displayedLogs().length }} / {{ filteredLogs().length }}
          </span>
        </div>

        <div class="activity-dialog__content" (touchmove)="$event.stopPropagation()">
          <div class="activity-loading" *ngIf="loading()">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Đang tải...</span>
          </div>

          <div class="activity-empty" *ngIf="!loading() && filteredLogs().length === 0">
            <i class="pi pi-inbox"></i>
            <p *ngIf="filterCategory === 'all'">Chưa có hoạt động nào được ghi nhận</p>
            <p *ngIf="filterCategory !== 'all'">Không có hoạt động nào trong danh mục này</p>
          </div>

          <ul class="activity-list" *ngIf="!loading() && displayedLogs().length > 0">
            <li
              *ngFor="let log of displayedLogs(); trackBy: trackByLogId"
              class="activity-item"
              [attr.data-color]="getEventColor(log.eventType)"
            >
              <div class="activity-item__icon">
                <i class="pi" [ngClass]="getEventIcon(log.eventType)"></i>
              </div>
              <div class="activity-item__body">
                <div class="activity-item__meta">
                  <span class="activity-item__type">{{ getEventLabel(log.eventType) }}</span>
                  <span class="activity-item__user">{{ log.user }}</span>
                </div>
                <p class="activity-item__content">
                  <ng-container *ngFor="let part of parseContent(log.content)">
                    <strong *ngIf="part.bold">{{ part.text }}</strong>
                    <span *ngIf="!part.bold">{{ part.text }}</span>
                  </ng-container>
                </p>
                <time class="activity-item__time">{{ formatTime(log.timestamp) }}</time>
              </div>
            </li>
          </ul>

          <!-- Load More Button -->
          <div class="activity-load-more" *ngIf="hasMore()">
            <button type="button" class="load-more-btn" (click)="loadMore()">
              <i class="pi pi-angle-down"></i>
              Tải thêm ({{ remainingCount() }} còn lại)
            </button>
          </div>
        </div>

        <footer class="activity-dialog__footer">
          <span class="activity-footer__info">
            <i class="pi pi-sync"></i>
            Tự động cập nhật mỗi 5 phút
          </span>
          <button
            type="button"
            class="activity-footer__refresh"
            (click)="refreshLogs()"
            [disabled]="loading()"
          >
            <i class="pi" [ngClass]="loading() ? 'pi-spin pi-spinner' : 'pi-refresh'"></i>
            Làm mới
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .activity-log-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 10px;
      background: #f1f5f9;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;

      i {
        font-size: 16px;
      }

      &:hover {
        background: #e2e8f0;
        color: #334155;
      }

      &.has-unread {
        background: #fef3c7;
        color: #d97706;

        &:hover {
          background: #fde68a;
        }
      }
    }

    .activity-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 10px;
      font-weight: 700;
      line-height: 18px;
      text-align: center;
      color: #fff;
      background: #ef4444;
      border-radius: 999px;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
    }

    .activity-dialog-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 60px 16px 40px;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      animation: fadeIn 0.15s ease;
      overflow: hidden;
      touch-action: none;

      @media (max-width: 640px) {
        padding: 40px 12px 24px;
        align-items: flex-start;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .activity-dialog {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 480px;
      max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: slideUp 0.2s ease;
      overflow: hidden;

      @media (max-width: 640px) {
        max-height: calc(100vh - 80px);
        border-radius: 16px;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .activity-dialog__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .activity-dialog__title {
      display: flex;
      align-items: center;
      gap: 10px;

      i {
        font-size: 18px;
        color: #5b6cff;
      }

      h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
      }
    }

    .activity-dialog__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #fee2e2;
        color: #ef4444;
      }
    }

    .activity-dialog__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 20px;
      border-bottom: 1px solid #f1f5f9;
      background: #fff;
      flex-wrap: wrap;
    }

    .activity-toolbar__filters {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .activity-filter,
    .activity-sort {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #64748b;

      i {
        font-size: 13px;
      }

      select {
        padding: 6px 24px 6px 8px;
        font-size: 11px;
        font-weight: 500;
        color: #334155;
        background: #f8fafc url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 6px center;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        cursor: pointer;
        appearance: none;
        transition: all 0.15s ease;

        &:hover {
          border-color: #cbd5e1;
        }

        &:focus {
          outline: none;
          border-color: #5b6cff;
          box-shadow: 0 0 0 3px rgba(91, 108, 255, 0.1);
        }
      }
    }

    .activity-filter select {
      min-width: 90px;
    }

    .activity-count {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      white-space: nowrap;
    }

    .activity-dialog__content {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      min-height: 300px;
      max-height: 520px;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;

      @media (max-width: 640px) {
        max-height: calc(100vh - 220px);
      }
    }

    .activity-loading,
    .activity-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 20px;
      color: #94a3b8;

      i {
        font-size: 32px;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .activity-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .activity-item {
      display: flex;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s ease;

      &:hover {
        background: #f8fafc;
      }

      &:last-child {
        border-bottom: none;
      }

      &[data-color="green"] .activity-item__icon {
        background: #dcfce7;
        color: #16a34a;
      }

      &[data-color="blue"] .activity-item__icon {
        background: #dbeafe;
        color: #2563eb;
      }

      &[data-color="red"] .activity-item__icon {
        background: #fee2e2;
        color: #dc2626;
      }

      &[data-color="gray"] .activity-item__icon {
        background: #f1f5f9;
        color: #64748b;
      }
    }

    .activity-item__icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      font-size: 15px;
    }

    .activity-item__body {
      flex: 1;
      min-width: 0;
    }

    .activity-item__meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .activity-item__type {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #64748b;
    }

    .activity-item__user {
      font-size: 11px;
      color: #94a3b8;

      &::before {
        content: '·';
        margin-right: 8px;
      }
    }

    .activity-item__content {
      margin: 0 0 6px;
      font-size: 13px;
      line-height: 1.5;
      color: #334155;

      strong {
        color: #0f172a;
        font-weight: 600;
      }
    }

    .activity-item__time {
      font-size: 11px;
      color: #94a3b8;
    }

    .activity-load-more {
      display: flex;
      justify-content: center;
      padding: 16px 20px 20px;
    }

    .load-more-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 600;
      color: #5b6cff;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      i {
        font-size: 14px;
      }

      &:hover {
        background: #5b6cff;
        border-color: #5b6cff;
        color: #fff;
      }
    }

    .activity-dialog__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .activity-footer__info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94a3b8;

      i {
        font-size: 12px;
      }
    }

    .activity-footer__refresh {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #5b6cff;
      background: #eef2ff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: #5b6cff;
        color: #fff;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      i {
        font-size: 13px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityLogComponent implements OnInit, OnDestroy {
  private activityLogService = inject(ActivityLogService);
  private checkSub?: Subscription;

  /** Emit when new activity detected - parent can reload data */
  activityChanged = output<void>();

  dialogOpen = signal(false);

  private rawLogs = this.activityLogService.logs$;
  loading = this.activityLogService.loading$;
  unreadCount = this.activityLogService.unreadCount;
  hasNewActivity = this.activityLogService.hasNewActivity$;

  /** Pagination */
  private readonly PAGE_SIZE = 20;
  displayCount = signal(this.PAGE_SIZE);

  /** Sort order */
  sortOrder: SortOrder = 'desc';
  private sortOrderSignal = signal<SortOrder>('desc');

  /** Filter category */
  filterCategory: FilterCategory = 'all';
  private filterCategorySignal = signal<FilterCategory>('all');

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
    this.displayCount.set(this.PAGE_SIZE);
    this.filterCategory = 'all';
    this.filterCategorySignal.set('all');
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
    this.dialogOpen.set(false);
  }

  refreshLogs(): void {
    this.displayCount.set(this.PAGE_SIZE);
    this.activityLogService.refresh();
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

  trackByLogId(_: number, log: ActivityLogRow): string {
    return log.id;
  }

  parseContent(content: string) {
    return parseContentWithBold(content);
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

  formatTime(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;

    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${mi}`;
  }
}
