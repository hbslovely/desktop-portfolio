import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, interval, Subject, from, throwError, Subscription } from 'rxjs';
import { map, catchError, tap, switchMap, startWith } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** Event types cho logging */
export const ACTIVITY_EVENT = {
  // Feeding events
  FEEDING_ADDED: 'FEEDING_ADDED',
  FEEDING_UPDATED: 'FEEDING_UPDATED',
  FEEDING_DELETED: 'FEEDING_DELETED',
  BOTTLE_PREP_ADDED: 'BOTTLE_PREP_ADDED',
  
  // Weight events
  WEIGHT_ADDED: 'WEIGHT_ADDED',
  WEIGHT_UPDATED: 'WEIGHT_UPDATED',
  WEIGHT_DELETED: 'WEIGHT_DELETED',
  
  // Medical events
  MEDICAL_ADDED: 'MEDICAL_ADDED',
  MEDICAL_UPDATED: 'MEDICAL_UPDATED',
  MEDICAL_DELETED: 'MEDICAL_DELETED',
  
  // Schedule events
  SCHEDULE_ADDED: 'SCHEDULE_ADDED',
  SCHEDULE_UPDATED: 'SCHEDULE_UPDATED',
  SCHEDULE_DELETED: 'SCHEDULE_DELETED',
  
  // Settings events
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',

  // Document/Explorer events
  FILE_ADDED: 'FILE_ADDED',
  FILE_DELETED: 'FILE_DELETED',
  FILE_MOVED: 'FILE_MOVED',
  FILE_RENAMED: 'FILE_RENAMED',
  FOLDER_ADDED: 'FOLDER_ADDED',
  FOLDER_DELETED: 'FOLDER_DELETED',
  FOLDER_RENAMED: 'FOLDER_RENAMED',
} as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT)[keyof typeof ACTIVITY_EVENT];

/** Row data từ sheet Log */
export interface ActivityLogRow {
  id: string;
  user: string;
  eventType: ActivityEventType;
  content: string;
  timestamp: string;
  rowIndex?: number;
}

/** Dữ liệu để tạo log entry mới */
export interface ActivityLogEntry {
  user: string;
  eventType: ActivityEventType;
  content: string;
}

/** Helper để format content user-friendly */
export function formatLogContent(
  eventType: ActivityEventType,
  details: Record<string, string | number | undefined>
): string {
  switch (eventType) {
    // Feeding
    case ACTIVITY_EVENT.FEEDING_ADDED:
      return `Thêm cữ bú '${details['volume']}ml' vào lúc '${details['time']}'`;
    case ACTIVITY_EVENT.FEEDING_UPDATED: {
      const oldVol = details['oldVolume'];
      const newVol = details['newVolume'];
      const time = details['time'];
      if (
        oldVol != null &&
        newVol != null &&
        Number(oldVol) !== Number(newVol)
      ) {
        return `Thay đổi cữ bú lúc '${time}' từ '${oldVol}ml' thành '${newVol}ml'`;
      }
      return `cập nhật nội dung cữ bú lúc '${time}'`;
    }
    case ACTIVITY_EVENT.FEEDING_DELETED:
      return `Xóa cữ bú '${details['volume']}ml' lúc '${details['time']}'`;
    case ACTIVITY_EVENT.BOTTLE_PREP_ADDED:
      return `Pha sữa '${details['volume']}ml' lúc '${details['time']}'`;

    // Weight
    case ACTIVITY_EVENT.WEIGHT_ADDED:
      return `Thêm ghi nhận cân nặng '${details['weight']}kg' ngày '${details['date']}'`;
    case ACTIVITY_EVENT.WEIGHT_UPDATED:
      return details['oldWeight'] && details['newWeight']
        ? `Thay đổi cân nặng ngày '${details['date']}' từ '${details['oldWeight']}kg' thành '${details['newWeight']}kg'`
        : `Cập nhật cân nặng ngày '${details['date']}'`;
    case ACTIVITY_EVENT.WEIGHT_DELETED:
      return `Xóa ghi nhận cân nặng '${details['weight']}kg' ngày '${details['date']}'`;

    // Medical
    case ACTIVITY_EVENT.MEDICAL_ADDED:
      return details['location']
        ? `Thêm sự kiện y tế '${details['title']}' tại '${details['location']}'`
        : `Thêm sự kiện y tế '${details['title']}'`;
    case ACTIVITY_EVENT.MEDICAL_UPDATED:
      return details['location']
        ? `Chỉnh sửa sự kiện y tế '${details['title']}' tại '${details['location']}'`
        : `Chỉnh sửa sự kiện y tế '${details['title']}'`;
    case ACTIVITY_EVENT.MEDICAL_DELETED:
      return `Xóa sự kiện y tế '${details['title']}'`;

    // Schedule
    case ACTIVITY_EVENT.SCHEDULE_ADDED:
      return `Thêm lịch mới '${details['title']}' vào ngày '${details['date']}'`;
    case ACTIVITY_EVENT.SCHEDULE_UPDATED:
      return `Chỉnh sửa lịch '${details['title']}'`;
    case ACTIVITY_EVENT.SCHEDULE_DELETED:
      return `Xóa lịch '${details['title']}'`;

    // Settings
    case ACTIVITY_EVENT.SETTINGS_UPDATED:
      return `Cập nhật cài đặt '${details['setting']}'`;
    case ACTIVITY_EVENT.PROFILE_UPDATED:
      return `Cập nhật thông tin '${details['field']}'`;

    // Documents
    case ACTIVITY_EVENT.FILE_ADDED:
      return `Tải lên file '${details['name']}' vào thư mục '${details['folder']}'`;
    case ACTIVITY_EVENT.FILE_DELETED:
      return `Xóa file '${details['name']}'`;
    case ACTIVITY_EVENT.FILE_MOVED:
      return `Di chuyển file '${details['name']}' sang '${details['toFolder']}'`;
    case ACTIVITY_EVENT.FILE_RENAMED:
      return `Đổi tên file từ '${details['oldName']}' thành '${details['newName']}'`;
    case ACTIVITY_EVENT.FOLDER_ADDED:
      return `Tạo thư mục '${details['name']}'`;
    case ACTIVITY_EVENT.FOLDER_DELETED:
      return `Xóa thư mục '${details['name']}'`;
    case ACTIVITY_EVENT.FOLDER_RENAMED:
      return `Đổi tên thư mục từ '${details['oldName']}' thành '${details['newName']}'`;

    default:
      return `Hoạt động: ${eventType}`;
  }
}

