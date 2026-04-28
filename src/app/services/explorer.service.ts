import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type ExplorerType = 'folder' | 'file';

export interface ExplorerEntry {
  id: number;
  name: string;
  type: ExplorerType;
  /** null = không có cha (chỉ có root) */
  parentId: number | null;
  /** base64 data URL cho file. Folder thì để trống. */
  content?: string;
  /** ISO timestamp khi entry được tạo trong sheet (server-side stamp). */
  createdAt?: string;
  /**
   * Kích thước file (byte) — ước lượng từ độ dài base64 sau khi đã trừ
   * phần header `data:image/...;base64,`. base64 gấp ~4/3 lần binary nên
   * `bytes ≈ encodedLen * 3/4`. Folder = 0.
   */
  sizeBytes?: number;
  /** Row trong sheet (1-based, header = row 1) — chỉ có khi load từ sheet */
  rowIndex?: number;
}

export interface ExplorerResponse {
  success: boolean;
  entries?: ExplorerEntry[];
  entry?: ExplorerEntry;
  id?: number;
  error?: string;
}

/**
 * Service quản lý cây thư mục/ảnh trên tab `Explorer` của sheet feeding.
 *
 * Layout cột (7 cột):
 *   A=id  B=name  C=type  D=parent_id  E=Content(base64)  F=created_at  G=isDeleted
 *
 * Read: dùng Sheets API v4 + API Key (nhanh, không CORS). Client tự filter
 * các row có `isDeleted=TRUE` (soft delete) để không hiển thị, đồng bộ với
 * `handleGetExplorer` ở Apps Script.
 *
 * Write: POST tới cùng Apps Script đã dùng cho feeding (action mới).
 */
