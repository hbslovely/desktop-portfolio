import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface StoredToken {
  token: string;
  timestamp: number;
}

export interface FireAntSearchResult {
  symbol: string;
  organCode: string;
  organName: string;
  organShortName: string;
  comGroupCode: string;
  icbCode: string;
}

export interface FireAntSearchResponse {
  data: FireAntSearchResult[];
  total: number;
}

export interface FireAntStockInfo {
  symbol: string;
  organCode: string;
  organName: string;
  organShortName: string;
  floor: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  ceilingPrice: number;
  floorPrice: number;
  refPrice: number;
  totalVolume: number;
  totalValue: number;
  marketCap: number;
  pe: number;
  eps: number;
  beta: number;
}

// Interfaces for VNStock app compatibility
export interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface SymbolFundamental {
  symbol: string;
  marketCap?: number;
  sharesOutstanding?: number;
  eps?: number;
  pe?: number;
  pb?: number;
  roe?: number;
  roa?: number;
  exchange?: string;
}

export interface SymbolInfo {
  symbol: string;
  organCode: string;
  organName: string;
  organShortName?: string;
  exchange?: string;
  icbName?: string;
  lastPrice?: number;
  priceChange?: number;
  perPriceChange?: number;
  totalVolume?: number;
}

export interface SymbolPost {
  id?: string | number;
  user?: {
    name?: string;
    isAuthentic?: boolean;
  };
  publishDate?: string;
  date?: string;
  title?: string;
  content?: string;
  originalContent?: string;
  link?: string;
  linkImage?: string;
  linkTitle?: string;
  linkDescription?: string;
  images?: any[];
  totalLikes?: number;
  totalReplies?: number;
  totalShares?: number;
}

export interface HistoricalQuote {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  priceBasic?: {
    open?: number;
    close?: number;
    volume?: number;
  };
}

export interface InstitutionProfile {
  institutionID?: number;
  symbol?: string;
  icbCode?: string;
  companyName?: string;
  shortName?: string;
  internationalName?: string;
  headQuarters?: string;
  phone?: string;
  fax?: string;
  email?: string;
  webAddress?: string;
  overview?: string;
  history?: string;
  businessAreas?: string;
  employees?: number;
  branches?: number | null;
  establishmentDate?: string;
  businessLicenseNumber?: string;
  dateOfIssue?: string;
  taxIDNumber?: string;
  charterCapital?: number;
  dateOfListing?: string;
  exchange?: string;
  initialListingPrice?: number;
  listingVolume?: number;
  stateOwnership?: number;
  foreignOwnership?: number;
  otherOwnership?: number;
  isListed?: boolean;
}

export interface SearchResult {
  symbol?: string;
  organName?: string;
  name?: string;
  key?: string;
  id?: string | number | null;
  description?: string;
  type?: string;
}

export interface SymbolEvent {
  eventID?: string | number;
  eventDate?: string;
  eventType?: string;
  eventTitle?: string;
  eventDesc?: string;
  attachedFile?: string;
}

export interface MacroDataType {
  type: string;
  name?: string;
  nameVN?: string;
  description?: string;
  id?: string | number;
}

export interface MacroDataInfo {
  nameVN?: string;
  name?: string;
  description?: string;
  id?: string | number;
  frequency?: string;
  lastValue?: number;
  unit?: string;
  lastDate?: string;
  previousValue?: number;
  minValue?: number;
  maxValue?: number;
  averageValue?: number;
}

