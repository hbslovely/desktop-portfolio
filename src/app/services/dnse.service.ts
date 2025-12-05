import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DNSESymbol {
  symbol: string;
  name?: string;
  exchange?: string;
  [key: string]: any;
}

export interface DNSEStockData {
  pageProps?: {
    symbol: string;
    instrumentSymbol: string;
    companyInfo: any;
    statistic: any;
    priceSnapshot: any;
    ticker: any;
    financialIndicators: any;
    financialReportOverall: any;
    [key: string]: any;
  };
  fullData?: {
    [key: string]: any;
  };
  [key: string]: any;
}

export interface DNSEOHLCData {
  t: number[]; // Timestamps
  o: number[]; // Open prices
  h: number[]; // High prices
  l: number[]; // Low prices
  c: number[]; // Close prices
  v: number[]; // Volumes
  nextTime?: number;
}

export type ExchangeType = 'hose' | 'hnx' | 'upcom' | 'vn30';

@Injectable({
  providedIn: 'root'
})
export class DnseService {
  // Use proxy to avoid CORS issues
  private readonly SYMBOLS_API_BASE = '/api/dnse-api/chart-api/symbols';
  private readonly STOCK_DATA_BASE = '/api/dnse/senses/_next/data/TNgKE3JbtnJNequvT4tmO/co-phieu-';
  
  // Cache for symbols list
  private symbolsCache: Map<ExchangeType, DNSESymbol[]> = new Map();
  
  // Track fetched symbols (stored in localStorage)
  private readonly FETCHED_SYMBOLS_KEY = 'dnse_fetched_symbols';

  constructor(private http: HttpClient) {}

