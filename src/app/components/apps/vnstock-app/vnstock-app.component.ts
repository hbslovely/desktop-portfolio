import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FireantService, StockData, Industry, SymbolFundamental, SymbolInfo, SymbolPost, HistoricalQuote, InstitutionProfile, MacroIndicator, TopMover } from '../../../services/fireant.service';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

type TabType = 'movers' | 'market' | 'industries' | 'fundamentals';
type MarketSubView = 'macro' | 'contributors' | 'topMovers';

@Component({
  selector: 'app-vnstock-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vnstock-app.component.html',
  styleUrls: ['./vnstock-app.component.scss']
})
export class VnstockAppComponent implements OnInit, OnDestroy {
  // Tab management
  activeTab: TabType = 'market';
  tabs = [
    { id: 'market' as TabType, name: 'Thị trường', icon: '📈' },
    { id: 'movers' as TabType, name: 'Danh Sách CP', icon: '📋' },
    { id: 'industries' as TabType, name: 'Ngành', icon: '🏢' },
    { id: 'fundamentals' as TabType, name: 'Cơ Bản', icon: '📊' }
  ];

  // Market sub-view management
  activeMarketView: MarketSubView = 'contributors';
  marketViews = [
    { id: 'macro' as MarketSubView, name: 'Dữ liệu vĩ mô', icon: '🌐' },
    { id: 'contributors' as MarketSubView, name: 'Top đóng góp', icon: '🔝' },
    { id: 'topMovers' as MarketSubView, name: 'Top biến động', icon: '⚡' }
  ];

  // Common data
  stocks: StockData[] = [];
  filteredStocks: StockData[] = [];
  loading = false;
  error = '';
  searchTerm = '';
  sortColumn: keyof StockData = 'symbol';
  sortDirection: 'asc' | 'desc' = 'asc';
  autoRefresh = true;
  lastUpdate: Date | null = null;
  
  // Exchange/Index selection
  selectedExchange = 'HOSE'; // For movers and contributors
  selectedContributorType = 1; // 1: Đóng góp tăng index, 2: Đóng góp giảm index
  contributorTypes = [
    { code: 1, name: 'Đóng góp tăng', icon: '📈' },
    { code: 2, name: 'Đóng góp giảm', icon: '📉' }
  ];

  // Macro indicators
  macroIndicators: MacroIndicator[] = [];
  filteredMacroIndicators: MacroIndicator[] = [];

  // Top movers
  topMovers: TopMover[] = [];
  filteredTopMovers: TopMover[] = [];
  selectedMoverTopType: string = 'Gainers'; // 'Gainers', 'Losers', 'Actives'
  selectedMoverExchange: string = ''; // '', 'HSX', 'HNX', 'UPCOM'
  selectedMoverSecurityType: string = 'stock'; // 'stock', 'warrant', 'crypto'
  
  moverTopTypes = [
    { code: 'Gainers', name: 'Tăng mạnh', icon: '📈' },
    { code: 'Losers', name: 'Giảm mạnh', icon: '📉' },
    { code: 'Actives', name: 'Giao dịch khủng', icon: '🔥' }
  ];
  
  moverExchanges = [
    { code: '', name: 'Tất cả', icon: '🌐' },
    { code: 'HSX', name: 'HSX', icon: '🏢' },
    { code: 'HNX', name: 'HNX', icon: '🏛️' },
    { code: 'UPCOM', name: 'UPCOM', icon: '📊' }
  ];
  
  moverSecurityTypes = [
    { code: 'stock', name: 'Cổ phiếu', icon: '📈' },
    { code: 'warrant', name: 'Chứng quyền', icon: '📜' }
  ];
  
  exchanges = [
    { code: 'HSX', name: 'HSX', description: 'Sở Giao dịch Chứng khoán TP.HCM' },
    { code: 'HNX', name: 'HNX', description: 'Sở Giao dịch Chứng khoán Hà Nội' },
    { code: 'UPCOM', name: 'UPCOM', description: 'Thị trường Cổ phiếu chưa niêm yết' }
  ];
  
  // Industries tab
  industries: Industry[] = [];
  filteredIndustries: Industry[] = [];
  selectedIndustry: Industry | null = null;
  industrySearchTerm = '';
  
