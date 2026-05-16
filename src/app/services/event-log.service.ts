import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FeedingEventLog {
  user: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm 24h */
  time: string;
  title: string;
  note?: string;
  place?: string;
  acknowledged: boolean;
  rowIndex?: number;
}

export interface EventSheetResponse {
  success: boolean;
  rowIndex?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class EventLogService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'Event';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;

  private readonly APPS_SCRIPT_URL = environment.production
    ? (environment.googleFeedingAppsScriptUrl || environment.googleAppsScriptUrl)
    : '/api/feeding-apps-script';

  /** Trạng thái dùng chung (tab Lịch + nhắc toàn cục) */
  readonly events = signal<FeedingEventLog[]>([]);
  readonly loading = signal(false);

  /**
   * Cột tab Event:
   * A User | B Ngày DD/MM/YYYY | C Giờ HH:mm | D Tên sự kiện | E Ghi chú | F Vị trí | G Acknowledge
   */
  loadEvents(): Observable<FeedingEventLog[]> {
    this.loading.set(true);
    const range = `${this.SHEET_NAME}!A2:G`;
    const url = `${this.BASE_URL}/values/${encodeURIComponent(
      range
    )}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => this.mapRows(resp.values || [])),
      tap((rows) => {
        this.events.set(rows);
        this.loading.set(false);
      }),
      catchError((err) => {
        console.error('EventLogService.loadEvents failed', err);
        this.loading.set(false);
        this.events.set([]);
        return throwError(() => err);
      })
    );
  }

  addEvent(ev: FeedingEventLog): Observable<EventSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'addEvent',
      log: {
        user: ev.user,
        date: ev.date,
        time: ev.time,
        title: ev.title,
        note: ev.note || '',
        place: ev.place || '',
      },
    }).pipe(catchError(() => of({ success: true })));
  }

  updateEvent(
    rowIndex: number,
    patch: {
      date: string;
      time: string;
      title: string;
      note?: string;
      place?: string;
    }
  ): Observable<EventSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'updateEvent',
      row: rowIndex,
      patch: {
        date: patch.date,
        time: patch.time,
        title: patch.title,
        note: patch.note ?? '',
        place: patch.place ?? '',
      },
    }).pipe(catchError(() => of({ success: true })));
  }

  deleteEvent(rowIndex: number): Observable<EventSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'deleteEvent',
      row: rowIndex,
    }).pipe(catchError(() => of({ success: true })));
  }

  acknowledgeEvent(rowIndex: number): Observable<EventSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'acknowledgeEvent',
      row: rowIndex,
    }).pipe(catchError(() => of({ success: true })));
  }

  /** ISO `date` + `time` → Date (giờ địa phương). */
  static eventDateTime(ev: FeedingEventLog): Date | null {
    const d = ev.date?.trim();
    const t = ev.time?.trim();
    if (!d || !t) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!m || !tm) return null;
    const y = +m[1];
    const mo = +m[2] - 1;
    const day = +m[3];
    const hh = +tm[1];
    const mm = +tm[2];
    const dt = new Date(y, mo, day, hh, mm, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private mapRows(rows: string[][]): FeedingEventLog[] {
    return rows
      .map((row, idx) => {
        const rowUser = (row[0] || '').trim();
        const dateStr = (row[1] || '').trim();
        const timeStr = (row[2] || '').trim();
        const title = (row[3] || '').trim();
        const note = (row[4] || '').trim();
        const place = (row[5] || '').trim();
        const ackRaw = row[6];

        if (!dateStr || !timeStr || !title) return null;

        const date = this.parseSheetDate(dateStr);
        const time = this.normalizeTime(timeStr);
        if (!date) return null;

        const ev: FeedingEventLog = {
          user: rowUser.toLowerCase(),
          date,
          time,
          title,
          note: note || undefined,
          place: place || undefined,
          acknowledged: this.parseAck(ackRaw),
          rowIndex: idx + 2,
        };
        return ev;
      })
      .filter((e): e is FeedingEventLog => !!e)
      .sort((a, b) => {
        const ta = EventLogService.eventDateTime(a)?.getTime() ?? 0;
        const tb = EventLogService.eventDateTime(b)?.getTime() ?? 0;
        return ta - tb;
      });
  }

  private parseAck(v: unknown): boolean {
    if (v === true || v === 'TRUE') return true;
    const s = String(v ?? '')
      .trim()
      .toLowerCase();
    return s === 'true' || s === 'x' || s === '1' || s === 'yes' || s === 'có';
  }

  private postToAppsScript(
    body: Record<string, unknown>
  ): Observable<EventSheetResponse> {
    const url = this.APPS_SCRIPT_URL;
    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.post<EventSheetResponse>(url, body, { headers });
    }

    const payload = JSON.stringify(body);
    return from(
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow',
      }).then((): EventSheetResponse => ({ success: true }))
    );
  }

  private parseSheetDate(raw: string): string | null {
    if (!raw) return null;
    const m1 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const [, d, mo, y] = m1;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      const [, y, mo, d] = m2;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
  }

  private normalizeTime(raw: string): string {
    const s = String(raw || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return s;
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
}
