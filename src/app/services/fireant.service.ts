import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  contributionToIndex?: number; // For top contributors
  industry?: string; // For industry filter
}

export interface Industry {
  icbCode: string;
  icbName: string;
  orderNo?: number;
  level?: number;
}

export interface SymbolFundamental {
  symbol: string;
  companyName: string;
  exchange: string;
  industry: string;
  icbCode?: string;
  marketCap?: number;
  sharesOutstanding?: number;
  eps?: number;
  pe?: number;
  pb?: number;
  roe?: number;
  roa?: number;
  [key: string]: any;
}

export interface SymbolInfo {
  symbol: string;
  organName?: string;
  organShortName?: string;
  organCode?: string;
  icbName?: string;
  comGroupCode?: string;
  lastPrice?: number;
  priceChange?: number;
  perPriceChange?: number;
  totalVolume?: number;
  ticker?: string;
  exchange?: string;
  [key: string]: any;
}

export interface SymbolPost {
  id?: string;
  title?: string;
  content?: string;
  originalContent?: string;
  summary?: string;
  publishDate?: string;
  date?: string;
  source?: string;
  url?: string;
  imageUrl?: string;
  user?: {
    id?: string;
    name?: string;
    bio?: string;
    isAuthentic?: boolean;
    followed?: boolean;
  };
  link?: string;
  linkImage?: string;
  linkTitle?: string;
  linkDescription?: string;
  images?: Array<{
    imageID?: number;
    base64Image?: string;
    imageUrl?: string;
  }>;
  totalLikes?: number;
  totalReplies?: number;
  totalShares?: number;
  taggedSymbols?: Array<{
    symbol?: string;
    price?: number;
    change?: number;
    percentChange?: number;
    changeSince?: number;
    percentChangeSince?: number;
  }>;
  [key: string]: any;
}

export interface HistoricalQuote {
  date?: string;
  priceBasic?: {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
  };
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  [key: string]: any;
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
  branches?: number;
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
  [key: string]: any;
}

export interface MacroIndicator {
  indicatorID?: string;
  name?: string;
  value?: number;
  unit?: string;
  period?: string;
  lastUpdate?: string;
  changePercent?: number;
  [key: string]: any;
}

export interface TopMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  type?: string; // 'gainer', 'loser', 'active'
  [key: string]: any;
}

export interface FireAntAuthResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FireantService {
  private apiUrl = 'https://api.fireant.vn';
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Anonymous login to FireAnt API
   */
  loginAnonymous(): Observable<FireAntAuthResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    console.log('🔐 Attempting anonymous login to FireAnt API...');

