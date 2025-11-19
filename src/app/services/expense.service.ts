import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Expense {
  date: string;
  content: string;
  amount: number;
  category: string;
  note?: string;
  rowIndex?: number;
}

export interface ExpenseRow {
  ngay: string;
  noiDung: string;
  soTien: string;
  phanLoai: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  // Google Sheets API configuration
  // Sheet ID from the URL: https://docs.google.com/spreadsheets/d/1nlLxaRCSePOddntUeNsMBKx2qP6kGSNLsZwtyqSbb88/edit
  private readonly SHEET_ID = '1nlLxaRCSePOddntUeNsMBKx2qP6kGSNLsZwtyqSbb88';
  private readonly SHEET_NAME = 'Chi tiêu'; // Tab name
  private readonly API_KEY = environment.googleSheetsApiKey;

  // For private sheets, we'll use a proxy or Google Apps Script
  // For now, using a simple approach with Google Sheets API v4
  private readonly BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}`;

  // Alternative: Use Google Apps Script Web App
  // You can create a Google Apps Script that exposes GET and POST endpoints
  // See GOOGLE_APPS_SCRIPT_SETUP.md for instructions
  // IMPORTANT: API Key cannot write to Google Sheets. You MUST use Google Apps Script for write operations.
  // Use proxy in development to avoid CORS issues
  private readonly APPS_SCRIPT_URL = environment.production
    ? environment.googleAppsScriptUrl
    : '/api/google-apps-script'; // Use proxy in development

  // Use Google API client for read/write operations
  private useGapi = true;

  // Cache to prevent multiple API calls
  private cachedExpenses$: Observable<Expense[]> | null = null;
  private lastLoadTime: number = 0;
  private readonly CACHE_DURATION = 5000; // 5 seconds cache
  private isLoading = false;

  constructor(private http: HttpClient) {}

  /**
   * Get all expenses from Google Sheets (with caching)
   * Reads from the "Chi tiêu" sheet starting from row 2 (row 1 is header)
   * Uses caching to prevent multiple API calls
   */
  getExpenses(forceRefresh: boolean = false): Observable<Expense[]> {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && this.cachedExpenses$ && (now - this.lastLoadTime) < this.CACHE_DURATION) {
      console.log('📦 Using cached expenses');
      return this.cachedExpenses$;
    }

    // If already loading, return cached or wait
    if (this.isLoading && this.cachedExpenses$) {
      console.log('⏳ Already loading, returning cached data');
      return this.cachedExpenses$;
    }

    // Use API key for read access (Apps Script is only for write operations)
    const range = `${this.SHEET_NAME}!A2:F`;
    const url = `${this.BASE_URL}/values/${range}?key=${this.API_KEY}`;

    this.isLoading = true;
    this.cachedExpenses$ = this.http.get<{ values: string[][] }>(url).pipe(
      shareReplay(1),
      map((response) => {
        if (!response.values || response.values.length === 0) {
          this.isLoading = false;
          this.lastLoadTime = Date.now();
          return [];
        }

        const expenses = response.values
          .filter((row: string[]) => row && row.length >= 5 && row[0] && row[1] && row[3] && row[4])
          .map((row: string[]) => {
            // A: Parse date (format: "Thứ Bảy, 01/11/2025")
            const dateStr = row[0]?.trim() || '';
            const date = this.parseDate(dateStr);

            // B: Content
            const content = row[1]?.trim() || '';

            // D: Parse amount (format: "1.906.228 đ" or "30.000 đ")
            const amountStr = row[3]?.replace(/[^\d]/g, '') || '0';
            const amount = parseInt(amountStr, 10) || 0;

            // E: Category
            const category = row[4]?.trim() || '';

            // F: Note (Ghi chú)
            const note = row[5]?.trim() || '';

            return {
              date: date,
              content: content,
              amount: amount,
              category: category,
              note: note || undefined
            };
          });

        this.isLoading = false;
        this.lastLoadTime = Date.now();
        return expenses;
      }),
      catchError((error) => {
        console.error('Failed to get expenses from Google Sheets:', error);
        this.isLoading = false;
        this.cachedExpenses$ = null;
        return throwError(() => error);
      })
    );

    return this.cachedExpenses$;
  }

  /**
   * Clear cache (call after adding/updating expenses)
   */
  clearCache(): void {
    this.cachedExpenses$ = null;
    this.lastLoadTime = 0;
    console.log('🗑️ Cache cleared');
  }


  /**
   * Update an existing expense in Google Sheets
   * NOTE: Requires row index to update the correct row
   * NOTE: Google Sheets API v4 does not support write operations with API Key.
   * You MUST use Google Apps Script for write operations.
   */
  updateExpense(expense: Expense, rowIndex: number): Observable<any> {
    // If using Google Apps Script (RECOMMENDED)
    if (this.APPS_SCRIPT_URL) {
      return this.http.post(this.APPS_SCRIPT_URL, {
        action: 'edit',
        expense: expense,
        row: rowIndex
      }, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }).pipe(
        catchError((error) => {
          console.error('Failed to update expense via Apps Script:', error);
          return throwError(() => new Error('Không thể cập nhật chi tiêu. Vui lòng kiểm tra cấu hình Google Apps Script.'));
        })
      );
    }

    // Fallback: Try API key (will fail for write operations)
    const dateStr = this.formatDateForSheet(expense.date);
    const amountStr = this.formatAmountForSheet(expense.amount);
    const values = [[dateStr, expense.content, '', amountStr, expense.category, expense.note || '']];
    const range = `${this.SHEET_NAME}!A${rowIndex}:F${rowIndex}`;
    const url = `${this.BASE_URL}/values/${range}?valueInputOption=USER_ENTERED&key=${this.API_KEY}`;

    const body = { values: [values[0]] };

    // Clear cache after updating
    this.clearCache();

    return this.http.put(url, body, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      catchError((error) => {
        console.error('Failed to update expense in Google Sheets:', error);
        if (error.status === 401 || error.status === 403) {
          return throwError(() => new Error('API Key không thể ghi dữ liệu. Vui lòng thiết lập Google Apps Script.'));
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a new expense to Google Sheets
   * NOTE: Google Sheets API v4 does not support write operations with API Key.
   * You MUST use Google Apps Script for write operations.
   * See GOOGLE_APPS_SCRIPT_SETUP.md for setup instructions.
   */
  addExpense(expense: Expense): Observable<any> {
    // If using Google Apps Script (RECOMMENDED)
    if (this.APPS_SCRIPT_URL) {
      return this.http.post(this.APPS_SCRIPT_URL, {
        expense,
        action: 'add'
      }, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }).pipe(
        catchError((error) => {
          console.error('Failed to add expense via Apps Script:', error);
          return throwError(() => new Error('Không thể thêm chi tiêu. Vui lòng kiểm tra cấu hình Google Apps Script. Xem GOOGLE_APPS_SCRIPT_SETUP.md để biết cách thiết lập.'));
        })
      );
    }

    // Fallback: Try API key (will fail for write operations)
    // This is only for backward compatibility
    const dateStr = this.formatDateForSheet(expense.date);
    const amountStr = this.formatAmountForSheet(expense.amount);
    const values = [[dateStr, expense.content, '', amountStr, expense.category, expense.note || '']];
    const range = `${this.SHEET_NAME}!A:F`;
    const url = `${this.BASE_URL}/values/${range}:append?valueInputOption=USER_ENTERED&key=${this.API_KEY}`;

    const body = { values: values };

    // Clear cache after adding
    this.clearCache();

    return this.http.post(url, body, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      catchError((error) => {
        console.error('Failed to add expense to Google Sheets:', error);
        // Provide helpful error message
        if (error.status === 401 || error.status === 403) {
          return throwError(() => new Error('API Key không thể ghi dữ liệu. Vui lòng thiết lập Google Apps Script. Xem GOOGLE_APPS_SCRIPT_SETUP.md để biết cách thiết lập.'));
        }
        return throwError(() => error);
      })
    );
  }


  /**
   * Parse Vietnamese date string to ISO date string
   * Input: "Thứ Bảy, 01/11/2025" or "01/11/2025"
   * Output: "2025-11-01"
   */
  private parseDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // Extract date part (DD/MM/YYYY or MM/DD/YYYY)
    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const [, part1, part2, year] = dateMatch;
      const num1 = parseInt(part1, 10);
      const num2 = parseInt(part2, 10);

      // Determine if it's DD/MM/YYYY or MM/DD/YYYY
      // If first part > 12, it must be DD/MM/YYYY
      // If second part > 12, it must be MM/DD/YYYY
      // Otherwise, assume DD/MM/YYYY (Vietnamese format)
      let day: string, month: string;

      if (num1 > 12) {
        // First part is day (DD/MM/YYYY)
        day = part1.padStart(2, '0');
        month = part2.padStart(2, '0');
      } else if (num2 > 12) {
        // Second part is day (MM/DD/YYYY)
        month = part1.padStart(2, '0');
        day = part2.padStart(2, '0');
      } else {
        // Ambiguous case - assume DD/MM/YYYY (Vietnamese format)
        // But check if year makes sense
        const yearNum = parseInt(year, 10);
        if (yearNum < 2000 || yearNum > 2100) {
          // Year seems wrong, might be swapped
          // Try the other interpretation
          month = part1.padStart(2, '0');
          day = part2.padStart(2, '0');
        } else {
          day = part1.padStart(2, '0');
          month = part2.padStart(2, '0');
        }
      }

      return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split('T')[0];
  }

  /**
   * Format date for Google Sheets (Vietnamese format)
   * Input: "2025-11-01" or Date object
   * Output: "Thứ Bảy, 01/11/2025"
   */
  private formatDateForSheet(date: string | Date): string {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }

    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();

    const dayOfWeek = dateObj.getDay();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[dayOfWeek];

    return `${dayName}, ${day}/${month}/${year}`;
  }

  /**
   * Format amount for Google Sheets (Vietnamese format with dots)
   * Input: 1906228
   * Output: "1.906.228 đ"
   */
  private formatAmountForSheet(amount: number): string {
    return `${amount.toLocaleString('vi-VN')} đ`;
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get reversed date string for password
   * Input: "2025-11-01"
   * Output: "011152025" (reversed: 011152025)
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
    const storedHash = sessionStorage.getItem('expense_app_auth_hash');
    if (!storedHash) {
      return false;
    }

    const todayHash = this.getTodayHashedPassword();
    return storedHash === todayHash;
  }
}

