import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface NotificationLog {
  user: string;
  content: string;
  acknowledgeUsers: string[];
  createdAt?: string;
  rowIndex?: number;
}

export interface NotificationSheetResponse {
  success: boolean;
  rowIndex?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationLogService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = environment.googleFeedingSheetId;
  private readonly SHEET_NAME = 'Notification';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = this.SHEET_ID
    ? `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`
    : '';
  private readonly APPS_SCRIPT_URL = '/api/feeding-apps-script';

  readonly notifications = signal<NotificationLog[]>([]);
  readonly loading = signal(false);

  loadNotifications(): Observable<NotificationLog[]> {
    if (!this.BASE_URL || !this.API_KEY) {
      this.notifications.set([]);
      return of([]);
    }
    this.loading.set(true);
    const range = `${this.SHEET_NAME}!A2:D`;
    const url = `${this.BASE_URL}/values/${encodeURIComponent(
      range
    )}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => this.mapRows(resp.values || [])),
      tap((rows) => {
        this.notifications.set(rows);
        this.loading.set(false);
      }),
      catchError((err) => {
        console.error('NotificationLogService.loadNotifications failed', err);
        this.notifications.set([]);
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }

  addNotification(payload: {
    user: string;
    content: string;
  }): Observable<NotificationSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'addNotification',
      notification: {
        user: payload.user,
        content: payload.content,
        createdAt: new Date().toISOString(),
      },
    }).pipe(catchError(() => of({ success: true })));
  }

  acknowledgeNotification(rowIndex: number, user: string): Observable<NotificationSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'acknowledgeNotification',
      row: rowIndex,
      user,
    }).pipe(catchError(() => of({ success: true })));
  }

  deleteNotification(rowIndex: number, user: string): Observable<NotificationSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'deleteNotification',
      row: rowIndex,
      user,
    }).pipe(catchError(() => of({ success: true })));
  }

  private mapRows(rows: string[][]): NotificationLog[] {
    return rows
      .map((row, idx) => {
        const rowUser = String(row[0] || '')
          .trim()
          .toLowerCase();
        const content = String(row[1] || '').trim();
        const acknowledgeListRaw = String(row[2] || '').trim();
        const createdAtRaw = String(row[3] || '').trim();
        if (!rowUser || !content) return null;
        const acknowledgeUsers = acknowledgeListRaw
          .split(',')
          .map((v) => v.trim().toLowerCase())
          .filter((v) => v.length > 0);
        const createdAt = createdAtRaw || undefined;
        const item: NotificationLog = {
          user: rowUser,
          content,
          acknowledgeUsers,
          createdAt,
          rowIndex: idx + 2,
        };
        return item;
      })
      .filter((item): item is NotificationLog => !!item)
      .sort((a, b) => (b.rowIndex ?? 0) - (a.rowIndex ?? 0));
  }

  private postToAppsScript(body: Record<string, unknown>): Observable<NotificationSheetResponse> {
    const url = this.APPS_SCRIPT_URL;
    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.post<NotificationSheetResponse>(url, body, { headers });
    }

    const payload = JSON.stringify(body);
    return from(
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow',
      }).then((): NotificationSheetResponse => ({ success: true }))
    );
  }
}
