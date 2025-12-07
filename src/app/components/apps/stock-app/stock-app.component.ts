import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DnseService, DNSESymbol, DNSEStockData, DNSEOHLCData, ExchangeType } from '../../../services/dnse.service';
import { Chart, ChartConfiguration, registerables, TimeScale } from 'chart.js';
// @ts-ignore - chartjs-chart-financial doesn't have proper type declarations
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

// Register Chart.js and financial chart components
Chart.register(...registerables, TimeScale);
Chart.register(CandlestickController, CandlestickElement);
Chart.register(zoomPlugin);

interface SymbolWithStatus extends DNSESymbol {
  exchange: ExchangeType;
  isFetched: boolean;
  isFetching?: boolean;
  hasBasicInfo?: boolean; // Track if has full basic info data
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
    fullData?: any; // Store full data for checking
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
  filterMode = signal<'all' | 'unfetched' | 'missingBasicInfo'>('all');
  allSymbols = signal<SymbolWithStatus[]>([]);
  filteredSymbols = signal<SymbolWithStatus[]>([]);
  isLoading = signal(false);
  searchQuery = signal('');
  isLoadingBasicInfoCheck = signal(false);

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

  // Selected symbol for detail view
  selectedSymbol = signal<SymbolWithStatus | null>(null);
  selectedSymbolData = signal<DNSEStockData | null>(null);
  selectedSymbolPriceData = signal<DNSEOHLCData | null>(null);
  showDetailView = signal(false);
  isLoadingDetail = signal(false);
  isLoadingPrice = signal(false);
  selectedYears = signal<number>(3); // Default 3 years