/** Parse content để hiển thị với phần trong '' được in đậm */
export function parseContentWithBold(content: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const regex = /'([^']+)'/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), bold: false });
  }

  return parts.length > 0 ? parts : [{ text: content, bold: false }];
}

/** Map event type sang label tiếng Việt */
export function getEventTypeLabel(eventType: ActivityEventType): string {
  const labels: Record<ActivityEventType, string> = {
    [ACTIVITY_EVENT.FEEDING_ADDED]: 'Thêm cữ bú',
    [ACTIVITY_EVENT.FEEDING_UPDATED]: 'Sửa cữ bú',
    [ACTIVITY_EVENT.FEEDING_DELETED]: 'Xóa cữ bú',
    [ACTIVITY_EVENT.BOTTLE_PREP_ADDED]: 'Pha sữa',
    [ACTIVITY_EVENT.WEIGHT_ADDED]: 'Thêm cân nặng',
    [ACTIVITY_EVENT.WEIGHT_UPDATED]: 'Sửa cân nặng',
    [ACTIVITY_EVENT.WEIGHT_DELETED]: 'Xóa cân nặng',
    [ACTIVITY_EVENT.MEDICAL_ADDED]: 'Thêm sự kiện y tế',
    [ACTIVITY_EVENT.MEDICAL_UPDATED]: 'Sửa sự kiện y tế',
    [ACTIVITY_EVENT.MEDICAL_DELETED]: 'Xóa sự kiện y tế',
    [ACTIVITY_EVENT.SCHEDULE_ADDED]: 'Thêm lịch',
    [ACTIVITY_EVENT.SCHEDULE_UPDATED]: 'Sửa lịch',
    [ACTIVITY_EVENT.SCHEDULE_DELETED]: 'Xóa lịch',
    [ACTIVITY_EVENT.SETTINGS_UPDATED]: 'Cài đặt',
    [ACTIVITY_EVENT.PROFILE_UPDATED]: 'Hồ sơ',
    [ACTIVITY_EVENT.FILE_ADDED]: 'Tải file',
    [ACTIVITY_EVENT.FILE_DELETED]: 'Xóa file',
    [ACTIVITY_EVENT.FILE_MOVED]: 'Di chuyển file',
    [ACTIVITY_EVENT.FILE_RENAMED]: 'Đổi tên file',
    [ACTIVITY_EVENT.FOLDER_ADDED]: 'Tạo thư mục',
    [ACTIVITY_EVENT.FOLDER_DELETED]: 'Xóa thư mục',
    [ACTIVITY_EVENT.FOLDER_RENAMED]: 'Đổi tên thư mục',
  };
  return labels[eventType] || eventType;
}

