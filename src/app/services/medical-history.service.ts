import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** Loại sự kiện y tế (V2 — có cấu trúc, lọc, màu) */
export type MedicalEventKind =
  | 'vaccine'
  | 'checkup'
  | 'medication'
  | 'illness'
  | 'lab'
  | 'other';

export interface MedicalHistoryEntry {
  user: string;
  /** YYYY-MM-DD */
  date: string;
  kind: MedicalEventKind;
  title: string;
  detail: string;
  place?: string;
  /** id file ảnh trên tab Explorer (thư mục « Y tế ») */
  attachmentExplorerId?: number;
  rowIndex?: number;
}

export interface MedicalSheetResponse {
  success: boolean;
  rowIndex?: number;
  error?: string;
}

const KIND_SET = new Set<string>([
  'vaccine',
  'checkup',
  'medication',
  'illness',
  'lab',
  'other',
]);

function parseKind(raw: string): MedicalEventKind {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return KIND_SET.has(s) ? (s as MedicalEventKind) : 'other';
}

@Injectable({ providedIn: 'root' })
export class MedicalHistoryService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'MedicalHistory';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;

  private readonly APPS_SCRIPT_URL = environment.production
    ? environment.googleFeedingAppsScriptUrl || environment.googleAppsScriptUrl
    : '/api/feeding-apps-script';

  /**
   * Cột:
   *   A = User
   *   B = Ngày (DD/MM/YYYY)
   *   C = Loại (slug)
   *   D = Tiêu đề
   *   E = Chi tiết
   *   F = Nơi khám / ghi chú ngắn
   */
  getEntries(): Observable<MedicalHistoryEntry[]> {
    const range = `${this.SHEET_NAME}!A2:F`;
    const url = `${this.BASE_URL}/values/${range}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => {
        const rows = resp.values || [];
        return rows
          .map((row, idx) => {
            const rowUser = (row[0] || '').trim();
            const dateStr = (row[1] || '').trim();
            const kindRaw = (row[2] || '').trim();
            const title = (row[3] || '').trim();
            const detail = (row[4] || '').trim();
            const place = (row[5] || '').trim();

            if (!dateStr || !title) return null;

            const date = this.parseSheetDate(dateStr);
            if (!date) return null;

            const entry: MedicalHistoryEntry = {
              user: rowUser.toLowerCase(),
              date,
              kind: parseKind(kindRaw),
              title,
              detail,
              place: place || undefined,
              rowIndex: idx + 2,
            };
            return entry;
          })
          .filter((e): e is MedicalHistoryEntry => !!e)
          .sort((a, b) => b.date.localeCompare(a.date));
      }),
      catchError((err) => {
        console.error('MedicalHistoryService.getEntries failed', err);
        return throwError(() => err);
      })
    );
  }

  addEntry(entry: MedicalHistoryEntry): Observable<MedicalSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'addMedicalHistory',
      log: {
        user: entry.user,
        date: entry.date,
        kind: entry.kind,
        title: entry.title,
        detail: entry.detail || '',
        place: entry.place || '',
      },
    }).pipe(catchError(() => of({ success: true })));
  }

  updateEntry(
    rowIndex: number,
    patch: {
      date?: string;
      kind?: MedicalEventKind;
      title?: string;
      detail?: string;
      place?: string;
    }
  ): Observable<MedicalSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'updateMedicalHistory',
      row: rowIndex,
      patch,
    }).pipe(catchError(() => of({ success: true })));
  }

  deleteEntry(rowIndex: number): Observable<MedicalSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    return this.postToAppsScript({
      action: 'deleteMedicalHistory',
      row: rowIndex,
    }).pipe(catchError(() => of({ success: true })));
  }

  private postToAppsScript(
    body: Record<string, unknown>
  ): Observable<MedicalSheetResponse> {
    const url = this.APPS_SCRIPT_URL;
    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.post<MedicalSheetResponse>(url, body, { headers });
    }

    const payload = JSON.stringify(body);
    return from(
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow',
      }).then((): MedicalSheetResponse => ({ success: true }))
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
}
