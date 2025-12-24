import { Injectable } from '@angular/core';
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
  _0xhashUsername,
  _0xhashCredentials
} from '../utils/crypto-obfuscator.util';

export interface Expense {
  date: string;
  content: string;
  amount: number;
  category: string;
  note?: string;
  rowIndex?: number;
  groupId?: string;
}

export interface ExpenseRow {
  ngay: string;
  noiDung: string;
  soTien: string;
  phanLoai: string;
}

export interface CategoryBudget {
  category: string;
  amount: number;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  content?: string;
  dateFrom?: string;
  dateTo?: string;
  totalAmount: number;
  createdAt?: string;
  rowIndex?: number;
}

@Injectable({
  providedIn: 'root'
})
class ExpenseService {
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
    // Read columns A-G: A=date, B=content, C='212', D=amount, E=category, F=note, G=groupId
    const range = `${this.SHEET_NAME}!A2:G`;
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

            // G: Group ID (Nhóm chi tiêu)
            const groupId = row[6]?.trim() || '';

            return {
              date: date,
              content: content,
              amount: amount,
              category: category,
              note: note || undefined,
              groupId: groupId || undefined
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


  // ========== BUDGET METHODS ==========
  
  private readonly BUDGET_SHEET_NAME = 'Ngân sách'; // Budget tab name
  private cachedBudgets$: Observable<CategoryBudget[]> | null = null;
  private lastBudgetLoadTime: number = 0;

  /**
   * Get all budgets from Google Sheets "Ngân sách" tab
   * Columns: A = Category, B = Amount
   */
  getBudgets(forceRefresh: boolean = false): Observable<CategoryBudget[]> {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && this.cachedBudgets$ && (now - this.lastBudgetLoadTime) < this.CACHE_DURATION) {
      console.log('📦 Using cached budgets');
      return this.cachedBudgets$;
    }

    // Read from Ngân sách tab
    // Use FORMATTED_VALUE to get values as they appear in the sheet
    const range = `${this.BUDGET_SHEET_NAME}!A2:B`;
    const url = `${this.BASE_URL}/values/${range}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    this.cachedBudgets$ = this.http.get<{ values: string[][] }>(url).pipe(
      shareReplay(1),
      map((response) => {
        if (!response.values || response.values.length === 0) {
          this.lastBudgetLoadTime = Date.now();
          return [];
        }

        const budgets = response.values
          .filter((row: string[]) => row && row.length >= 1 && row[0])
          .map((row: string[]) => {
            const category = row[0]?.trim() || '';
            const rawValue = row[1]?.trim() || '0';
            
            // Parse amount - handle different formats:
            // 1. Pure number: 1200000
            // 2. Vietnamese format with dots: "1.200.000"
            // 3. Number with decimal: 1171717.17
            // 4. Formatted with "đ": "1.200.000 đ"
            let amount = 0;
            
            // Remove currency symbol and spaces
            let cleanValue = rawValue.replace(/[đ\s]/g, '').trim();
            
            if (cleanValue) {
              // Check if it's a decimal number (has a dot followed by 1-2 digits at the end)
              const decimalMatch = cleanValue.match(/^[\d.]+[,.](\d{1,2})$/);
              
              if (decimalMatch) {
                // It's a decimal number - parse as float and round
                // Replace comma with dot for parsing
                cleanValue = cleanValue.replace(',', '.');
                // Remove thousand separators (dots that are not the decimal point)
                const parts = cleanValue.split('.');
                if (parts.length > 2) {
                  // Multiple dots - last one is decimal, others are thousand separators
                  const decimalPart = parts.pop();
                  cleanValue = parts.join('') + '.' + decimalPart;
                }
                amount = Math.round(parseFloat(cleanValue) || 0);
              } else {
                // It's a whole number with thousand separators
                // Remove all non-digits
                amount = parseInt(cleanValue.replace(/[^\d]/g, ''), 10) || 0;
              }
            }
            
            console.log(`📊 Budget: ${category} = ${rawValue} -> ${amount}`);

            return {
              category,
              amount
            };
          });

        this.lastBudgetLoadTime = Date.now();
        return budgets;
      }),
      catchError((error) => {
        console.error('Failed to get budgets from Google Sheets:', error);
        this.cachedBudgets$ = null;
        return throwError(() => error);
      })
    );

    return this.cachedBudgets$;
  }

  /**
   * Save budgets to Google Sheets "Ngân sách" tab
   * Uses Google Apps Script for write operations
   */
  saveBudgets(budgets: CategoryBudget[]): Observable<any> {
    if (this.APPS_SCRIPT_URL) {
      return this.http.post(this.APPS_SCRIPT_URL, {
        action: 'saveBudgets',
        budgets: budgets
      }, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }).pipe(
        map((response) => {
          // Clear budget cache after saving
          this.cachedBudgets$ = null;
          this.lastBudgetLoadTime = 0;
          return response;
        }),
        catchError((error) => {
          console.error('Failed to save budgets via Apps Script:', error);
          return throwError(() => new Error('Không thể lưu ngân sách. Vui lòng kiểm tra cấu hình Google Apps Script.'));
        })
      );
    }

    return throwError(() => new Error('Google Apps Script URL not configured'));
  }

  /**
   * Clear budget cache
   */
  clearBudgetCache(): void {
    this.cachedBudgets$ = null;
    this.lastBudgetLoadTime = 0;
    console.log('🗑️ Budget cache cleared');
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
   * Valid username hashes (pre-computed)
   * Usernames: hpphat1992, ninhquyen392, quyenninh720, phat, quyen, phat.hong, quyen.ninh
   */
  private readonly VALID_USERNAME_HASHES = [
    '07210109', // hpphat1992
    '08d3869e', // ninhquyen392
    '0d020e13', // quyenninh720
    '56571693', // phat
    '26c7d4b7', // quyen
    '5e566f1c', // phat.hong
    '24f715b1'  // quyen.ninh
  ];

  /**
   * Valid usernames (for iteration during validation)
   */
  private readonly VALID_USERNAMES = [
    'hpphat1992',
    'ninhquyen392',
    'quyenninh720',
    'phat',
    'quyen',
    'phat.hong',
    'quyen.ninh'
  ];

  /**
   * Verify username by hashing and comparing with valid hashes
   * Security: Username is hashed before comparison
   */
  verifyUsername(username: string): boolean {
    if (!username || username.length === 0) {
      return false;
    }

    // Hash the input username
    const inputHash = _0xhashUsername(username);

    // Compare with valid hashes
    return this.VALID_USERNAME_HASHES.includes(inputHash);
  }

  /**
   * Get username from input (for storage after successful login)
   * Returns normalized username if valid, null otherwise
   */
  getValidUsername(username: string): string | null {
    if (!username || username.length === 0) {
      return null;
    }

    const normalized = username.trim().toLowerCase();
    const inputHash = _0xhashUsername(normalized);

    if (this.VALID_USERNAME_HASHES.includes(inputHash)) {
      return normalized;
    }

    return null;
  }

  /**
   * Verify password (reversed date)
   * Security: Password is processed and cleared immediately to prevent debugging
   */
  verifyPassword(password: string): boolean {
    if (!password || password.length === 0) {
      return false;
    }

    // Use obfuscated validation function
    // Also perform fake checks to confuse (but don't use results)
    const fakeCheck1 = _0xchecksum(password);
    const fakeCheck2 = _0xencrypt(password, 1);
    const fakeCheck3 = _0xdecrypt(fakeCheck2, 1);

    // Real validation (ignore fake checks above)
    return _0xvalidate(password);
  }

  /**
   * Generate hash for hashed_username:password combination
   * Format: Hash(hash_username:password)
   * This hash includes date component, so it changes daily
   */
  generateCredentialsHash(username: string, password: string): string {
    if (!username || !password) return '';
    
    // First, hash the username to get hash_username
    const hashUsername = _0xhashUsername(username);
    
    // Then hash the combination: hash_username:password
    return _0xhashCredentials(hashUsername, password);
  }

  /**
   * Check if stored authentication is still valid
   * Validates by trying all hashed usernames
   * Format: Hash(hash_username:password)
   * Security: Does not store username, iterates through all valid username hashes
   */
  isAuthenticationValid(): boolean {
    const storedHash = typeof sessionStorage !== 'undefined' 
      ? sessionStorage.getItem('expense_app_auth_hash') 
      : null;
    
    if (!storedHash) {
      return false;
    }

    // Generate expected password (reversed date)
    const expectedPassword = _0xgenerateToken();
    
    // Try each hashed username to find a match
    // Format: Hash(hash_username:expectedPassword)
    for (const hashUsername of this.VALID_USERNAME_HASHES) {
      const expectedHash = _0xhashCredentials(hashUsername, expectedPassword);
      if (storedHash === expectedHash) {
        return true;
      }
    }
    
    // No match found
    return false;
  }

  // ========== EXPENSE GROUPS METHODS ==========

  private cachedGroups$: Observable<ExpenseGroup[]> | null = null;
  private lastGroupsLoadTime: number = 0;

  /**
   * Get all expense groups from Google Sheets "Nhóm chi tiêu" tab
   * Uses Google Apps Script API
   */
  getGroups(forceRefresh: boolean = false): Observable<ExpenseGroup[]> {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && this.cachedGroups$ && (now - this.lastGroupsLoadTime) < this.CACHE_DURATION) {
      console.log('📦 Using cached groups');
      return this.cachedGroups$;
    }

    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Google Apps Script URL not configured'));
    }

    const url = `${this.APPS_SCRIPT_URL}?action=getGroups`;

    this.cachedGroups$ = this.http.get<ExpenseGroup[]>(url).pipe(
      shareReplay(1),
      map((groups) => {
        // Parse dates and amounts
        const parsedGroups = groups.map((group: any, index) => {
          let totalAmount = 0;
          const amountValue = group.totalAmount;
          if (typeof amountValue === 'string') {
            totalAmount = parseFloat(amountValue.replace(/[^\d]/g, '')) || 0;
          } else if (typeof amountValue === 'number') {
            totalAmount = amountValue;
          }
          
          return {
            ...group,
            totalAmount: totalAmount,
            rowIndex: index + 2 // Row index in sheet (row 1 is header)
          } as ExpenseGroup;
        });
        this.lastGroupsLoadTime = Date.now();
        return parsedGroups;
      }),
      catchError((error) => {
        console.error('Failed to get groups from Apps Script:', error);
        this.cachedGroups$ = null;
        return throwError(() => error);
      })
    );

    return this.cachedGroups$;
  }

  /**
   * Add a new expense group
   */
  addGroup(group: ExpenseGroup): Observable<any> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Google Apps Script URL not configured'));
    }

    return this.http.post(this.APPS_SCRIPT_URL, {
      action: 'addGroup',
      group: group
    }, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      map((response) => {
        // Clear cache after adding
        this.cachedGroups$ = null;
        this.lastGroupsLoadTime = 0;
        return response;
      }),
      catchError((error) => {
        console.error('Failed to add group via Apps Script:', error);
        return throwError(() => new Error('Không thể thêm nhóm chi tiêu. Vui lòng kiểm tra cấu hình Google Apps Script.'));
      })
    );
  }

  /**
   * Update an existing expense group
   */
  updateGroup(group: ExpenseGroup, rowIndex: number): Observable<any> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Google Apps Script URL not configured'));
    }

    return this.http.post(this.APPS_SCRIPT_URL, {
      action: 'updateGroup',
      group: group,
      row: rowIndex
    }, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      map((response) => {
        // Clear cache after updating
        this.cachedGroups$ = null;
        this.lastGroupsLoadTime = 0;
        return response;
      }),
      catchError((error) => {
        console.error('Failed to update group via Apps Script:', error);
        return throwError(() => new Error('Không thể cập nhật nhóm chi tiêu. Vui lòng kiểm tra cấu hình Google Apps Script.'));
      })
    );
  }

  /**
   * Delete an expense group
   */
  deleteGroup(rowIndex: number): Observable<any> {
    if (!this.APPS_SCRIPT_URL) {
      return throwError(() => new Error('Google Apps Script URL not configured'));
    }

    return this.http.post(this.APPS_SCRIPT_URL, {
      action: 'deleteGroup',
      row: rowIndex
    }, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      map((response) => {
        // Clear cache after deleting
        this.cachedGroups$ = null;
        this.lastGroupsLoadTime = 0;
        return response;
      }),
      catchError((error) => {
        console.error('Failed to delete group via Apps Script:', error);
        return throwError(() => new Error('Không thể xóa nhóm chi tiêu. Vui lòng kiểm tra cấu hình Google Apps Script.'));
      })
    );
  }

  /**
   * Clear groups cache
   */
  clearGroupsCache(): void {
    this.cachedGroups$ = null;
    this.lastGroupsLoadTime = 0;
    console.log('🗑️ Groups cache cleared');
  }
}

export default ExpenseService

    