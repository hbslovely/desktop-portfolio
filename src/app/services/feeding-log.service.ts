import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
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

/** Pha sữa đọc từ `Feeding!G1:K1` (K = ISO lúc pha, do app ghi). */
export interface BottlePrepFromSheet {
  volumeMl: number;
  at: string;
  user: string;
}

/** Cột tab Google Sheet `Settings`: ID | Tên chỉ tiêu | Giá trị | Đơn vị | Kiểu dữ liệu */
export interface FeedingSettingRow {
  id: string;
  name: string;
  value: string;
  unit: string;
  dataType: string;
}

/** Giá trị đã parse — app chỉ bind theo `FEEDING_SETTING_ID`, không theo tên hiển thị. */
export interface FeedingSettingsResolved {
  /**
   * Ngưỡng **H** (giờ) giữa hai cữ: cảnh báo khi khoảng cách **≥ H** — ID `FEED_TIME_WARNING`.
   */
  feedTimeWarningHours: number;
  /** Cữ có dung tích < giá trị này (ml) — `FEED_WARNING_AMOUNT`. */
  feedWarningMl: number;
}

/** ID cố định trên sheet — khi lưu chỉ gửi các key này. */
export const FEEDING_SETTING_ID = {
  FEED_TIME_WARNING: 'FEED_TIME_WARNING',
  FEED_WARNING_AMOUNT: 'FEED_WARNING_AMOUNT',
} as const;

const DEFAULT_FEEDING_SETTINGS: FeedingSettingsResolved = {
  feedTimeWarningHours: 3,
  feedWarningMl: 40,
};

export function parseFeedingSettingsFromRows(
  rows: FeedingSettingRow[]
): FeedingSettingsResolved {
  const byId = new Map(rows.map((r) => [r.id.trim(), r]));
  const timeRow =
    byId.get(FEEDING_SETTING_ID.FEED_TIME_WARNING) ??
    byId.get('GROUP_FEEDING_TIME');
  const wRow = byId.get(FEEDING_SETTING_ID.FEED_WARNING_AMOUNT);

  let feedTimeWarningHours = parseFloat(
    String(timeRow?.value ?? '').replace(',', '.').trim()
  );
  let feedWarningMl = parseInt(
    String(wRow?.value ?? '').replace(/[^\d]/g, ''),
    10
  );

  if (!Number.isFinite(feedTimeWarningHours) || feedTimeWarningHours <= 0) {
    feedTimeWarningHours = DEFAULT_FEEDING_SETTINGS.feedTimeWarningHours;
  }
  if (!Number.isFinite(feedWarningMl) || feedWarningMl <= 0) {
    feedWarningMl = DEFAULT_FEEDING_SETTINGS.feedWarningMl;
  }

  feedTimeWarningHours = Math.min(48, Math.max(0.25, feedTimeWarningHours));
  feedWarningMl = Math.min(500, Math.max(1, feedWarningMl));

  return { feedTimeWarningHours, feedWarningMl };
}

