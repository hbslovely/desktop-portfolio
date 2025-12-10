import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, effect, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { DnseService, DNSESymbol, DNSEStockData, DNSEOHLCData, ExchangeType } from '../../../services/dnse.service';
import { NeuralNetworkService, StockPrediction, TrainingProgress, TrainingConfig, DEFAULT_TRAINING_CONFIG, TRAINING_CONFIG_DESCRIPTIONS, ModelStatus } from '../../../services/neural-network.service';
import { TradingSimulationService, TradingConfig, TradingResult, TradeSignal } from '../../../services/trading-simulation.service';
import { TradingviewChartComponent } from './tradingview-chart/tradingview-chart.component';
import { Chart, ChartConfiguration, registerables, TimeScale } from 'chart.js';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
// @ts-ignore - chartjs-chart-financial doesn't have proper type declarations
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

// Register Chart.js and financial chart components
Chart.register(...registerables, TimeScale);
Chart.register(CandlestickController, CandlestickElement);
Chart.register(zoomPlugin);

interface SymbolWithStatus {
  symbol: string;
  name?: string;
  exchange: ExchangeType | ExchangeType[]; // Can be single exchange or array for merged symbols
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

interface Transaction {
  type: 'buy' | 'sell';
  date: number;
  dateStr: string;
  quantity: number;
  price: number;
  capitalBefore: number;
  transactionAmount: number; // Tiền giao dịch (số tiền dùng để mua hoặc nhận được khi bán)
  capitalAfter: number;
  totalSharesBefore: number; // Tổng số cổ phiếu đang nắm giữ trước GD
  totalSharesAfter: number;  // Tổng số cổ phiếu đang nắm giữ sau GD
  avgPriceAfter: number;     // Giá trung bình sau GD
  holdingDays?: number; // Chỉ có khi là giao dịch bán
}

@Component({
  selector: 'app-stock-app',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule, TradingviewChartComponent],
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
  activeTab = signal<'overview' | 'trading' | 'chart' | 'financial'>('overview');

  // Financial indicator labels mapping (Vietnamese)
  financialIndicatorLabels: Record<string, string> = {
    'marketShare': 'Thị phần',
    'totalAssets': 'Tổng tài sản',
    'eps': 'EPS',
    'pe': 'P/E',
    'ps': 'P/S',
    'pb': 'P/B',
    'beta': 'Beta',
    'netInterestMargin': 'NIM',
    'lossRatio': 'Tỷ lệ bồi thường',
    'combineRatio': 'Tỷ lệ kết hợp',
    'profitGrowth': 'Tăng trưởng LN',
    'ytd': 'YTD',
    'nplRatio': 'Tỷ lệ nợ xấu',
    'llr': 'Bao phủ nợ xấu',
    'casaRatio': 'Tỷ lệ CASA',
    'roe': 'ROE',
    'roa': 'ROA',
    'grossMargin': 'Biên LN gộp',
    'debtEquityRatio': 'Nợ/Vốn CSH',
    'inventoryGrowth': 'Tăng trưởng tồn kho',
    'prepaidBuyerGrowth': 'Tăng trưởng NMTTT',
    'proprietaryTradingRatio': 'Tỷ trọng tự doanh',
    'marginLendingGrowth': 'Tăng trưởng cho vay margin',
    'freeFloatRatio': 'Free Float',
    'dividendYield': 'Tỷ suất cổ tức',
    'dividendRatio': 'Tỷ lệ cổ tức',
    'equity': 'Vốn chủ sở hữu',
    'bookValue': 'Giá trị sổ sách',
    'sales': 'Doanh số',
    'capitalization': 'Vốn hóa',
    'revenue': 'Doanh thu',
    'revenuePerShare': 'Doanh thu/CP',
    'profit': 'Lợi nhuận',
    'foreignOwnershipRatio': 'Tỷ lệ SHNN',
    'foreignHoldingRatio': 'Room NN',
    'accuredInterestTotalAssetRatio': 'Lãi dự thu/TTS',
    'remainForeignRoom': 'Room NN còn lại'
  };

  // Header search state
  headerSearchQuery = signal('');
  showSearchSuggestions = signal(false);

  // Computed: price table data with reference price, ceiling, floor, and color classes
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
      floorPrice: number,
      changeValue: number,
      changePercent: number,
      openColorClass: string,
      highColorClass: string,
      lowColorClass: string,
      closeColorClass: string,
      openFormatted: string,
      highFormatted: string,
      lowFormatted: string,
      closeFormatted: string
    }> = [];

    // Data is sorted oldest to newest, so i-1 is the previous trading day
    for (let i = 0; i < priceData.t.length; i++) {
      const timestamp = priceData.t[i];
      const date = new Date(timestamp * 1000);
      const dateStr = this.formatDateVN(date);

      // Reference price = previous trading day's close price
      // For the first record, use the open price as reference (no previous data)
      const referencePrice = i > 0 ? (priceData.c[i - 1] || 0) : (priceData.o[i] || 0);

      // Calculate ceiling and floor (typically ±7% for HOSE/HNX, ±10% for UPCOM)
      // Using 7% as default
      const ceilingPrice = referencePrice * 1.07;
      const floorPrice = referencePrice * 0.93;

      const open = priceData.o[i] || 0;
      const high = priceData.h[i] || 0;
      const low = priceData.l[i] || 0;
      const close = priceData.c[i] || 0;

      // Calculate daily change (close vs reference)
      const changeValue = close - referencePrice;
      const changePercent = referencePrice > 0 ? (changeValue / referencePrice) * 100 : 0;

      result.push({
        date: dateStr,
        open,
        high,
        low,
        close,
        volume: priceData.v[i] || 0,
        referencePrice,
        ceilingPrice,
        floorPrice,
        changeValue,
        changePercent,
        openColorClass: this.getPriceColorClass(open, referencePrice, ceilingPrice, floorPrice),
        highColorClass: this.getPriceColorClass(high, referencePrice, ceilingPrice, floorPrice),
        lowColorClass: this.getPriceColorClass(low, referencePrice, ceilingPrice, floorPrice),
        closeColorClass: this.getPriceColorClass(close, referencePrice, ceilingPrice, floorPrice),
        openFormatted: `${(open * 1000).toLocaleString('vi-VN')} đ`,
        highFormatted: `${(high * 1000).toLocaleString('vi-VN')} đ`,
        lowFormatted: `${(low * 1000).toLocaleString('vi-VN')} đ`,
        closeFormatted: `${(close * 1000).toLocaleString('vi-VN')} đ`
      });
    }