  // Fundamentals tab - Enhanced with multiple data sources
  fundamentalSymbol = '';
  fundamentalData: SymbolFundamental | null = null;
  symbolInfo: SymbolInfo | null = null;
  symbolPosts: SymbolPost[] = [];
  historicalQuotes: HistoricalQuote[] = [];
  institutionProfile: InstitutionProfile | null = null;
  fundamentalLoading = false;
  
  // Historical data settings
  historicalDays = 30; // Last 30 days by default
  
  private destroy$ = new Subject<void>();

  constructor(private fireantService: FireantService) {}

  ngOnInit() {
    this.initializeApp();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async initializeApp() {
    this.loading = true;
    this.error = '';

    try {
      // Login anonymously first
      await this.fireantService.loginAnonymous().toPromise();
      
      // Load data based on active tab
      await this.loadTabData();
      
      // Setup auto-refresh every 30 seconds
      if (this.autoRefresh) {
        interval(30000)
          .pipe(
            takeUntil(this.destroy$)
          )
          .subscribe(
            () => {
              this.loadTabData();
            },
            error => {
              console.error('Auto-refresh error:', error);
            }
          );
      }
    } catch (error) {
      this.error = 'Không thể kết nối đến FireAnt API. Vui lòng kiểm tra kết nối mạng và thử lại.';
      console.error('Initialization error:', error);
      this.stocks = [];
      this.filteredStocks = [];
    } finally {
      this.loading = false;
    }
  }

  async loadTabData() {
    switch (this.activeTab) {
      case 'market':
        await this.loadMarketData();
        break;
      case 'movers':
        await this.loadStockData();
        break;
      case 'industries':
        await this.loadIndustries();
        break;
      case 'fundamentals':
        // Don't auto-load, user needs to search
        break;
    }
  }

  async loadMarketData() {
    switch (this.activeMarketView) {
      case 'macro':
        await this.loadMacroIndicators();
        break;
      case 'contributors':
        await this.loadTopContributors();
        break;
      case 'topMovers':
        await this.loadTopMovers();
        break;
    }
  }

  switchMarketView(view: MarketSubView) {
    this.activeMarketView = view;
    this.error = '';
    this.loadMarketData();
  }

  switchTab(tab: TabType) {
    this.activeTab = tab;
    this.error = '';
    this.loadTabData();
  }

  async loadStockData(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    try {
      console.log(`Loading stock data for ${this.selectedExchange}...`);
      const stocks = await this.fireantService.getStockMarketData(this.selectedExchange).toPromise();
      
      if (!stocks || stocks.length === 0) {
        this.error = `Không tìm thấy dữ liệu cho sàn ${this.selectedExchange}. API có thể đang bảo trì.`;
        this.stocks = [];
        this.filteredStocks = [];
      } else {
        this.stocks = stocks;
        this.filteredStocks = [...this.stocks];
        this.lastUpdate = new Date();
        console.log(`✅ Loaded ${stocks.length} stocks successfully`);
      }
    } catch (error: any) {
      if (error.status === 401 || error.status === 403) {
        this.error = 'Lỗi xác thực. Đang thử đăng nhập lại...';
        // Try to re-login
        try {
          await this.fireantService.loginAnonymous().toPromise();
          // Retry loading data
          await this.loadStockData();
          return;
        } catch (loginError) {
          this.error = 'Không thể đăng nhập vào FireAnt API. Vui lòng thử lại sau.';
        }
      } else if (error.status === 0) {
        this.error = 'Không thể kết nối đến FireAnt API. Kiểm tra kết nối mạng.';
      } else {
        this.error = `Lỗi khi tải dữ liệu cổ phiếu (${error.status || 'Unknown'}). Vui lòng thử lại.`;
      }
      console.error('Error loading stock data:', error);
      this.stocks = [];
      this.filteredStocks = [];
    } finally {
      this.loading = false;
    }
  }

  async changeExchange(exchange: string) {
    this.selectedExchange = exchange;
    if (this.activeTab === 'movers') {
      await this.loadStockData();
    } else if (this.activeTab === 'market' && this.activeMarketView === 'contributors') {
      await this.loadTopContributors();
    }
  }

  async changeContributorType(type: number) {
    this.selectedContributorType = type;
    await this.loadTopContributors();
  }

  async changeMoverTopType(topType: string) {
    this.selectedMoverTopType = topType;
    await this.loadTopMovers();
  }

  async changeMoverExchange(exchange: string) {
    this.selectedMoverExchange = exchange;
    await this.loadTopMovers();
  }

  async changeMoverSecurityType(type: string) {
    this.selectedMoverSecurityType = type;
    await this.loadTopMovers();
  }

  async loadMacroIndicators(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    try {
      console.log('Loading macro indicators...');
      const indicators = await this.fireantService.getMacroIndicators().toPromise();
      
      if (!indicators || indicators.length === 0) {
        this.error = 'Không tìm thấy dữ liệu vĩ mô.';
        this.macroIndicators = [];
        this.filteredMacroIndicators = [];
      } else {
        this.macroIndicators = indicators;
        this.filteredMacroIndicators = [...this.macroIndicators];
        this.lastUpdate = new Date();
        console.log(`✅ Loaded ${indicators.length} macro indicators`);
      }
    } catch (error: any) {
      this.handleApiError(error);
    } finally {
      this.loading = false;
    }
  }

  async loadTopMovers(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    try {
      console.log(`Loading top movers (${this.selectedMoverTopType}, ${this.selectedMoverExchange || 'ALL'}, ${this.selectedMoverSecurityType})...`);
      const movers = await this.fireantService.getTopMovers(
        this.selectedMoverExchange,
        this.selectedMoverSecurityType,
        this.selectedMoverTopType,
        20
      ).toPromise();
      
      if (!movers || movers.length === 0) {
        this.error = `Không tìm thấy dữ liệu cho ${this.getMoverTopTypeName()}.`;
        this.topMovers = [];
        this.filteredTopMovers = [];
      } else {
        this.topMovers = movers;
        this.filteredTopMovers = [...this.topMovers];
        this.lastUpdate = new Date();
        console.log(`✅ Loaded ${movers.length} top movers`);
      }
    } catch (error: any) {
      this.handleApiError(error);
    } finally {
      this.loading = false;
    }
  }

  getMoverTopTypeName(): string {
    const type = this.moverTopTypes.find(t => t.code === this.selectedMoverTopType);
    return type ? type.name : 'N/A';
  }

  getMoverExchangeName(): string {
    const exchange = this.moverExchanges.find(e => e.code === this.selectedMoverExchange);
    return exchange ? exchange.name : 'N/A';
  }

  getMoverSecurityTypeName(): string {
    const type = this.moverSecurityTypes.find(t => t.code === this.selectedMoverSecurityType);
    return type ? type.name : 'N/A';
  }

  async loadTopContributors(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    try {
      console.log(`Loading top contributors for ${this.selectedExchange} (type: ${this.selectedContributorType})...`);
      const stocks = await this.fireantService.getTopContributors(this.selectedExchange, this.selectedContributorType, 20).toPromise();
      
      if (!stocks || stocks.length === 0) {
        this.error = `Không tìm thấy dữ liệu cho sàn ${this.selectedExchange}.`;
        this.stocks = [];
        this.filteredStocks = [];
      } else {
        this.stocks = stocks;
        this.filteredStocks = [...this.stocks];
        this.lastUpdate = new Date();
        console.log(`✅ Loaded ${stocks.length} top contributors`);
      }
    } catch (error: any) {
      this.handleApiError(error);
    } finally {
      this.loading = false;
    }
  }

  async loadIndustries(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    try {
      console.log('Loading industries...');
      const industries = await this.fireantService.getIndustries().toPromise();
      
      if (!industries || industries.length === 0) {
        this.error = 'Không tìm thấy dữ liệu ngành.';
        this.industries = [];
        this.filteredIndustries = [];
      } else {
        this.industries = industries;
        this.filteredIndustries = [...this.industries];
        this.lastUpdate = new Date();
        console.log(`✅ Loaded ${industries.length} industries`);
      }
    } catch (error: any) {
      this.handleApiError(error);
    } finally {
      this.loading = false;
    }
  }

  async selectIndustry(industry: Industry) {
    console.log('🔍 Selecting industry CODE:', industry.icbCode);
    console.log('🔍 Selecting industry NAME:', industry.icbName);
    console.log('🔍 Previous selected CODE:', this.selectedIndustry?.icbCode);
    console.log('🔍 Full industry object:', industry);
    
    this.selectedIndustry = industry;
    this.loading = true;
    
    try {
      console.log(`Loading stocks for industry: ${industry.icbName}`);
      const stocks = await this.fireantService.getSymbolsByIndustry(industry.icbCode).toPromise();
      
      this.stocks = stocks || [];
      this.filteredStocks = [...this.stocks];
      console.log(`✅ Loaded ${stocks?.length || 0} stocks in industry`);
    } catch (error: any) {
      this.error = `Lỗi khi tải cổ phiếu trong ngành ${industry.icbName}`;
      console.error('Error loading industry stocks:', error);
      this.stocks = [];
      this.filteredStocks = [];
    } finally {
      this.loading = false;
    }
  }

  isIndustrySelected(industry: Industry): boolean {
    if (!this.selectedIndustry) {
      return false;
    }
    
    // Ensure both have valid icbCode
    if (!this.selectedIndustry.icbCode || !industry.icbCode) {
      console.warn('⚠️ Missing icbCode in comparison:', {
        selected: this.selectedIndustry,
        current: industry
      });
      return false;
    }
    
    const isSelected = this.selectedIndustry.icbCode === industry.icbCode;
    
    // Debug log for each comparison
    if (isSelected) {
      console.log('✅ Match found:', industry.icbCode, industry.icbName);
    }
    
    return isSelected;
  }

  filterIndustries() {
    if (!this.industrySearchTerm.trim()) {
      this.filteredIndustries = [...this.industries];
    } else {
      const term = this.industrySearchTerm.toLowerCase();
      this.filteredIndustries = this.industries.filter(industry =>
        industry.icbName.toLowerCase().includes(term) ||
        industry.icbCode.toLowerCase().includes(term)
      );
    }
  }

  async searchFundamental() {
    if (!this.fundamentalSymbol.trim()) {
      this.error = 'Vui lòng nhập mã cổ phiếu';
      return;
    }

    this.fundamentalLoading = true;
    this.error = '';
    
    // Reset all data
    this.fundamentalData = null;
    this.symbolInfo = null;
    this.symbolPosts = [];
    this.historicalQuotes = [];
    this.institutionProfile = null;
    
    try {
      const symbol = this.fundamentalSymbol.trim().toUpperCase();
      console.log(`🔍 Searching comprehensive data for ${symbol}...`);
      
      // Calculate date range for historical data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - this.historicalDays);
      
      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };
      
      // Fetch all data in parallel
      const [
        fundamental,
        symbolInfoData,
        posts,
        historical,
        institution
      ] = await Promise.allSettled([
        this.fireantService.getSymbolFundamental(symbol).toPromise(),
        this.fireantService.getSymbolInfo(symbol).toPromise(),
        this.fireantService.getSymbolPosts(symbol, 10).toPromise(),
        this.fireantService.getHistoricalQuotes(symbol, formatDate(startDate), formatDate(endDate)).toPromise(),
        this.fireantService.getInstitutionProfile(symbol).toPromise()
      ]);
      
      // Handle fundamental data
      if (fundamental.status === 'fulfilled' && fundamental.value) {
        this.fundamentalData = fundamental.value;
        console.log('✅ Fundamental data loaded');
      }
      
      // Handle symbol info
      if (symbolInfoData.status === 'fulfilled' && symbolInfoData.value) {
        this.symbolInfo = symbolInfoData.value;
        console.log('✅ Symbol info loaded');
      }
      
      // Handle posts
      if (posts.status === 'fulfilled' && posts.value) {
        this.symbolPosts = posts.value;
        console.log(`✅ Loaded ${this.symbolPosts.length} posts`);
      }
      
      // Handle historical quotes
      if (historical.status === 'fulfilled' && historical.value) {
        this.historicalQuotes = historical.value;
        console.log(`✅ Loaded ${this.historicalQuotes.length} historical quotes`);
      }
      
      // Handle institution profile
      if (institution.status === 'fulfilled' && institution.value) {
        this.institutionProfile = institution.value;
        console.log('✅ Institution profile loaded');
      }
      
      // Check if we got at least some data
      const hasAnyData = this.fundamentalData || this.symbolInfo || 
                         this.symbolPosts.length > 0 || 
                         this.historicalQuotes.length > 0 || 
                         this.institutionProfile;
      
      if (!hasAnyData) {
        this.error = `Không tìm thấy thông tin cho mã ${symbol}`;
      } else {
        // Calculate price change from historical data if needed
        this.calculatePriceChangeFromHistory();
      }
      
    } catch (error: any) {
      this.error = `Không tìm thấy thông tin cho mã ${this.fundamentalSymbol}`;
      console.error('Error loading fundamental data:', error);
    } finally {
      this.fundamentalLoading = false;
    }
  }

