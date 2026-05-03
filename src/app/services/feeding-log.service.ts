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

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'Feeding';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${ this.SHEET_ID }`;

  /**
   * Apps Script bound to **the feeding sheet**. Tách biệt với expense script
   * vì 2 sheet khác nhau ⇒ 2 deployment khác nhau.
   *
   * Dev: gọi qua proxy `/api/feeding-apps-script` để né CORS.
   * Prod: dùng `environment.googleFeedingAppsScriptUrl` (fallback sang
   *       `googleAppsScriptUrl` nếu chưa cấu hình – tương thích ngược cho
   *       dự án cũ dùng chung 1 script).
   */
  private readonly APPS_SCRIPT_URL = environment.production
    ? (environment.googleFeedingAppsScriptUrl || environment.googleAppsScriptUrl)
    : '/api/feeding-apps-script';

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
    const range = `${ this.SHEET_NAME }!A2:E`;
    const url = `${ this.BASE_URL }/values/${ range }?key=${ this.API_KEY }&valueRenderOption=FORMATTED_VALUE`;

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
            const aK = `${ a.date } ${ a.time }`;
            const bK = `${ b.date } ${ b.time }`;
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
    });
  }

  /**
   * Cập nhật một cữ bú hiện có. **KHÔNG** cho đổi `date` (nghiệp vụ: cữ
   * thuộc về ngày nào thì cố định, chỉ chỉnh giờ / ml / note).
   *
   * - `rowIndex` là số row 1-based trong sheet (header = row 1).
   * - Server-side Apps Script chịu trách nhiệm validate + chỉ ghi 3 cột
   *   `Giờ`, `Dung tích`, `Ghi chú` để tránh nguy cơ ghi đè cột khác.
   */
  updateLog(
    rowIndex: number,
    patch: { time: string; volume: number; note?: string }
  ): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    return this.postToAppsScript({
      action: 'updateFeeding',
      row: rowIndex,
      patch: {
        time: patch.time,
        volume: patch.volume,
        note: patch.note || '',
      },
    });
  }

  deleteLog(rowIndex: number): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    return this.postToAppsScript({
      action: 'deleteFeeding',
      row: rowIndex,
    });
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
            return resp;
          })
        );
    }

    const payload = JSON.stringify(body);
    /*
     * no-cors: browser không cho đọc status/body → không biết GAS có {success:true}
     * hay lỗi. `{ success: true }` chỉ nghĩa là request đã được **gửi đi**, không
     * chứng minh đã ghi Sheet. Xác nhận thật: xem dòng mới sau `getLogs()` reload.
     */
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
      const [ , d, mo, y ] = m1;
      return `${ y }-${ mo.padStart(2, '0') }-${ d.padStart(2, '0') }`;
    }
    const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m2) {
      const [ , y, mo, d ] = m2;
      return `${ y }-${ mo.padStart(2, '0') }-${ d.padStart(2, '0') }`;
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const mo = (parsed.getMonth() + 1).toString().padStart(2, '0');
      const d = parsed.getDate().toString().padStart(2, '0');
      return `${ y }-${ mo }-${ d }`;
    }
    return null;
  }

  private normalizeTime(raw: string): string {
    if (!raw) return '00:00';
    const m = raw.match(/(\d{1,2})[:h](\d{1,2})/);
    if (m) {
      return `${ m[1].padStart(2, '0') }:${ m[2].padStart(2, '0') }`;
    }
    return raw;
  }
}