@Injectable({ providedIn: 'root' })
export class ExplorerService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
  private readonly SHEET_NAME = 'Explorer';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${ this.SHEET_ID }`;

  private readonly APPS_SCRIPT_URL = environment.production
    ? (environment.googleFeedingAppsScriptUrl || environment.googleAppsScriptUrl)
    : '/api/feeding-apps-script';

  getEntries(): Observable<ExplorerEntry[]> {
    // Range A2:G để đọc thêm cột created_at (F) + isDeleted (G).
    // Sheets API trả về row với độ dài thực tế của cell có giá trị, nên các
    // sheet cũ (5 hoặc 6 cột) vẫn parse được — `row[5]` / `row[6]` sẽ là
    // undefined và code xử lý như chuỗi rỗng.
    const range = `${ this.SHEET_NAME }!A2:G`;
    const url = `${ this.BASE_URL }/values/${ range }?key=${ this.API_KEY }&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<{ values?: string[][] }>(url).pipe(
      map((resp) => {
        const rows = resp.values || [];
        return rows
          .map((row, idx) => {
            // Soft-delete filter: skip row có cột G truthy. Đặt trước cùng
            // cho gọn — nếu đã xoá thì khỏi cần parse các cột khác.
            if (this.parseBool(row[6])) return null;

            const idStr = (row[0] || '').toString().trim();
            const name = (row[1] || '').toString().trim();
            const typeStr = (row[2] || '').toString().trim().toLowerCase();
            const parentStr = (row[3] || '').toString().trim();
            const content = row[4] || '';
            const createdRaw = (row[5] || '').toString().trim();

            const id = parseInt(idStr, 10);
            if (!id || !name) return null;
            if (typeStr !== 'folder' && typeStr !== 'file') return null;

            const parentId = parentStr === '' || parentStr.toLowerCase() === 'null'
              ? null
              : parseInt(parentStr, 10) || null;

            const contentStr = typeStr === 'file' ? String(content) : '';
            const sizeBytes = typeStr === 'file' ? this.estimateBase64Bytes(contentStr) : 0;

            const entry: ExplorerEntry = {
              id,
              name,
              type: typeStr as ExplorerType,
              parentId,
              content: typeStr === 'file' ? contentStr : undefined,
              createdAt: createdRaw || undefined,
              sizeBytes,
              rowIndex: idx + 2,
            };
            return entry;
          })
          .filter((e): e is ExplorerEntry => !!e);
      }),
      catchError((err) => {
        console.error('ExplorerService.getEntries failed', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Parse value của cột isDeleted. Sheets API (FORMATTED_VALUE) thường trả
   * về `TRUE` / `FALSE` cho boolean cell, nhưng cũng có thể là `1` / `0`
   * nếu user nhập tay. Trống = false.
   */
  private parseBool(raw: unknown): boolean {
    if (raw === undefined || raw === null) return false;
    const s = String(raw).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  }

  /**
   * Ước lượng số byte gốc từ độ dài chuỗi base64. Cần loại header
   * `data:...;base64,` trước khi tính vì header không phải payload.
   *  - Mỗi 4 ký tự base64 = 3 byte.
   *  - Padding `=` cuối chuỗi giảm bớt 1-2 byte → trừ đi cho chính xác.
   */
  private estimateBase64Bytes(dataUrl: string): number {
    if (!dataUrl) return 0;
    const commaIdx = dataUrl.indexOf(',');
    const payload = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const len = payload.length;
    if (len === 0) return 0;
    let padding = 0;
    if (payload.endsWith('==')) padding = 2;
    else if (payload.endsWith('=')) padding = 1;
    return Math.max(0, Math.floor((len * 3) / 4) - padding);
  }

  addEntry(payload: {
    name: string;
    type: ExplorerType;
    parentId: number;
    content?: string;
  }): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'addExplorer',
      entry: {
        name: payload.name,
        type: payload.type,
        parent_id: payload.parentId,
        content: payload.type === 'file' ? (payload.content || '') : '',
      },
    });
  }

  /**
   * Update tên (folder/file) hoặc nội dung (file). KHÔNG cho đổi `type` hoặc
   * `parent_id` — nếu cần thì xoá rồi thêm mới.
   */
  updateEntry(
    id: number,
    patch: { name?: string; content?: string }
  ): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'updateExplorer',
      id,
      patch: {
        name: patch.name,
        content: patch.content,
      },
    });
  }

  /**
   * **Soft delete** entry. Server set cột `isDeleted=TRUE` thay vì xoá row
   * vật lý → có thể restore thủ công bằng cách đổi cột G về `FALSE` trong
   * Google Sheets. Nếu là folder, server cascade soft-delete toàn bộ con
   * cháu trong cùng một call.
   *
   * Phía client không cần biết khác biệt: getEntries() đã filter sẵn các
   * row đã xoá nên UI thấy biến mất ngay.
   */
  deleteEntry(id: number): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'deleteExplorer',
      id,
    });
  }

  /**
   * Chuyển một mảng file (chỉ file, folder sẽ bị server bỏ qua) sang
   * folder cha mới. Dùng cho thao tác cut & paste nhiều file 1 lần.
   *
   * `parentId` phải là folder đã tồn tại. Server validate.
   */
  moveEntries(
    ids: number[],
    parentId: number
  ): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'moveExplorer',
      ids,
      parentId,
    });
  }

  private postToAppsScript(
    body: Record<string, unknown>
  ): Observable<ExplorerResponse> {
    const url = this.APPS_SCRIPT_URL;
    if (!url) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    const isProxy = !environment.production;

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http
        .post<ExplorerResponse>(url, body, { headers })
        .pipe(
          catchError((err) => {
            console.error('ExplorerService POST failed (dev)', err);
            return throwError(() => err);
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
      }).then((): ExplorerResponse => ({ success: true }))
    ).pipe(
      catchError(() => of({ success: true }))
    );
  }

  /**
   * Đọc 1 file ảnh (File hoặc Blob) → resize/compress xuống tối đa
   * `maxSize`px (cạnh dài) ở chất lượng JPEG `quality`, trả về data URL
   * base64. Mục đích: né giới hạn 50.000 ký tự / cell của Google Sheets.
   *
   * Khoảng an toàn để ảnh JPEG ~30–35 KB sau base64: maxSize 720, quality 0.7.
   */
  async fileToCompressedBase64(
    file: File,
    maxSize = 720,
    quality = 0.7
  ): Promise<string> {
    const dataUrl = await this.readAsDataURL(file);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Không đọc được file ảnh'));
      i.src = dataUrl;
    });

    let { width, height } = img;
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không khởi tạo được canvas');
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  }

  private readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(file);
    });
  }
}