  /**
   * Get list of symbols from an exchange
   */
  getSymbols(exchange: ExchangeType): Observable<DNSESymbol[]> {
    // Check cache first
    if (this.symbolsCache.has(exchange)) {
      return of(this.symbolsCache.get(exchange)!);
    }

    const url = `${this.SYMBOLS_API_BASE}?type=${exchange}`;
    
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        // API might return array directly or wrapped in data property
        const symbols: DNSESymbol[] = Array.isArray(response) 
          ? response 
          : (response.data || response.symbols || []);
        
        // Cache the result
        this.symbolsCache.set(exchange, symbols);
        
        return symbols;
      }),
      catchError((error) => {
        console.error(`Failed to get symbols for ${exchange}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all symbols from all exchanges
   */
  getAllSymbols(): Observable<{ exchange: ExchangeType; symbols: DNSESymbol[] }[]> {
    const exchanges: ExchangeType[] = ['hose', 'hnx', 'upcom', 'vn30'];
    const requests = exchanges.map(exchange => 
      this.getSymbols(exchange).pipe(
        map(symbols => ({ exchange, symbols }))
      )
    );

    // Combine all requests
    return new Observable(observer => {
      const results: { exchange: ExchangeType; symbols: DNSESymbol[] }[] = [];
      let completed = 0;

      requests.forEach((request, index) => {
        request.subscribe({
          next: (result) => {
            results[index] = result;
            completed++;
            if (completed === requests.length) {
              observer.next(results);
              observer.complete();
            }
          },
          error: (error) => {
            console.error(`Error loading ${exchanges[index]}:`, error);
            results[index] = { exchange: exchanges[index], symbols: [] };
            completed++;
            if (completed === requests.length) {
              observer.next(results);
              observer.complete();
            }
          }
        });
      });
    });
  }

  /**
   * Get stock data for a specific symbol
   */
  getStockData(symbol: string): Observable<DNSEStockData> {
    const url = `${this.STOCK_DATA_BASE}${symbol}.json`;
    
    return this.http.get<DNSEStockData>(url).pipe(
      catchError((error) => {
        console.error(`Failed to get stock data for ${symbol}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get OHLC (Open, High, Low, Close) price history for a symbol
   * @param symbol - Stock symbol
   * @param from - Start timestamp (Unix timestamp in seconds)
   * @param to - End timestamp (Unix timestamp in seconds)
   * @param resolution - Time resolution (1D = daily, 1W = weekly, 1M = monthly)
   */
  getOHLCData(symbol: string, from: number, to: number, resolution: string = '1D'): Observable<DNSEOHLCData> {
    const url = `/api/dnse-api/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=${resolution}`;
    
    return this.http.get<DNSEOHLCData>(url).pipe(
      catchError((error) => {
        console.error(`Failed to get OHLC data for ${symbol}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get OHLC data for the last N days
   */
  getOHLCDataLastDays(symbol: string, days: number = 365, resolution: string = '1D'): Observable<DNSEOHLCData> {
    const now = Math.floor(Date.now() / 1000);
    const from = now - (days * 24 * 60 * 60);
    return this.getOHLCData(symbol, from, now, resolution);
  }

  /**
   * Mark a symbol as fetched
   */
  markAsFetched(symbol: string): void {
    const fetched = this.getFetchedSymbols();
    if (!fetched.includes(symbol)) {
      fetched.push(symbol);
      localStorage.setItem(this.FETCHED_SYMBOLS_KEY, JSON.stringify(fetched));
    }
  }

  /**
   * Mark a symbol as not fetched (remove from fetched list)
   */
  markAsNotFetched(symbol: string): void {
    const fetched = this.getFetchedSymbols();
    const index = fetched.indexOf(symbol);
    if (index > -1) {
      fetched.splice(index, 1);
      localStorage.setItem(this.FETCHED_SYMBOLS_KEY, JSON.stringify(fetched));
    }
  }

  /**
   * Get list of fetched symbols
   */
  getFetchedSymbols(): string[] {
    try {
      const stored = localStorage.getItem(this.FETCHED_SYMBOLS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading fetched symbols:', error);
      return [];
    }
  }

  /**
   * Check if a symbol has been fetched (from Google Sheets)
   */
  checkSheetExists(sheetId: string, symbol: string, scriptId?: string): Observable<boolean> {
    const scriptIdToUse = scriptId || '';
    if (!scriptIdToUse) {
      // Fallback to localStorage if scriptId not configured
      return new Observable(observer => {
        observer.next(this.getFetchedSymbols().includes(symbol));
        observer.complete();
      });
    }

    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptIdToUse}/exec`
      : `/api/securities-apps-script/${scriptIdToUse}/exec`;

    return this.http.post<any>(baseUrl, {
      action: 'checkSheetExists',
      sheetId: sheetId,
      symbol: symbol
    }).pipe(
      map((response: any) => {
        return response.success && response.exists === true;
      }),
      catchError((error) => {
        console.error(`Error checking sheet for ${symbol}:`, error);
        // Fallback to localStorage on error
        return of(this.getFetchedSymbols().includes(symbol));
      })
    );
  }

  /**
   * Check if price sheet ({SYMBOL}_Price) exists
   */
  checkPriceSheetExists(sheetId: string, symbol: string, scriptId?: string): Observable<boolean> {
    const scriptIdToUse = scriptId || '';
    if (!scriptIdToUse) {
      return of(false);
    }

    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptIdToUse}/exec`
      : `/api/securities-apps-script/${scriptIdToUse}/exec`;

    return this.http.post<any>(baseUrl, {
      action: 'checkSheetExists',
      sheetId: sheetId,
      symbol: `${symbol}_Price`
    }).pipe(
      map((response: any) => {
        return response.success && response.exists === true;
      }),
      catchError((error) => {
        console.error(`Error checking price sheet for ${symbol}:`, error);
        return of(false);
      })
    );
  }

  /**
   * Get all fetched symbols from Google Sheets
   */
  getAllFetchedSymbolsFromSheets(sheetId: string, scriptId?: string): Observable<string[]> {
    const scriptIdToUse = scriptId || '';
    if (!scriptIdToUse) {
      return of(this.getFetchedSymbols());
    }

    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptIdToUse}/exec`
      : `/api/securities-apps-script/${scriptIdToUse}/exec`;

    return this.http.post<any>(baseUrl, {
      action: 'getAllSymbols',
      sheetId: sheetId
    }).pipe(
      map((response: any) => {
        if (response.success && Array.isArray(response.symbols)) {
          return response.symbols;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting all symbols from sheets:', error);
        return of(this.getFetchedSymbols());
      })
    );
  }

  /**
   * Check if a symbol has been fetched (legacy - uses localStorage)
   */
  isFetched(symbol: string): boolean {
    return this.getFetchedSymbols().includes(symbol);
  }

  /**
   * Clear all fetched symbols
   */
  clearFetchedSymbols(): void {
    localStorage.removeItem(this.FETCHED_SYMBOLS_KEY);
  }

  /**
   * Get count of fetched symbols
   */
  getFetchedCount(): number {
    return this.getFetchedSymbols().length;
  }

  /**
   * Get price data from Google Sheets
   */
  getPriceDataFromSheets(sheetId: string, symbol: string, scriptId?: string): Observable<any> {
    const scriptIdToUse = scriptId || '';
    if (!scriptIdToUse) {
      return throwError(() => new Error('Script ID chưa được cấu hình'));
    }

    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptIdToUse}/exec`
      : `/api/securities-apps-script/${scriptIdToUse}/exec`;

    return this.http.post<any>(baseUrl, {
      action: 'getPriceData',
      sheetId: sheetId,
      symbol: symbol
    }).pipe(
      catchError((error) => {
        console.error(`Error getting price data for ${symbol}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get basic info of a stock from Google Sheets
   */
  getStockBasicInfoFromSheets(sheetId: string, symbol: string, scriptId?: string): Observable<any> {
    const scriptIdToUse = scriptId || '';
    if (!scriptIdToUse) {
      return throwError(() => new Error('Script ID chưa được cấu hình'));
    }

    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptIdToUse}/exec`
      : `/api/securities-apps-script/${scriptIdToUse}/exec`;

    return this.http.post<any>(baseUrl, {
      action: 'getStockBasicInfo',
      sheetId: sheetId,
      symbol: symbol
    }).pipe(
      catchError((error) => {
        console.error(`Error getting basic info for ${symbol}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get basic info of all stocks from Google Sheets
   */
  getAllStocksBasicInfoFromSheets(sheetId: string, scriptId?: string): Observable<any> {
    const scriptIdToUse = scriptId || '';
    if (!scriptIdToUse) {
      return throwError(() => new Error('Script ID chưa được cấu hình'));
    }

    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptIdToUse}/exec`
      : `/api/securities-apps-script/${scriptIdToUse}/exec`;

    return this.http.post<any>(baseUrl, {
      action: 'getAllStocksBasicInfo',
      sheetId: sheetId
    }).pipe(
      catchError((error) => {
        console.error('Error getting all stocks basic info:', error);
        return throwError(() => error);
      })
    );
  }
}