  private handleApiError(error: any) {
    if (error.status === 401 || error.status === 403) {
      this.error = 'Lỗi xác thực. Đang thử đăng nhập lại...';
      this.fireantService.loginAnonymous().toPromise().then(() => {
        this.loadTabData();
      }).catch(() => {
        this.error = 'Không thể đăng nhập vào FireAnt API. Vui lòng thử lại sau.';
      });
    } else if (error.status === 0) {
      this.error = 'Không thể kết nối đến FireAnt API. Kiểm tra kết nối mạng.';
    } else {
      this.error = `Lỗi khi tải dữ liệu (${error.status || 'Unknown'}). Vui lòng thử lại.`;
    }
    console.error('API Error:', error);
    this.stocks = [];
    this.filteredStocks = [];
  }

  filterStocks() {
    if (!this.searchTerm.trim()) {
      this.filteredStocks = [...this.stocks];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredStocks = this.stocks.filter(stock =>
        stock.symbol.toLowerCase().includes(term) ||
        stock.name.toLowerCase().includes(term)
      );
    }
  }

  onSearch() {
    this.filterStocks();
  }

  sortBy(column: keyof StockData) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredStocks.sort((a, b) => {
      const aValue = a[column];
      const bValue = b[column];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return this.sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  }

  getPriceChangeClass(change: number): string {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatPercent(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      // Restart auto-refresh
      this.ngOnInit();
    }
  }

  async refresh() {
    await this.loadStockData();
  }

  getSortIcon(column: keyof StockData): string {
    if (this.sortColumn !== column) return '⇅';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  getSelectedExchangeName(): string {
    const exchange = this.exchanges.find(e => e.code === this.selectedExchange);
    return exchange ? exchange.name : 'N/A';
  }

  getSelectedContributorTypeName(): string {
    const type = this.contributorTypes.find(t => t.code === this.selectedContributorType);
    return type ? type.name : 'N/A';
  }

  formatCurrency(value: number): string {
    if (!value) return '0';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }

  formatMarketCap(value: number): string {
    if (!value) return 'N/A';
    if (value >= 1000000000000) {
      return `${(value / 1000000000000).toFixed(2)} Nghìn tỷ`;
    } else if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(2)} Tỷ`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} Triệu`;
    }
    return value.toLocaleString('vi-VN');
  }