  // Computed: price table data with reference price, ceiling, floor
  priceTableData = computed(() => {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.t) return [];

    const result: Array<{
      date: string, 
      open: number, 
      high: number, 
      low: number, 
      close: number, 
      volume: number,
      referencePrice: number,
      ceilingPrice: number,
      floorPrice: number
    }> = [];

    for (let i = 0; i < priceData.t.length; i++) {
      const timestamp = priceData.t[i];
      const date = new Date(timestamp * 1000);
      const dateStr = this.formatDateVN(date);

      // Reference price = previous day's close price
      const referencePrice = i > 0 ? (priceData.c[i - 1] || 0) : (priceData.c[i] || 0);
      
      // Calculate ceiling and floor (typically ±7% for HOSE/HNX, ±10% for UPCOM)
      // Using 7% as default
      const ceilingPrice = referencePrice * 1.07;
      const floorPrice = referencePrice * 0.93;

      result.push({
        date: dateStr,
        open: priceData.o[i] || 0,
        high: priceData.h[i] || 0,
        low: priceData.l[i] || 0,
        close: priceData.c[i] || 0,
        volume: priceData.v[i] || 0,
        referencePrice,
        ceilingPrice,
        floorPrice
      });
    }

    // Show latest 20 records (most recent first)
    return result.slice(-20).reverse();
  });

  // Computed: company info from selected symbol data
  companyInfo = computed(() => {
    const data = this.selectedSymbolData();
    if (!data) return null;
    return this.extractCompanyInfo(data);
  });

  // Computed: price snapshot from selected symbol data
  priceSnapshot = computed(() => {
    const data = this.selectedSymbolData();
    if (!data) return null;
    return this.extractPriceSnapshot(data);
  });

  // Computed: pageProps from selected symbol data
  pageProps = computed(() => {
    const data = this.selectedSymbolData();
    if (!data) return null;
    return this.extractPageProps(data);
  });

  constructor(
    private dnseService: DnseService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadSymbols();
    this.checkFetchedStatus();
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
        this.checkFetchedStatus();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading symbols:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Check fetched status from Stock API and load basic info
   */
  checkFetchedStatus() {
    this.dnseService.getAllFetchedSymbols().subscribe({
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
   * Load basic info for fetched symbols from Stock API
   */
  loadBasicInfoForFetchedSymbols(fetchedSymbols: string[]) {
    if (fetchedSymbols.length === 0) return;

    // Load stock data for each symbol
    let completed = 0;
    const total = fetchedSymbols.length;
    const basicInfoMap = new Map<string, any>();

    fetchedSymbols.forEach(symbol => {
      this.dnseService.getStockDataFromAPI(symbol).subscribe({
        next: (data) => {
          if (data) {
            basicInfoMap.set(symbol, data);
          }
          
          completed++;
          if (completed === total) {
            // Update all symbols with basic info
            this.allSymbols.update(symbols =>
              symbols.map(s => {
                const stockData = basicInfoMap.get(s.symbol);
                if (stockData) {
                  const fullData = stockData.fullData || {};
                  const hasFullName = fullData['pageProps.companyInfo.fullName'] || fullData['pageProps.companyInfo.name'];
                  const hasFullNameEn = fullData['pageProps.companyInfo.fullNameEn'];
                  const hasImage = fullData['pageProps.companyInfo.image'];
                  const hasIntroduction = fullData['pageProps.companyInfo.introduction'];
                  const hasNotes = fullData['pageProps.companyInfo.notes'];
                  const hasPermanentAddress = fullData['pageProps.companyInfo.permanentAddress'];
                  
                  const hasBasicInfo = !!(hasFullName || hasFullNameEn || hasImage || hasIntroduction || hasNotes || hasPermanentAddress);
                  
                  // Extract basic info from stockData
                  const basicInfo = stockData.basicInfo || {};
                  
                  return {
                    ...s,
                    hasBasicInfo,
                    basicInfo: {
                      companyName: basicInfo.companyName || fullData['pageProps.companyInfo.fullName'] || fullData['pageProps.companyInfo.name'],
                      exchange: basicInfo.exchange || fullData['pageProps.companyInfo.exchange'],
                      matchPrice: basicInfo.matchPrice || fullData['pageProps.priceSnapshot.matchPrice'],
                      changedValue: basicInfo.changedValue || fullData['pageProps.priceSnapshot.changedValue'],
                      changedRatio: basicInfo.changedRatio || fullData['pageProps.priceSnapshot.changedRatio'],
                      totalVolume: basicInfo.totalVolume || fullData['pageProps.priceSnapshot.totalVolumeTraded'],
                      marketCap: basicInfo.marketCap,
                      beta: basicInfo.beta,
                      eps: basicInfo.eps,
                      pe: basicInfo.pe,
                      pb: basicInfo.pb,
                      roe: basicInfo.roe,
                      roa: basicInfo.roa,
                      fullData: fullData
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
          completed++;
          if (completed === total) {
            this.applyFilters();
          }
        }
      });
    });
  }

  /**
   * Load basic info for a single symbol from Stock API
   */
  loadBasicInfoForSymbol(symbol: string) {
    this.dnseService.getStockDataFromAPI(symbol).subscribe({
      next: (data) => {
        if (data) {
          const fullData = data.fullData || {};
          const basicInfo = data.basicInfo || {};
          
          this.allSymbols.update(symbols =>
            symbols.map(s => {
              if (s.symbol === symbol.toUpperCase()) {
                return {
                  ...s,
                  basicInfo: {
                    companyName: basicInfo.companyName || fullData['pageProps.companyInfo.fullName'] || fullData['pageProps.companyInfo.name'],
                    exchange: basicInfo.exchange || fullData['pageProps.companyInfo.exchange'],
                    matchPrice: basicInfo.matchPrice || fullData['pageProps.priceSnapshot.matchPrice'],
                    changedValue: basicInfo.changedValue || fullData['pageProps.priceSnapshot.changedValue'],
                    changedRatio: basicInfo.changedRatio || fullData['pageProps.priceSnapshot.changedRatio'],
                    totalVolume: basicInfo.totalVolume || fullData['pageProps.priceSnapshot.totalVolumeTraded'],
                    marketCap: basicInfo.marketCap,
                    beta: basicInfo.beta,
                    eps: basicInfo.eps,
                    pe: basicInfo.pe,
                    pb: basicInfo.pb,
                    roe: basicInfo.roe,
                    roa: basicInfo.roa,
                    fullData: fullData
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
   * Check if a symbol has basic info data
   * Checks for: fullName, fullNameEn, image, introduction, notes, permanentAddress
   */
  hasBasicInfoData(symbol: SymbolWithStatus): boolean {
    if (!symbol.isFetched) return false;
    
    // If already checked, return cached value
    if (symbol.hasBasicInfo !== undefined) {
      return symbol.hasBasicInfo;
    }

    // Check if we have fullData in basicInfo
    if (symbol.basicInfo?.fullData) {
      const fullData = symbol.basicInfo.fullData;
      const hasFullName = fullData['pageProps.companyInfo.fullName'] || fullData['pageProps.companyInfo.name'];
      const hasFullNameEn = fullData['pageProps.companyInfo.fullNameEn'];
      const hasImage = fullData['pageProps.companyInfo.image'];
      const hasIntroduction = fullData['pageProps.companyInfo.introduction'];
      const hasNotes = fullData['pageProps.companyInfo.notes'];
      const hasPermanentAddress = fullData['pageProps.companyInfo.permanentAddress'];
      
      // Consider has basic info if at least fullName exists
      return !!(hasFullName || hasFullNameEn || hasImage || hasIntroduction || hasNotes || hasPermanentAddress);
    }

    return false;
  }

  /**
   * Load and check basic info for all fetched symbols from Stock API
   */
  checkBasicInfoForAllSymbols() {
    this.isLoadingBasicInfoCheck.set(true);
    const fetchedSymbols = this.allSymbols().filter(s => s.isFetched && s.hasBasicInfo === undefined);

    if (fetchedSymbols.length === 0) {
      this.isLoadingBasicInfoCheck.set(false);
      this.applyFilters();
      return;
    }

    // Load full data for each symbol to check basic info
    let completed = 0;
    const total = fetchedSymbols.length;
    const basicInfoMap = new Map<string, any>();

    fetchedSymbols.forEach(symbol => {
      this.dnseService.getStockDataFromAPI(symbol.symbol).subscribe({
        next: (data) => {
          if (data && data.fullData) {
            basicInfoMap.set(symbol.symbol, data.fullData);
          }
          
          completed++;
          if (completed === total) {
            // Update all symbols with basic info check
            this.allSymbols.update(symbols =>
              symbols.map(s => {
                if (s.isFetched && s.hasBasicInfo === undefined) {
                  const fullData = basicInfoMap.get(s.symbol);
                  if (fullData) {
                    const hasFullName = fullData['pageProps.companyInfo.fullName'] || fullData['pageProps.companyInfo.name'];
                    const hasFullNameEn = fullData['pageProps.companyInfo.fullNameEn'];
                    const hasImage = fullData['pageProps.companyInfo.image'];
                    const hasIntroduction = fullData['pageProps.companyInfo.introduction'];
                    const hasNotes = fullData['pageProps.companyInfo.notes'];
                    const hasPermanentAddress = fullData['pageProps.companyInfo.permanentAddress'];
                    
                    const hasBasicInfo = !!(hasFullName || hasFullNameEn || hasImage || hasIntroduction || hasNotes || hasPermanentAddress);
                    
                    return {
                      ...s,
                      hasBasicInfo,
                      basicInfo: {
                        ...s.basicInfo,
                        fullData: fullData
                      }
                    };
                  } else {
                    return {
                      ...s,
                      hasBasicInfo: false
                    };
                  }
                }
                return s;
              })
            );
            this.isLoadingBasicInfoCheck.set(false);
            this.applyFilters();
          }
        },
        error: (error) => {
          console.error(`Error checking basic info for ${symbol.symbol}:`, error);
          completed++;
          if (completed === total) {
            // Mark as no basic info if error
            this.allSymbols.update(symbols =>
              symbols.map(s => {
                if (s.isFetched && s.hasBasicInfo === undefined && !basicInfoMap.has(s.symbol)) {
                  return {
                    ...s,
                    hasBasicInfo: false
                  };
                }
                return s;
              })
            );
            this.isLoadingBasicInfoCheck.set(false);
            this.applyFilters();
          }
        }
      });
    });
  }

  /**
   * Apply filters (exchange, search, and filter mode)
   */
  applyFilters() {
    let filtered = [...this.allSymbols()];

    // Filter by exchange
    if (this.selectedExchange() !== 'all') {
      filtered = filtered.filter(s => s.exchange === this.selectedExchange());
    }

    // Filter by filter mode
    const filterMode = this.filterMode();
    if (filterMode === 'unfetched') {
      filtered = filtered.filter(s => !s.isFetched);
    } else if (filterMode === 'missingBasicInfo') {
      // Check basic info for symbols that haven't been checked yet
      filtered = filtered.filter(s => {
        if (!s.isFetched) return false;
        return !this.hasBasicInfoData(s);
      });
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
   * Change filter mode
   */
  onFilterModeChange(mode: 'all' | 'unfetched' | 'missingBasicInfo') {
    this.filterMode.set(mode);
    if (mode === 'missingBasicInfo') {
      // Check basic info when switching to this filter
      this.checkBasicInfoForAllSymbols();
    } else {
      this.applyFilters();
    }
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
        // Fetch price history (3 years = 1095 days)
        this.dnseService.getOHLCDataLastDays(symbol.symbol, 1095, '1D').subscribe({
          next: (ohlcData) => {
            // Extract basic info from data
            const basicInfo = this.extractBasicInfoFromStockData(data);
            
            // Save to Stock API
            this.dnseService.saveStockData(
              symbol.symbol,
              basicInfo,
              ohlcData,
              data.fullData || data
            ).subscribe({
              next: (response) => {
                console.log(`✅ Đã lưu dữ liệu ${symbol.symbol} vào Stock API`, response);
                
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
              error: (saveError) => {
                console.error(`Error saving ${symbol.symbol} to API:`, saveError);
                // Still mark as fetched even if save fails
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
   * Extract basic info from stock data
   */
  private extractBasicInfoFromStockData(data: DNSEStockData): any {
    const companyInfo = this.extractCompanyInfo(data);
    const priceSnapshot = this.extractPriceSnapshot(data);
    const pageProps = this.extractPageProps(data);
    
    return {
      companyName: companyInfo?.fullName || companyInfo?.name,
      exchange: companyInfo?.exchange,
      matchPrice: priceSnapshot?.matchPrice,
      changedValue: priceSnapshot?.changedValue,
      changedRatio: priceSnapshot?.changedRatio,
      totalVolume: priceSnapshot?.totalVolumeTraded,
      marketCap: companyInfo?.capital,
      beta: companyInfo?.beta,
      eps: pageProps?.financialIndicators?.indexes?.eps?.value,
      pe: pageProps?.financialIndicators?.indexes?.pe?.value,
      pb: pageProps?.financialIndicators?.indexes?.pb?.value,
      roe: pageProps?.financialIndicators?.indexes?.roe?.value,
      roa: pageProps?.financialIndicators?.indexes?.roa?.value
    };
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

    // Load basic info from Stock API
    this.dnseService.getStockDataFromAPI(symbol.symbol).subscribe({
      next: (data) => {
        if (data) {
          // Convert to DNSEStockData format for display
          const fullData = data.fullData || {};
          const basicInfo = data.basicInfo || {};
          
          this.selectedSymbolData.set({
            pageProps: {
              symbol: symbol.symbol,
              companyInfo: {
                name: basicInfo.companyName || fullData['pageProps.companyInfo.name'],
                fullName: basicInfo.companyName || fullData['pageProps.companyInfo.fullName'],
                exchange: basicInfo.exchange || fullData['pageProps.companyInfo.exchange']
              },
              priceSnapshot: {
                matchPrice: basicInfo.matchPrice || fullData['pageProps.priceSnapshot.matchPrice'],
                changedValue: basicInfo.changedValue || fullData['pageProps.priceSnapshot.changedValue'],
                changedRatio: basicInfo.changedRatio || fullData['pageProps.priceSnapshot.changedRatio'],
                totalVolumeTraded: basicInfo.totalVolume || fullData['pageProps.priceSnapshot.totalVolumeTraded']
              }
            },
            fullData: fullData
          } as DNSEStockData);
          
          // Set price data if available
          if (data.priceData) {
            this.selectedSymbolPriceData.set(data.priceData);
            setTimeout(() => this.initCandlestickChart(), 100);
          }
        }
        this.isLoadingDetail.set(false);
      },
      error: (error) => {
        console.error(`Error loading stock data for ${symbol.symbol}:`, error);
        this.isLoadingDetail.set(false);
        // Don't show alert, just show empty data
      }
    });

    // Load price data (3 years default)
    this.loadPriceData(symbol.symbol, 3);
  }

  /**
   * Load price data for detail view from Stock API
   * If not found in API, fetch from DNSE API and save to Stock API
   */
  loadPriceData(symbol: string, years: number) {
    this.isLoadingPrice.set(true);

    // Try to load from Stock API first
    this.dnseService.getStockDataFromAPI(symbol).subscribe({
      next: (data) => {
        if (data && data.priceData && data.priceData.t && data.priceData.t.length > 0) {
          // Use price data from API
          this.selectedSymbolPriceData.set(data.priceData);
          this.isLoadingPrice.set(false);
          setTimeout(() => this.initCandlestickChart(), 100);
        } else {
          // No price data in API, fetch from DNSE and save
          this.fetchPriceDataFromAPIAndSave(symbol, years);
        }
      },
      error: (error) => {
        console.error(`Error loading price data from API for ${symbol}:`, error);
        // Fallback to fetch from DNSE API
        this.fetchPriceDataFromAPIAndSave(symbol, years);
      }
    });
  }

  /**
   * Fetch price data from DNSE API and save to Stock API
   */
  fetchPriceDataFromAPIAndSave(symbol: string, years: number) {
    const days = years * 365;

    this.dnseService.getOHLCDataLastDays(symbol, days, '1D').subscribe({
      next: (ohlcData) => {
        // Load existing stock data to update
        this.dnseService.getStockDataFromAPI(symbol).subscribe({
          next: (existingData) => {
            const basicInfo = existingData?.basicInfo || this.extractBasicInfoFromStockData({} as DNSEStockData);
            const fullData = existingData?.fullData || {};
            
            // Save updated data with new price data
            this.dnseService.saveStockData(symbol, basicInfo, ohlcData, fullData).subscribe({
              next: () => {
                console.log(`✅ Đã cập nhật price data cho ${symbol}`);
              },
              error: (saveError) => {
                console.error(`Error saving price data for ${symbol}:`, saveError);
              }
            });
          },
          error: () => {
            // No existing data, just save price data with empty basic info
            this.dnseService.saveStockData(symbol, {}, ohlcData, {}).subscribe({
              next: () => {
                console.log(`✅ Đã lưu price data cho ${symbol}`);
              },
              error: (saveError) => {
                console.error(`Error saving price data for ${symbol}:`, saveError);
              }
            });
          }
        });

        this.selectedSymbolPriceData.set(ohlcData);
        this.isLoadingPrice.set(false);
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
   * Fetch price data only (from detail view) and save to Stock API
   */
  fetchPriceDataOnly(years: number) {
    const symbol = this.selectedSymbol();
    if (!symbol) return;

    this.isLoadingPrice.set(true);
    const days = years * 365;

    this.dnseService.getOHLCDataLastDays(symbol.symbol, days, '1D').subscribe({
      next: (ohlcData) => {
        // Load existing stock data to update
        this.dnseService.getStockDataFromAPI(symbol.symbol).subscribe({
          next: (existingData) => {
            const basicInfo = existingData?.basicInfo || this.extractBasicInfoFromStockData({} as DNSEStockData);
            const fullData = existingData?.fullData || {};
            
            // Save updated data with new price data
            this.dnseService.saveStockData(symbol.symbol, basicInfo, ohlcData, fullData).subscribe({
              next: () => {
                console.log(`✅ Đã cập nhật price data cho ${symbol.symbol}`);
              },
              error: (saveError) => {
                console.error(`Error saving price data for ${symbol.symbol}:`, saveError);
              }
            });
          },
          error: () => {
            // No existing data, just save price data with empty basic info
            this.dnseService.saveStockData(symbol.symbol, {}, ohlcData, {}).subscribe({
              next: () => {
                console.log(`✅ Đã lưu price data cho ${symbol.symbol}`);
              },
              error: (saveError) => {
                console.error(`Error saving price data for ${symbol.symbol}:`, saveError);
              }
            });
          }
        });

        // Update UI
        this.selectedSymbolPriceData.set(ohlcData);
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
   * Get price color class based on reference price, ceiling, floor
   */
  getPriceColorClass(price: number, referencePrice: number, ceilingPrice: number, floorPrice: number): string {
    const tolerance = 0.01; // Small tolerance for floating point comparison
    
    // Check if price equals reference price (within tolerance)
    if (Math.abs(price - referencePrice) < tolerance) {
      return 'price-reference'; // Yellow
    }
    
    // Check if price equals ceiling price
    if (Math.abs(price - ceilingPrice) < tolerance) {
      return 'price-ceiling'; // Purple
    }
    
    // Check if price equals floor price
    if (Math.abs(price - floorPrice) < tolerance) {
      return 'price-floor'; // Cyan
    }
    
    // Compare with reference price
    if (price > referencePrice) {
      return 'price-up'; // Green
    } else {
      return 'price-down'; // Red
    }
  }

  /**
   * Calculate Moving Average
   */
  calculateMA(prices: number[], period: number): number[] {
    const ma: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(sum / period);
      }
    }
    return ma;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  calculateRSI(prices: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    const changes: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Calculate initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < period && i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }
    
    avgGain /= period;
    avgLoss /= period;

    // First RSI values
    for (let i = 0; i <= period; i++) {
      rsi.push(NaN);
    }

    // Calculate RSI for remaining periods
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      // Use Wilder's smoothing method
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  /**
   * Calculate MACD
   */
  calculateMACD(prices: number[]): { macd: number[], signal: number[], histogram: number[] } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macd: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (isNaN(ema12[i]) || isNaN(ema26[i])) {
        macd.push(NaN);
      } else {
        macd.push(ema12[i] - ema26[i]);
      }
    }
    
    const signal = this.calculateEMA(macd.filter(v => !isNaN(v)), 9);
    const histogram: number[] = [];
    
    for (let i = 0; i < macd.length; i++) {
      if (isNaN(macd[i]) || isNaN(signal[i])) {
        histogram.push(NaN);
      } else {
        histogram.push(macd[i] - signal[i]);
      }
    }
    
    return { macd, signal, histogram };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < period && i < prices.length; i++) {
      sum += prices[i];
      if (i < period - 1) {
        ema.push(NaN);
      }
    }
    
    if (prices.length >= period) {
      ema.push(sum / period);
      
      // Calculate subsequent EMA values
      for (let i = period; i < prices.length; i++) {
        ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
      }
    }
    
    return ema;
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
    const closePrices = priceData.c.map(p => p * 1000);
    const ma20 = this.calculateMA(closePrices, 20);
    const ma50 = this.calculateMA(closePrices, 50);
    const rsi = this.calculateRSI(closePrices, 14);
    const macdData = this.calculateMACD(closePrices);

    const chartData = priceData.t.map((timestamp, index) => ({
      x: timestamp * 1000, // Convert to milliseconds for Date
      o: (priceData.o[index] || 0) * 1000, // Open price * 1000
      h: (priceData.h[index] || 0) * 1000, // High price * 1000
      l: (priceData.l[index] || 0) * 1000, // Low price * 1000
      c: (priceData.c[index] || 0) * 1000  // Close price * 1000
    }));

    const ma20Data = priceData.t.map((timestamp, index) => ({
      x: timestamp * 1000,
      y: isNaN(ma20[index]) ? null : ma20[index]
    })).filter(d => d.y !== null);

    const ma50Data = priceData.t.map((timestamp, index) => ({
      x: timestamp * 1000,
      y: isNaN(ma50[index]) ? null : ma50[index]
    })).filter(d => d.y !== null);

    const config: ChartConfiguration<any, any, any> = {
      type: 'candlestick' as any,
      data: {
        datasets: [
          {
            label: this.selectedSymbol()?.symbol || 'Giá cổ phiếu',
            data: chartData as any,
            color: {
              up: '#2e7d32',    // Dark green for up candles
              down: '#d32f2f',  // Red for down candles
              unchanged: '#757575' // Gray for unchanged
            },
            borderWidth: {
              up: 1,
              down: 1
            },
            borderColor: {
              up: '#1b5e20',    // Darker green border
              down: '#b71c1c'   // Darker red border
            },
            // Adjust candlestick width - set a fixed width in pixels
            // For time scale, we calculate based on time unit
            // Using barThickness to set approximate width
            barThickness: 'flex' as any,
            maxBarThickness: 6,
            minBarLength: 0,
            // Ensure wick (đuôi nến) is visible and styled
            wick: {
              up: {
                color: '#1b5e20',
                lineWidth: 1
              },
              down: {
                color: '#b71c1c',
                lineWidth: 1
              }
            }
          } as any,
          {
            type: 'line',
            label: 'MA20',
            data: ma20Data,
            borderColor: '#ff9800',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'MA50',
            data: ma50Data,
            borderColor: '#2196f3',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            yAxisID: 'y'
          }
        ]
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
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
                speed: 0.1
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
              limits: {
                x: {
                  min: 'original',
                  max: 'original'
                }
              }
            },
            pan: {
              enabled: true,
              mode: 'x',
              limits: {
                x: {
                  min: 'original',
                  max: 'original'
                }
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
            },
            // For time scale, we need to adjust the bar width differently
            // The width is controlled by the dataset options
            offset: false
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
        },
        // Interaction settings for better zoom/pan
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    };

    this.candlestickChart = new Chart(this.candlestickChartRef.nativeElement, config as any);
  }

  /**
   * Reset zoom to original view
   */
  resetZoom() {
    if (this.candlestickChart) {
      this.candlestickChart.resetZoom();
    }
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

  /**
   * Extract company info from stock data (private helper)
   * Supports both data.pageProps.companyInfo and data.fullData['pageProps.companyInfo....']
   */
  private extractCompanyInfo(data: DNSEStockData): any {
    // Try fullData first (new structure)
    if (data.fullData) {
      // Look for keys that start with 'pageProps.companyInfo'
      for (const key in data.fullData) {
        if (key.startsWith('pageProps.companyInfo')) {
          return data.fullData[key];
        }
      }
    }
    
    // Fallback to pageProps.companyInfo (old structure)
    if (data.pageProps?.companyInfo) {
      return data.pageProps.companyInfo;
    }
    
    return null;
  }

  /**
   * Extract pageProps from stock data (private helper)
   * Supports both data.pageProps and data.fullData['pageProps....']
   */
  private extractPageProps(data: DNSEStockData): any {
    // Try fullData first (new structure)
    if (data.fullData) {
      // Look for keys that start with 'pageProps'
      const pageProps: any = {};
      for (const key in data.fullData) {
        if (key.startsWith('pageProps.')) {
          const propName = key.replace('pageProps.', '');
          pageProps[propName] = data.fullData[key];
        }
      }
      if (Object.keys(pageProps).length > 0) {
        return pageProps;
      }
    }
    
    // Fallback to pageProps (old structure)
    if (data.pageProps) {
      return data.pageProps;
    }
    
    return null;
  }

  /**
   * Extract priceSnapshot from stock data (private helper)
   * Supports both data.pageProps.priceSnapshot and data.fullData['pageProps.priceSnapshot....']
   */
  private extractPriceSnapshot(data: DNSEStockData): any {
    // Try fullData first (new structure)
    if (data.fullData) {
      // Look for keys that start with 'pageProps.priceSnapshot'
      for (const key in data.fullData) {
        if (key.startsWith('pageProps.priceSnapshot')) {
          return data.fullData[key];
        }
      }
    }
    
    // Fallback to pageProps.priceSnapshot (old structure)
    if (data.pageProps?.priceSnapshot) {
      return data.pageProps.priceSnapshot;
    }
    
    return null;
  }
}

