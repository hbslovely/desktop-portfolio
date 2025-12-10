import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
  
  // Track last DNSE sync date
  private readonly LAST_DNSE_SYNC_KEY = 'dnse_last_sync_date';

  constructor(private http: HttpClient) {}

  /**
   * Check if today is within the DNSE sync window (days 10-20 of the month)
   */
  isInDNSESyncWindow(): boolean {
    const today = new Date();
    const dayOfMonth = today.getDate();
    return dayOfMonth >= 10 && dayOfMonth <= 20;
  }

  /**
   * Check if we already synced DNSE in the current month
   */
  hasAlreadySyncedThisMonth(): boolean {
    const lastSync = localStorage.getItem(this.LAST_DNSE_SYNC_KEY);
    if (!lastSync) return false;
    
    const lastSyncDate = new Date(lastSync);
    const today = new Date();
    
    // Check if last sync was in the same month and year
    return lastSyncDate.getMonth() === today.getMonth() && 
           lastSyncDate.getFullYear() === today.getFullYear();
  }

  /**
   * Mark that we've synced DNSE this month
   */
  markDNSESynced(): void {
    localStorage.setItem(this.LAST_DNSE_SYNC_KEY, new Date().toISOString());
  }

  /**
   * Check if we should sync with DNSE API
   * Only sync if: within days 10-20 AND haven't synced this month yet
   */
  shouldSyncWithDNSE(): boolean {
    return this.isInDNSESyncWindow() && !this.hasAlreadySyncedThisMonth();
  }

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
   * Get all fetched symbols from Stock API
   */
  getAllFetchedSymbols(): Observable<string[]> {
    return this.http.get<any>('/api/stocks-v2/list').pipe(
      map((response: any) => {
        if (response.success && Array.isArray(response.stocks)) {
          return response.stocks.map((stock: any) => stock.symbol).filter((s: string) => s);
        }
        if (response.success && Array.isArray(response.symbols)) {
          // Fallback for old API format
          return response.symbols;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting all symbols from API:', error);
        // Fallback to localStorage on error
        return of(this.getFetchedSymbols());
      })
    );
  }

  /**
   * Get all stock data from Stock API
   */
  getAllStockData(): Observable<any[]> {
    return this.http.get<any>('/api/stocks-v2/list').pipe(
      map((response: any) => {
        if (response.success && Array.isArray(response.stocks)) {
          return response.stocks;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting all stock data from API:', error);
        return of([]);
      })
    );
  }

  /**
   * Pagination response interface
   */
  

  /**
   * Get stock data with pagination and search
   * @param options - Query options
   * @param options.keyword - Search keyword (symbol or company name)
   * @param options.limit - Number of records per page (default: 50)
   * @param options.offset - Number of records to skip (default: 0)
   */
  getStocksPaginated(options: { keyword?: string; limit?: number; offset?: number } = {}): Observable<{
    stocks: any[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean } | null;
    query: { keyword: string; limit: number; offset: number };
  }> {
    const { keyword = '', limit = 50, offset = 0 } = options;
    
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());

    const url = `/api/stocks-v2/list?${params.toString()}`;

    return this.http.get<any>(url).pipe(
      map((response: any) => {
        if (response.success) {
          return {
            stocks: response.stocks || [],
            pagination: response.pagination || null,
            query: response.query || { keyword, limit, offset }
          };
        }
        return {
          stocks: [],
          pagination: null,
          query: { keyword, limit, offset }
        };
      }),
      catchError((error) => {
        console.error('Error getting paginated stock data:', error);
        return of({
          stocks: [],
          pagination: null,
          query: { keyword, limit, offset }
        });
      })
    );
  }

  /**
   * Sync new stocks from DNSE API and save to database
   * This should only be called during days 10-20 of the month
   * Returns Observable with { newSymbols: string[], totalFromDNSE: number }
   */
  syncNewStocksFromDNSE(): Observable<{ newSymbols: string[]; totalFromDNSE: number; synced: boolean }> {
    if (!this.shouldSyncWithDNSE()) {
      return of({ newSymbols: [], totalFromDNSE: 0, synced: false });
    }

    return new Observable(observer => {
      // First, get all existing stocks from our API
      this.getAllStockData().subscribe({
        next: (existingStocks) => {
          const existingSymbolsSet = new Set(
            existingStocks.map((s: any) => s.symbol?.toUpperCase()).filter(Boolean)
          );

          // Then get all symbols from DNSE API
          this.getAllSymbols().subscribe({
            next: (results) => {
              const newSymbols: string[] = [];
              let totalFromDNSE = 0;

              results.forEach(({ symbols }) => {
                symbols.forEach(symbol => {
                  const symbolStr = typeof symbol === 'string' ? symbol : symbol.symbol;
                  const symbolKey = symbolStr.toUpperCase();
                  totalFromDNSE++;

                  if (!existingSymbolsSet.has(symbolKey)) {
                    newSymbols.push(symbolStr);
                  }
                });
              });

              if (newSymbols.length > 0) {
                console.log(`Found ${newSymbols.length} new stocks from DNSE:`, newSymbols);
                // Save new stocks to database (just basic info for now)
                this.saveNewStocksToDB(newSymbols).subscribe({
                  next: () => {
                    this.markDNSESynced();
                    observer.next({ newSymbols, totalFromDNSE, synced: true });
                    observer.complete();
                  },
                  error: (error) => {
                    console.error('Error saving new stocks:', error);
                    this.markDNSESynced(); // Still mark as synced to avoid retrying
                    observer.next({ newSymbols, totalFromDNSE, synced: true });
                    observer.complete();
                  }
                });
              } else {
                console.log('No new stocks found from DNSE');
                this.markDNSESynced();
                observer.next({ newSymbols: [], totalFromDNSE, synced: true });
                observer.complete();
              }
            },
            error: (error) => {
              console.error('Error getting symbols from DNSE:', error);
              observer.next({ newSymbols: [], totalFromDNSE: 0, synced: false });
              observer.complete();
            }
          });
        },
        error: (error) => {
          console.error('Error getting existing stocks:', error);
          observer.next({ newSymbols: [], totalFromDNSE: 0, synced: false });
          observer.complete();
        }
      });
    });
  }

  /**
   * Save new stocks to database with basic info
   */
  private saveNewStocksToDB(symbols: string[]): Observable<any> {
    const requests = symbols.map(symbol => 
      this.http.post<any>('/api/stocks-v2/create', {
        symbol: symbol.toUpperCase(),
        basicInfo: { symbol: symbol.toUpperCase() },
        priceData: null,
        fullData: null
      }).pipe(
        catchError(error => {
          console.error(`Error creating stock ${symbol}:`, error);
          return of(null);
        })
      )
    );

    return new Observable(observer => {
      if (requests.length === 0) {
        observer.next([]);
        observer.complete();
        return;
      }

      let completed = 0;
      const results: any[] = [];

      requests.forEach((req, index) => {
        req.subscribe({
          next: (result) => {
            results[index] = result;
            completed++;
            if (completed === requests.length) {
              observer.next(results);
              observer.complete();
            }
          },
          error: () => {
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
   * Get stock data from Stock API (includes basicInfo, priceData, fullData)
   */
  getStockDataFromAPI(symbol: string): Observable<any> {
    return this.http.get<any>(`/api/stocks-v2/${symbol.toUpperCase()}`).pipe(
      map((response: any) => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error('Stock data not found');
      }),
      catchError((error) => {
        console.error(`Error getting stock data for ${symbol}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Save stock data to Stock API
   */
  saveStockData(symbol: string, basicInfo: any, priceData: DNSEOHLCData, fullData: any): Observable<any> {
    return this.http.post<any>('/api/stocks-v2/save', {
      symbol: symbol.toUpperCase(),
      basicInfo,
      priceData,
      fullData
    }).pipe(
      catchError((error) => {
        console.error(`Error saving stock data for ${symbol}:`, error);
        return throwError(() => error);
      })
    );
  }
}

