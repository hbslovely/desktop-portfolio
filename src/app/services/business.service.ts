import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  _0xgenerateToken,
  _0xcomputeHash,
  _0xgetHashedToken,
  _0xvalidate,
  _0xisValid,
  _0xencrypt,
  _0xdecrypt,
  _0xchecksum,
  _0xmultiValidate,
} from '../utils/crypto-obfuscator.util';

export interface BusinessItem {
  rowIndex?: number;

  // Common fields (used across different tabs)
  tenChiPhi?: string; // For "Đầu vào đầu ra": Tên chi phí
  soTien?: string; // For "Đầu vào đầu ra": Số tiền

  // "Nguồn vật liệu" fields
  monHang?: string; // A: Món hàng (Loại nguyên liệu mua)
  giaTien?: string; // B: Giá tiền (Chi phí mua)
  khoiLuong?: string; // C: Khối lượng (Đơn vị tính)
  thuongHieu?: string; // D: Thương hiệu (Loại/hiện)

  // "Nguồn nguyên liệu" fields
  soThuTu?: string; // A: Số thứ tự (có thể bỏ qua)
  monHangNguyenLieu?: string; // B: Món hàng (tên hàng)
  giaGoc?: string; // C: Giá gốc cho mỗi đơn vị
  donViTinh?: string; // D: Đơn vị tính cho mỗi giá
  thuongHieuNguyenLieu?: string; // E: Thương hiệu
  soLuongVien?: string; // F: Số lượng viên mỗi đơn vị
  giaCot?: string; // G: Giá cốt = C / F (calculated)
  giaBanDeXuat?: string; // H: Giá bán đề xuất trên App = G * 2.01 (calculated)
  giaBanLeDeXuat?: string; // I: Giá bán lẻ đề xuất = G * 1.4 (calculated)

  // "Menu" fields
  tenMon?: string; // A: Tên món
  moTa?: string; // B: Mô tả của món
  danhMuc?: string; // C: Danh mục món
  giaBan?: string; // D: Giá bán
  cachCheBien?: string; // E: Cách chế biến

  // "Đầu vào đầu ra" fields (already defined above)
  tongChiPhi?: string; // C: Tổng chi phí tính đến ngày (có thể bỏ qua)
  phanLoai?: string; // D: Phân loại mua hay vào/ra
  san?: string; // E: Sàn - nếu là tiền vào thì là tiền thu từ sàn Be/Shopee/Xanh SM

  // Optional fields
  note?: string;
  date?: string;
}

export type SheetName = 'Menu' | 'Nguồn nguyên liệu' | 'Nguồn vật liệu' | 'Đầu vào đầu ra';

@Injectable({
  providedIn: 'root',
})
export class BusinessService {
  private http = inject(HttpClient);

  private readonly SHEET_ID = environment.googleBusinessSheetId;
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = this.SHEET_ID
    ? `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`
    : '';

  // Use Google Apps Script for write operations (add, update, delete)
  // Google Sheets API v4 does not support write operations with API Key
  // IMPORTANT: API Key can only READ data. You MUST use Google Apps Script for write operations.
  private readonly APPS_SCRIPT_URL = environment.appsScriptDirect
    ? environment.googleBusinessAppsScriptUrl || '/api/business-apps-script'
    : '/api/business-apps-script';

  // Cache for each sheet
  private cache: {
    [key: string]: { data$: Observable<BusinessItem[]> | null; timestamp: number };
  } = {};
  private readonly CACHE_DURATION = 5000;