    return this.http.post<FireAntAuthResponse>(
      `${this.apiUrl}/authentication/anonymous-login`,
      {}, // Empty body for anonymous login
      { headers }
    ).pipe(
      tap(response => {
        console.log('FireAnt login response:', response);
        if (response && response.accessToken) {
          this.tokenSubject.next(response.accessToken);
          console.log('✅ Authentication successful');
        } else {
          console.error('❌ No access token in response');
        }
      }),
      catchError(error => {
        console.error('❌ FireAnt login error:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url
        });
        throw error;
      })
    );
  }

  /**
   * Get all instruments (all stock symbols)
   * @param exchange - Optional exchange filter (HOSE, HNX, UPCOM)
   */
  getAllInstruments(exchange?: string): Observable<StockData[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available. Please login first.');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Use the /instruments endpoint to get all symbols
    const url = exchange 
      ? `${this.apiUrl}/instruments?exchange=${exchange}`
      : `${this.apiUrl}/instruments`;
    console.log(`📊 Fetching instruments from: ${url}`);

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        console.log('✅ FireAnt API Response (Instruments):', response);
        
        // Handle different response structures
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        } else if (response && response.items) {
          dataArray = response.items;
        }

        if (!Array.isArray(dataArray)) {
          console.error('❌ Unexpected API response format:', response);
          throw new Error('Invalid API response format');
        }

        console.log(`✅ Received ${dataArray.length} instruments${exchange ? ' from ' + exchange : ''}`);
        
        // Log raw data structure for debugging
        if (dataArray.length > 0) {
          console.log('📋 Sample raw item:', JSON.stringify(dataArray[0], null, 2));
        }

        // Transform the API response to our StockData format
        const stocks = dataArray.map((item: any) => {
          // Extract nested priceBasic if it exists
          const priceData = item.priceBasic || item;
          
          return {
            symbol: item.symbol || item.ticker || item.code || '',
            name: item.organName || item.companyName || item.name || item.organShortName || '',
            price: priceData.matchPrice || priceData.lastPrice || item.lastPrice || item.price || 
                   priceData.closePrice || item.closePrice || priceData.close || item.close || 0,
            change: priceData.change || item.change || item.priceChange || item.changePrice || 0,
            changePercent: priceData.changePc || item.changePc || item.changePercent || 
                          item.perPriceChange || item.pctChange || item.percentChange || 0,
            volume: item.totalMatchVol || priceData.totalMatchVol || item.volume || 
                   item.totalVol || item.matchedVolume || item.totalVolume || 0,
            high: priceData.highest || item.highest || item.high || item.highPrice || 0,
            low: priceData.lowest || item.lowest || item.low || item.lowPrice || 0,
            open: priceData.open || item.open || item.openPrice || item.openingPrice || 0,
            industry: item.icbName || item.industry || ''
          };
        });

        console.log('✅ Transformed instruments (sample):', stocks.slice(0, 2));
        return stocks;
      }),
      catchError(error => {
        console.error(`❌ Error fetching instruments${exchange ? ' for ' + exchange : ''}:`, error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url
        });
        throw error;
      })
    );
  }

  /**
   * Get stock market data by exchange (using /instruments endpoint)
   * @param exchange - The exchange code (HOSE, HNX, UPCOM)
   */
  getStockMarketData(exchange: string = 'HOSE'): Observable<StockData[]> {
    return this.getAllInstruments(exchange);
  }

  /**
   * Get all symbols (no exchange filter)
   */
  getAllSymbols(): Observable<StockData[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log('📊 Fetching all symbols...');

    return this.http.get<any>(`${this.apiUrl}/symbols`, { headers }).pipe(
      map(response => {
        console.log('✅ All symbols response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        return dataArray.map((item: any) => ({
          symbol: item.symbol || item.code || '',
          name: item.name || item.companyName || item.organName || '',
          price: item.lastPrice || item.price || 0,
          change: item.change || 0,
          changePercent: item.changePercent || item.pctChange || 0,
          volume: item.volume || item.totalVol || 0,
          high: item.high || item.highPrice || 0,
          low: item.low || item.lowPrice || 0,
          open: item.open || item.openPrice || 0
        }));
      }),
      catchError(error => {
        console.error('❌ Error fetching all symbols:', error);
        throw error;
      })
    );
  }

  /**
   * Search for stocks by symbol
   */
  searchStock(symbol: string): Observable<any> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`🔍 Searching for stock: ${symbol}`);

    return this.http.get<any>(`${this.apiUrl}/symbols/${symbol}`, { headers }).pipe(
      tap(response => console.log('✅ Stock search result:', response)),
      catchError(error => {
        console.error(`❌ Error searching stock ${symbol}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get top contributors to index
   * @param index - Index code (VNINDEX, HNX-INDEX, UPCOM-INDEX, VN30)
   */
  getTopContributors(index: string = 'VNINDEX'): Observable<StockData[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const url = `${this.apiUrl}/symbols/top-contributors-to-index?index=${index}`;
    console.log(`📊 Fetching top contributors to ${index}: ${url}`);

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        console.log('✅ Top Contributors Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          console.error('❌ Unexpected API response format:', response);
          throw new Error('Invalid API response format');
        }

        console.log(`✅ Received ${dataArray.length} top contributors`);
        
        // Log raw data structure for debugging
        if (dataArray.length > 0) {
          console.log('📋 Sample contributor:', JSON.stringify(dataArray[0], null, 2));
        }

        return dataArray.map((item: any) => {
          const priceData = item.priceBasic || item;
          
          return {
            symbol: item.symbol || item.ticker || item.code || '',
            name: item.organName || item.name || item.companyName || item.organShortName || '',
            price: priceData.matchPrice || item.lastPrice || item.price || priceData.lastPrice || 0,
            change: priceData.change || item.change || item.priceChange || 0,
            changePercent: priceData.changePc || item.changePc || item.changePercent || item.perPriceChange || 0,
            volume: item.totalMatchVol || priceData.totalMatchVol || item.volume || 0,
            high: priceData.highest || item.highest || item.high || 0,
            low: priceData.lowest || item.lowest || item.low || 0,
            open: priceData.open || item.open || 0,
            contributionToIndex: item.contributionToIndex || item.indexContribution || item.indexImpact || 0
          };
        });
      }),
      catchError(error => {
        console.error(`❌ Error fetching top contributors for ${index}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get all industries
   */
  getIndustries(): Observable<Industry[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log('📊 Fetching industries...');

    return this.http.get<any>(`${this.apiUrl}/industries`, { headers }).pipe(
      map(response => {
        console.log('✅ Industries Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          dataArray = [];
        }

        console.log(`✅ Received ${dataArray.length} industries`);
        
        // Log first industry for debugging
        if (dataArray.length > 0) {
          console.log('📋 Sample industry:', JSON.stringify(dataArray[0], null, 2));
        }

        return dataArray.map((item: any) => {
          const industry = {
            icbCode: item.industryCode || item.icbCode || item.code || '',
            icbName: item.name || item.icbName || item.industryName || '',
            orderNo: item.orderNo || 0,
            level: item.level || 0
          };
          
          // Log if icbCode is missing
          if (!industry.icbCode) {
            console.warn('⚠️ Industry missing icbCode:', item);
          }
          
          return industry;
        });
      }),
      catchError(error => {
        console.error('❌ Error fetching industries:', error);
        throw error;
      })
    );
  }

  /**
   * Get symbol fundamental data
   * @param symbol - Stock symbol
   */
  getSymbolFundamental(symbol: string): Observable<SymbolFundamental> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`📊 Fetching fundamental data for ${symbol}...`);

    return this.http.get<any>(`${this.apiUrl}/symbols/${symbol}/fundamental`, { headers }).pipe(
      map(response => {
        console.log('✅ Fundamental Response:', response);
        const data = response.data || response;

        return {
          symbol: data.symbol || symbol,
          companyName: data.companyName || data.organName || '',
          exchange: data.exchange || data.floor || '',
          industry: data.industry || data.icbName || '',
          icbCode: data.icbCode || '',
          marketCap: data.marketCap || data.marketCapitalization || 0,
          sharesOutstanding: data.sharesOutstanding || data.outstandingShare || 0,
          eps: data.eps || data.basicEps || 0,
          pe: data.pe || data.priceToEarning || 0,
          pb: data.pb || data.priceToBook || 0,
          roe: data.roe || data.returnOnEquity || 0,
          roa: data.roa || data.returnOnAssets || 0,
          ...data
        };
      }),
      catchError(error => {
        console.error(`❌ Error fetching fundamental for ${symbol}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get symbols by industry
   * @param icbCode - Industry ICB code
   */
  getSymbolsByIndustry(icbCode: string): Observable<StockData[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const url = `${this.apiUrl}/icb/${icbCode}/symbols`;
    console.log(`📊 Fetching symbols by industry ${icbCode}: ${url}`);

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        console.log('✅ Symbols by Industry Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          dataArray = [];
        }

        console.log(`✅ Received ${dataArray.length} symbols in industry`);
        
        // Log raw data structure for debugging
        if (dataArray.length > 0) {
          console.log('📋 Sample industry symbol:', JSON.stringify(dataArray[0], null, 2));
        }

        return dataArray.map((item: any) => {
          const priceData = item.priceBasic || item;
          
          return {
            symbol: item.symbol || item.ticker || item.code || '',
            name: item.organName || item.name || item.companyName || item.organShortName || '',
            price: priceData.matchPrice || item.lastPrice || item.price || priceData.lastPrice || 0,
            change: priceData.change || item.change || item.priceChange || 0,
            changePercent: priceData.changePc || item.changePc || item.changePercent || item.perPriceChange || 0,
            volume: item.totalMatchVol || priceData.totalMatchVol || item.volume || 0,
            high: priceData.highest || item.highest || item.high || 0,
            low: priceData.lowest || item.lowest || item.low || 0,
            open: priceData.open || item.open || 0,
            industry: item.icbName || item.industry || ''
          };
        });
      }),
      catchError(error => {
        console.error(`❌ Error fetching symbols by industry ${icbCode}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get symbol info (detailed info about a stock symbol)
   * @param symbol - Stock symbol
   */
  getSymbolInfo(symbol: string): Observable<SymbolInfo> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`📊 Fetching symbol info for ${symbol}...`);

    return this.http.get<any>(`${this.apiUrl}/symbols/${symbol}`, { headers }).pipe(
      map(response => {
        console.log('✅ Symbol Info Response:', response);
        const data = response.data || response;
        return {
          symbol: data.symbol || data.ticker || symbol,
          organName: data.organName || data.companyName || '',
          organShortName: data.organShortName || data.shortName || '',
          organCode: data.organCode || '',
          icbName: data.icbName || data.industry || '',
          comGroupCode: data.comGroupCode || '',
          lastPrice: data.lastPrice || data.price || 0,
          priceChange: data.priceChange || data.change || 0,
          perPriceChange: data.perPriceChange || data.changePercent || 0,
          totalVolume: data.totalVolume || data.volume || 0,
          ticker: data.ticker || data.symbol || symbol,
          exchange: data.exchange || data.floor || '',
          ...data
        };
      }),
      catchError(error => {
        console.error(`❌ Error fetching symbol info for ${symbol}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get symbol posts/news
   * @param symbol - Stock symbol
   * @param limit - Number of posts to fetch (default 10)
   */
  getSymbolPosts(symbol: string, limit: number = 10): Observable<SymbolPost[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`📰 Fetching posts for ${symbol}...`);

    return this.http.get<any>(`${this.apiUrl}/symbols/${symbol}/posts?limit=${limit}`, { headers }).pipe(
      map(response => {
        console.log('✅ Symbol Posts Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          dataArray = [];
        }

        console.log(`✅ Received ${dataArray.length} posts`);

        return dataArray.map((item: any) => ({
          id: item.postID || item.id || item.postId || '',
          title: item.title || '',
          content: item.originalContent || item.content || '',
          summary: item.summary || item.description || '',
          publishDate: item.date || item.publishDate || item.createdDate || '',
          source: item.postSource || item.source || item.sourceName || '',
          url: item.contentURL || item.url || item.link || '',
          imageUrl: item.linkImage || item.imageUrl || item.thumbnail || '',
          ...item
        }));
      }),
      catchError(error => {
        console.error(`❌ Error fetching posts for ${symbol}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get historical quotes (price history)
   * @param symbol - Stock symbol
   * @param startDate - Start date (format: YYYY-MM-DD)
   * @param endDate - End date (format: YYYY-MM-DD)
   */
  getHistoricalQuotes(symbol: string, startDate: string, endDate: string): Observable<HistoricalQuote[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`📈 Fetching historical quotes for ${symbol} from ${startDate} to ${endDate}...`);

    return this.http.get<any>(
      `${this.apiUrl}/symbols/${symbol}/historical-quotes?startDate=${startDate}&endDate=${endDate}`, 
      { headers }
    ).pipe(
      map(response => {
        console.log('✅ Historical Quotes Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          dataArray = [];
        }

        console.log(`✅ Received ${dataArray.length} historical quotes`);

        return dataArray.map((item: any) => ({
          date: item.date || item.tradingDate || '',
          open: item.priceOpen || item.open || item.priceBasic?.open || 0,
          high: item.priceHigh || item.high || item.highest || item.priceBasic?.high || 0,
          low: item.priceLow || item.low || item.lowest || item.priceBasic?.low || 0,
          close: item.priceClose || item.close || item.priceBasic?.close || item.priceBasic || 0,
          volume: item.totalVolume || item.dealVolume || item.volume || item.priceBasic?.volume || 0,
          priceBasic: item.priceBasic,
          ...item
        }));
      }),
      catchError(error => {
        console.error(`❌ Error fetching historical quotes for ${symbol}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get macro indicators
   */
  getMacroIndicators(): Observable<MacroIndicator[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log('📊 Fetching macro indicators...');

    return this.http.get<any>(`${this.apiUrl}/macro/indicators`, { headers }).pipe(
      map(response => {
        console.log('✅ Macro Indicators Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          dataArray = [];
        }

        console.log(`✅ Received ${dataArray.length} macro indicators`);

        return dataArray.map((item: any) => ({
          indicatorID: item.indicatorID || item.id || '',
          name: item.name || item.indicatorName || '',
          value: item.value || item.latestValue || 0,
          unit: item.unit || '',
          period: item.period || item.periodName || '',
          lastUpdate: item.lastUpdate || item.updateDate || '',
          changePercent: item.changePercent || item.percentChange || 0,
          ...item
        }));
      }),
      catchError(error => {
        console.error('❌ Error fetching macro indicators:', error);
        throw error;
      })
    );
  }

  /**
   * Get top movers (gainers, losers, most active)
   * @param type - Type of movers: 'gainer', 'loser', 'active', 'breakout', 'foreign'
   * @param exchange - Exchange filter (optional)
   */
  getTopMovers(type: string = 'gainer', exchange?: string): Observable<TopMover[]> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const params = exchange ? `?type=${type}&exchange=${exchange}` : `?type=${type}`;
    const url = `${this.apiUrl}/symbols/top-movers${params}`;
    console.log(`📊 Fetching top movers (${type}): ${url}`);

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        console.log('✅ Top Movers Response:', response);
        let dataArray = response;
        
        if (response && response.data) {
          dataArray = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response && Array.isArray(response)) {
          dataArray = response;
        }

        if (!Array.isArray(dataArray)) {
          dataArray = [];
        }

        console.log(`✅ Received ${dataArray.length} top movers`);

        return dataArray.map((item: any) => {
          const priceData = item.priceBasic || item;
          
          return {
            symbol: item.symbol || item.ticker || item.code || '',
            name: item.organName || item.name || item.companyName || item.organShortName || '',
            price: priceData.matchPrice || item.lastPrice || item.price || priceData.lastPrice || 0,
            change: priceData.change || item.change || item.priceChange || 0,
            changePercent: priceData.changePc || item.changePc || item.changePercent || item.perPriceChange || 0,
            volume: item.totalMatchVol || priceData.totalMatchVol || item.volume || item.totalVolume || 0,
            high: priceData.highest || item.highest || item.high || 0,
            low: priceData.lowest || item.lowest || item.low || 0,
            open: priceData.open || item.open || 0,
            type: type,
            ...item
          };
        });
      }),
      catchError(error => {
        console.error(`❌ Error fetching top movers (${type}):`, error);
        throw error;
      })
    );
  }

  /**
   * Get institution profile
   * @param symbol - Stock symbol
   */
  getInstitutionProfile(symbol: string): Observable<InstitutionProfile> {
    const token = this.tokenSubject.value;
    
    if (!token) {
      console.error('❌ No authentication token available');
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`🏢 Fetching institution profile for ${symbol}...`);

    return this.http.get<any>(`${this.apiUrl}/symbols/${symbol}/profile`, { headers }).pipe(
      map(response => {
        console.log('✅ Institution Profile Response:', response);
        const data = response.data || response;

        return {
          institutionID: data.institutionID || 0,
          symbol: data.symbol || symbol,
          icbCode: data.icbCode || '',
          companyName: data.companyName || '',
          shortName: data.shortName || '',
          internationalName: data.internationalName || '',
          headQuarters: data.headQuarters || '',
          phone: data.phone || '',
          fax: data.fax || '',
          email: data.email || '',
          webAddress: data.webAddress || '',
          overview: data.overview || '',
          history: data.history || '',
          businessAreas: data.businessAreas || '',
          employees: data.employees || 0,
          branches: data.branches || 0,
          establishmentDate: data.establishmentDate || data.establishmentDate || '',
          businessLicenseNumber: data.businessLicenseNumber || '',
          dateOfIssue: data.dateOfIssue || '',
          taxIDNumber: data.taxIDNumber || '',
          charterCapital: data.charterCapital || 0,
          dateOfListing: data.dateOfListing || '',
          exchange: data.exchange || '',
          initialListingPrice: data.initialListingPrice || 0,
          listingVolume: data.listingVolume || 0,
          stateOwnership: data.stateOwnership || 0,
          foreignOwnership: data.foreignOwnership || 0,
          otherOwnership: data.otherOwnership || 0,
          isListed: data.isListed || false,
          ...data
        };
      }),
      catchError(error => {
        console.error(`❌ Error fetching institution profile for ${symbol}:`, error);
        throw error;
      })
    );
  }
}