    // Show latest 20 records (most recent first)
    return result.slice(-20).reverse();
  });

  // Computed: selected symbol formatted info
  selectedSymbolInfo = computed(() => {
    const symbol = this.selectedSymbol();
    if (!symbol) return null;

    const basicInfo = symbol.basicInfo;
    if (!basicInfo) return null;

    const matchPrice = basicInfo.matchPrice ? parseFloat(basicInfo.matchPrice) : null;
    const changedValue = basicInfo.changedValue ? parseFloat(basicInfo.changedValue) : null;
    const totalVolume = basicInfo.totalVolume ? parseFloat(basicInfo.totalVolume) : null;

    const exchange = Array.isArray(symbol.exchange) ? symbol.exchange[0] : symbol.exchange;
    return {
      symbol: symbol.symbol,
      companyName: basicInfo.companyName || '-',
      exchange: exchange,
      exchangeName: this.exchangeNames[exchange],
      matchPrice: matchPrice,
      matchPriceFormatted: matchPrice ? `${(matchPrice * 1000).toLocaleString('vi-VN')} đ` : '-',
      changedValue: changedValue,
      changedValueFormatted: changedValue ? `${(changedValue * 1000).toLocaleString('vi-VN')} đ` : '-',
      changedRatio: basicInfo.changedRatio || '0',
      changedValueClass: changedValue !== null ? (changedValue >= 0 ? 'positive' : 'negative') : '',
      totalVolume: totalVolume,
      totalVolumeFormatted: totalVolume ? totalVolume.toLocaleString('vi-VN') : '-',
      eps: basicInfo.eps || '-',
      pe: basicInfo.pe || '-',
      pb: basicInfo.pb || '-',
      roe: basicInfo.roe || '-',
      roa: basicInfo.roa || '-',
      marketCap: basicInfo.marketCap ? parseFloat(basicInfo.marketCap).toLocaleString('vi-VN') : '-',
      hasFullData: !!basicInfo.fullData,
      hasTicker: !!basicInfo.fullData?.['pageProps.ticker']
    };
  });

  // Computed: company info HTML
  companyInfoHTML = computed(() => {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return '';
    }

    const ticker = symbol.basicInfo.fullData['pageProps.ticker'];
    if (!ticker) {
      return '';
    }

    // Convert ticker object to HTML
    let html = '<div class="ticker-info">';

    if (typeof ticker === 'object') {
      for (const key in ticker) {
        if (ticker[key] && typeof ticker[key] !== 'object') {
          html += `<div class="ticker-item"><strong>${key}:</strong> ${ticker[key]}</div>`;
        }
      }
    } else {
      html += `<div>${ticker}</div>`;
    }

    html += '</div>';
    return html;
  });

  // Computed: stock list items with formatted data
  stockListItems = computed(() => {
    return this.filteredSymbols().map(symbol => {
      const basicInfo = symbol.basicInfo;
      const matchPrice = basicInfo?.matchPrice ? parseFloat(basicInfo.matchPrice) : null;
      const changedValue = basicInfo?.changedValue ? parseFloat(basicInfo.changedValue) : null;

      const exchange = Array.isArray(symbol.exchange) ? symbol.exchange[0] : symbol.exchange;
      return {
        ...symbol,
        companyName: basicInfo?.companyName || symbol.name || '-',
        exchangeName: this.exchangeNames[exchange],
        matchPrice: matchPrice,
        matchPriceFormatted: matchPrice ? `${(matchPrice * 1000).toLocaleString('vi-VN')} đ` : '-',
        changedValue: changedValue,
        changedValueFormatted: changedValue ? `${(changedValue * 1000).toLocaleString('vi-VN')} đ` : '-',
        changedRatio: basicInfo?.changedRatio || '0',
        changedValueClass: changedValue !== null ? (changedValue >= 0 ? 'positive' : 'negative') : '',
        hasMetrics: !!(basicInfo?.pe || basicInfo?.pb || basicInfo?.roe)
      };
    });
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

  // Neural Network state
  nnPrediction = signal<StockPrediction | null>(null);
  nnTrainingProgress = signal<TrainingProgress | null>(null);
  isNNTraining = signal(false);
  isNNReady = signal(false);
  nnError = signal<string | null>(null);
  nnPredictionComparison = signal<Array<{
    date: number;
    dateStr: string;
    predictedPrice: number;
    actualPrice: number;
    error: number;
    errorPercent: number;
  }> | null>(null);
  isLoadingComparison = signal(false);
  
  // Training configuration state
  trainingConfig = signal<TrainingConfig>({ ...DEFAULT_TRAINING_CONFIG });
  trainingConfigDescriptions = TRAINING_CONFIG_DESCRIPTIONS;
  showTrainingConfig = signal(false);
  modelStatus = signal<ModelStatus>({ exists: false, hasWeights: false, hasSimulation: false });
  isCheckingModel = signal(false);
  
  // Chart state
  showPriceTable = signal(false);
  showChartFullscreen = signal(false);

  // Trading simulation state
  tradingConfig = signal<TradingConfig>({
    initialCapital: 100000000, // 100 triệu đồng
    stopLossPercent: 5, // 5%
    takeProfitPercent: 10, // 10%
    minConfidence: 0.0, // Không dùng nữa - model tự quyết định
    maxPositions: 3, // Cho phép mua nhiều lần để tối ưu
    tPlusDays: 2 // T+2 (sau 2 ngày mới được bán)
  });
  tradingResult = signal<TradingResult | null>(null);
  isRunningSimulation = signal(false);
  

  // Date range for backtesting
  backtestStartDate = signal<string>('');
  backtestEndDate = signal<string>('');

  constructor(
    private dnseService: DnseService,
    private http: HttpClient,
    private nnService: NeuralNetworkService,
    private tradingSimulationService: TradingSimulationService
  ) {
    // Watch for tab changes and initialize chart when switching to chart tab
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'chart' && this.selectedSymbolPriceData() && !this.isLoadingPrice()) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          // Always reinitialize chart when switching to chart tab
          if (this.candlestickChart) {
            this.candlestickChart.destroy();
            this.candlestickChart = null;
          }
          this.initCandlestickChart();
        }, 200);
      }
    });
  }

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
   * Load symbols from internal API only (api/stocks-v2/list)
   * DNSE API is only called on days 10-20 of the month to sync new stocks
   */
  loadSymbols() {
    this.isLoading.set(true);

    // Only load from internal API (api/stocks-v2/list)
    this.dnseService.getAllStockData().subscribe({
      next: (stocks) => {
        // Deduplicate stocks by symbol
        const uniqueStocksMap = new Map<string, any>();
        stocks.forEach((stock: any) => {
          if (stock && stock.symbol) {
            const symbolKey = stock.symbol.toUpperCase();
            const existing = uniqueStocksMap.get(symbolKey);
            if (!existing || (stock.fullData || stock.basicInfo) && !(existing.fullData || existing.basicInfo)) {
              uniqueStocksMap.set(symbolKey, stock);
            }
          }
        });

        // Convert stocks to SymbolWithStatus array
        const allSymbols: SymbolWithStatus[] = [];
        uniqueStocksMap.forEach((stock: any) => {
          const symbol: SymbolWithStatus = {
            symbol: stock.symbol,
            name: stock.basicInfo?.companyName || stock.fullData?.['pageProps.companyInfo.fullName'],
            exchange: (stock.basicInfo?.exchange || 'hose') as ExchangeType,
            isFetched: !!(stock.priceData || stock.fullData),
            basicInfo: {
              companyName: stock.basicInfo?.companyName || stock.fullData?.['pageProps.companyInfo.fullName'],
              exchange: stock.basicInfo?.exchange || 'hose',
              matchPrice: stock.basicInfo?.matchPrice,
              changedValue: stock.basicInfo?.changedValue,
              changedRatio: stock.basicInfo?.changedRatio,
              totalVolume: stock.basicInfo?.totalVolume,
              marketCap: stock.basicInfo?.marketCap,
              beta: stock.basicInfo?.beta,
              eps: stock.basicInfo?.eps,
              pe: stock.basicInfo?.pe,
              pb: stock.basicInfo?.pb,
              roe: stock.basicInfo?.roe,
              roa: stock.basicInfo?.roa,
              fullData: stock.fullData
            }
          };
          allSymbols.push(symbol);
        });

        this.allSymbols.set(allSymbols);
        this.applyFilters();
        this.updateFetchedCount();
        this.updateExchangeCounts();
        this.isLoading.set(false);

        // Check if we should sync with DNSE (days 10-20 of month)
        this.checkAndSyncDNSE();
      },
      error: (error) => {
        console.error('Error loading stock data:', error);
        this.allSymbols.set([]);
        this.applyFilters();
        this.isLoading.set(false);
        
        // Still try to sync with DNSE if in window
        this.checkAndSyncDNSE();
      }
    });
  }

  /**
   * Check if we should sync with DNSE API and do it if needed
   * Only syncs on days 10-20 of the month, and only once per month
   */
  private checkAndSyncDNSE() {
    if (this.dnseService.shouldSyncWithDNSE()) {
      console.log('🔄 DNSE sync window (days 10-20) - checking for new stocks...');
      
      this.dnseService.syncNewStocksFromDNSE().subscribe({
        next: (result) => {
          if (result.synced) {
            if (result.newSymbols.length > 0) {
              console.log(`✅ Synced ${result.newSymbols.length} new stocks from DNSE:`, result.newSymbols);
              // Reload symbols to include new ones
              this.loadSymbolsWithoutDNSESync();
            } else {
              console.log(`✅ DNSE sync complete. No new stocks found (${result.totalFromDNSE} total in DNSE)`);
            }
          }
        },
        error: (error) => {
          console.error('Error syncing with DNSE:', error);
        }
      });
    } else {
      const today = new Date();
      const dayOfMonth = today.getDate();
      if (dayOfMonth < 10) {
        console.log(`📅 DNSE sync skipped - waiting for sync window (current: day ${dayOfMonth}, window: days 10-20)`);
      } else if (dayOfMonth > 20) {
        console.log(`📅 DNSE sync skipped - window passed (current: day ${dayOfMonth}, window: days 10-20)`);
      } else {
        console.log(`📅 DNSE sync skipped - already synced this month`);
      }
    }
  }

  /**
   * Load symbols without triggering DNSE sync (used after sync completes)
   */
  private loadSymbolsWithoutDNSESync() {
    this.dnseService.getAllStockData().subscribe({
      next: (stocks) => {
        const uniqueStocksMap = new Map<string, any>();
        stocks.forEach((stock: any) => {
          if (stock && stock.symbol) {
            const symbolKey = stock.symbol.toUpperCase();
            const existing = uniqueStocksMap.get(symbolKey);
            if (!existing || (stock.fullData || stock.basicInfo) && !(existing.fullData || existing.basicInfo)) {
              uniqueStocksMap.set(symbolKey, stock);
            }
          }
        });

        const allSymbols: SymbolWithStatus[] = [];
        uniqueStocksMap.forEach((stock: any) => {
          const symbol: SymbolWithStatus = {
            symbol: stock.symbol,
            name: stock.basicInfo?.companyName || stock.fullData?.['pageProps.companyInfo.fullName'],
            exchange: (stock.basicInfo?.exchange || 'hose') as ExchangeType,
            isFetched: !!(stock.priceData || stock.fullData),
            basicInfo: {
              companyName: stock.basicInfo?.companyName || stock.fullData?.['pageProps.companyInfo.fullName'],
              exchange: stock.basicInfo?.exchange || 'hose',
              matchPrice: stock.basicInfo?.matchPrice,
              changedValue: stock.basicInfo?.changedValue,
              changedRatio: stock.basicInfo?.changedRatio,
              totalVolume: stock.basicInfo?.totalVolume,
              marketCap: stock.basicInfo?.marketCap,
              beta: stock.basicInfo?.beta,
              eps: stock.basicInfo?.eps,
              pe: stock.basicInfo?.pe,
              pb: stock.basicInfo?.pb,
              roe: stock.basicInfo?.roe,
              roa: stock.basicInfo?.roa,
              fullData: stock.fullData
            }
          };
          allSymbols.push(symbol);
        });

        this.allSymbols.set(allSymbols);
        this.applyFilters();
        this.updateFetchedCount();
        this.updateExchangeCounts();
      }
    });
  }

  /**
   * Check fetched status from Stock API and load basic info
   * This is now handled in loadSymbols, but kept for backward compatibility
   */
  checkFetchedStatus() {
    // This is now handled in loadSymbols, but we keep it for compatibility
    this.dnseService.getAllStockData().subscribe({
      next: (stocks) => {
        const stockMap = new Map<string, any>();
        stocks.forEach((stock: any) => {
          if (stock && stock.symbol) {
            stockMap.set(stock.symbol.toUpperCase(), stock);
          }
        });

        // Update symbols with fetched data
        this.allSymbols.update(symbols =>
          symbols.map(s => {
            const stockData = stockMap.get(s.symbol.toUpperCase());
            if (stockData) {
              const basicInfo = stockData.basicInfo || {};
              return {
                ...s,
                isFetched: true,
                basicInfo: {
                  companyName: basicInfo.companyName || stockData.fullData?.['pageProps.companyInfo.fullName'] || stockData.fullData?.['pageProps.companyInfo.name'],
                  exchange: basicInfo.exchange || s.exchange,
                  matchPrice: basicInfo.matchPrice,
                  changedValue: basicInfo.changedValue,
                  changedRatio: basicInfo.changedRatio,
                  totalVolume: basicInfo.totalVolume,
                  marketCap: basicInfo.marketCap,
                  eps: basicInfo.eps,
                  pe: basicInfo.pe,
                  pb: basicInfo.pb,
                  roe: basicInfo.roe,
                  roa: basicInfo.roa,
                  fullData: stockData.fullData
                }
              };
            }
            return {
              ...s,
              isFetched: false
            };
          })
        );
        this.applyFilters();
        this.updateFetchedCount();
        this.updateExchangeCounts();
      },
      error: (error) => {
        console.error('Error loading stock data:', error);
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
      const symbols = this.allSymbols().filter(s => {
        if (Array.isArray(s.exchange)) {
          return s.exchange.includes(exchange);
        }
        return s.exchange === exchange;
      });
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
   * Get exchange count text (shows total count, works even before fetching)
   */
  getExchangeCountText(exchange: ExchangeType): string {
    // Always calculate on the fly to show current count
    const symbols = this.allSymbols().filter(s => {
      if (Array.isArray(s.exchange)) {
        return s.exchange.includes(exchange);
      }
      return s.exchange === exchange;
    });
    return `${symbols.length}`;
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
      filtered = filtered.filter(s => {
        if (Array.isArray(s.exchange)) {
          return s.exchange.includes(this.selectedExchange() as ExchangeType);
        }
        return s.exchange === this.selectedExchange();
      });
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
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.basicInfo?.companyName && s.basicInfo.companyName.toLowerCase().includes(query))
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
   * Fetch a single symbol and return a Promise
   */
  private fetchSymbolPromise(symbol: SymbolWithStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.fetchingSymbols().has(symbol.symbol)) {
        resolve(); // Already fetching, skip
        return;
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

                  resolve();
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

                  resolve(); // Resolve even on error to continue with next symbol
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

              resolve(); // Resolve even on error to continue with next symbol
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

          resolve(); // Resolve even on error to continue with next symbol
        }
      });
    });
  }

  /**
   * Fetch multiple symbols sequentially (one by one)
   */
  async fetchSelectedSymbols(symbols: SymbolWithStatus[]) {
    const unfetched = symbols.filter(s => !s.isFetched && !this.fetchingSymbols().has(s.symbol));

    console.log(`🔄 Bắt đầu fetch tuần tự ${unfetched.length} mã cổ phiếu...`);

    for (const symbol of unfetched) {
      console.log(`📥 Đang fetch: ${symbol.symbol}...`);
      await this.fetchSymbolPromise(symbol);
      console.log(`✅ Hoàn thành: ${symbol.symbol}`);
    }

    console.log(`✨ Đã hoàn thành fetch tất cả ${unfetched.length} mã cổ phiếu`);
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
        // Initialize date range when price data is loaded
        setTimeout(() => this.initializeDateRange(), 100);
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
   * Get latest close price in actual VND units
   */
  getLatestClosePrice(): number {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || priceData.c.length === 0) return 0;
    // Convert from database units to actual VND units
    return priceData.c[priceData.c.length - 1] * 1000;
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
            display: false
          },
          tooltip: {
            enabled: false
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
                  min: 0.1,  // Minimum zoom: 10% of original
                  max: 1     // Maximum zoom: 100% of original (no zoom out beyond original)
                },
                y: {
                  min: 0.5,  // Minimum zoom: 50% of original for Y axis
                  max: 2     // Maximum zoom: 200% of original for Y axis
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
   * Supports multiple formats:
   * - data.fullData['pageProps.companyInfo'] (flat key object)
   * - data.fullData.pageProps?.companyInfo (nested object)
   * - data.fullData['pageProps.companyInfo.xxx'] (flat keys with prefix)
   * - data.pageProps?.companyInfo (fallback)
   */
  private extractCompanyInfo(data: DNSEStockData): any {
    // Try fullData first (new structure)
    if (data.fullData) {
      // Case 1: Check for flat key 'pageProps.companyInfo' (object)
      if (data.fullData['pageProps.companyInfo'] && typeof data.fullData['pageProps.companyInfo'] === 'object') {
        return data.fullData['pageProps.companyInfo'];
      }

      // Case 2: Check for nested object data.fullData['pageProps']?.companyInfo
      if (data.fullData['pageProps']?.companyInfo && typeof data.fullData['pageProps'].companyInfo === 'object') {
        return data.fullData['pageProps'].companyInfo;
      }

      // Case 3: Look for keys that start with 'pageProps.companyInfo.' and build object
      const companyInfo: any = {};
      let hasFields = false;
      for (const key in data.fullData) {
        if (key.startsWith('pageProps.companyInfo.')) {
          const fieldName = key.replace('pageProps.companyInfo.', '');
          companyInfo[fieldName] = data.fullData[key];
          hasFields = true;
        }
      }
      if (hasFields && Object.keys(companyInfo).length > 0) {
        return companyInfo;
      }

      // Case 4: Check for exact key 'pageProps.companyInfo' (might be a string or other type)
      if (data.fullData['pageProps.companyInfo'] !== undefined) {
        return data.fullData['pageProps.companyInfo'];
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

  /**
   * Get price color class based on price, reference, ceiling, and floor
   * Green > reference, Yellow = reference, Red < reference, Purple = ceiling, Light blue = floor
   */
  getPriceColorClass(price: number, referencePrice: number, ceilingPrice: number, floorPrice: number): string {
    const tolerance = 0.01; // Small tolerance for floating point comparison

    // Check if price equals ceiling price (within tolerance)
    if (Math.abs(price - ceilingPrice) < tolerance) {
      return 'price-ceiling'; // Purple = trần
    }

    // Check if price equals floor price (within tolerance)
    if (Math.abs(price - floorPrice) < tolerance) {
      return 'price-floor'; // Light blue = sàn
    }

    // Check if price equals reference price (within tolerance)
    if (Math.abs(price - referencePrice) < tolerance) {
      return 'price-reference'; // Yellow = tham chiếu
    }

    // Compare with reference price
    if (price > referencePrice) {
      return 'price-up'; // Green > tham chiếu
    } else {
      return 'price-down'; // Red < tham chiếu
    }
  }

  /**
   * Get company info from fullData
   * Supports multiple formats:
   * - fullData['pageProps.companyInfo'] (flat key object)
   * - fullData.pageProps?.companyInfo (nested object)
   * - fullData['pageProps.companyInfo.xxx'] (flat keys with prefix)
   */
  getCompanyInfoFromFullData(): any {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return null;
    }

    const fullData = symbol.basicInfo.fullData;

    // Case 1: Check for flat key 'pageProps.companyInfo' (object)
    if (fullData['pageProps.companyInfo'] && typeof fullData['pageProps.companyInfo'] === 'object') {
      return fullData['pageProps.companyInfo'];
    }

    // Case 2: Check for nested object fullData['pageProps']?.companyInfo
    if (fullData['pageProps']?.companyInfo && typeof fullData['pageProps'].companyInfo === 'object') {
      return fullData['pageProps'].companyInfo;
    }

    // Case 3: Look for keys that start with 'pageProps.companyInfo.' and build object
    const companyInfo: any = {};
    let hasFields = false;
    for (const key in fullData) {
      if (key.startsWith('pageProps.companyInfo.')) {
        const fieldName = key.replace('pageProps.companyInfo.', '');
        companyInfo[fieldName] = fullData[key];
        hasFields = true;
      }
    }
    if (hasFields && Object.keys(companyInfo).length > 0) {
      return companyInfo;
    }

    // Case 4: Check for exact key 'pageProps.companyInfo' (might be a string or other type)
    if (fullData['pageProps.companyInfo'] !== undefined) {
      return fullData['pageProps.companyInfo'];
    }

    return null;
  }

  /**
   * Get company address from symbol
   * Supports multiple formats for companyInfo
   */
  getCompanyAddress(symbol: SymbolWithStatus): string {
    if (!symbol.basicInfo?.fullData) return '';

    const fullData = symbol.basicInfo.fullData;

    // Try to get companyInfo in different formats
    let companyInfo: any = null;

    // Case 1: Check for flat key 'pageProps.companyInfo' (object)
    if (fullData['pageProps.companyInfo'] && typeof fullData['pageProps.companyInfo'] === 'object') {
      companyInfo = fullData['pageProps.companyInfo'];
    }
    // Case 2: Check for nested object fullData['pageProps']?.companyInfo
    else if (fullData['pageProps']?.companyInfo && typeof fullData['pageProps'].companyInfo === 'object') {
      companyInfo = fullData['pageProps'].companyInfo;
    }
    // Case 3: Check for flat key 'pageProps.companyInfo.address'
    else if (fullData['pageProps.companyInfo.address'] !== undefined) {
      return fullData['pageProps.companyInfo.address'];
    }

    if (companyInfo && companyInfo.address) {
      return companyInfo.address;
    }

    return '';
  }

  /**
   * Get field from company info
   */
  getCompanyField(fieldName: string): any {
    const companyInfo = this.getCompanyInfoFromFullData();
    if (!companyInfo) {
      // Fallback: try to get from fullData directly
      const symbol = this.selectedSymbol();
      if (symbol?.basicInfo?.fullData) {
        const fullData = symbol.basicInfo.fullData;
        const key = `pageProps.companyInfo.${fieldName}`;
        if (fullData[key] !== undefined) {
          return fullData[key];
        }
      }
      return null;
    }
    return companyInfo[fieldName] || null;
  }

  /**
   * Get ticker info from fullData
   * Supports multiple formats:
   * - fullData['pageProps.ticker'] (flat key object)
   * - fullData.pageProps?.ticker (nested object)
   * - fullData['pageProps.ticker.xxx'] (flat keys with prefix)
   */
  getTickerInfoFromFullData(): any {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return null;
    }

    const fullData = symbol.basicInfo.fullData;

    // Case 1: Check for flat key 'pageProps.ticker' (object)
    if (fullData['pageProps.ticker'] && typeof fullData['pageProps.ticker'] === 'object') {
      return fullData['pageProps.ticker'];
    }

    // Case 2: Check for nested object fullData['pageProps']?.ticker
    if (fullData['pageProps']?.ticker && typeof fullData['pageProps'].ticker === 'object') {
      return fullData['pageProps'].ticker;
    }

    // Case 3: Look for keys that start with 'pageProps.ticker.' and build object
    const ticker: any = {};
    let hasFields = false;
    for (const key in fullData) {
      if (key.startsWith('pageProps.ticker.')) {
        const fieldName = key.replace('pageProps.ticker.', '');
        ticker[fieldName] = fullData[key];
        hasFields = true;
      }
    }
    if (hasFields && Object.keys(ticker).length > 0) {
      return ticker;
    }

    // Case 4: Check for exact key 'pageProps.ticker' (might be a string or other type)
    if (fullData['pageProps.ticker'] !== undefined) {
      return fullData['pageProps.ticker'];
    }

    return null;
  }

  /**
   * Get field from ticker info
   */
  getTickerField(fieldName: string): any {
    const ticker = this.getTickerInfoFromFullData();
    if (!ticker) {
      // Fallback: try to get from fullData directly
      const symbol = this.selectedSymbol();
      if (symbol?.basicInfo?.fullData) {
        const fullData = symbol.basicInfo.fullData;
        const key = `pageProps.ticker.${fieldName}`;
        if (fullData[key] !== undefined) {
          return fullData[key];
        }
      }
      return null;
    }
    return ticker[fieldName] || null;
  }

  /**
   * Get company info from ticker data
   */
  getCompanyInfo(): any {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return null;
    }

    const ticker = symbol.basicInfo.fullData['pageProps.ticker'];
    return ticker || null;
  }

  /**
   * Get company info HTML from ticker data
   */
  getCompanyInfoHTML(): string {
    const ticker = this.getCompanyInfo();
    if (!ticker) {
      return '';
    }

    // Convert ticker object to HTML
    let html = '<div class="ticker-info">';

    if (typeof ticker === 'object') {
      for (const key in ticker) {
        if (ticker[key] !== null && ticker[key] !== undefined) {
          if (typeof ticker[key] === 'object') {
            html += `<div class="ticker-item"><strong>${key}:</strong> ${JSON.stringify(ticker[key], null, 2)}</div>`;
          } else {
            html += `<div class="ticker-item"><strong>${key}:</strong> ${ticker[key]}</div>`;
          }
        }
      }
    } else {
      html += `<div>${ticker}</div>`;
    }

    html += '</div>';
    return html;
  }

  /**
   * View stock detail - load from API
   */
  viewStockDetail(symbol: SymbolWithStatus) {
    this.selectedSymbol.set(symbol);
    this.showDetailView.set(true);
    this.isLoadingDetail.set(true);
    this.isLoadingPrice.set(true);
    this.selectedSymbolData.set(null);
    this.selectedSymbolPriceData.set(null);
    this.activeTab.set('overview'); // Reset to overview tab
    // Reset date range
    this.backtestStartDate.set('');
    this.backtestEndDate.set('');
    this.tradingResult.set(null);
    // Reset neural network state
    this.isNNReady.set(false);
    this.nnPrediction.set(null);
    this.nnError.set(null);
    this.nnTrainingProgress.set(null);
    // Check if model exists in database for this symbol
    this.checkModelExists();

    // Load stock data from API
    this.dnseService.getStockDataFromAPI(symbol.symbol).subscribe({
      next: (data) => {
        this.selectedSymbolData.set(data as any);
        this.isLoadingDetail.set(false);

        // Load price data if available
        if (data && data.priceData) {
          this.selectedSymbolPriceData.set(data.priceData);
          this.isLoadingPrice.set(false);
          // Initialize date range when price data is loaded
          setTimeout(() => this.initializeDateRange(), 100);
          // Initialize chart if on chart tab
          if (this.activeTab() === 'chart') {
            setTimeout(() => this.initCandlestickChart(), 100);
          }
        } else {
          // Fetch price data
          this.fetchPriceDataOnly(this.selectedYears());
        }
      },
      error: (error) => {
        console.error('Error loading stock detail:', error);
        this.isLoadingDetail.set(false);
        this.isLoadingPrice.set(false);
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
    this.activeTab.set('overview');
    if (this.candlestickChart) {
      this.candlestickChart.destroy();
      this.candlestickChart = null;
    }
  }

  /**
   * Get related stocks from sameSectorStocks
   */
  getRelatedStocks(): Array<{symbol: string, name?: string, price?: number}> {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return [];
    }

    const fullData = symbol.basicInfo.fullData;

    // Look for sameSectorStocks in fullData
    // It might be in pageProps.companyInfo.sameSectorStocks or directly in fullData
    let sameSectorStocks: any[] = [];

    // Try to find sameSectorStocks in various possible locations
    for (const key in fullData) {
      if (key.includes('sameSectorStocks') || key.includes('sameSector')) {
        const value = fullData[key];
        if (Array.isArray(value)) {
          sameSectorStocks = value;
          break;
        }
      }
    }

    // If not found, try to get from pageProps
    if (sameSectorStocks.length === 0) {
      const companyInfo = this.getCompanyInfoFromFullData();
      if (companyInfo && companyInfo.sameSectorStocks) {
        sameSectorStocks = companyInfo.sameSectorStocks;
      }
    }

    // Map to our format
    return sameSectorStocks.map((stock: any) => {
      if (typeof stock === 'string') {
        // If it's just a symbol string
        return { symbol: stock.toUpperCase() };
      } else if (stock && stock.symbol) {
        // If it's an object with symbol
        return {
          symbol: stock.symbol.toUpperCase(),
          name: stock.name || stock.companyName,
          price: stock.price || stock.matchPrice
        } as any;
      }
      return null;
    }).filter((s: any) => s !== null && s.symbol);
  }

  /**
   * View related stock detail
   */
  viewRelatedStock(stock: {symbol: string, name?: string, price?: number}) {
    // Find the symbol in allSymbols
    const foundSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === stock.symbol.toUpperCase());
    if (foundSymbol && foundSymbol.isFetched) {
      // If found and already fetched, view detail immediately
      this.viewStockDetail(foundSymbol);
    } else if (foundSymbol && !foundSymbol.isFetched) {
      // If found but not fetched, fetch first then view
      this.fetchSymbol(foundSymbol);
      // Wait for fetch to complete
      const checkInterval = setInterval(() => {
        const updatedSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === stock.symbol.toUpperCase());
        if (updatedSymbol && updatedSymbol.isFetched) {
          clearInterval(checkInterval);
          this.viewStockDetail(updatedSymbol);
        }
      }, 500);
      // Timeout after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    } else {
      // If not found, create a temporary symbol object and add to list
      const tempSymbol: SymbolWithStatus = {
        symbol: stock.symbol.toUpperCase(),
        name: stock.name,
        exchange: this.selectedSymbol()?.exchange || 'hose' as ExchangeType,
        isFetched: false
      };
      // Add to allSymbols temporarily
      this.allSymbols.update(symbols => [...symbols, tempSymbol]);
      // Fetch the symbol
      this.fetchSymbol(tempSymbol);
      // Wait for fetch to complete
      const checkInterval = setInterval(() => {
        const updatedSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === stock.symbol.toUpperCase());
        if (updatedSymbol && updatedSymbol.isFetched) {
          clearInterval(checkInterval);
          this.viewStockDetail(updatedSymbol);
        }
      }, 500);
      // Timeout after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }

  /**
   * Get highest price from price data
   */
  getHighestPrice(): number {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.h || priceData.h.length === 0) return 0;
    const maxHigh = Math.max(...priceData.h);
    return maxHigh * 1000; // Convert to đồng
  }

  /**
   * Get lowest price from price data
   */
  getLowestPrice(): number {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.l || priceData.l.length === 0) return 0;
    const minLow = Math.min(...priceData.l);
    return minLow * 1000; // Convert to đồng
  }

  /**
   * Get average price from price data
   */
  getAveragePrice(): number {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || priceData.c.length === 0) return 0;
    const sum = priceData.c.reduce((a, b) => a + b, 0);
    const avg = sum / priceData.c.length;
    return avg * 1000; // Convert to đồng
  }

  /**
   * Helper: Check if exchange is array
   */
  isExchangeArray(exchange: ExchangeType | ExchangeType[] | undefined): exchange is ExchangeType[] {
    return Array.isArray(exchange);
  }

  /**
   * Helper: Get exchanges as array
   */
  getExchangesArray(exchange: ExchangeType | ExchangeType[] | undefined): ExchangeType[] {
    if (!exchange) return [];
    return (Array.isArray(exchange) ? exchange : [exchange]).filter(Boolean);
  }

  /**
   * Helper: Get exchange name safely
   */
  getExchangeName(exchange: ExchangeType | ExchangeType[] | undefined): string {
    if (!exchange) return '';
    const exch = Array.isArray(exchange) ? exchange[0] : exchange;
    return this.exchangeNames[exch] || '';
  }

  /**
   * Get autocomplete suggestions for header search
   */
  getHeaderSearchSuggestions = computed(() => {
    const query = this.headerSearchQuery().toLowerCase().trim();
    if (!query || query.length < 1) return [];

    return this.allSymbols()
      .filter(s =>
        s.symbol.toLowerCase().includes(query) ||
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.basicInfo?.companyName && s.basicInfo.companyName.toLowerCase().includes(query))
      )
      .slice(0, 10) // Limit to 10 suggestions
      .map(s => ({
        symbol: s.symbol,
        name: s.basicInfo?.companyName || s.name || s.symbol,
        exchange: this.getExchangesArray(s.exchange),
        isFetched: s.isFetched
      }));
  });

  /**
   * Handle header search input
   */
  onHeaderSearchInput(value: string) {
    this.headerSearchQuery.set(value);
    this.showSearchSuggestions.set(value.length > 0);
  }

  /**
   * Handle header search keydown (Enter)
   */
  onHeaderSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const query = this.headerSearchQuery().trim().toUpperCase();
      if (query) {
        const symbol = this.allSymbols().find(s => s.symbol.toUpperCase() === query);
        if (symbol) {
          if (symbol.isFetched) {
            this.viewStockDetail(symbol);
          } else {
            // Fetch first then view
            this.fetchSymbol(symbol);
            const checkInterval = setInterval(() => {
              const updatedSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === query);
              if (updatedSymbol && updatedSymbol.isFetched) {
                clearInterval(checkInterval);
                this.viewStockDetail(updatedSymbol);
              }
            }, 500);
            setTimeout(() => clearInterval(checkInterval), 10000);
          }
          this.headerSearchQuery.set('');
          this.showSearchSuggestions.set(false);
        }
      }
    } else if (event.key === 'Escape') {
      this.showSearchSuggestions.set(false);
    }
  }

  /**
   * Handle header search blur with delay
   */
  onHeaderSearchBlur() {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      this.showSearchSuggestions.set(false);
    }, 200);
  }

  /**
   * Select symbol from autocomplete
   */
  selectSymbolFromSuggestion(suggestion: {symbol: string, isFetched: boolean}) {
    const symbol = this.allSymbols().find(s => s.symbol.toUpperCase() === suggestion.symbol.toUpperCase());
    if (symbol) {
      if (symbol.isFetched) {
        this.viewStockDetail(symbol);
      } else {
        this.fetchSymbol(symbol);
        const checkInterval = setInterval(() => {
          const updatedSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === suggestion.symbol.toUpperCase());
          if (updatedSymbol && updatedSymbol.isFetched) {
            clearInterval(checkInterval);
            this.viewStockDetail(updatedSymbol);
          }
        }, 500);
        setTimeout(() => clearInterval(checkInterval), 10000);
      }
      this.headerSearchQuery.set('');
      this.showSearchSuggestions.set(false);
    }
  }

  /**
   * Get same sector stocks from fullData
   */
  getSameSectorStocks(): Array<{symbol: string, name?: string, price?: number}> {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return [];
    }

    const fullData = symbol.basicInfo.fullData;
    const sameSectorStocks = fullData['pageProps.sameSectorStocks'];

    if (!sameSectorStocks || !Array.isArray(sameSectorStocks)) {
      return [];
    }

    const result: Array<{symbol: string, name?: string, price?: number}> = [];
    sameSectorStocks.forEach((stock: any) => {
      if (typeof stock === 'string') {
        result.push({ symbol: stock.toUpperCase() });
      } else if (stock && stock.symbol) {
        result.push({
          symbol: stock.symbol.toUpperCase(),
          name: stock.name || stock.companyName,
          price: stock.price || stock.matchPrice
        });
      }
    });
    return result;
  }

  /**
   * Get financial indicators from fullData
   */
  getFinancialIndicators(): any {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return null;
    }

    const fullData = symbol.basicInfo.fullData;
    return fullData['pageProps.financialIndicators.indexes'] || null;
  }

  /**
   * Get financial report overall from fullData
   */
  getFinancialReportOverall(): any {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return null;
    }

    const fullData = symbol.basicInfo.fullData;
    return fullData['pageProps.financialReportOverall'] || null;
  }

  /**
   * Format financial report for display
   */
  formatFinancialReport(report: any): string {
    if (!report) return '';

    if (typeof report === 'string') {
      return report;
    }

    if (typeof report === 'object') {
      let html = '<div class="financial-report-data">';

      if (Array.isArray(report)) {
        report.forEach((item: any, index: number) => {
          html += `<div class="report-item">`;
          html += this.formatReportItem(item);
          html += `</div>`;
        });
      } else {
        html += this.formatReportItem(report);
      }

      html += '</div>';
      return html;
    }

    return JSON.stringify(report, null, 2);
  }

  /**
   * Format a single report item
   */
  private formatReportItem(item: any): string {
    if (typeof item === 'string' || typeof item === 'number') {
      return `<div>${item}</div>`;
    }

    if (typeof item === 'object' && item !== null) {
      let html = '';
      for (const key in item) {
        const value = item[key];
        html += `<div class="report-field"><strong>${key}:</strong> `;
        if (typeof value === 'object') {
          html += `<pre>${JSON.stringify(value, null, 2)}</pre>`;
        } else {
          html += `${value}`;
        }
        html += `</div>`;
      }
      return html;
    }

    return '';
  }

  /**
   * Helper: Check if indicator value is an object
   */
  isIndicatorObject(value: any): boolean {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Helper: Check if indicator has a value property
   */
  hasIndicatorValue(value: any): boolean {
    return value && typeof value === 'object' && value.value !== undefined;
  }

  /**
   * Helper: Get indicator value
   */
  getIndicatorValue(value: any): number {
    if (value && typeof value === 'object' && value.value !== undefined) {
      return parseFloat(value.value) || 0;
    }
    return 0;
  }

  /**
   * Helper: Get indicator unit
   */
  getIndicatorUnit(value: any): string {
    if (value && typeof value === 'object' && value.unit) {
      return value.unit;
    }
    return '';
  }

  /**
   * Get indicator label in Vietnamese
   */
  getIndicatorLabel(key: string): string {
    return this.financialIndicatorLabels[key] || key;
  }

  /**
   * Get indicator tooltip
   */
  getIndicatorTooltip(value: any): string {
    if (value && typeof value === 'object' && value.tooltip) {
      return value.tooltip;
    }
    return '';
  }

  /**
   * Format indicator value with proper formatting
   */
  formatIndicatorValue(key: string, value: any): string {
    if (!value) return '-';
    
    let numValue: number | string;
    
    if (typeof value === 'object' && value.value !== undefined) {
      numValue = value.value;
    } else if (typeof value === 'number' || typeof value === 'string') {
      numValue = value;
    } else {
      return '-';
    }

    // Handle string values (like "15.0%")
    if (typeof numValue === 'string') {
      return numValue;
    }

    // Format based on indicator type
    const percentageIndicators = ['marketShare', 'roe', 'roa', 'grossMargin', 'debtEquityRatio', 
      'profitGrowth', 'inventoryGrowth', 'prepaidBuyerGrowth', 'foreignOwnershipRatio', 
      'foreignHoldingRatio', 'dividendYield', 'nplRatio', 'llr', 'casaRatio', 
      'netInterestMargin', 'lossRatio', 'combineRatio', 'marginLendingGrowth'];
    
    const currencyIndicators = ['totalAssets', 'equity', 'sales', 'capitalization', 'revenue', 'profit'];
    const priceIndicators = ['bookValue', 'eps', 'revenuePerShare'];

    if (percentageIndicators.includes(key)) {
      // Convert decimal to percentage
      if (Math.abs(numValue) < 1) {
        return `${(numValue * 100).toFixed(2)}%`;
      }
      return `${numValue.toFixed(2)}%`;
    }

    if (currencyIndicators.includes(key)) {
      // Format as billion VND
      if (numValue >= 1000000000) {
        return `${(numValue / 1000000000).toFixed(2)} tỷ`;
      } else if (numValue >= 1000000) {
        return `${(numValue / 1000000).toFixed(2)} triệu`;
      }
      return numValue.toLocaleString('vi-VN') + ' đ';
    }

    if (priceIndicators.includes(key)) {
      return numValue.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';
    }

    // Default formatting
    if (Number.isInteger(numValue)) {
      return numValue.toLocaleString('vi-VN');
    }
    return numValue.toFixed(2);
  }

  /**
   * Get key financial indicators (most important ones)
   */
  getKeyFinancialIndicators(): Array<{key: string, label: string, value: string, tooltip: string, isPositive?: boolean}> {
    const indicators = this.getFinancialIndicators();
    if (!indicators) return [];

    // Key indicators to show prominently
    const keyIndicators = [
      'eps', 'pe', 'pb', 'roe', 'roa', 'grossMargin', 'debtEquityRatio', 
      'beta', 'dividendYield', 'dividendRatio', 'profitGrowth', 'marketShare'
    ];

    const result: Array<{key: string, label: string, value: string, tooltip: string, isPositive?: boolean}> = [];

    keyIndicators.forEach(key => {
      if (indicators[key]) {
        const value = indicators[key];
        const formattedValue = this.formatIndicatorValue(key, value);
        if (formattedValue !== '-') {
          const numValue = typeof value === 'object' ? value.value : value;
          let isPositive: boolean | undefined;
          
          // Determine if value is positive/negative for coloring
          if (['roe', 'roa', 'eps', 'grossMargin', 'dividendYield', 'profitGrowth'].includes(key)) {
            isPositive = numValue > 0;
          } else if (['debtEquityRatio'].includes(key)) {
            isPositive = numValue < 0.5; // Low debt is good
          }

          result.push({
            key,
            label: this.getIndicatorLabel(key),
            value: formattedValue,
            tooltip: this.getIndicatorTooltip(value),
            isPositive
          });
        }
      }
    });

    return result;
  }

  /**
   * Get all financial indicators formatted
   */
  getAllFinancialIndicators(): Array<{key: string, label: string, value: string, tooltip: string}> {
    const indicators = this.getFinancialIndicators();
    if (!indicators) return [];

    const result: Array<{key: string, label: string, value: string, tooltip: string}> = [];

    Object.keys(indicators).forEach(key => {
      const value = indicators[key];
      const formattedValue = this.formatIndicatorValue(key, value);
      if (formattedValue !== '-') {
        result.push({
          key,
          label: this.getIndicatorLabel(key),
          value: formattedValue,
          tooltip: this.getIndicatorTooltip(value)
        });
      }
    });

    return result;
  }

  /**
   * Get formatted financial report items
   */
  getFormattedFinancialReport(): Array<{type: string, label: string, value: number, yearValue: number, change: number, changePercent: number}> {
    const report = this.getFinancialReportOverall();
    if (!report || !Array.isArray(report)) return [];

    return report.map((item: any) => {
      const value = item.value || 0;
      const yearValue = item.yearValue || 0;
      const change = value - yearValue;
      const changePercent = yearValue !== 0 ? ((value - yearValue) / Math.abs(yearValue)) * 100 : 0;

      return {
        type: item.type || '',
        label: item.label || item.type || '',
        value,
        yearValue,
        change,
        changePercent
      };
    });
  }

  /**
   * Format large number for display
   */
  formatLargeNumber(num: number): string {
    if (Math.abs(num) >= 1000000000000) {
      return `${(num / 1000000000000).toFixed(2)} nghìn tỷ`;
    }
    if (Math.abs(num) >= 1000000000) {
      return `${(num / 1000000000).toFixed(2)} tỷ`;
    }
    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(2)} triệu`;
    }
    return num.toLocaleString('vi-VN');
  }

  /**
   * Get same sector stocks with full data
   */
  getFormattedSameSectorStocks(): Array<{symbol: string, name: string, shortName?: string, isFetched: boolean}> {
    const symbol = this.selectedSymbol();
    if (!symbol || !symbol.basicInfo?.fullData) {
      return [];
    }

    const fullData = symbol.basicInfo.fullData;
    const sameSectorStocks = fullData['pageProps.sameSectorStocks'];

    if (!sameSectorStocks || !Array.isArray(sameSectorStocks)) {
      return [];
    }

    return sameSectorStocks.map((stock: any) => {
      if (typeof stock === 'string') {
        const foundSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === stock.toUpperCase());
        return {
          symbol: stock.toUpperCase(),
          name: foundSymbol?.name || foundSymbol?.basicInfo?.companyName || '',
          isFetched: foundSymbol?.isFetched || false
        };
      } else if (stock && stock.symbol) {
        const foundSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === stock.symbol.toUpperCase());
        return {
          symbol: stock.symbol.toUpperCase(),
          name: stock.name || stock.companyName || foundSymbol?.name || '',
          shortName: stock.shortName,
          isFetched: foundSymbol?.isFetched || false
        };
      }
      return null;
    }).filter((s): s is {symbol: string, name: string, shortName?: string, isFetched: boolean} => s !== null);
  }

  /**
   * Navigate to related stock
   */
  navigateToStock(stockSymbol: string) {
    const foundSymbol = this.allSymbols().find(s => s.symbol.toUpperCase() === stockSymbol.toUpperCase());
    
    if (foundSymbol) {
      this.viewStockDetail(foundSymbol);
    } else {
      // Stock not in list, try to load it
      const newSymbol: SymbolWithStatus = {
        symbol: stockSymbol.toUpperCase(),
        exchange: 'hose',
        isFetched: false
      };
      
      // Fetch the stock first
      this.fetchSymbol(newSymbol);
      
      // Wait a bit then view
      setTimeout(() => {
        const updated = this.allSymbols().find(s => s.symbol.toUpperCase() === stockSymbol.toUpperCase());
        if (updated) {
          this.viewStockDetail(updated);
        }
      }, 2000);
    }
  }

  /**
   * TrackBy function for virtual scroll optimization
   */
  trackBySymbol(index: number, symbol: SymbolWithStatus): string {
    return symbol.symbol;
  }

  /**
   * Train neural network model with current stock data
   */
  async trainNeuralNetwork() {
    const priceData = this.selectedSymbolPriceData();
    const config = this.trainingConfig();
    const minDataRequired = config.lookbackDays + 50; // Need at least lookback + 50 for training
    
    if (!priceData || !priceData.c || priceData.c.length < minDataRequired) {
      this.nnError.set(`Cần ít nhất ${minDataRequired} ngày dữ liệu giá để huấn luyện mô hình (lookback: ${config.lookbackDays} ngày)`);
      return;
    }

    const symbol = this.selectedSymbol();
    if (!symbol) {
      this.nnError.set('Không tìm thấy mã cổ phiếu');
      return;
    }

    this.isNNTraining.set(true);
    this.nnError.set(null);
    this.nnPrediction.set(null);

    try {
      const prices = priceData.c;

      // Use configurable training parameters
      await this.nnService.trainModel(
        prices,
        config,
        (progress) => {
          this.nnTrainingProgress.set(progress);
        }
      );

      this.isNNReady.set(true);
      this.isNNTraining.set(false);

      // Save weights to API (database)
      try {
        await this.nnService.saveWeights(symbol.symbol).toPromise();
        console.log('✅ Neural network weights saved to database');
        // Update model status
        this.modelStatus.set({ exists: true, hasWeights: true, hasSimulation: this.modelStatus().hasSimulation });
      } catch (saveError) {
        console.error('Error saving weights:', saveError);
        // Don't fail training if save fails
      }

      // Automatically make prediction after training
      await this.predictWithNeuralNetwork();
    } catch (error: any) {
      console.error('Error training neural network:', error);
      this.nnError.set(error.message || 'Lỗi khi huấn luyện mô hình');
      this.isNNTraining.set(false);
    }
  }

  /**
   * Update training configuration
   */
  updateTrainingConfig(updates: Partial<TrainingConfig>) {
    this.trainingConfig.update(config => ({ ...config, ...updates }));
    this.nnService.setTrainingConfig(updates);
  }

  /**
   * Reset training config to defaults
   */
  resetTrainingConfig() {
    this.trainingConfig.set({ ...DEFAULT_TRAINING_CONFIG });
    this.nnService.setTrainingConfig(DEFAULT_TRAINING_CONFIG);
  }

  /**
   * Apply training preset configuration
   * @param preset - 'fast' | 'balanced' | 'accurate'
   */
  applyTrainingPreset(preset: 'fast' | 'balanced' | 'accurate') {
    const presets: Record<string, Partial<TrainingConfig>> = {
      fast: {
        epochs: 30,
        batchSize: 64,
        validationSplit: 0.15,
        lookbackDays: 30,
        forecastDays: 1,
        learningRate: 0.002
      },
      balanced: {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        lookbackDays: 60,
        forecastDays: 1,
        learningRate: 0.001
      },
      accurate: {
        epochs: 100,
        batchSize: 16,
        validationSplit: 0.25,
        lookbackDays: 90,
        forecastDays: 1,
        learningRate: 0.0005
      }
    };

    const presetConfig = presets[preset];
    if (presetConfig) {
      this.trainingConfig.update(config => ({ ...config, ...presetConfig }));
      this.nnService.setTrainingConfig(presetConfig);
    }
  }

  /**
   * Toggle training config panel
   */
  toggleTrainingConfig() {
    this.showTrainingConfig.update(v => !v);
  }

  /**
   * Toggle price table visibility in chart tab
   */
  togglePriceTable() {
    this.showPriceTable.update(v => !v);
  }

  /**
   * Check if model exists in database for current symbol and auto-load if found
   */
  async checkModelExists() {
    const symbol = this.selectedSymbol();
    if (!symbol) return;

    this.isCheckingModel.set(true);
    try {
      this.nnService.checkModelExists(symbol.symbol).subscribe({
        next: async (status) => {
          this.modelStatus.set(status);
          this.isCheckingModel.set(false);
          
          // Auto-load model if exists with weights
          if (status.hasWeights) {
            console.log(`📦 Model found for ${symbol.symbol}, auto-loading...`);
            await this.autoLoadModel();
          }
        },
        error: (error) => {
          console.error('Error checking model:', error);
          this.isCheckingModel.set(false);
        }
      });
    } catch (error) {
      console.error('Error checking model:', error);
      this.isCheckingModel.set(false);
    }
  }

  /**
   * Auto-load model from database (called when opening stock detail)
   */
  async autoLoadModel() {
    const symbol = this.selectedSymbol();
    if (!symbol) return;

    try {
      const loaded = await this.nnService.loadWeights(symbol.symbol);
      if (loaded) {
        this.isNNReady.set(true);
        this.nnError.set(null);
        // Load training config from service after loading weights
        const savedConfig = this.nnService.getTrainingConfig();
        this.trainingConfig.set(savedConfig);
        console.log(`✅ Model for ${symbol.symbol} auto-loaded successfully`);
        console.log(`   Training config: lookback=${savedConfig.lookbackDays}, epochs=${savedConfig.epochs}`);
      }
    } catch (error: any) {
      console.warn('Auto-load model failed:', error.message);
      // Don't show error - user can train manually
    }
  }

  /**
   * Reload data from DNSE API and retrain
   */
  async reloadDataAndRetrain() {
    const symbol = this.selectedSymbol();
    if (!symbol) {
      this.nnError.set('Không tìm thấy mã cổ phiếu');
      return;
    }

    this.isNNTraining.set(true);
    this.nnError.set(null);
    this.nnPrediction.set(null);
    this.isLoadingPrice.set(true);

    try {
      // Reload price data
      await this.fetchPriceDataOnly(this.selectedYears());

      // Wait a bit for data to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if we have enough data
      const priceData = this.selectedSymbolPriceData();
      if (!priceData || !priceData.c || priceData.c.length < 100) {
        this.nnError.set('Dữ liệu mới không đủ (cần ít nhất 100 ngày). Vui lòng chọn nhiều năm hơn.');
        this.isNNTraining.set(false);
        this.isLoadingPrice.set(false);
        return;
      }

      // Train with new data
      await this.trainNeuralNetwork();

      this.isLoadingPrice.set(false);
    } catch (error: any) {
      console.error('Error reloading data and retraining:', error);
      this.nnError.set(error.message || 'Lỗi khi reload và train lại');
      this.isNNTraining.set(false);
      this.isLoadingPrice.set(false);
    }
  }

  /**
   * Load saved neural network weights
   */
  async loadSavedWeights() {
    const symbol = this.selectedSymbol();
    if (!symbol) {
      this.nnError.set('Không tìm thấy mã cổ phiếu');
      return;
    }

    try {
      const loaded = await this.nnService.loadWeights(symbol.symbol);
      if (loaded) {
        this.isNNReady.set(true);
        this.nnError.set(null);
        // Automatically make prediction after loading
        await this.predictWithNeuralNetwork();
      } else {
        this.nnError.set('Không tìm thấy mô hình đã lưu. Vui lòng huấn luyện mô hình trước.');
      }
    } catch (error: any) {
      console.error('Error loading weights:', error);
      this.nnError.set(error.message || 'Lỗi khi load mô hình đã lưu');
    }
  }

  /**
   * Make prediction using neural network
   */
  async predictWithNeuralNetwork() {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || priceData.c.length < 60) {
      this.nnError.set('Cần ít nhất 60 ngày dữ liệu giá để dự đoán');
      return;
    }

    if (!this.nnService.isReady()) {
      this.nnError.set('Mô hình chưa được huấn luyện. Vui lòng huấn luyện trước.');
      return;
    }

    try {
      this.nnError.set(null);
      const prices = priceData.c;
      const prediction = await this.nnService.predict(prices, 30);
      this.nnPrediction.set(prediction);
    } catch (error: any) {
      console.error('Error making prediction:', error);
      this.nnError.set(error.message || 'Lỗi khi dự đoán');
    }
  }

  /**
   * Get prediction vs actual comparison for last 10 days
   */
  async loadPredictionComparison(): Promise<any> {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || !priceData.t || priceData.c.length < 70) {
      this.nnError.set('Cần ít nhất 70 ngày dữ liệu để so sánh (60 ngày để dự đoán + 10 ngày để so sánh)');
      return;
    }

    if (!this.nnService.isReady()) {
      this.nnError.set('Mô hình chưa được huấn luyện. Vui lòng huấn luyện trước.');
      return;
    }

    this.isLoadingComparison.set(true);
    this.nnError.set(null);

    try {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || !priceData.t || priceData.c.length < 70) {
      return null; // Need at least 70 days (60 for lookback + 10 for comparison)
    }

    if (!this.nnService.isReady()) {
      return null;
    }

      const comparisons: Array<{
        date: number;
        dateStr: string;
        predictedPrice: number;
        actualPrice: number;
        error: number;
        errorPercent: number;
      }> = [];

      const prices = priceData.c;
      const timestamps = priceData.t;
      const last10Days = Math.min(10, prices.length - 60);

      // For each of the last 10 days, predict using data up to that point
      for (let i = 0; i < last10Days; i++) {
        const targetIndex = prices.length - last10Days + i;
        const historicalData = prices.slice(0, targetIndex);

        if (historicalData.length < 60) continue;

        try {
          // Predict for the next day (which is the actual price we have)
          const prediction = await this.nnService.predict(historicalData, 1);
          const actualPrice = prices[targetIndex] * 1000; // Convert to VND
          const predictedPrice = prediction.predictedPrice; // Already in VND
          const error = predictedPrice - actualPrice;
          const errorPercent = (error / actualPrice) * 100;

          comparisons.push({
            date: timestamps[targetIndex],
            dateStr: this.formatDateFromTimestamp(timestamps[targetIndex]),
            predictedPrice,
            actualPrice,
            error,
            errorPercent
          });
        } catch (error) {
          console.error(`Error predicting for day ${targetIndex}:`, error);
        }
      }

      // Sort by date (newest first)
      comparisons.sort((a, b) => b.date - a.date);

      this.nnPredictionComparison.set(comparisons.length > 0 ? comparisons : null);
    } catch (error: any) {
      console.error('Error loading prediction comparison:', error);
      this.nnError.set(error.message || 'Lỗi khi so sánh dự đoán');
    } finally {
      this.isLoadingComparison.set(false);
    }
  }

  /**
   * Get neural network status text
   */
  getNNStatusText(): string {
    if (this.isNNTraining()) {
      const progress = this.nnTrainingProgress();
      if (progress) {
        return `Đang huấn luyện... Epoch ${progress.epoch}, Loss: ${progress.loss.toFixed(6)}`;
      }
      return 'Đang huấn luyện...';
    }
    if (this.isNNReady()) {
      return 'Sẵn sàng';
    }
    return 'Chưa huấn luyện';
  }

  /**
   * Get neural network status badge class
   */
  getNNStatusBadgeClass(): string {
    if (this.isNNTraining()) {
      return 'nn-status-training';
    }
    if (this.isNNReady()) {
      return 'nn-status-ready';
    }
    return 'nn-status-pending';
  }

  /**
   * Format prediction price
   * Note: All prices are now normalized to actual VND units (multiplied by 1000)
   * in the neural network service, so we just need to format them here.
   */
  formatPredictionPrice(price: number): string {
    // All prices are already in actual VND units (e.g., 22500 = 22,500 VND)
    return `${price.toLocaleString('vi-VN')} đ`;
  }

  /**
   * Format confidence percentage
   */
  formatConfidence(confidence: number): string {
    return `${(confidence * 100).toFixed(1)}%`;
  }

  /**
   * Get trend icon class
   */
  getTrendIconClass(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up':
        return 'pi pi-arrow-up';
      case 'down':
        return 'pi pi-arrow-down';
      default:
        return 'pi pi-minus';
    }
  }

  /**
   * Get trend color class
   */
  getTrendColorClass(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up':
        return 'trend-up';
      case 'down':
        return 'trend-down';
      default:
        return 'trend-neutral';
    }
  }

  /**
   * Check if there's enough data for training
   */
  hasEnoughDataForTraining(): boolean {
    const priceData = this.selectedSymbolPriceData();
    const config = this.trainingConfig();
    const minDataRequired = config.lookbackDays + 50; // Need at least lookback + 50 for training
    return !!(priceData && priceData.c && priceData.c.length >= minDataRequired);
  }

  /**
   * Get available date range from price data
   */
  getAvailableDateRange(): { minDate: string, maxDate: string } | null {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.t || priceData.t.length === 0) {
      return null;
    }

    const timestamps = priceData.t;
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    const minDate = new Date(minTimestamp * 1000);
    const maxDate = new Date(maxTimestamp * 1000);

    return {
      minDate: this.formatDateForInput(minDate),
      maxDate: this.formatDateForInput(maxDate)
    };
  }

  /**
   * Format date for input[type="date"]
   */
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Initialize date range to full range
   */
  initializeDateRange() {
    const range = this.getAvailableDateRange();
    if (range) {
      if (!this.backtestStartDate()) {
        this.backtestStartDate.set(range.minDate);
      }
      if (!this.backtestEndDate()) {
        this.backtestEndDate.set(range.maxDate);
      }
    }
  }

  /**
   * Filter data by date range
   */
  filterDataByDateRange(
    prices: number[],
    timestamps: number[],
    startDate: string,
    endDate: string
  ): { prices: number[], timestamps: number[] } {
    if (!startDate || !endDate) {
      return { prices, timestamps };
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    const filteredPrices: number[] = [];
    const filteredTimestamps: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= startTimestamp && timestamps[i] <= endTimestamp) {
        filteredTimestamps.push(timestamps[i]);
        filteredPrices.push(prices[i]);
      }
    }

    return { prices: filteredPrices, timestamps: filteredTimestamps };
  }

  /**
   * Run trading simulation
   */
  async runTradingSimulation() {
    const priceData = this.selectedSymbolPriceData();
    if (!priceData || !priceData.c || priceData.c.length < 60) {
      this.nnError.set('Cần ít nhất 60 ngày dữ liệu để chạy mô phỏng');
      return;
    }

    if (!this.nnService.isReady()) {
      this.nnError.set('Mô hình chưa được huấn luyện. Vui lòng huấn luyện trước.');
      return;
    }

    // Validate date range
    const startDate = this.backtestStartDate();
    const endDate = this.backtestEndDate();
    if (!startDate || !endDate) {
      this.nnError.set('Vui lòng chọn vùng ngày để testing');
      return;
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
    if (startTimestamp >= endTimestamp) {
      this.nnError.set('Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
      return;
    }

    this.isRunningSimulation.set(true);
    this.nnError.set(null);

    try {
      // Filter data by date range
      const { prices: filteredPrices, timestamps: filteredTimestamps } =
        this.filterDataByDateRange(priceData.c, priceData.t, startDate, endDate);

      if (filteredPrices.length < 30) {
        this.nnError.set('Vùng ngày được chọn có quá ít dữ liệu (cần ít nhất 30 ngày)');
        this.isRunningSimulation.set(false);
        return;
      }

      // Generate predictions for backtesting
      let basePrediction = this.nnPrediction();
      if (!basePrediction) {
        // If no prediction yet, make one
        await this.predictWithNeuralNetwork();
        basePrediction = this.nnPrediction();
        if (!basePrediction) {
          throw new Error('Không thể tạo dự đoán');
        }
      }

      console.log('[StockApp] Base prediction:', {
        predictedPrice: basePrediction.predictedPrice,
        confidence: basePrediction.confidence,
        trend: basePrediction.trend,
        tradingDecision: basePrediction.tradingDecision
      });

      const predictions = this.tradingSimulationService.generatePredictionsForBacktest(
        filteredPrices,
        filteredTimestamps,
        basePrediction
      );

      console.log('[StockApp] Generated predictions:', predictions.length);
      console.log('[StockApp] Sample predictions:', predictions.slice(0, 5).map(p => ({
        predictedPrice: p.predictedPrice,
        confidence: p.confidence,
        trend: p.trend,
        tradingDecision: p.tradingDecision
      })));

      // Generate signals
      const signals = this.tradingSimulationService.generateSignals(
        filteredPrices,
        filteredTimestamps,
        predictions,
        this.tradingConfig()
      );

      console.log('[StockApp] Generated signals:', signals.length);
      const buySignals = signals.filter(s => s.action === 'buy').length;
      const sellSignals = signals.filter(s => s.action === 'sell').length;
      const holdSignals = signals.filter(s => s.action === 'hold').length;
      console.log(`[StockApp] Signals breakdown: ${buySignals} buy, ${sellSignals} sell, ${holdSignals} hold`);

      // Run simulation
      const result = this.tradingSimulationService.simulateTrading(
        filteredPrices,
        filteredTimestamps,
        signals,
        this.tradingConfig()
      );

      this.tradingResult.set(result);

      // Auto-save simulation result to API
      await this.saveSimulationResult(result, startDate, endDate);
    } catch (error: any) {
      console.error('Error running simulation:', error);
      this.nnError.set(error.message || 'Lỗi khi chạy mô phỏng');
    } finally {
      this.isRunningSimulation.set(false);
    }
  }

  /**
   * Save simulation result to API
   */
  async saveSimulationResult(result: TradingResult, startDate: string, endDate: string) {
    const symbol = this.selectedSymbol()?.symbol;
    if (!symbol) {
      console.warn('No symbol selected, cannot save simulation result');
      return;
    }

    try {
      const payload = {
        simulationResult: result,
        tradingConfig: this.tradingConfig(),
        dateRange: {
          startDate,
          endDate
        }
      };

      this.http.post(`/api/stocks-v2/stock-model/${symbol}`, payload).subscribe({
        next: (response: any) => {
          if (response.success) {
            console.log('Simulation result saved successfully:', response);
          } else {
            console.warn('Failed to save simulation result:', response.error);
          }
        },
        error: (error) => {
          console.error('Error saving simulation result:', error);
        }
      });
    } catch (error: any) {
      console.error('Error in saveSimulationResult:', error);
    }
  }

  /**
   * Load saved simulation result from API
   */
  loadSavedSimulationResult() {
    const symbol = this.selectedSymbol()?.symbol;
    if (!symbol) {
      this.nnError.set('Vui lòng chọn mã cổ phiếu');
      return;
    }

    this.http.get(`/api/stocks-v2/stock-model/${symbol}`).subscribe({
      next: (response: any) => {
        if (response.success && response.data?.simulationResult) {
          this.tradingResult.set(response.data.simulationResult);
          if (response.data.tradingConfig) {
            this.tradingConfig.set(response.data.tradingConfig);
          }
          if (response.data.dateRange) {
            this.backtestStartDate.set(response.data.dateRange.startDate);
            this.backtestEndDate.set(response.data.dateRange.endDate);
          }
          console.log('Simulation result loaded successfully');
        } else {
          this.nnError.set('Không tìm thấy kết quả mô phỏng đã lưu');
        }
      },
      error: (error) => {
        console.error('Error loading simulation result:', error);
        this.nnError.set('Lỗi khi tải kết quả mô phỏng đã lưu');
      }
    });
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return `${amount.toLocaleString('vi-VN')} đ`;
  }

  /**
   * Format date from timestamp (seconds)
   */
  formatDateFromTimestamp(timestamp: number): string {
    // Timestamp is in seconds, convert to milliseconds
    return this.formatDateVN(new Date(timestamp * 1000));
  }

  /**
   * Format date from timestamp for display in info
   */
  formatDateFromTimestampForInfo(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  /**
   * Update trading config
   */
  updateTradingConfig(config: Partial<TradingConfig>) {
    this.tradingConfig.update(current => ({ ...current, ...config }));
  }

  /**
   * Convert number to Vietnamese text
   * Example: 10000000 -> "Mười triệu đồng"
   */
  numberToVietnameseText(num: number): string {
    if (num === 0) return 'Không đồng';
    if (num < 0) return 'Âm ' + this.numberToVietnameseText(-num);

    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

    const readThreeDigits = (n: number, showZeroHundred: boolean = false): string => {
      if (n === 0) return '';
      
      const hundred = Math.floor(n / 100);
      const ten = Math.floor((n % 100) / 10);
      const unit = n % 10;
      
      let result = '';
      
      // Hundreds
      if (hundred > 0 || showZeroHundred) {
        result += digits[hundred] + ' trăm ';
      }
      
      // Tens
      if (ten === 0 && unit > 0 && hundred > 0) {
        result += 'lẻ ';
      } else if (ten === 1) {
        result += 'mười ';
      } else if (ten > 1) {
        result += digits[ten] + ' mươi ';
      }
      
      // Units
      if (unit === 1 && ten > 1) {
        result += 'mốt';
      } else if (unit === 4 && ten > 1) {
        result += 'tư';
      } else if (unit === 5 && ten > 0) {
        result += 'lăm';
      } else if (unit > 0) {
        result += digits[unit];
      }
      
      return result.trim();
    };

    const parts: string[] = [];
    let remaining = num;
    let unitIndex = 0;

    while (remaining > 0) {
      const part = remaining % 1000;
      remaining = Math.floor(remaining / 1000);

      if (part > 0) {
        const text = readThreeDigits(part, unitIndex > 0 && remaining > 0);
        if (text) {
          parts.unshift(text + (units[unitIndex] ? ' ' + units[unitIndex] : ''));
        }
      } else if (unitIndex > 0 && remaining > 0) {
        // Handle zeros in between (e.g., 1,000,000 should not skip "nghìn")
      }

      unitIndex++;
    }

    let result = parts.join(' ').trim();
    
    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);
    
    return result + ' đồng';
  }

  /**
   * Get Vietnamese text for initial capital
   */
  getInitialCapitalText(): string {
    const capital = this.tradingConfig().initialCapital;
    return this.numberToVietnameseText(capital);
  }

  /**
   * Parse capital input (remove formatting)
   */
  parseCapitalInput(value: string): number {
    // Remove all non-digit characters
    const cleaned = value.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  /**
   * Format capital input on blur
   */
  formatCapitalInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.tradingConfig().initialCapital;
    input.value = value.toLocaleString('vi-VN');
  }

  /**
   * Get formatted min date for display
   */
  getFormattedMinDate(): string {
    const range = this.getAvailableDateRange();
    if (!range) return '';
    const timestamp = Math.floor(new Date(range.minDate).getTime() / 1000);
    return this.formatDateFromTimestampForInfo(timestamp);
  }

  /**
   * Get formatted max date for display
   */
  getFormattedMaxDate(): string {
    const range = this.getAvailableDateRange();
    if (!range) return '';
    const timestamp = Math.floor(new Date(range.maxDate).getTime() / 1000);
    return this.formatDateFromTimestampForInfo(timestamp);
  }

  /**
   * Get CSS class for comparison table row based on error percentage
   */
  getComparisonRowClass(errorPercent: number): string {
    const absError = Math.abs(errorPercent);
    if (absError < 2) return 'good';
    if (absError < 5) return 'moderate';
    return 'poor';
  }

  /**
   * Convert trades to transactions (separate buy and sell)
   */
  getTransactions(): Transaction[] {
    const result = this.tradingResult();
    if (!result || !result.trades || result.trades.length === 0) {
      return [];
    }

    // Create a list of all events (buy and sell) sorted by date
    interface TradeEvent {
      type: 'buy' | 'sell';
      date: number;
      quantity: number;
      price: number;
      trade: typeof result.trades[0];
    }

    const events: TradeEvent[] = [];
    
    for (const trade of result.trades) {
      events.push({
        type: 'buy',
        date: trade.buyDate,
        quantity: trade.quantity,
        price: trade.buyPrice,
        trade
      });
      events.push({
        type: 'sell',
        date: trade.sellDate,
        quantity: trade.quantity,
        price: trade.sellPrice,
        trade
      });
    }

    // Sort by date
    events.sort((a, b) => a.date - b.date);

    // Process events to calculate running totals
    const transactions: Transaction[] = [];
    let totalShares = 0;
    let totalCost = 0; // Total cost of shares held (for avg price calculation)

    for (const event of events) {
      const trade = event.trade;
      const totalSharesBefore = totalShares;
      const avgPriceBefore = totalShares > 0 ? totalCost / totalShares : 0;

      if (event.type === 'buy') {
        // Calculate new totals after buy
        totalShares += event.quantity;
        totalCost += event.price * event.quantity;
        const avgPriceAfter = totalShares > 0 ? totalCost / totalShares : 0;

        transactions.push({
          type: 'buy',
          date: event.date,
          dateStr: this.formatDateFromTimestamp(event.date),
          quantity: event.quantity,
          price: event.price,
          capitalBefore: trade.buyCapital,
          transactionAmount: event.price * event.quantity,
          capitalAfter: trade.buyCapital - (event.price * event.quantity),
          totalSharesBefore,
          totalSharesAfter: totalShares,
          avgPriceAfter
        });
      } else {
        // Calculate new totals after sell
        // When selling, we reduce total cost proportionally
        const costReduction = avgPriceBefore * event.quantity;
        totalShares -= event.quantity;
        totalCost -= costReduction;
        if (totalShares <= 0) {
          totalShares = 0;
          totalCost = 0;
        }
        const avgPriceAfter = totalShares > 0 ? totalCost / totalShares : 0;

        transactions.push({
          type: 'sell',
          date: event.date,
          dateStr: this.formatDateFromTimestamp(event.date),
          quantity: event.quantity,
          price: event.price,
          capitalBefore: trade.sellCapital,
          transactionAmount: event.price * event.quantity,
          capitalAfter: trade.sellCapital + (event.price * event.quantity),
          totalSharesBefore,
          totalSharesAfter: totalShares,
          avgPriceAfter,
          holdingDays: trade.duration
        });
      }
    }

    return transactions;
  }

  /**
   * Get average error from comparison data
   */
  getAverageError(): number {
    const comparison = this.nnPredictionComparison();
    if (!comparison || comparison.length === 0) return 0;
    return comparison.reduce((sum, c) => sum + c.error, 0) / comparison.length;
  }

  /**
   * Get average absolute error percentage from comparison data
   */
  getAverageErrorPercent(): number {
    const comparison = this.nnPredictionComparison();
    if (!comparison || comparison.length === 0) return 0;
    return comparison.reduce((sum, c) => sum + Math.abs(c.errorPercent), 0) / comparison.length;
  }

  /**
   * Get CSS class for average error percentage
   */
  getAverageErrorClass(): string {
    const avgError = this.getAverageErrorPercent();
    if (avgError < 3) return 'good';
    if (avgError < 5) return 'moderate';
    return 'poor';
  }

  /**
   * Get recent week analysis (last 7 days)
   */
  getRecentWeekAnalysis() {
    const result = this.tradingResult();
    const priceData = this.selectedSymbolPriceData();
    if (!result || !priceData || !priceData.t || !priceData.c) {
      return null;
    }

    const now = Date.now() / 1000; // Current timestamp in seconds
    const sevenDaysAgo = now - (7 * 24 * 60 * 60); // 7 days ago

    // Filter trades from last 7 days
    const recentTrades = result.trades.filter(trade => {
      return trade.buyDate >= sevenDaysAgo || trade.sellDate >= sevenDaysAgo;
    });

    // Get buy positions (trades that were bought in last 7 days)
    const buyPositions = recentTrades
      .filter(trade => trade.buyDate >= sevenDaysAgo)
      .map(trade => {
        const sellTrade = result.trades.find(t =>
          t.buyDate === trade.buyDate && t.sellDate > trade.buyDate
        );
        return {
          buyDate: trade.buyDate,
          buyPrice: trade.buyPrice,
          quantity: trade.quantity,
          sellDate: sellTrade?.sellDate,
          sellPrice: sellTrade?.sellPrice,
          currentPrice: priceData.c[priceData.c.length - 1] * 1000, // Convert to actual VND
          profit: sellTrade ? sellTrade.profit : null,
          profitPercent: sellTrade ? sellTrade.profitPercent : null,
          status: sellTrade ? 'sold' : 'holding'
        };
      });

    // Get sell positions (trades that were sold in last 7 days)
    const sellPositions = recentTrades
      .filter(trade => trade.sellDate >= sevenDaysAgo && trade.buyDate < sevenDaysAgo)
      .map(trade => ({
        buyDate: trade.buyDate,
        buyPrice: trade.buyPrice,
        sellDate: trade.sellDate,
        sellPrice: trade.sellPrice,
        quantity: trade.quantity,
        profit: trade.profit,
        profitPercent: trade.profitPercent,
        expectedBuyPrice: trade.buyPrice // Giá mua kỳ vọng
      }));

    // Get today's recommendation
        const todayRecommendation = this.nnPrediction();
        const todaySignal = todayRecommendation?.tradingDecision;

        // Convert current price from database units to actual VND units
        const currentPriceDb = priceData.c[priceData.c.length - 1];
        const currentPriceActual = currentPriceDb * 1000; // Convert to actual VND

        return {
          buyPositions,
          sellPositions,
          todayRecommendation: todaySignal ? {
            action: todaySignal.action,
            confidence: todaySignal.confidence,
            reason: todaySignal.reason,
            predictedPrice: todayRecommendation.predictedPrice,
            currentPrice: currentPriceActual
          } : null,
      totalBuyPositions: buyPositions.length,
      totalSellPositions: sellPositions.length
    };
  }

  /**
   * Check if date is today
   */
  isToday(timestamp: number): boolean {
    const today = new Date();
    const date = new Date(timestamp * 1000);
    return date.toDateString() === today.toDateString();
  }
}