/** Map event type sang icon class */
export function getEventTypeIcon(eventType: ActivityEventType): string {
  if (eventType === ACTIVITY_EVENT.FEEDING_ADDED) return 'pi-heart';
  if (eventType === ACTIVITY_EVENT.BOTTLE_PREP_ADDED) return 'pi-inbox';
  if (eventType.startsWith('FEEDING_')) return 'pi-heart';
  if (eventType.startsWith('WEIGHT_')) return 'pi-chart-line';
  if (eventType.startsWith('MEDICAL_')) return 'pi-briefcase';
  if (eventType.startsWith('SCHEDULE_')) return 'pi-calendar';
  if (eventType.startsWith('SETTINGS_')) return 'pi-cog';
  if (eventType.startsWith('PROFILE_')) return 'pi-user';
  if (eventType.startsWith('FILE_')) return 'pi-file';
  if (eventType.startsWith('FOLDER_')) return 'pi-folder';
  return 'pi-info-circle';
}

/** Map event type sang màu */
export function getEventTypeColor(eventType: ActivityEventType): string {
  if (eventType.includes('_ADDED')) return 'green';
  if (eventType.includes('_UPDATED')) return 'blue';
  if (eventType.includes('_DELETED')) return 'red';
  return 'gray';
}

interface LogSheetResponse {
  success: boolean;
  rowIndex?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'Log';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;
  private readonly STORAGE_KEY = 'activity-log-last-read-id';

  /**
   * Apps Script bound to the feeding sheet.
   * Dev: gọi qua proxy `/api/feeding-apps-script` để né CORS.
   * Prod: dùng `environment.googleFeedingAppsScriptUrl`.
   */
  private readonly APPS_SCRIPT_URL = environment.production
    ? (environment.googleFeedingAppsScriptUrl || environment.googleAppsScriptUrl)
    : '/api/feeding-apps-script';

  /** Refresh interval in minutes (configurable from settings) */
  refreshIntervalMinutes = signal<number>(5);
  private autoRefreshSub?: Subscription;

  private logs = signal<ActivityLogRow[]>([]);
  private lastLogId = signal<string | null>(null);
  private lastReadLogId = signal<string | null>(null);
  private loading = signal<boolean>(false);
  private hasNewActivity = signal<boolean>(false);

  private refreshTrigger$ = new Subject<void>();

  readonly logs$ = this.logs.asReadonly();
  readonly loading$ = this.loading.asReadonly();
  readonly hasNewActivity$ = this.hasNewActivity.asReadonly();
  readonly lastReadLogId$ = this.lastReadLogId.asReadonly();

  /** Số lượng log chưa xem (mới) */
  unreadCount = signal<number>(0);

  constructor() {
    this.loadLastReadLogId();
    this.startAutoRefresh();
  }