  formatRatio(value: number): string {
    if (!value && value !== 0) return 'N/A';
    return value.toFixed(2);
  }

  // TrackBy functions for performance
  trackByIndustryCode(index: number, industry: Industry): string {
    return industry.icbCode;
  }

  trackByStockSymbol(index: number, stock: StockData): string {
    return stock.symbol;
  }

  // Format post date
  formatPostDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN');
  }

  // Format date for historical data (DD/MM/YYYY)
  formatHistoricalDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Format ownership percentage (2 decimal places)
  formatOwnership(value: number | undefined): string {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(2);
  }

  // Decode HTML entities
  decodeHtml(html: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  // Convert text to HTML paragraphs
  textToHtml(text: string | undefined): string {
    if (!text) return '';
    const decoded = this.decodeHtml(text);
    return decoded.split('\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('');
  }

  // Navigate to stock detail (fundamentals tab)
  viewStockDetail(symbol: string) {
    this.activeTab = 'fundamentals';
    this.fundamentalSymbol = symbol;
    this.searchFundamental();
  }

  // Calculate price change from historical data if not available
  calculatePriceChangeFromHistory(): void {
    if (this.symbolInfo && this.historicalQuotes.length >= 2) {
      // Get today's close price (most recent)
      const todayQuote = this.historicalQuotes[0];
      const todayClose = todayQuote.close || todayQuote.priceBasic?.close || 0;
      
      // Get yesterday's close price (previous day)
      const yesterdayQuote = this.historicalQuotes[1];
      const yesterdayClose = yesterdayQuote.close || yesterdayQuote.priceBasic?.close || 0;
      
      // If we don't have change data, calculate from historical data
      if ((!this.symbolInfo.priceChange || this.symbolInfo.priceChange === 0) && yesterdayClose > 0 && todayClose > 0) {
        this.symbolInfo.lastPrice = todayClose; // Update last price to today's close
        this.symbolInfo.priceChange = todayClose - yesterdayClose;
        this.symbolInfo.perPriceChange = ((todayClose - yesterdayClose) / yesterdayClose) * 100;
        
        console.log(`📊 Calculated price from history: Today=${todayClose}, Yesterday=${yesterdayClose}, Change=${this.symbolInfo.priceChange} (${this.symbolInfo.perPriceChange.toFixed(2)}%)`);
      }
    }
  }

  // Get current price info with calculated change from historical data
  getCurrentPriceInfo() {
    if (!this.symbolInfo) return null;
    
    let lastPrice = this.symbolInfo.lastPrice || 0;
    let priceChange = this.symbolInfo.priceChange || 0;
    let perPriceChange = this.symbolInfo.perPriceChange || 0;
    
    // Always prioritize historical data if available (need at least 2 days to compare)
    if (this.historicalQuotes.length >= 2) {
      const todayQuote = this.historicalQuotes[0];
      const todayClose = todayQuote.close || todayQuote.priceBasic?.close || 0;
      
      const yesterdayQuote = this.historicalQuotes[1];
      const yesterdayClose = yesterdayQuote.close || yesterdayQuote.priceBasic?.close || 0;
      
      if (todayClose > 0 && yesterdayClose > 0) {
        // Use today's close price as the current price
        lastPrice = todayClose;
        // Calculate change: today's close - yesterday's close
        priceChange = todayClose - yesterdayClose;
        // Calculate percent change based on yesterday's close
        perPriceChange = ((todayClose - yesterdayClose) / yesterdayClose) * 100;
        
        console.log(`📊 Using historical data: Today=${todayClose}, Yesterday=${yesterdayClose}, Change=${priceChange}, %=${perPriceChange.toFixed(2)}`);
      }
    } else if (this.historicalQuotes.length === 1) {
      // If only today's data is available, use open price for comparison
      const todayQuote = this.historicalQuotes[0];
      const todayClose = todayQuote.close || todayQuote.priceBasic?.close || 0;
      const todayOpen = todayQuote.open || todayQuote.priceBasic?.open || 0;
      
      if (todayClose > 0 && todayOpen > 0) {
        lastPrice = todayClose;
        priceChange = todayClose - todayOpen;
        perPriceChange = ((todayClose - todayOpen) / todayOpen) * 100;
        
        console.log(`📊 Only today's data available: Close=${todayClose}, Open=${todayOpen}, Change=${priceChange}`);
      }
    }
    
    return {
      lastPrice,
      priceChange,
      perPriceChange
    };
  }

  // Get current volume from historical data if not available
  getCurrentVolume(): number {
    if (!this.symbolInfo) return 0;
    
    let volume = this.symbolInfo.totalVolume || 0;
    
    // If no volume data and we have historical quotes, get from latest quote
    if ((!volume || volume === 0) && this.historicalQuotes.length > 0) {
      const latestQuote = this.historicalQuotes[0];
      volume = latestQuote.volume || latestQuote.priceBasic?.volume || 0;
      
      if (volume > 0) {
        console.log(`📊 Got volume from historical data: ${volume}`);
      }
    }
    
    return volume;
  }

  // Get change class for tagged symbols
  getChangeClass(change: number | undefined): string {
    if (!change && change !== 0) return 'change-neutral';
    if (change > 0) return 'change-up';
    if (change < 0) return 'change-down';
    return 'change-neutral';
  }

  // Format change value
  formatChange(change: number | undefined): string {
    if (change === undefined || change === null) return '';
    if (!change && change !== 0) return '';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  }
}

