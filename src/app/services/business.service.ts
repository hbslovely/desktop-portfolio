import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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
  providedIn: 'root'
})
export class BusinessService {
  private readonly SHEET_ID = '1EHt1u4Ap8TfIwcH17OmdnlmXidnBHOb1wjuHA_ukB5g';
  private readonly API_KEY = environment.googleSheetsApiKey;
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;

  // Use Google Apps Script for write operations (add, update, delete)
  // Google Sheets API v4 does not support write operations with API Key
  // IMPORTANT: API Key can only READ data. You MUST use Google Apps Script for write operations.
  private readonly APPS_SCRIPT_URL = environment.production
    ? (environment.googleBusinessAppsScriptUrl || '/api/business-apps-script')
    : '/api/business-apps-script'; // Use proxy in development

  // Cache for each sheet
  private cache: { [key: string]: { data$: Observable<BusinessItem[]> | null; timestamp: number } } = {};
  private readonly CACHE_DURATION = 5000; // 5 seconds

  constructor(private http: HttpClient) {}

  /**
   * Get all items from a specific sheet
   * Uses Google Sheets API v4 for reading data (API Key can read public/accessible sheets)
   */
  getItems(sheetName: SheetName, forceRefresh: boolean = false): Observable<BusinessItem[]> {
    // Check cache
    const now = Date.now();
    const cached = this.cache[sheetName];
    
    if (!forceRefresh && cached && cached.data$ && (now - cached.timestamp) < this.CACHE_DURATION) {
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
                san: row[4]?.trim() || ''
              };
            } else if (sheetName === 'Nguồn vật liệu') {
              // A=Món hàng, B=Giá tiền, C=Khối lượng, D=Thương hiệu
              return {
                ...baseItem,
                monHang: row[0]?.trim() || '',
                giaTien: row[1]?.trim() || '',
                khoiLuong: row[2]?.trim() || '',
                thuongHieu: row[3]?.trim() || ''
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
                giaBanLeDeXuat: row[8]?.trim() || this.formatAmount(giaCot * 1.4)
              };
            } else if (sheetName === 'Menu') {
              // A=Tên món, B=Mô tả, C=Danh mục, D=Giá bán, E=Cách chế biến
              return {
                ...baseItem,
                tenMon: row[0]?.trim() || '',
                moTa: row[1]?.trim() || '',
                danhMuc: row[2]?.trim() || '',
                giaBan: row[3]?.trim() || '',
                cachCheBien: row[4]?.trim() || ''
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
                date: row[6]?.trim() || ''
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
   */
  addItem(sheetName: SheetName, item: BusinessItem): Observable<any> {
    if (this.APPS_SCRIPT_URL) {
      return this.http.post(this.APPS_SCRIPT_URL, {
        action: 'add',
        sheetName: sheetName,
        item: item
      }, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }).pipe(
        catchError((error) => {
          console.error(`Failed to add item to ${sheetName}:`, error);
          return throwError(() => new Error(`Không thể thêm dữ liệu vào ${sheetName}. Vui lòng kiểm tra cấu hình Google Apps Script.`));
        })
      );
    }

    return throwError(() => new Error('Google Apps Script URL is not configured'));
  }

  /**
   * Update existing item in sheet
   */
  updateItem(sheetName: SheetName, item: BusinessItem, rowIndex: number): Observable<any> {
    if (this.APPS_SCRIPT_URL) {
      return this.http.post(this.APPS_SCRIPT_URL, {
        action: 'update',
        sheetName: sheetName,
        item: item,
        rowIndex: rowIndex
      }, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }).pipe(
        catchError((error) => {
          console.error(`Failed to update item in ${sheetName}:`, error);
          return throwError(() => new Error(`Không thể cập nhật dữ liệu trong ${sheetName}. Vui lòng kiểm tra cấu hình Google Apps Script.`));
        })
      );
    }

    return throwError(() => new Error('Google Apps Script URL is not configured'));
  }

  /**
   * Delete item from sheet
   */
  deleteItem(sheetName: SheetName, rowIndex: number): Observable<any> {
    if (this.APPS_SCRIPT_URL) {
      return this.http.post(this.APPS_SCRIPT_URL, {
        action: 'delete',
        sheetName: sheetName,
        rowIndex: rowIndex
      }, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }).pipe(
        catchError((error) => {
          console.error(`Failed to delete item from ${sheetName}:`, error);
          return throwError(() => new Error(`Không thể xóa dữ liệu từ ${sheetName}. Vui lòng kiểm tra cấu hình Google Apps Script.`));
        })
      );
    }

    return throwError(() => new Error('Google Apps Script URL is not configured'));
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
   */
  getReversedDatePassword(): string {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear().toString();

    // Format: DDMMYYYY, then reverse
    const dateStr = day + month + year;
    return dateStr.split('').reverse().join('');
  }

  /**
   * Hash password using simple hash function
   */
  hashPassword(password: string): string {
    // Simple hash function (not cryptographically secure, but sufficient for this use case)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get hashed password for today
   */
  getTodayHashedPassword(): string {
    const password = this.getReversedDatePassword();
    return this.hashPassword(password);
  }

  /**
   * Verify password (reversed date)
   */
  verifyPassword(password: string): boolean {
    const expectedPassword = this.getReversedDatePassword();
    return password === expectedPassword;
  }

  /**
   * Check if stored authentication is still valid (same day)
   */
  isAuthenticationValid(): boolean {
    const storedHash = sessionStorage.getItem('business_app_auth_hash');
    if (!storedHash) {
      return false;
    }

    const todayHash = this.getTodayHashedPassword();
    return storedHash === todayHash;
  }
}

