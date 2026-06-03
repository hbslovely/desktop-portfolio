import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, scan, switchMap, takeLast } from 'rxjs/operators';
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
  /** Google Drive file id (nếu đã migrate/saved qua Drive). */
  driveFileId?: string;
  /** MIME type gốc (image/jpeg, application/pdf...). */
  mimeType?: string;
  /** Trạng thái lưu trữ: sheet (legacy) | drive | migrated | migration_failed. */
  storageStatus?: string;
  /** Ảnh preview đã fetch lazy qua Apps Script, ưu tiên hiển thị hơn content legacy. */
  previewUrl?: string;
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

  // Loading states for UI
  /** Đang loading preview/content từ Drive */
  isLoading?: boolean;
  /** Lỗi khi load preview/content */
  loadError?: boolean;
}

export interface ExplorerResponse {
  success: boolean;
  entries?: ExplorerEntry[];
  entry?: ExplorerEntry;
  id?: number;
  error?: string;
}

export interface ExplorerFileResponse {
  success: boolean;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  dataUrl?: string;
  error?: string;
}

export interface ExplorerMigrationResponse {
  success: boolean;
  migratedCount?: number;
  migratedFolders?: number;
  migratedFiles?: number;
  failedCount?: number;
  hasMore?: boolean;
  error?: string;
}

/**
 * ExplorerService (Drive-first):
 * - Cây thư mục và file metadata đọc qua Apps Script action `getExplorer`.
 * - Binary file lưu private trong Google Drive (account B), Apps Script account A làm proxy.
 * - Không phụ thuộc tab `Explorer` trong Google Sheet sau khi finalize migration.
 */
@Injectable({ providedIn: 'root' })
export class ExplorerService {
  private http = inject(HttpClient);

  private readonly APPS_SCRIPT_URL = environment.production
    ? environment.googleFeedingAppsScriptUrl
    : '/api/feeding-apps-script';

  getEntries(): Observable<ExplorerEntry[]> {
    return this.postToAppsScriptExpectResponse<ExplorerResponse>({
      action: 'getExplorer',
    }).pipe(
      map((resp) => {
        if (!resp?.success) {
          throw new Error(resp?.error || 'Không tải được danh sách Explorer');
        }
        return (resp.entries || [])
          .map((entry) => this.normalizeEntry(entry))
          .filter((entry): entry is ExplorerEntry => !!entry);
      })
    );
  }

  private parseDriveFileId(raw: unknown): string {
    const s = String(raw || '').trim();
    if (!s) return '';
    // Drive file id thường >= 20 ký tự gồm chữ/số/_/-
    if (!/^[A-Za-z0-9_-]{20,}$/.test(s)) return '';
    return s;
  }

  private parseMimeType(raw: unknown): string {
    const s = String(raw || '')
      .trim()
      .toLowerCase();
    if (!s || !s.includes('/')) return '';
    return s;
  }

