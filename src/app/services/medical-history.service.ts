import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GoogleSheetsService } from './google-sheets.service';
import { MedicalDataMapperService } from '../pages/feeding/medical-history/medical-data-mapper.service';
import { MedicalErrorHandlerService } from '../pages/feeding/medical-history/medical-error-handler.service';
import {
  MEDICAL_KINDS,
  type MedicalEventKind,
} from '../pages/feeding/medical-history/medical-history-kinds.data';

export type { MedicalEventKind };

export interface MedicalHistoryEntry {
  user: string;
  /** YYYY-MM-DD */
  date: string;
  kind: MedicalEventKind;
  title: string;
  detail: string;
  place?: string;
  /** Google Drive file ID for medical image attachments */
  driveFileId?: string;
  rowIndex?: number;
}

export interface MedicalSheetResponse {
  success: boolean;
  rowIndex?: number;
  error?: string;
}


@Injectable({ providedIn: 'root' })
export class MedicalHistoryService {
  private http = inject(HttpClient);
  private googleSheets = inject(GoogleSheetsService);
  private dataMapper = inject(MedicalDataMapperService);
  private errorHandler = inject(MedicalErrorHandlerService);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_GID = '836488919'; // Medical History tab GID
  private readonly SHEET_NAME = 'MedicalHistory'; // Will fallback to GID if name doesn't work

  private readonly APPS_SCRIPT_URL = '/api/feeding-apps-script';

  /**
   * Cột:
   *   A = User
   *   B = Ngày (DD/MM/YYYY)
   *   C = Loại (slug)
   *   D = Tiêu đề
   *   E = Chi tiết
   *   F = Nơi khám / ghi chú ngắn
   *   G = Google Drive file ID cho ảnh đính kèm, có thể để trống
   */
  getEntries(): Observable<MedicalHistoryEntry[]> {
    const config = {
      spreadsheetId: this.SHEET_ID,
      sheetGid: this.SHEET_GID,
      range: 'A2:H' // Include column H for id file Explorer
    };

    return this.googleSheets.getSheetValues(config).pipe(
      map(rows => {
        console.log(`Fetched ${rows.length} rows from Google Sheets`);
        const entries = this.dataMapper.mapRowsToEntries(rows);
        console.log(`Mapped to ${entries.length} valid medical history entries`);
        return entries;
      }),
      catchError(err => {
        const handledError = this.errorHandler.handleError(err);
        console.error('MedicalHistoryService.getEntries failed', {
          original: err,
          handled: handledError
        });
        return throwError(() => handledError);
      })
    );
  }

  /**
   * Test method to verify Google Sheets connection and data format
   */
  testConnection(): Observable<{ success: boolean; message: string; rowCount: number }> {
    const config = {
      spreadsheetId: this.SHEET_ID,
      sheetGid: this.SHEET_GID,
      range: 'A1:H10' // Test with first 10 rows including header
    };

    return this.googleSheets.getSheetValues(config).pipe(
      map(rows => {
        const hasHeader = rows.length > 0;
        const headerRow = hasHeader ? rows[0] : [];
        const dataRows = rows.slice(1);
        const entries = this.dataMapper.mapRowsToEntries(dataRows);

        return {
          success: true,
          message: `Connected successfully. Header: [${headerRow.join(', ')}]. Found ${entries.length} valid entries.`,
          rowCount: dataRows.length
        };
      }),
      catchError(err => {
        return of({
          success: false,
          message: `Connection failed: ${err.message}`,
          rowCount: 0
        });
      })
    );
  }


  addEntry(entry: MedicalHistoryEntry): Observable<MedicalSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    // Validate entry data before sending
    const validationErrors = this.dataMapper.validateEntry(entry);
    if (validationErrors.length > 0) {
      return throwError(() => new Error(`Validation failed: ${validationErrors.join(', ')}`));
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
        attachment_id: entry.driveFileId || '',
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
      /** Gửi `null` hoặc `''` để xoá đính kèm */
      driveFileId?: string | null | '';
    }
  ): Observable<MedicalSheetResponse> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }
    const bodyPatch: Record<string, unknown> = {};
    if (patch.date !== undefined) bodyPatch['date'] = patch.date;
    if (patch.kind !== undefined) bodyPatch['kind'] = patch.kind;
    if (patch.title !== undefined) bodyPatch['title'] = patch.title;
    if (patch.detail !== undefined) bodyPatch['detail'] = patch.detail;
    if (patch.place !== undefined) bodyPatch['place'] = patch.place;
    if (
      Object.prototype.hasOwnProperty.call(patch, 'driveFileId')
    ) {
      const v = patch.driveFileId;
      bodyPatch['attachment_id'] =
        v === null || v === '' ? '' : v;
    }

    return this.postToAppsScript({
      action: 'updateMedicalHistory',
      row: rowIndex,
      patch: bodyPatch,
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
      // 🚀 Mobile CORS fix: Avoid preflight by using simple content-type for dev proxy
      const headers = new HttpHeaders({ 
        'Content-Type': 'text/plain;charset=UTF-8' 
      });
      return this.http.post<MedicalSheetResponse>(url, JSON.stringify(body), { headers });
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