  /**
   * Get all items from a specific sheet
   * Uses Google Sheets API v4 for reading data (API Key can read public/accessible sheets)
   */
  getItems(sheetName: SheetName, forceRefresh: boolean = false): Observable<BusinessItem[]> {
    if (!this.BASE_URL || !this.API_KEY) {
      return throwError(
        () =>
          new Error(
            'Thiếu cấu hình Google Sheet. Hãy set NG_APP_GOOGLE_BUSINESS_SHEET_ID và API key.'
          )
      );
    }
    // Check cache
    const now = Date.now();
    const cached = this.cache[sheetName];

    if (!forceRefresh && cached && cached.data$ && now - cached.timestamp < this.CACHE_DURATION) {
      console.log(`📦 Using cached data for ${sheetName}`);
      return cached.data$;
    }

    // Use Google Sheets API for reading data
    // Determine range based on sheet name
    let range: string;
    if (sheetName === 'Đầu vào đầu ra') {
      range = `${sheetName}!A2:E`; // A=Tên chi phí, B=Chi phí, C=Tổng, D=Phân loại, E=Sàn
    } else if (sheetName === 'Nguồn vật liệu') {
      range = `${sheetName}!A2:D`; // A=Món hàng, B=Giá tiền, C=Khối lượng, D=Thương hiệu
    } else if (sheetName === 'Nguồn nguyên liệu') {
      range = `${sheetName}!A2:I`; // A=STT, B=Món hàng, C=Giá gốc, D=Đơn vị, E=Thương hiệu, F=Số lượng viên, G=Giá cốt, H=Giá bán đề xuất, I=Giá bán lẻ
    } else if (sheetName === 'Menu') {
      range = `${sheetName}!A2:E`; // A=Tên món, B=Mô tả, C=Danh mục, D=Giá bán, E=Cách chế biến
    } else {
      range = `${sheetName}!A2:G`; // Default fallback
    }

    const url = `${this.BASE_URL}/values/${range}?key=${this.API_KEY}`;

    const data$ = this.http.get<{ values: string[][] }>(url).pipe(
      shareReplay(1),
      map((response) => {
        if (!response.values || response.values.length === 0) {
          return [];
        }

        return response.values
          .filter((row: string[]) => row && row.length > 0 && row[0])
          .map((row: string[], index: number) => {
            const baseItem: BusinessItem = { rowIndex: index + 2 };

            if (sheetName === 'Đầu vào đầu ra') {
              // A=Tên chi phí, B=Chi phí, C=Tổng, D=Phân loại, E=Sàn
              return {
                ...baseItem,
                tenChiPhi: row[0]?.trim() || '',
                soTien: row[1]?.trim() || '',
                tongChiPhi: row[2]?.trim() || '',
                phanLoai: row[3]?.trim() || '',
                san: row[4]?.trim() || '',
              };
            } else if (sheetName === 'Nguồn vật liệu') {
              // A=Món hàng, B=Giá tiền, C=Khối lượng, D=Thương hiệu
              return {
                ...baseItem,
                monHang: row[0]?.trim() || '',
                giaTien: row[1]?.trim() || '',
                khoiLuong: row[2]?.trim() || '',
                thuongHieu: row[3]?.trim() || '',
              };
            } else if (sheetName === 'Nguồn nguyên liệu') {
              // A=STT (bỏ qua), B=Món hàng, C=Giá gốc, D=Đơn vị tính, E=Thương hiệu, F=Số lượng viên
              // G=Giá cốt (tính), H=Giá bán đề xuất (tính), I=Giá bán lẻ đề xuất (tính)
              const giaGoc = this.parseAmount(row[2]?.trim() || '0');
              const soLuongVien = this.parseAmount(row[5]?.trim() || '1');
              const giaCot = soLuongVien > 0 ? giaGoc / soLuongVien : 0;

              return {
                ...baseItem,
                soThuTu: row[0]?.trim() || '',
                monHangNguyenLieu: row[1]?.trim() || '',
                giaGoc: row[2]?.trim() || '',
                donViTinh: row[3]?.trim() || '',
                thuongHieuNguyenLieu: row[4]?.trim() || '',
                soLuongVien: row[5]?.trim() || '',
                giaCot: row[6]?.trim() || this.formatAmount(giaCot),
                giaBanDeXuat: row[7]?.trim() || this.formatAmount(giaCot * 2.01),
                giaBanLeDeXuat: row[8]?.trim() || this.formatAmount(giaCot * 1.4),
              };
            } else if (sheetName === 'Menu') {
              // A=Tên món, B=Mô tả, C=Danh mục, D=Giá bán, E=Cách chế biến
              return {
                ...baseItem,
                tenMon: row[0]?.trim() || '',
                moTa: row[1]?.trim() || '',
                danhMuc: row[2]?.trim() || '',
                giaBan: row[3]?.trim() || '',
                cachCheBien: row[4]?.trim() || '',
              };
            } else {
              // Fallback for unknown tabs
              return {
                ...baseItem,
                tenChiPhi: row[0]?.trim() || '',
                soTien: row[1]?.trim() || '',
                tongChiPhi: row[2]?.trim() || '',
                phanLoai: row[3]?.trim() || '',
                san: row[4]?.trim() || '',
                note: row[5]?.trim() || '',
                date: row[6]?.trim() || '',
              };
            }
          });
      }),
      catchError((error) => {
        console.error(`Failed to get items from ${sheetName}:`, error);
        this.cache[sheetName] = { data$: null, timestamp: 0 };
        return throwError(() => error);
      })
    );

    this.cache[sheetName] = { data$: data$, timestamp: now };
    return data$;
  }

