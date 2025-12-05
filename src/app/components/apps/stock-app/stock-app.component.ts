import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DnseService, DNSESymbol, DNSEStockData, DNSEOHLCData, ExchangeType } from '../../../services/dnse.service';
import { environment } from '../../../../environments/environment';
import { Chart, ChartConfiguration, registerables, TimeScale } from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';

// Register Chart.js and financial chart components
Chart.register(...registerables, TimeScale);
Chart.register(CandlestickController, CandlestickElement);

interface SymbolWithStatus extends DNSESymbol {
  exchange: ExchangeType;
  isFetched: boolean;
  isFetching?: boolean;
  basicInfo?: {
    companyName?: string;
    exchange?: string;
    matchPrice?: string;
    changedValue?: string;
    changedRatio?: string;
    totalVolume?: string;
    marketCap?: string;
    beta?: string;
    eps?: string;
    pe?: string;
    pb?: string;
    roe?: string;
    roa?: string;
  };
}

interface ExchangeCount {
  exchange: ExchangeType;
  total: number;
  fetched: number;
}

@Component({
  selector: 'app-stock-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-app.component.html',
  styleUrl: './stock-app.component.scss'
})
export class StockAppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('candlestickChart') candlestickChartRef!: ElementRef<HTMLCanvasElement>;
  private candlestickChart: Chart | null = null;
  // Exchange types
  exchanges: ExchangeType[] = ['hose', 'hnx', 'upcom', 'vn30'];
  exchangeNames: Record<ExchangeType, string> = {
    'hose': 'HOSE',
    'hnx': 'HNX',
    'upcom': 'UPCOM',
    'vn30': 'VN30'
  };

  // State
  selectedExchange = signal<ExchangeType | 'all'>('all');
  allSymbols = signal<SymbolWithStatus[]>([]);
  filteredSymbols = signal<SymbolWithStatus[]>([]);
  isLoading = signal(false);
  searchQuery = signal('');

  // Fetching state
  fetchingSymbols = signal<Set<string>>(new Set());
  fetchedCount = signal(0);
  totalCount = computed(() => this.allSymbols().length);

  // Computed: check if there are unfetched symbols
  hasUnfetchedSymbols = computed(() => {
    return this.filteredSymbols().filter(s => !s.isFetched).length > 0;
  });

  // Exchange counts
  exchangeCounts = signal<Map<ExchangeType, ExchangeCount>>(new Map());

  // Google Sheets configuration
  sheetId = signal('17NW3ieBoMCpun6STz57AVoVHm7g7V5N7Dyu1gGG3Mi0');
  scriptId = signal(environment.securitiesSheetScriptId || '');

  // Selected symbol for detail view
  selectedSymbol = signal<SymbolWithStatus | null>(null);
  selectedSymbolData = signal<DNSEStockData | null>(null);
  selectedSymbolPriceData = signal<DNSEOHLCData | null>(null);
  showDetailView = signal(false);
  isLoadingDetail = signal(false);
  isLoadingPrice = signal(false);
  selectedYears = signal<number>(3); // Default 3 years

  // Computed: price table data (cached to avoid repeated calculations)
  priceTableData = computed(() => {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.t) return [];

    const result: Array<{date: string, open: number, high: number, low: number, close: number, volume: number}> = [];

    for (let i = 0; i < priceData.t.length; i++) {
      const timestamp = priceData.t[i];
      const date = new Date(timestamp * 1000);
      const dateStr = this.formatDateVN(date);

      result.push({
        date: dateStr,
        open: priceData.o[i] || 0,
        high: priceData.h[i] || 0,
        low: priceData.l[i] || 0,
        close: priceData.c[i] || 0,
        volume: priceData.v[i] || 0
      });
    }

    // Show latest 20 records (most recent first)
    return result.slice(-20).reverse();
  });

  constructor(
    private dnseService: DnseService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadSymbols();
    this.checkFetchedStatusFromSheets();
  }

  ngAfterViewInit() {
    // Chart will be initialized when price data is loaded
  }

  ngOnDestroy() {
    // Cleanup chart
    if (this.candlestickChart) {
      this.candlestickChart.destroy();
      this.candlestickChart = null;
    }
  }

  /**
   * Load symbols from all exchanges
   */
  loadSymbols() {
    this.isLoading.set(true);

    this.dnseService.getAllSymbols().subscribe({
      next: (results) => {
        const allSymbols: SymbolWithStatus[] = [];

        results.forEach(({ exchange, symbols }) => {
          symbols.forEach(symbol => {
            const symbolStr = typeof symbol === 'string' ? symbol : symbol.symbol;
            allSymbols.push({
              symbol: symbolStr,
              name: typeof symbol === 'object' ? symbol.name : undefined,
              exchange,
              isFetched: false // Will be updated by checkFetchedStatusFromSheets
            });
          });
        });

        this.allSymbols.set(allSymbols);
        this.applyFilters();
        this.checkFetchedStatusFromSheets();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading symbols:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Check fetched status from Google Sheets and load basic info
   */
  checkFetchedStatusFromSheets() {
    if (!this.scriptId()) {
      // Fallback to localStorage if scriptId not configured
      this.allSymbols.update(symbols =>
        symbols.map(s => ({
          ...s,
          isFetched: this.dnseService.isFetched(s.symbol)
        }))
      );
      this.applyFilters();
      this.updateFetchedCount();
      this.updateExchangeCounts();
      return;
    }

    this.dnseService.getAllFetchedSymbolsFromSheets(this.sheetId(), this.scriptId()).subscribe({
      next: (fetchedSymbols) => {
        const fetchedSet = new Set(fetchedSymbols);
        this.allSymbols.update(symbols =>
          symbols.map(s => ({
            ...s,
            isFetched: fetchedSet.has(s.symbol)
          }))
        );
        this.applyFilters();
        this.updateFetchedCount();
        this.updateExchangeCounts();

        // Load basic info for fetched symbols
        this.loadBasicInfoForFetchedSymbols(fetchedSymbols);
      },
      error: (error) => {
        console.error('Error checking fetched status:', error);
        // Fallback to localStorage
        this.allSymbols.update(symbols =>
          symbols.map(s => ({
            ...s,
            isFetched: this.dnseService.isFetched(s.symbol)
          }))
        );
        this.applyFilters();
        this.updateFetchedCount();
        this.updateExchangeCounts();
      }
    });
  }

  /**
   * Load basic info for fetched symbols
   */
  loadBasicInfoForFetchedSymbols(fetchedSymbols: string[]) {
    if (!this.scriptId() || fetchedSymbols.length === 0) return;

    // Load all stocks basic info at once
    this.dnseService.getAllStocksBasicInfoFromSheets(this.sheetId(), this.scriptId()).subscribe({
      next: (response) => {
        if (response.success && response.data && Array.isArray(response.data)) {
          const basicInfoMap = new Map<string, any>();
          response.data.forEach((info: any) => {
            if (info.symbol) {
              basicInfoMap.set(info.symbol, info);
            }
          });

          // Update symbols with basic info
          this.allSymbols.update(symbols =>
            symbols.map(s => {
              const basicInfo = basicInfoMap.get(s.symbol);
              if (basicInfo) {
                return {
                  ...s,
                  basicInfo: {
                    companyName: basicInfo.companyName,
                    exchange: basicInfo.exchange,
                    matchPrice: basicInfo.matchPrice,
                    changedValue: basicInfo.changedValue,
                    changedRatio: basicInfo.changedRatio,
                    totalVolume: basicInfo.totalVolume,
                    marketCap: basicInfo.marketCap,
                    beta: basicInfo.beta,
                    eps: basicInfo.eps,
                    pe: basicInfo.pe,
                    pb: basicInfo.pb,
                    roe: basicInfo.roe,
                    roa: basicInfo.roa
                  }
                };
              }
              return s;
            })
          );
          this.applyFilters();
        }
      },
      error: (error) => {
        console.error('Error loading basic info:', error);
      }
    });
  }

  /**
   * Load basic info for a single symbol
   */
  loadBasicInfoForSymbol(symbol: string) {
    if (!this.scriptId()) return;

    this.dnseService.getStockBasicInfoFromSheets(this.sheetId(), symbol, this.scriptId()).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const basicInfo = response.data;
          this.allSymbols.update(symbols =>
            symbols.map(s => {
              if (s.symbol === symbol) {
                return {
                  ...s,
                  basicInfo: {
                    companyName: basicInfo.companyName,
                    exchange: basicInfo.exchange,
                    matchPrice: basicInfo.matchPrice,
                    changedValue: basicInfo.changedValue,
                    changedRatio: basicInfo.changedRatio,
                    totalVolume: basicInfo.totalVolume,
                    marketCap: basicInfo.marketCap,
                    beta: basicInfo.beta,
                    eps: basicInfo.eps,
                    pe: basicInfo.pe,
                    pb: basicInfo.pb,
                    roe: basicInfo.roe,
                    roa: basicInfo.roa
                  }
                };
              }
              return s;
            })
          );
          this.applyFilters();
        }
      },
      error: (error) => {
        console.error(`Error loading basic info for ${symbol}:`, error);
      }
    });
  }

  /**
   * Update exchange counts
   */
  updateExchangeCounts() {
    const counts = new Map<ExchangeType, ExchangeCount>();

    this.exchanges.forEach(exchange => {
      const symbols = this.allSymbols().filter(s => s.exchange === exchange);
      const fetched = symbols.filter(s => s.isFetched).length;

      counts.set(exchange, {
        exchange,
        total: symbols.length,
        fetched
      });
    });

    this.exchangeCounts.set(counts);
  }

  /**
   * Get exchange count text
   */
  getExchangeCountText(exchange: ExchangeType): string {
    const count = this.exchangeCounts().get(exchange);
    if (!count) return this.exchangeNames[exchange];
    return `${this.exchangeNames[exchange]} (${count.fetched}/${count.total})`;
  }

  /**
   * Apply filters (exchange and search)
   */
  applyFilters() {
    let filtered = [...this.allSymbols()];

    // Filter by exchange
    if (this.selectedExchange() !== 'all') {
      filtered = filtered.filter(s => s.exchange === this.selectedExchange());
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      filtered = filtered.filter(s =>
        s.symbol.toLowerCase().includes(query) ||
        (s.name && s.name.toLowerCase().includes(query))
      );
    }

    // Sort by symbol
    filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));

    this.filteredSymbols.set(filtered);
  }

  /**
   * Update search query
   */
  onSearchChange(query: string) {
    this.searchQuery.set(query);
    this.applyFilters();
  }

  /**
   * Change selected exchange
   */
  onExchangeChange(exchange: ExchangeType | 'all') {
    this.selectedExchange.set(exchange);
    this.applyFilters();
  }

  /**
   * Fetch data for a single symbol
   */
  fetchSymbol(symbol: SymbolWithStatus) {
    if (this.fetchingSymbols().has(symbol.symbol)) {
      return; // Already fetching
    }

    this.fetchingSymbols.update(set => {
      const newSet = new Set(set);
      newSet.add(symbol.symbol);
      return newSet;
    });

    // Update UI to show fetching state
    this.allSymbols.update(symbols =>
      symbols.map(s =>
        s.symbol === symbol.symbol ? { ...s, isFetching: true } : s
      )
    );

    // Fetch both detail data and price history
    this.dnseService.getStockData(symbol.symbol).subscribe({
      next: (data) => {
        // Save detail data to Google Sheets
        this.saveToGoogleSheets(symbol.symbol, data);

        // Fetch price history (3 years = 1095 days)
        this.dnseService.getOHLCDataLastDays(symbol.symbol, 1095, '1D').subscribe({
          next: (ohlcData) => {
            // Save price data to Google Sheets
            this.savePriceDataToGoogleSheets(symbol.symbol, ohlcData);

            // Mark as fetched
            this.dnseService.markAsFetched(symbol.symbol);

            // Update UI
            this.allSymbols.update(symbols =>
              symbols.map(s =>
                s.symbol === symbol.symbol
                  ? { ...s, isFetched: true, isFetching: false }
                  : s
              )
            );
            this.applyFilters();
            this.updateFetchedCount();
            this.updateExchangeCounts();

            // Load basic info for this symbol
            this.loadBasicInfoForSymbol(symbol.symbol);

            // Remove from fetching set
            this.fetchingSymbols.update(set => {
              const newSet = new Set(set);
              newSet.delete(symbol.symbol);
              return newSet;
            });
          },
          error: (error) => {
            console.error(`Error fetching price data for ${symbol.symbol}:`, error);
            // Still mark as fetched even if price data fails
            this.dnseService.markAsFetched(symbol.symbol);
            this.allSymbols.update(symbols =>
              symbols.map(s =>
                s.symbol === symbol.symbol
                  ? { ...s, isFetched: true, isFetching: false }
                  : s
              )
            );
            this.applyFilters();
            this.updateFetchedCount();
            this.fetchingSymbols.update(set => {
              const newSet = new Set(set);
              newSet.delete(symbol.symbol);
              return newSet;
            });
          }
        });
      },
      error: (error) => {
        console.error(`Error fetching data for ${symbol.symbol}:`, error);

        // Update UI to remove fetching state
        this.allSymbols.update(symbols =>
          symbols.map(s =>
            s.symbol === symbol.symbol ? { ...s, isFetching: false } : s
          )
        );

        // Remove from fetching set
        this.fetchingSymbols.update(set => {
          const newSet = new Set(set);
          newSet.delete(symbol.symbol);
          return newSet;
        });
      }
    });
  }

  /**
   * Fetch multiple symbols
   */
  fetchSelectedSymbols(symbols: SymbolWithStatus[]) {
    symbols.forEach(symbol => {
      if (!symbol.isFetched && !this.fetchingSymbols().has(symbol.symbol)) {
        this.fetchSymbol(symbol);
      }
    });
  }

  /**
   * Fetch all unfetched symbols
   */
  fetchAllUnfetched() {
    const unfetched = this.filteredSymbols().filter(s => !s.isFetched);
    this.fetchSelectedSymbols(unfetched);
  }

  /**
   * Mark symbol as not fetched (reset)
   */
  markAsNotFetched(symbol: SymbolWithStatus) {
    this.dnseService.markAsNotFetched(symbol.symbol);

    this.allSymbols.update(symbols =>
      symbols.map(s =>
        s.symbol === symbol.symbol ? { ...s, isFetched: false } : s
      )
    );
    this.applyFilters();
    this.updateFetchedCount();
  }

  /**
   * Clear all fetched status
   */
  clearAllFetched() {
    if (confirm('Bạn có chắc muốn xóa tất cả trạng thái đã fetch?')) {
      this.dnseService.clearFetchedSymbols();
      this.allSymbols.update(symbols =>
        symbols.map(s => ({ ...s, isFetched: false }))
      );
      this.applyFilters();
      this.updateFetchedCount();
    }
  }

  /**
   * Update fetched count
   */
  updateFetchedCount() {
    const count = this.allSymbols().filter(s => s.isFetched).length;
    this.fetchedCount.set(count);
  }

  /**
   * Save data to Google Sheets via Apps Script
   */
  saveToGoogleSheets(symbol: string, data: DNSEStockData) {
    const scriptId = this.scriptId();
    if (!scriptId) {
      console.warn('Google Apps Script ID chưa được cấu hình');
      alert('Vui lòng cấu hình NG_APP_SECURITIES_SHEET_SCRIPT_ID trong biến môi trường để lưu dữ liệu vào Google Sheets');
      return;
    }

    // Use proxy in development, direct URL in production
    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptId}/exec`
      : `/api/securities-apps-script/${scriptId}/exec`;

    this.http.post(baseUrl, {
      action: 'saveStockData',
      sheetId: this.sheetId(),
      symbol: symbol,
      data: data
    }).subscribe({
      next: (response) => {
        console.log(`✅ Đã lưu dữ liệu ${symbol} vào Google Sheets`, response);
      },
      error: (error) => {
        console.error(`❌ Lỗi khi lưu ${symbol}:`, error);
        alert(`Lỗi khi lưu dữ liệu ${symbol}: ${error.message || 'Vui lòng kiểm tra lại cấu hình'}`);
      }
    });
  }

  /**
   * Save price data to Google Sheets via Apps Script
   */
  savePriceDataToGoogleSheets(symbol: string, ohlcData: DNSEOHLCData) {
    const scriptId = this.scriptId();
    if (!scriptId) {
      console.warn('Google Apps Script ID chưa được cấu hình');
      return;
    }

    // Use proxy in development, direct URL in production
    const baseUrl = environment.production
      ? `https://script.google.com/macros/s/${scriptId}/exec`
      : `/api/securities-apps-script/${scriptId}/exec`;

    this.http.post(baseUrl, {
      action: 'savePriceData',
      sheetId: this.sheetId(),
      symbol: symbol,
      ohlcData: ohlcData
    }).subscribe({
      next: (response) => {
        console.log(`✅ Đã lưu dữ liệu giá ${symbol} vào Google Sheets`, response);
      },
      error: (error) => {
        console.error(`❌ Lỗi khi lưu giá ${symbol}:`, error);
      }
    });
  }

  /**
   * Get status badge class
   */
  getStatusClass(symbol: SymbolWithStatus): string {
    if (symbol.isFetching) return 'status-fetching';
    if (symbol.isFetched) return 'status-fetched';
    return 'status-not-fetched';
  }

  /**
   * Get status text
   */
  getStatusText(symbol: SymbolWithStatus): string {
    if (symbol.isFetching) return 'Đang tải...';
    if (symbol.isFetched) return 'Đã fetch';
    return 'Chưa fetch';
  }

  /**
   * View stock detail
   */
  viewStockDetail(symbol: SymbolWithStatus) {
    this.selectedSymbol.set(symbol);
    this.showDetailView.set(true);
    this.isLoadingDetail.set(true);
    this.isLoadingPrice.set(true);
    this.selectedSymbolData.set(null);
    this.selectedSymbolPriceData.set(null);

    // Load basic info ONLY from Google Sheets (no DNSE API fallback)
    if (this.scriptId()) {
      this.dnseService.getStockBasicInfoFromSheets(this.sheetId(), symbol.symbol, this.scriptId()).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Convert basic info to DNSEStockData format for display
            const basicInfo = response.data;
            this.selectedSymbolData.set({
              pageProps: {
                symbol: symbol.symbol,
                companyInfo: {
                  name: basicInfo.companyName,
                  fullName: basicInfo.companyName,
                  exchange: basicInfo.exchange
                },
                priceSnapshot: {
                  matchPrice: basicInfo.matchPrice,
                  changedValue: basicInfo.changedValue,
                  changedRatio: basicInfo.changedRatio,
                  totalVolumeTraded: basicInfo.totalVolume
                }
              }
            } as DNSEStockData);
          }
          this.isLoadingDetail.set(false);
        },
        error: (error) => {
          console.error(`Error loading basic info for ${symbol.symbol}:`, error);
          this.isLoadingDetail.set(false);
          // Don't show alert, just show empty data
        }
      });
    } else {
      this.isLoadingDetail.set(false);
    }

    // Load price data (3 years default)
    this.loadPriceData(symbol.symbol, 3);
  }

  /**
   * Load price data for detail view
   * Check if {SYMBOL}_Price tab exists first
   * If exists, load from Google Sheets
   * If not, fetch from DNSE API and save to Google Sheets
   */
  loadPriceData(symbol: string, years: number) {
    this.isLoadingPrice.set(true);

    // Check if price sheet exists
    if (this.scriptId()) {
      this.dnseService.checkPriceSheetExists(this.sheetId(), symbol, this.scriptId()).subscribe({
        next: (priceSheetExists) => {
          if (priceSheetExists) {
            // Load from Google Sheets
            this.dnseService.getPriceDataFromSheets(this.sheetId(), symbol, this.scriptId()).subscribe({
              next: (response) => {
                if (response.success && response.data && response.data.length > 0) {
                  // Convert sheet data back to OHLC format
                  const ohlcData = this.convertSheetDataToOHLC(response.data);
                  this.selectedSymbolPriceData.set(ohlcData);
                  this.isLoadingPrice.set(false);
                  // Initialize chart after data is loaded
                  setTimeout(() => this.initCandlestickChart(), 100);
                } else {
                  // Sheet exists but no data, fetch from API and save
                  this.fetchPriceDataFromAPIAndSave(symbol, years);
                }
              },
              error: (error) => {
                console.error(`Error loading price data from sheets for ${symbol}:`, error);
                // Fallback to API and save
                this.fetchPriceDataFromAPIAndSave(symbol, years);
              }
            });
          } else {
            // Price sheet doesn't exist, fetch from API and save
            this.fetchPriceDataFromAPIAndSave(symbol, years);
          }
        },
        error: (error) => {
          console.error(`Error checking price sheet for ${symbol}:`, error);
          // Fallback to API and save
          this.fetchPriceDataFromAPIAndSave(symbol, years);
        }
      });
    } else {
      // No script ID, fetch directly from API (but can't save)
      this.fetchPriceDataFromAPI(symbol, years);
    }
  }

  /**
   * Fetch price data from API and save to Google Sheets
   */
  fetchPriceDataFromAPIAndSave(symbol: string, years: number) {
    const days = years * 365;

    this.dnseService.getOHLCDataLastDays(symbol, days, '1D').subscribe({
      next: (data) => {
        // Save to Google Sheets for caching
        if (this.scriptId()) {
          this.savePriceDataToGoogleSheets(symbol, data);
        }
        
        this.selectedSymbolPriceData.set(data);
        this.isLoadingPrice.set(false);
        // Initialize chart after data is loaded
        setTimeout(() => this.initCandlestickChart(), 100);
      },
      error: (error) => {
        console.error(`Error loading price data for ${symbol}:`, error);
        this.isLoadingPrice.set(false);
        alert(`Không thể tải dữ liệu giá cho ${symbol}`);
      }
    });
  }

  /**
   * Fetch price data from API (without saving - used when no script ID)
   */
  fetchPriceDataFromAPI(symbol: string, years: number) {
    const days = years * 365;

    this.dnseService.getOHLCDataLastDays(symbol, days, '1D').subscribe({
      next: (data) => {
        this.selectedSymbolPriceData.set(data);
        this.isLoadingPrice.set(false);
        // Initialize chart after data is loaded
        setTimeout(() => this.initCandlestickChart(), 100);
      },
      error: (error) => {
        console.error(`Error loading price data for ${symbol}:`, error);
        this.isLoadingPrice.set(false);
        alert(`Không thể tải dữ liệu giá cho ${symbol}`);
      }
    });
  }

  /**
   * Convert sheet data format to OHLC format
   * Supports both dd/mm/yyyy and ISO date string formats
   */
  convertSheetDataToOHLC(sheetData: Array<{time: string | Date, open: string | number, lowest: string | number, highest: string | number, close?: string | number, volume?: string | number}>): DNSEOHLCData {
    const t: number[] = [];
    const o: number[] = [];
    const h: number[] = [];
    const l: number[] = [];
    const c: number[] = [];
    const v: number[] = [];

    sheetData.forEach(row => {
      // Parse date - support both dd/mm/yyyy and ISO string formats
      let date: Date | null = null;
      
      if (row.time instanceof Date) {
        date = row.time;
      } else if (typeof row.time === 'string') {
        // Try ISO format first (e.g., "2022-12-06T17:00:00.000Z")
        if (row.time.includes('T') || row.time.includes('-')) {
          date = new Date(row.time);
        } else {
          // Try dd/mm/yyyy format
          const dateParts = row.time.split('/');
          if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
            const year = parseInt(dateParts[2], 10);
            date = new Date(year, month, day);
          }
        }
      }

      if (date && !isNaN(date.getTime())) {
        t.push(Math.floor(date.getTime() / 1000)); // Convert to Unix timestamp (seconds)
      } else {
        console.warn('Invalid date format:', row.time);
        return; // Skip this row if date is invalid
      }

      // Parse numbers - support both string and number formats
      const parseNumber = (value: string | number | undefined | null): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        
        const str = value.toString();
        // Remove dots (thousand separators) and replace comma with dot (decimal separator)
        const cleaned = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
      };

      const open = parseNumber(row.open);
      const high = parseNumber(row.highest);
      const low = parseNumber(row.lowest);
      const close = parseNumber(row.close);
      const volume = parseNumber(row.volume);

      o.push(open);
      h.push(high);
      l.push(low);
      // Close price - use provided close, fallback to high, then open
      c.push(close || high || open);
      // Volume - default to 0 if not provided
      v.push(volume);
    });

    return { t, o, h, l, c, v };
  }

  /**
   * Fetch price data only (from detail view)
   */
  fetchPriceDataOnly(years: number) {
    const symbol = this.selectedSymbol();
    if (!symbol) return;

    this.isLoadingPrice.set(true);
    const days = years * 365;

    this.dnseService.getOHLCDataLastDays(symbol.symbol, days, '1D').subscribe({
      next: (data) => {
        // Save to Google Sheets
        this.savePriceDataToGoogleSheets(symbol.symbol, data);

        // Update UI
        this.selectedSymbolPriceData.set(data);
        this.isLoadingPrice.set(false);
        this.selectedYears.set(years);
        // Update chart
        setTimeout(() => this.initCandlestickChart(), 100);
      },
      error: (error) => {
        console.error(`Error fetching price data for ${symbol.symbol}:`, error);
        this.isLoadingPrice.set(false);
        alert(`Không thể fetch dữ liệu giá cho ${symbol.symbol}`);
      }
    });
  }

  /**
   * Close detail view
   */
  closeDetailView() {
    this.showDetailView.set(false);
    this.selectedSymbol.set(null);
    this.selectedSymbolData.set(null);
    this.selectedSymbolPriceData.set(null);
    this.isLoadingDetail.set(false);
    this.isLoadingPrice.set(false);
    this.selectedYears.set(3);
  }

  /**
   * Get total volume from price data
   */
  getTotalVolume(priceData: DNSEOHLCData): number {
    if (!priceData.v || priceData.v.length === 0) return 0;
    return priceData.v.reduce((sum, vol) => sum + vol, 0);
  }


  /**
   * Format date to Vietnamese format dd/mm/yyyy
   */
  formatDateVN(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Get latest close price
   */
  getLatestClosePrice(): number {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || priceData.c.length === 0) return 0;
    return priceData.c[priceData.c.length - 1];
  }

  /**
   * Get total volume for display
   */
  getTotalVolumeDisplay(): number {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData) return 0;
    return this.getTotalVolume(priceData);
  }

  /**
   * Parse float from string
   */
  parseFloat(value: string | number | undefined | null): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Initialize candlestick chart
   */
  initCandlestickChart() {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.t || priceData.t.length === 0) {
      return;
    }

    if (!this.candlestickChartRef?.nativeElement) {
      return;
    }

    // Destroy existing chart if any
    if (this.candlestickChart) {
      this.candlestickChart.destroy();
    }

    // Prepare data for candlestick chart
    // Note: Prices are in thousands (1000đ), so multiply by 1000
    const chartData = priceData.t.map((timestamp, index) => ({
      x: timestamp * 1000, // Convert to milliseconds for Date
      o: (priceData.o[index] || 0) * 1000, // Open price * 1000
      h: (priceData.h[index] || 0) * 1000, // High price * 1000
      l: (priceData.l[index] || 0) * 1000, // Low price * 1000
      c: (priceData.c[index] || 0) * 1000  // Close price * 1000
    }));

    const config: ChartConfiguration<'candlestick'> = {
      type: 'candlestick',
      data: {
        datasets: [{
          label: this.selectedSymbol()?.symbol || 'Giá cổ phiếu',
          data: chartData as any,
          color: {
            up: '#4caf50',    // Green for up candles
            down: '#f44336',  // Red for down candles
            unchanged: '#999' // Gray for unchanged
          }
        } as any]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context: any) => {
                const data = context.raw;
                return [
                  `Mở cửa: ${this.formatNumberVN(data.o)}`,
                  `Cao nhất: ${this.formatNumberVN(data.h)}`,
                  `Thấp nhất: ${this.formatNumberVN(data.l)}`,
                  `Đóng cửa: ${this.formatNumberVN(data.c)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'dd/MM/yyyy'
              }
            },
            title: {
              display: true,
              text: 'Ngày'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Giá (đồng)'
            },
            ticks: {
              callback: (value: any) => {
                return this.formatNumberVN(value);
              }
            }
          }
        }
      }
    };

    this.candlestickChart = new Chart(this.candlestickChartRef.nativeElement, config);
  }

  /**
   * Format number in Vietnamese format (with thousand separators)
   */
  formatNumberVN(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return value.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }
}

