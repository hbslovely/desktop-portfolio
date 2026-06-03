import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WeightLog {
  user: string;
  /** YYYY-MM-DD */
  date: string;
  /** kg — có thể lẻ (vd 4.25) */
  weightKg: number;
  /** cm — tuỳ chọn, thường chỉ đo khi khám định kỳ */
  heightCm?: number;
  note?: string;
  rowIndex?: number;
}

export interface WeightSheetResponse {
  success: boolean;
  rowIndex?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WeightLogService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'Weight';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;

  private readonly APPS_SCRIPT_URL = '/api/feeding-apps-script';

  /**
   * Cột:
   *   A = User
   *   B = Ngày (DD/MM/YYYY)
   *   C = Cân nặng (kg)
   *   D = Chiều cao (cm, tuỳ chọn)
   *   E = Ghi chú
   */
  getLogs(): Observable<WeightLog[]> {
    const range = `${this.SHEET_NAME}!A2:E`;
    const url = `${this.BASE_URL}/values/${range}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => {
        const rows = resp.values || [];
        return rows
          .map((row, idx) => {
            const rowUser = (row[0] || '').trim();
            const dateStr = (row[1] || '').trim();
            const weightRaw = (row[2] ?? '').toString().trim();
            const colD = (row[3] ?? '').toString().trim();
            const colE = (row[4] ?? '').toString().trim();

            if (!dateStr || weightRaw === '') return null;

            const date = this.parseSheetDate(dateStr);
            const weightKg = this.parseWeightKg(weightRaw);
            if (!date || weightKg === null || weightKg <= 0) return null;
            const { heightCm, note } = this.resolveHeightAndNote(colD, colE);

            const log: WeightLog = {
              user: rowUser.toLowerCase(),
              date,
              weightKg,
              ...(heightCm !== null ? { heightCm } : {}),
              note: note || undefined,
              rowIndex: idx + 2,
            };
            return log;
          })
          .filter((l): l is WeightLog => !!l)
          .sort((a, b) => {
            const ak = `${a.date}`;
            const bk = `${b.date}`;
            return bk.localeCompare(ak);
          });
      }),
      catchError((err) => {
        console.error('WeightLogService.getLogs failed', err);
        return throwError(() => err);
      })
    );
  }

  addLog(log: WeightLog): Observable<WeightSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'addWeight',
      log: {
        user: log.user,
        date: log.date,
        weight_kg: log.weightKg,
        ...(log.heightCm !== undefined ? { height_cm: log.heightCm } : {}),
        note: log.note || '',
      },
    }).pipe(catchError(() => of({ success: true })));
  }

  updateLog(
    rowIndex: number,
    patch: { date: string; weightKg: number; heightCm?: number | null; note?: string }
  ): Observable<WeightSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'updateWeight',
      row: rowIndex,
      patch: {
        date: patch.date,
        weight_kg: patch.weightKg,
        ...(patch.heightCm !== undefined ? { height_cm: patch.heightCm ?? '' } : {}),
        note: patch.note ?? '',
      },
    }).pipe(catchError(() => of({ success: true })));
  }

  deleteLog(rowIndex: number): Observable<WeightSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'deleteWeight',
      row: rowIndex,
    }).pipe(catchError(() => of({ success: true })));
  }

  private postToAppsScript(body: Record<string, unknown>): Observable<WeightSheetResponse> {
    const url = this.APPS_SCRIPT_URL;
    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.post<WeightSheetResponse>(url, body, { headers });
    }

    const payload = JSON.stringify(body);
    return from(
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow',
      }).then((): WeightSheetResponse => ({ success: true }))
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

  /** Chuỗi "4,25" hoặc "4.25 kg" → số */
  private parseWeightKg(raw: string): number | null {
    const s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
    if (!s) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  /** Chuỗi "63,5" hoặc "63.5cm" → số cm */
  private parseHeightCm(raw: string): number | null {
    const s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
    if (!s) return null;
    const n = parseFloat(s);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n < 30 || n > 130) return null;
    return n;
  }

  /**
   * Ưu tiên format mới: D=height, E=note.
   * Fallback để đọc dữ liệu cũ: D=note, E=height.
   */
  private resolveHeightAndNote(
    colD: string,
    colE: string
  ): { heightCm: number | null; note: string } {
    const dHeight = this.parseHeightCm(colD);
    const eHeight = this.parseHeightCm(colE);

    // Format mới (ưu tiên): D là chiều cao, E là ghi chú.
    if (dHeight !== null) {
      return { heightCm: dHeight, note: colE };
    }

    // Format cũ: D là ghi chú, E là chiều cao.
    if (eHeight !== null) {
      return { heightCm: eHeight, note: colD };
    }

    // Không có chiều cao: ưu tiên ghi chú ở E (format mới),
    // fallback về D nếu E trống (format cũ).
    if (colE) return { heightCm: null, note: colE };
    return { heightCm: null, note: colD };
  }
}