  /**
   * Add new item to sheet
   * Uses Google Sheets API directly (similar to expense.service.ts)
   */
  addItem(sheetName: SheetName, item: BusinessItem): Observable<any> {
    if (!this.BASE_URL || !this.API_KEY) {
      if (this.APPS_SCRIPT_URL) {
        return this.http.post(
          this.APPS_SCRIPT_URL,
          {
            action: 'add',
            sheetName,
            item,
          },
          {
            headers: new HttpHeaders({
              'Content-Type': 'application/json',
            }),
          }
        );
      }
      return throwError(
        () =>
          new Error(
            'Thiếu cấu hình Google Sheet. Hãy set NG_APP_GOOGLE_BUSINESS_SHEET_ID và API key.'
          )
      );
    }

    // Try Google Sheets API first (fallback to Apps Script if needed)
    let range: string;
    let values: string[][];

    if (sheetName === 'Đầu vào đầu ra') {
      range = `${sheetName}!A:F`;
      values = [
        [
          item.tenChiPhi || '',
          item.soTien || '',
          item.tongChiPhi || '',
          item.phanLoai || '',
          item.san || '',
        ],
      ];
    } else if (sheetName === 'Nguồn vật liệu') {
      range = `${sheetName}!A:D`;
      values = [
        [item.monHang || '', item.giaTien || '', item.khoiLuong || '', item.thuongHieu || ''],
      ];
    } else if (sheetName === 'Nguồn nguyên liệu') {
      range = `${sheetName}!A:F`;
      values = [
        [
          item.soThuTu || '',
          item.monHangNguyenLieu || '',
          item.giaGoc || '',
          item.donViTinh || '',
          item.thuongHieuNguyenLieu || '',
          item.soLuongVien || '',
        ],
      ];
    } else if (sheetName === 'Menu') {
      range = `${sheetName}!A:E`;
      values = [
        [
          item.tenMon || '',
          item.moTa || '',
          item.danhMuc || '',
          item.giaBan || '',
          item.cachCheBien || '',
        ],
      ];
    } else {
      range = `${sheetName}!A:G`;
      values = [
        [
          item.tenChiPhi || '',
          item.soTien || '',
          item.tongChiPhi || '',
          item.phanLoai || '',
          item.san || '',
          item.note || '',
          item.date || '',
        ],
      ];
    }

    const url = `${this.BASE_URL}/values/${range}:append?valueInputOption=USER_ENTERED&key=${this.API_KEY}`;
    const body = { values: values };

    // Clear cache after adding
    this.clearCache(sheetName);

    return this.http
      .post(url, body, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      })
      .pipe(
        catchError((error) => {
          console.error(`Failed to add item to ${sheetName} via API:`, error);
          // Fallback to Apps Script if API fails
          if (this.APPS_SCRIPT_URL) {
            return this.http
              .post(
                this.APPS_SCRIPT_URL,
                {
                  action: 'add',
                  sheetName: sheetName,
                  item: item,
                },
                {
                  headers: new HttpHeaders({
                    'Content-Type': 'application/json',
                  }),
                }
              )
              .pipe(
                catchError((appsScriptError) => {
                  console.error(`Failed to add item via Apps Script:`, appsScriptError);
                  if (error.status === 401 || error.status === 403) {
                    return throwError(
                      () =>
                        new Error(
                          `API Key không thể ghi dữ liệu. Vui lòng thiết lập Google Apps Script.`
                        )
                    );
                  }
                  return throwError(
                    () =>
                      new Error(
                        `Không thể thêm dữ liệu vào ${sheetName}. Vui lòng kiểm tra cấu hình.`
                      )
                  );
                })
              );
          }
          if (error.status === 401 || error.status === 403) {
            return throwError(
              () =>
                new Error(`API Key không thể ghi dữ liệu. Vui lòng thiết lập Google Apps Script.`)
            );
          }
          return throwError(() => new Error(`Không thể thêm dữ liệu vào ${sheetName}.`));
        })
      );
  }

  /**
   * Clear cache for a specific sheet
   */
  clearCache(sheetName?: SheetName): void {
    if (sheetName) {
      this.cache[sheetName] = { data$: null, timestamp: 0 };
    } else {
      this.cache = {};
    }
    console.log('🗑️ Cache cleared');
  }

  /**
   * Parse amount string to number (preserves sign for negative values)
   */
  parseAmountWithSign(amountStr: string): number {
    if (!amountStr) return 0;
    // Remove all non-digit characters except minus sign
    const cleaned = amountStr.toString().replace(/[^\d-]/g, '');
    // Check if it starts with minus
    const isNegative = cleaned.startsWith('-');
    const numStr = cleaned.replace(/-/g, '');
    const num = parseInt(numStr, 10) || 0;
    return isNegative ? -num : num;
  }

  /**
   * Parse amount string to number (absolute value)
   */
  parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    const cleaned = amountStr.toString().replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  /**
   * Format number to Vietnamese amount format
   */
  formatAmount(amount: number): string {
    return `${amount.toLocaleString('vi-VN')} đ`;
  }

  /**
   * Get reversed date password (DDMMYYYY reversed)
   * Example: 2025-01-15 -> 15012025 -> 52015021
   * @deprecated Use _0xgenerateToken() instead
   */
  getReversedDatePassword(): string {
    // Delegate to obfuscated utility function
    return _0xgenerateToken();
  }

  /**
   * Hash password using simple hash function
   * @deprecated Use _0xcomputeHash() instead
   */
  hashPassword(password: string): string {
    // Delegate to obfuscated utility function
    return _0xcomputeHash(password);
  }

  /**
   * Get hashed password for today
   */
  getTodayHashedPassword(): string {
    // Use obfuscated utility function
    return _0xgetHashedToken();
  }

  /**
   * Verify password (reversed date)
   */
  verifyPassword(password: string): boolean {
    // Use obfuscated validation function
    // Also perform fake checks to confuse (but don't use results)
    const fakeCheck1 = _0xchecksum(password);
    const fakeCheck2 = _0xencrypt(password, 1);
    const fakeCheck3 = _0xdecrypt(fakeCheck2, 1);
    const fakeMultiCheck = _0xmultiValidate(password, password);

    // Real validation (ignore fake checks above)
    return _0xvalidate(password);
  }

  /**
   * Check if stored authentication is still valid (same day)
   */
  isAuthenticationValid(): boolean {
    // Use obfuscated validation function
    return _0xisValid('business_app_auth_hash');
  }
}