  /** Load last read log ID from localStorage */
  private loadLastReadLogId(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.lastReadLogId.set(stored);
      }
    } catch (e) {
      console.warn('Could not load last read log ID from localStorage', e);
    }
  }

  /** Save last read log ID to localStorage */
  private saveLastReadLogId(logId: string | null): void {
    try {
      if (logId) {
        localStorage.setItem(this.STORAGE_KEY, logId);
        this.lastReadLogId.set(logId);
      }
    } catch (e) {
      console.warn('Could not save last read log ID to localStorage', e);
    }
  }

  /** Calculate unread count based on last read log ID */
  private calculateUnreadCount(logs: ActivityLogRow[]): number {
    const lastReadId = this.lastReadLogId();
    if (!lastReadId || logs.length === 0) {
      return 0;
    }
    const lastReadIndex = logs.findIndex((l) => l.id === lastReadId);
    if (lastReadIndex === -1) {
      // Last read log not found, all logs are considered new
      return logs.length;
    }
    return lastReadIndex;
  }

  /** Update refresh interval and restart auto-refresh */
  setRefreshInterval(minutes: number): void {
    if (minutes > 0 && minutes !== this.refreshIntervalMinutes()) {
      this.refreshIntervalMinutes.set(minutes);
      this.restartAutoRefresh();
    }
  }

  private restartAutoRefresh(): void {
    this.autoRefreshSub?.unsubscribe();
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    const intervalMs = this.refreshIntervalMinutes() * 60 * 1000;
    this.autoRefreshSub = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchLogs())
      )
      .subscribe({
        next: (logs) => {
          const prevLastId = this.lastLogId();
          const newLastId = logs.length > 0 ? logs[0].id : null;

          // Check if there are new activities since last fetch
          if (prevLastId && newLastId && prevLastId !== newLastId) {
            this.hasNewActivity.set(true);
          }

          // Calculate unread count based on last READ log ID (from storage)
          const unread = this.calculateUnreadCount(logs);
          this.unreadCount.set(unread);

          this.logs.set(logs);
          this.lastLogId.set(newLastId);
        },
        error: (err) => console.error('[ActivityLog] Auto-refresh error:', err),
      });
  }

  /** Trigger manual refresh */
  refresh(): void {
    this.refreshTrigger$.next();
    this.fetchLogs().subscribe({
      next: (logs) => {
        this.logs.set(logs);
        if (logs.length > 0) {
          this.lastLogId.set(logs[0].id);
          // Recalculate unread count (keep last read ID unchanged)
          const unread = this.calculateUnreadCount(logs);
          this.unreadCount.set(unread);
        }
      },
    });
  }

  /** Mark all as read - save last read ID to localStorage */
  markAsRead(): void {
    const logs = this.logs();
    if (logs.length > 0) {
      // Save the most recent log ID as last read
      this.saveLastReadLogId(logs[0].id);
    }
    this.unreadCount.set(0);
    this.hasNewActivity.set(false);
  }

  /** Check if a specific log is unread */
  isLogUnread(logId: string): boolean {
    const logs = this.logs();
    const lastReadId = this.lastReadLogId();
    if (!lastReadId) return false;

    const logIndex = logs.findIndex((l) => l.id === logId);
    const lastReadIndex = logs.findIndex((l) => l.id === lastReadId);

    if (logIndex === -1 || lastReadIndex === -1) return false;
    return logIndex < lastReadIndex;
  }

  /** Fetch logs from sheet */
  private fetchLogs(): Observable<ActivityLogRow[]> {
    this.loading.set(true);
    const url = `${this.BASE_URL}/values/${encodeURIComponent(this.SHEET_NAME)}?key=${this.API_KEY}`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((res) => {
        const rows = res.values ?? [];
        if (rows.length < 2) return [];

        const header = rows[0].map((h) => String(h).trim().toLowerCase());
        const iId = header.indexOf('id');
        const iUser = header.indexOf('user');
        const iType = header.indexOf('type');
        const iContent = header.indexOf('content');
        const iTimestamp = header.indexOf('timestamp');

        return rows
          .slice(1)
          .map((r, idx) => ({
            id: r[iId] ?? `log-${idx}`,
            user: r[iUser] ?? 'unknown',
            eventType: (r[iType] ?? 'UNKNOWN') as ActivityEventType,
            content: r[iContent] ?? '',
            timestamp: r[iTimestamp] ?? '',
            rowIndex: idx + 2,
          }))
          .sort((a, b) => {
            const ta = new Date(a.timestamp).getTime();
            const tb = new Date(b.timestamp).getTime();
            return tb - ta; // Newest first
          });
      }),
      tap(() => this.loading.set(false)),
      catchError((err) => {
        console.error('[ActivityLog] Fetch error:', err);
        this.loading.set(false);
        return of([]);
      })
    );
  }

  /** Add a new log entry */
  addLog(entry: ActivityLogEntry): Observable<boolean> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    return this.postToAppsScript({
      action: 'addLog',
      log: {
        id,
        user: entry.user,
        type: entry.eventType,
        content: entry.content,
        timestamp,
      },
    }).pipe(
      map((res) => res.success === true),
      tap((success) => {
        if (success) {
          const newLog: ActivityLogRow = {
            id,
            user: entry.user,
            eventType: entry.eventType,
            content: entry.content,
            timestamp,
          };
          this.logs.update((logs) => [newLog, ...logs]);
        }
      }),
      catchError((err) => {
        console.error('[ActivityLog] Add error:', err);
        return of(false);
      })
    );
  }

  /**
   * Gửi POST tới Google Apps Script web app.
   *
   * Dev (proxy): dùng HttpClient bình thường, đọc JSON response.
   *
   * Prod (mobile-safe): dùng fetch với `mode: 'no-cors'`.
   *  - GAS `doPost` trả 302 redirect sang `script.googleusercontent.com`.
   *    XHR (HttpClient) cố gắng đọc CORS header ở endpoint cuối, và trên
   *    mobile/WebView hành vi này rất flaky ⇒ request thường fail với
   *    status 0 dù GAS đã ghi thành công.
   *  - `fetch` với `mode: 'no-cors'` gửi request như form thường, không
   *    expect đọc response, không cần CORS header ⇒ không bao giờ fail
   *    vì CORS. Opaque response cũng OK vì ta sẽ reload để verify.
   *  - Content-Type `text/plain;charset=utf-8` vẫn cần để nằm trong
   *    "CORS-safelisted" và không trigger preflight OPTIONS.
   */
  private postToAppsScript(
    body: Record<string, unknown>
  ): Observable<LogSheetResponse> {
    const url = this.APPS_SCRIPT_URL;
    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http
        .post<LogSheetResponse>(url, body, { headers })
        .pipe(map((resp) => resp));
    }

    const payload = JSON.stringify(body);
    return from(
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow',
      }).then((): LogSheetResponse => ({ success: true }))
    );
  }

  /** Helper: Log a feeding event */
  logFeeding(
    user: string,
    eventType: 'FEEDING_ADDED' | 'FEEDING_UPDATED' | 'FEEDING_DELETED',
    details: { time?: string; volume?: number; oldVolume?: number; newVolume?: number }
  ): Observable<boolean> {
    const content = formatLogContent(ACTIVITY_EVENT[eventType], {
      time: details.time,
      volume: details.volume,
      oldVolume: details.oldVolume,
      newVolume: details.newVolume,
    });
    return this.addLog({ user, eventType: ACTIVITY_EVENT[eventType], content });
  }

  /** Helper: Log a weight event */
  logWeight(
    user: string,
    eventType: 'WEIGHT_ADDED' | 'WEIGHT_UPDATED' | 'WEIGHT_DELETED',
    details: { date?: string; weight?: number; oldWeight?: number; newWeight?: number }
  ): Observable<boolean> {
    const content = formatLogContent(ACTIVITY_EVENT[eventType], {
      date: details.date,
      weight: details.weight,
      oldWeight: details.oldWeight,
      newWeight: details.newWeight,
    });
    return this.addLog({ user, eventType: ACTIVITY_EVENT[eventType], content });
  }

  /** Helper: Log a medical event */
  logMedical(
    user: string,
    eventType: 'MEDICAL_ADDED' | 'MEDICAL_UPDATED' | 'MEDICAL_DELETED',
    details: { title?: string; location?: string }
  ): Observable<boolean> {
    const content = formatLogContent(ACTIVITY_EVENT[eventType], {
      title: details.title,
      location: details.location,
    });
    return this.addLog({ user, eventType: ACTIVITY_EVENT[eventType], content });
  }

  /** Helper: Log a schedule event */
  logSchedule(
    user: string,
    eventType: 'SCHEDULE_ADDED' | 'SCHEDULE_UPDATED' | 'SCHEDULE_DELETED',
    details: { title?: string; date?: string }
  ): Observable<boolean> {
    const content = formatLogContent(ACTIVITY_EVENT[eventType], {
      title: details.title,
      date: details.date,
    });
    return this.addLog({ user, eventType: ACTIVITY_EVENT[eventType], content });
  }

  /** Helper: Log settings update */
  logSettings(user: string, settingName: string): Observable<boolean> {
    const content = formatLogContent(ACTIVITY_EVENT.SETTINGS_UPDATED, { setting: settingName });
    return this.addLog({ user, eventType: ACTIVITY_EVENT.SETTINGS_UPDATED, content });
  }

  /** Helper: Log a document/file event */
  logDocument(
    user: string,
    eventType: 'FILE_ADDED' | 'FILE_DELETED' | 'FILE_MOVED' | 'FILE_RENAMED' | 'FOLDER_ADDED' | 'FOLDER_DELETED' | 'FOLDER_RENAMED',
    details: { name?: string; folder?: string; toFolder?: string; oldName?: string; newName?: string }
  ): Observable<boolean> {
    const content = formatLogContent(ACTIVITY_EVENT[eventType], {
      name: details.name,
      folder: details.folder,
      toFolder: details.toFolder,
      oldName: details.oldName,
      newName: details.newName,
    });
    return this.addLog({ user, eventType: ACTIVITY_EVENT[eventType], content });
  }
}
