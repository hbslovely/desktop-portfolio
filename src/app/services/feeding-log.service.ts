import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FeedingLog {
  /** user id / bé (multi-account trên cùng sheet) */
  user: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24h) */
  time: string;
  /** ml */
  volume: number;
  note?: string;
  /** row trong sheet (1-based, row đầu là header) — chỉ có khi load từ sheet */
  rowIndex?: number;
}

export interface FeedingSheetResponse {
  success: boolean;
  logs?: FeedingLog[];
  rowIndex?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedingLogService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1nlLxaRCSePOddntUeNsMBKx2qP6kGSNLsZwtyqSbb88';
  private readonly SHEET_NAME = 'Feeding';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;

  private readonly APPS_SCRIPT_URL = environment.production
    ? environment.googleAppsScriptUrl
    : '/api/google-apps-script';

  /**
   * Columns:
   *  A: User  (chỉ để ghi nhận ai là người log, KHÔNG dùng để filter)
   *  B: Ngày (DD/MM/YYYY)
   *  C: Giờ (HH:mm)
   *  D: Dung tích (ml)
   *  E: Ghi chú
   *
   * Trả về TẤT CẢ cữ bú trong sheet — mọi user share chung dữ liệu của bé.
   */
  getLogs(): Observable<FeedingLog[]> {
    const range = `${this.SHEET_NAME}!A2:E`;
    const url = `${this.BASE_URL}/values/${range}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => {
        const rows = resp.values || [];

        return rows
          .map((row, idx) => {
            const rowUser = (row[0] || '').trim();
            const dateStr = (row[1] || '').trim();
            const timeStr = (row[2] || '').trim();
            const volumeStr = (row[3] || '').trim();
            const note = (row[4] || '').trim();

            if (!dateStr || !volumeStr) return null;

            const date = this.parseSheetDate(dateStr);
            const volume = parseInt(volumeStr.replace(/[^\d]/g, ''), 10) || 0;

            if (!date || volume <= 0) return null;

            const log: FeedingLog = {
              user: rowUser.toLowerCase(),
              date,
              time: this.normalizeTime(timeStr),
              volume,
              note: note || undefined,
              rowIndex: idx + 2,
            };
            return log;
          })
          .filter((l): l is FeedingLog => !!l)
          .sort((a, b) => {
            const aK = `${a.date} ${a.time}`;
            const bK = `${b.date} ${b.time}`;
            return bK.localeCompare(aK);
          });
      }),
      catchError((err) => {
        console.error('FeedingLogService.getLogs failed', err);
        return throwError(() => err);
      })
    );
  }

  addLog(log: FeedingLog): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    return this.postToAppsScript({
      action: 'addFeeding',
      log: {
        user: log.user,
        date: log.date,
        time: log.time,
        volume: log.volume,
        note: log.note || '',
      },
    }).pipe(
      catchError((err) => {
        console.error('FeedingLogService.addLog failed', err);
        return throwError(
          () =>
            new Error(
              'Không thể lưu cữ bú lên Google Sheet. Xem FEEDING_SETUP.md để cập nhật Apps Script.'
            )
        );
      })
    );
  }

  deleteLog(rowIndex: number): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    return this.postToAppsScript({
      action: 'deleteFeeding',
      row: rowIndex,
    }).pipe(
      catchError((err) => {
        console.error('FeedingLogService.deleteLog failed', err);
        return throwError(
          () => new Error('Không thể xoá cữ bú. Vui lòng thử lại.')
        );
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
  ): Observable<FeedingSheetResponse> {
    const url = this.APPS_SCRIPT_URL;
    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http
        .post<FeedingSheetResponse>(url, body, { headers })
        .pipe(
          map((resp) => {
            if (resp && resp.success === false) {
              throw new Error(resp.error || 'Apps Script trả về lỗi');
            }
            return resp;
          })
        );
    }

    const payload = JSON.stringify(body);
    return from(
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow',
      }).then((): FeedingSheetResponse => ({ success: true }))
    );
  }

  /**
   * Chuyển "07/04/2026" hoặc "2026-04-07" → "YYYY-MM-DD"
   */
  private parseSheetDate(raw: string): string | null {
    if (!raw) return null;
    const m1 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const [, d, mo, y] = m1;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m2) {
      const [, y, mo, d] = m2;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const mo = (parsed.getMonth() + 1).toString().padStart(2, '0');
      const d = parsed.getDate().toString().padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }
    return null;
  }

  private normalizeTime(raw: string): string {
    if (!raw) return '00:00';
    const m = raw.match(/(\d{1,2})[:h](\d{1,2})/);
    if (m) {
      return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
    }
    return raw;
  }
}