export interface SymbolHolder {
  institutionHolderID?: string | number;
  individualHolderID?: string | number;
  majorHolderID?: string | number;
  isOrganization?: boolean;
  isForeigner?: boolean;
  isFounder?: boolean;
  ownership?: number;
  position?: string;
  shares?: number;
  institutionHolderSymbol?: string;
  reported?: string;
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FireantService {
  private tokenSubject = new BehaviorSubject<string>('');
  public token$ = this.tokenSubject.asObservable();

  // Base URL for FireAnt API (using proxy to avoid CORS)
  private readonly BASE_URL = '/api/fireant-api';

  // Storage key for localStorage
  private readonly STORAGE_KEY = 'fireant_jwt_token';

  // Expiration time: 3 days in milliseconds
  private readonly EXPIRATION_TIME = 3 * 24 * 60 * 60 * 1000;

  constructor(private http: HttpClient) {
    // Initialize token from localStorage or fetch new one
    this.initializeToken();
  }

  /**
   * Get current token value
   */
  getToken(): string {
    return this.tokenSubject.value;
  }

  /**
   * Initialize JWT token from localStorage or fetch new one
   */
  private initializeToken(): void {
    const stored = this.getStoredToken();
    if (stored && !this.isExpired(stored.timestamp)) {
      // Use stored token if not expired
      this.tokenSubject.next(stored.token);
      console.log('Using cached FireAnt token');
        } else {
      // Fetch new token if expired or not found
      console.log('Cached token expired or not found, fetching new one...');
      this.fetchAndStoreToken();
    }
  }

  /**
   * Get stored token from localStorage
   */
  private getStoredToken(): StoredToken | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as StoredToken;
      }
    } catch (error) {
      console.error('Error reading FireAnt token from localStorage:', error);
    }
    return null;
  }

  /**
   * Store token in localStorage with timestamp
   */
  private storeToken(token: string): void {
    try {
      const data: StoredToken = {
        token,
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('FireAnt token cached for 3 days');
    } catch (error) {
      console.error('Error writing FireAnt token to localStorage:', error);
    }
  }

  /**
   * Check if stored timestamp is expired (older than 3 days)
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.EXPIRATION_TIME;
  }

  /**
   * Fetch and store new JWT token
   */
  private fetchAndStoreToken(): void {
    this.fetchToken().then(() => {
      const currentToken = this.tokenSubject.value;
      if (currentToken) {
        this.storeToken(currentToken);
      }
    }).catch(error => {
      console.error('Failed to fetch FireAnt token:', error);
    });
  }

  /**
   * Fetch the JWT token from FireAnt's JavaScript files
   */
  private async fetchToken(): Promise<void> {
    try {
      // Fetch the main HTML page to get script references (using proxy to avoid CORS)
      const htmlResponse = await firstValueFrom(
        this.http.get('/api/fireant', { responseType: 'text' })
      );

      // Look for script tags with _app-*.js pattern
      const scriptMatches = htmlResponse.match(/_app-[a-f0-9]+\.js/g);

      if (!scriptMatches) {
        throw new Error('No _app script files found');
      }

      // Try to find the token in the script files
      for (const scriptFile of scriptMatches) {
        try {
          const scriptUrl = `/api/fireant-static/web/v1/_next/static/chunks/pages/${scriptFile}`;
          const scriptContent = await firstValueFrom(
            this.http.get(scriptUrl, { responseType: 'text' })
          );

          // Look for JWT token pattern: let em = "eyJ..."
          const tokenMatch = scriptContent.match(/let\s+em\s*=\s*"(eyJ[^"]+)"/);

          if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];
            this.tokenSubject.next(token);
            console.log('✅ Found and updated FireAnt token');
            return;
          }
        } catch (error) {
          // Continue to next file if this one fails
          console.log(`⏭️  Skipping ${scriptFile}, continuing...`);
          continue;
        }
      }

      console.warn('⚠️ JWT token not found in any script files');
    } catch (error) {
      console.error('❌ Error fetching FireAnt token:', error);
        throw error;
    }
  }

  /**
   * Handle API call failure by fetching new token
   */
  private handleApiFailure(): void {
    console.warn('FireAnt API call failed, attempting to refresh token...');
    this.fetchAndStoreToken();
  }

  /**
   * Get the current token
   */
  private getCurrentToken(): string {
    return this.tokenSubject.value;
  }

  /**
   * Get headers with authorization token
   */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.getCurrentToken()}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Search for stocks/symbols
   */
  search(keywords: string, type: string = 'symbol', offset: number = 0, limit: number = 20): Observable<SearchResult[]> {
    const url = `${this.BASE_URL}/search?keywords=${encodeURIComponent(keywords)}&type=${type}&offset=${offset}&limit=${limit}`;

    return this.http.get<any[]>(url, { headers: this.getHeaders() }).pipe(
      map((results: any[]) => {
        // API returns array directly, map to SearchResult format
        return results.map((item: any) => ({
          symbol: item.symbol || item.key || '',
          organName: item.organName || item.name || '',
          name: item.name || item.organName || '',
          key: item.key || item.symbol || '',
          id: item.id,
          description: item.description || '',
          type: item.type || 'symbol',
          ...item // Include all other properties from API
        }));
      }),
      catchError((error) => {
        console.error('Failed to search FireAnt:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get stock information by symbol
   */
  getStockInfo(symbol: string): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get stock info:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get stock chart data
   */
  getChartData(symbol: string, startDate: string, endDate: string): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}/historical-quotes?startDate=${startDate}&endDate=${endDate}`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get chart data:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get company financial data
   */
  getFinancialData(organCode: string): Observable<any> {
    const url = `${this.BASE_URL}/companies/${organCode}/financial-reports`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get financial data:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  // Additional methods for VNStock app compatibility
  loginAnonymous(): Observable<any> {
    // Token is already managed, just return success
    return new Observable(observer => {
      observer.next({ success: true });
      observer.complete();
    });
  }

  getSymbolFundamental(symbol: string): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}/fundamental`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get symbol fundamental:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  getSymbolInfo(symbol: string): Observable<any> {
    return this.getStockInfo(symbol);
  }

  getSymbolPosts(symbol: string, limit: number = 10): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}/posts?limit=${limit}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get symbol posts:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  getSymbolEvents(symbol: string, startDate: string, endDate: string): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}/events?startDate=${startDate}&endDate=${endDate}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get symbol events:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  getSymbolHolders(symbol: string): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}/holders`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get symbol holders:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  getHistoricalQuotes(symbol: string, startDate: string, endDate: string): Observable<any> {
    return this.getChartData(symbol, startDate, endDate);
  }

  getInstitutionProfile(symbol: string): Observable<any> {
    const url = `${this.BASE_URL}/symbols/${symbol}/institution-profile`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get institution profile:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  getMacroDataTypes(): Observable<any> {
    const url = `${this.BASE_URL}/macro/types`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get macro data types:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  getMacroDataInfo(type: string): Observable<any> {
    const url = `${this.BASE_URL}/macro/${type}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Failed to get macro data info:', error);
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  searchSymbols(keywords: string, type: string = 'symbol', offset: number = 0, limit: number = 20): Observable<SearchResult[]> {
    return this.search(keywords, type, offset, limit);
  }
}