  private parseSize(raw: unknown): number {
    if (raw === undefined || raw === null || raw === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
  }

  private parseStorageStatus(raw: unknown): string {
    const s = String(raw || '')
      .trim()
      .toLowerCase();
    if (!s) return '';
    return s;
  }

  private normalizeEntry(entry: ExplorerEntry): ExplorerEntry | null {
    const id = Number(entry?.id);
    const type = String(entry?.type || '').toLowerCase();
    const name = String(entry?.name || '').trim();
    if (!id || !name) return null;
    if (type !== 'folder' && type !== 'file') return null;
    const content = type === 'file' ? String(entry?.content || '') : undefined;
    return {
      id,
      name,
      type: type as ExplorerType,
      parentId: this.toParentId(entry?.parentId),
      content: content || undefined,
      driveFileId: this.parseDriveFileId(entry?.driveFileId),
      mimeType: this.parseMimeType(entry?.mimeType),
      storageStatus: this.parseStorageStatus(entry?.storageStatus),
      createdAt: entry?.createdAt ? String(entry.createdAt) : undefined,
      sizeBytes: this.parseSize(entry?.sizeBytes),
      rowIndex: this.parseSize(entry?.rowIndex) || undefined,
    };
  }

  private toParentId(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  addEntry(payload: {
    name: string;
    type: ExplorerType;
    parentId: number;
    content?: string;
    mimeType?: string;
    sizeBytes?: number;
  }): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'addExplorer',
      entry: {
        name: payload.name,
        type: payload.type,
        parent_id: payload.parentId,
        content: payload.type === 'file' ? payload.content || '' : '',
        mimeType: payload.mimeType || '',
        sizeBytes: payload.sizeBytes || 0,
      },
    });
  }

  /**
   * Update tên (folder/file) hoặc nội dung (file). KHÔNG cho đổi `type` hoặc
   * `parent_id` — nếu cần thì xoá rồi thêm mới.
   */
  updateEntry(
    id: number,
    patch: { name?: string; content?: string; mimeType?: string; sizeBytes?: number }
  ): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'updateExplorer',
      id,
      patch: {
        name: patch.name,
        content: patch.content,
        mimeType: patch.mimeType,
        sizeBytes: patch.sizeBytes,
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
  moveEntries(ids: number[], parentId: number): Observable<ExplorerResponse> {
    return this.postToAppsScript({
      action: 'moveExplorer',
      ids,
      parentId,
    });
  }

  /**
   * Upload ảnh medical lên Google Drive thông qua addExplorer.
   * Trả về thông tin file bao gồm driveFileId.
   */
  uploadMedicalImageToDrive(payload: {
    fileName: string;
    dataUrl: string;
    mimeType: string;
    sizeBytes: number;
    parentId: number;
  }): Observable<ExplorerResponse & { driveFileId?: string }> {
    return this.addEntry({
      name: payload.fileName,
      type: 'file',
      parentId: payload.parentId,
      content: payload.dataUrl,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
    }).pipe(
      switchMap((response) => {
        if (!response.success || !response.id) {
          throw new Error('Upload thất bại');
        }

        // Lấy thông tin entry vừa tạo để có driveFileId
        return this.getEntries().pipe(
          map((entries) => {
            const createdEntry = entries.find((e) => e.id === response.id);
            return {
              ...response,
              driveFileId: createdEntry?.driveFileId,
            };
          })
        );
      })
    );
  }

  /**
   * Lấy nội dung file (data URL) qua Apps Script action `getExplorerFile`.
   * Dùng cho preview/download khi file đã chuyển sang Drive private.
   * Bây giờ có thể nhận cả Explorer ID hoặc Drive file ID.
   */
  getFileDataUrl(id: number | string): Observable<ExplorerFileResponse> {
    const body: { action: string; driveFileId?: string; id?: number } = {
      action: 'getExplorerFile',
    };

    // Nếu là string và không phải số, coi như driveFileId
    if (typeof id === 'string' && !/^\d+$/.test(id)) {
      body.driveFileId = id;
    } else {
      body.id = typeof id === 'string' ? parseInt(id, 10) : id;
    }

    return this.postToAppsScriptExpectResponse<ExplorerFileResponse>(body).pipe(
      map((resp) => {
        if (!resp?.success) {
          throw new Error(resp?.error || 'Không lấy được nội dung file');
        }
        return resp;
      })
    );
  }

  /**
   * Lấy nội dung nhiều file song song để tối ưu hiệu suất.
   * Trả về Map<id, ExplorerFileResponse> để dễ dàng map với entry tương ứng.
   */
  getMultipleFileDataUrls(ids: number[]): Observable<Map<number, ExplorerFileResponse>> {
    if (ids.length === 0) {
      return of(new Map());
    }

    // Tạo observable cho từng file
    const requests = ids.map((id) =>
      this.getFileDataUrl(id).pipe(
        map((response) => ({ id, response })),
        catchError((error) => {
          console.warn(`Failed to load file ${id}:`, error);
          return of({ id, response: null });
        })
      )
    );

    // Chạy song song và merge results
    return from(requests).pipe(
      mergeMap((request) => request, 5), // Giới hạn 5 requests đồng thời để tránh quá tải
      scan((acc, { id, response }) => {
        if (response) {
          acc.set(id, response);
        }
        return acc;
      }, new Map<number, ExplorerFileResponse>()),
      takeLast(1) // Chỉ lấy kết quả cuối cùng khi tất cả đã hoàn thành
    );
  }

  migrateExplorerToDrive(payload?: {
    destinationFolderId?: string;
    limit?: number;
    startAfterId?: number;
  }): Observable<ExplorerMigrationResponse> {
    return this.postToAppsScriptExpectResponse<ExplorerMigrationResponse>({
      action: 'migrateExplorerToDrive',
      ...payload,
    });
  }

  deleteExplorerSheetAfterMigration(): Observable<ExplorerResponse> {
    return this.postToAppsScriptExpectResponse<ExplorerResponse>({
      action: 'deleteExplorerSheetAfterMigration',
    });
  }

  /**
   * Gửi POST tới Google Apps Script (cùng pattern với `FeedingLogService`).
   *
   * **Lưu ý quan trọng**: Apps Script web app trả `302 Found` redirect sang
   * `script.googleusercontent.com` cho POST, kèm CORS thoáng cho GET nhưng
   * **không phản hồi CORS đúng cho POST response**. Hệ quả:
   *  - Apps Script `doPost` chạy thành công, **dữ liệu đã được ghi vào sheet**.
   *  - Browser/HttpClient cố theo redirect → đụng CORS / non-JSON → throw
   *    error mặc dù request đã có hiệu lực.
   *
   * Vì vậy: swallow lỗi response và **luôn coi như thành công**. Component
   * sẽ tự `loadEntries()` sau ~800-1000ms để verify state thật. Cách này
   * đồng nhất với `FeedingLogService.addLog/updateLog/deleteLog` trong cùng
   * codebase.
   *
   * Trade-off: nếu Apps Script thực sự fail (quota, sai action…), UI báo
   * thành công nhưng reload sẽ không thấy thay đổi → user tự nhận biết.
   * Đổi lại: không bao giờ báo "lỗi" khi backend đã ghi thành công (nguyên
   * nhân của bug "upload báo lỗi nhưng vẫn upload được").
   */
  private postToAppsScript(body: Record<string, unknown>): Observable<ExplorerResponse> {
    const url = this.APPS_SCRIPT_URL;
    if (!url) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    const isProxy = this.shouldUseJsonProxy();

    if (isProxy) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.post<ExplorerResponse>(url, body, { headers }).pipe(
        catchError((err) => {
          console.warn(
            '[ExplorerService] POST response không parse được — coi như đã ghi thành công, sẽ reload để verify.',
            err
          );
          return of({ success: true } as ExplorerResponse);
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
      catchError((err) => {
        console.warn('[ExplorerService] POST (no-cors) lỗi — coi như thành công.', err);
        return of({ success: true });
      })
    );
  }

  /**
   * Dùng cho action bắt buộc cần đọc JSON response (vd getExplorerFile).
   * Nếu không đi qua proxy tương thích CORS thì throw lỗi để user cấu hình lại.
   */
  private postToAppsScriptExpectResponse<T>(body: Record<string, unknown>): Observable<T> {
    const url = this.APPS_SCRIPT_URL;
    if (!url) {
      return throwError(() => new Error('Chưa cấu hình Google Apps Script URL'));
    }

    if (!this.shouldUseJsonProxy()) {
      return throwError(
        () =>
          new Error(
            'Endpoint hiện tại không đọc được response do CORS. Hãy dùng proxy /api/feeding-apps-script.'
          )
      );
    }

    // 🚀 Mobile CORS fix: Use simple content-type only for proxy (dev)
    const isProxy = this.shouldUseJsonProxy();
    const headers = new HttpHeaders({
      'Content-Type': isProxy ? 'text/plain;charset=UTF-8' : 'application/json',
    });
    const requestBody = isProxy ? JSON.stringify(body) : body;
    return this.http.post<T>(url, requestBody, { headers });
  }

  private shouldUseJsonProxy(): boolean {
    return this.APPS_SCRIPT_URL.startsWith('/');
  }

  /**
   * Đọc 1 file ảnh (File hoặc Blob) → resize/compress xuống tối đa
   * `maxSize`px (cạnh dài) ở chất lượng JPEG `quality`, trả về data URL
   * base64. Mục đích: né giới hạn 50.000 ký tự / cell của Google Sheets.
   *
   * Khoảng an toàn để ảnh JPEG ~30–35 KB sau base64: maxSize 720, quality 0.7.
   */
  async fileToCompressedBase64(file: File, maxSize = 720, quality = 0.7): Promise<string> {
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

  /** Đọc file bất kỳ thành data URL (phục vụ upload file non-image). */
  async fileToDataUrl(file: File): Promise<string> {
    return this.readAsDataURL(file);
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