@Injectable({ providedIn: 'root' })
export class FeedingLogService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'Feeding';
  private readonly SETTINGS_SHEET_NAME = 'Settings';
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

  /**
   * Đọc pha sữa từ dòng 1: G nhãn | H user | I ml | J giờ | K ISO (app).
   * Chỉ trả dữ liệu khi **H** khớp `currentUser` (`?user=`).
   * Nếu K trống (script cũ): suy ra `at` từ J + ngày gần nhất với giờ đó.
   */
  getBottlePrep(): Observable<BottlePrepFromSheet | null> {
    const range = `${ this.SHEET_NAME }!G1:K1`;
    const url = `${ this.BASE_URL }/values/${ range }?key=${ this.API_KEY }&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => this.parseBottlePrepRow(resp.values?.[0])),
      catchError((err) => {
        console.error('FeedingLogService.getBottlePrep failed', err);
        return of(null);
      })
    );
  }

  /**
   * Đọc tab `Settings` (A:E từ dòng 2). Cột A = **ID** (khóa ổn định), C = giá trị.
   * Sheet cần public read như tab Feeding.
   */
  getFeedingSettings(): Observable<FeedingSettingRow[]> {
    const range = `${this.SETTINGS_SHEET_NAME}!A2:E`;
    const url = `${this.BASE_URL}/values/${encodeURIComponent(range)}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => {
        const rows = resp.values || [];
        return rows
          .map((row) => ({
            id: String(row[0] ?? '').trim(),
            name: String(row[1] ?? '').trim(),
            value: String(row[2] ?? '').trim(),
            unit: String(row[3] ?? '').trim(),
            dataType: String(row[4] ?? '').trim(),
          }))
          .filter((r) => r.id.length > 0);
      }),
      catchError((err) => {
        console.error('FeedingLogService.getFeedingSettings failed', err);
        return of([]);
      })
    );
  }

  /**
   * Cập nhật **cột Giá trị** theo **ID** (cột A). POST qua Apps Script
   * `action: 'updateFeedingSettings'`, body: `{ updates: [{ id, value }] }`.
   */
  saveFeedingSettings(
    updates: { id: string; value: number }[]
  ): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'updateFeedingSettings',
      updates: updates.map((u) => ({
        id: String(u.id || '').trim(),
        value: u.value,
      })),
    }).pipe(
      catchError((err) => {
        console.error('saveFeedingSettings', err);
        return of({ success: false, error: String(err?.message || err) });
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
        return of({ success: true });
      })
    );
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
    }).pipe(
      catchError(() => {
        return of({ success: true });
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
        return of({ success: true });
      })
    );
  }

  /**
   * Ghi dòng 1 cột G–K tab Feeding: … | giờ pha | **K = ISO** (để load chính xác).
   * Apps Script: action `setBottlePrep`.
   */
  setBottlePrepOnSheet(payload: {
    user: string;
    volumeMl: number;
    time: string;
    atIso: string;
  }): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    return this.postToAppsScript({
      action: 'setBottlePrep',
      user: payload.user,
      volumeMl: payload.volumeMl,
      time: payload.time,
      atIso: payload.atIso,
    }).pipe(
      catchError((err) => {
        return of({ success: true });
      })
    );
  }

  /**
   * Xoá H1:K1 trên tab Feeding. Apps Script: `clearBottlePrep`.
   */
  clearBottlePrepOnSheet(): Observable<FeedingSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    return this.postToAppsScript({
      action: 'clearBottlePrep',
    }).pipe(
      catchError((err) => {
        return of({ success: true });
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

  private parseBottlePrepRow(
    row: string[] | undefined,
  ): BottlePrepFromSheet | null {
    if (!row?.length) return null;
    const sheetUser = String(row[1] ?? '')
      .toLowerCase()
      .trim();
    const volRaw = String(row[2] ?? '').trim();
    const timeRaw = String(row[3] ?? '').trim();
    const isoRaw = String(row[4] ?? '').trim();

    const volumeMl = parseInt(volRaw.replace(/[^\d]/g, ''), 10) || 0;
    if (volumeMl <= 0 || !timeRaw) return null;

    const fromK = isoRaw ? new Date(isoRaw) : null;
    const at =
      fromK && !isNaN(fromK.getTime())
        ? fromK.toISOString()
        : this.guessIsoFromClockTime(this.normalizeTime(timeRaw));

    return { volumeMl, at, user: sheetUser };
  }

  /** Khi sheet chưa có cột K: chọn ngày (hôm qua / hôm nay / mai) sao cho giờ J gần `now` nhất. */
  private guessIsoFromClockTime(hm: string): string {
    const parts = hm.split(':').map((x) => parseInt(x, 10));
    const hh = parts[0];
    const mm = parts[1];
    if (isNaN(hh) || isNaN(mm)) return new Date().toISOString();

    const now = new Date();
    let best = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hh,
      mm,
      0,
      0
    );
    let bestDiff = Math.abs(now.getTime() - best.getTime());

    for (const delta of [ -1, 1 ]) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + delta,
        hh,
        mm,
        0,
        0
      );
      const diff = Math.abs(now.getTime() - d.getTime());
      if (diff < bestDiff) {
        best = d;
        bestDiff = diff;
      }
    }

    return best.toISOString();
  }
}
