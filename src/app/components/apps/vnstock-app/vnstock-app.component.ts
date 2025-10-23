import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FireantService, StockData, SymbolFundamental, SymbolInfo, SymbolPost, HistoricalQuote, InstitutionProfile, SearchResult, SymbolEvent, MacroDataType, MacroDataInfo, SymbolHolder } from '../../../services/fireant.service';
import { Subject, interval } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormatNumberVNPipe } from '../../../pipes/format-number-vn.pipe';

type TabType = 'search' | 'macro';

@Component({
  selector: 'app-vnstock-app',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatNumberVNPipe],
  templateUrl: './vnstock-app.component.html',
  styleUrls: ['./vnstock-app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VnstockAppComponent implements OnInit, OnDestroy {
  // Tab management
  activeTab: TabType = 'search';
  tabs = [
    { id: 'search' as TabType, name: 'Tìm kiếm', icon: '🔍' },
    { id: 'macro' as TabType, name: 'Vĩ mô', icon: '🌐' }
  ];

  // Common data
  stocks: StockData[] = [];
  filteredStocks: StockData[] = [];
  loading = false;
  error = '';
  autoRefresh = true;
  lastUpdate: Date | null = null;

  // Macro data
  macroDataTypes: MacroDataType[] = [];
  selectedMacroType: string = '';
  macroDataInfo: MacroDataInfo[] = [];
  filteredMacroDataInfo: MacroDataInfo[] = [];
  macroSearchTerm = '';

  // Search/Fundamentals tab - Enhanced with multiple data sources
  fundamentalSymbol = '';
  fundamentalData: SymbolFundamental | null = null;
  symbolInfo: SymbolInfo | null = null;
  symbolPosts: SymbolPost[] = [];
  symbolEvents: SymbolEvent[] = [];
  symbolHolders: SymbolHolder[] = [];
  historicalQuotes: HistoricalQuote[] = [];
  institutionProfile: InstitutionProfile | null = null;
  fundamentalLoading = false;

  // Historical data settings
  historicalDays = 30; // Last 30 days by default

  // Search autocomplete
  searchResults: SearchResult[] = [];
  showSearchResults = false;
  private searchSubject = new Subject<string>();

  private destroy$ = new Subject<void>();

  // Cache for computed values to avoid recalculation
  private priceInfoCache: { symbol: string; value: any } | null = null;
  private volumeCache: { symbol: string; value: number } | null = null;

  constructor(
    private fireantService: FireantService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeApp();
    this.setupSearchAutocomplete();
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

            }
          );
      }
    } catch (error) {
      this.error = 'Không thể kết nối đến FireAnt API. Vui lòng kiểm tra kết nối mạng và thử lại.';

      this.stocks = [];
      this.filteredStocks = [];
      this.markForCheck();
    } finally {
      this.loading = false;
      this.markForCheck();
    }
  }

  setupSearchAutocomplete() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query && query.trim().length >= 1) {
        // Search for symbols only, limit to 10 results
        this.fireantService.searchSymbols(query.trim(), 'symbol', 0, 10).subscribe(
          results => {
            this.searchResults = results;
            this.showSearchResults = true;
            this.markForCheck();
          },
          error => {

            this.searchResults = [];
            this.showSearchResults = false;
            this.markForCheck();
          }
        );
      } else {
        this.searchResults = [];
        this.showSearchResults = false;
        this.markForCheck();
      }
    });
  }

  onSearchInput(query: string) {
    this.searchSubject.next(query);
  }

  selectSearchResult(result: SearchResult) {
    this.fundamentalSymbol = result.key || result.symbol || '';
    this.showSearchResults = false;
    this.markForCheck();
    this.searchResults = [];
    this.searchFundamental();
  }

  hideSearchResults() {
    // Delay to allow click event on result
    setTimeout(() => {
      this.showSearchResults = false;
      this.markForCheck();
    }, 200);
  }

  async loadTabData() {
    switch (this.activeTab) {
      case 'macro':
        await this.loadMacroData();
        break;
      case 'search':
        // Don't auto-load, user needs to search
        break;
    }
  }

  // Load macro data (types and initial data)
  async loadMacroData(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {

      const types = await this.fireantService.getMacroDataTypes().toPromise();

      if (!types || types.length === 0) {
        this.error = 'Không tìm thấy dữ liệu vĩ mô.';
        this.macroDataTypes = [];
      } else {
        this.macroDataTypes = types;
        this.lastUpdate = new Date();


        // Auto-load first type if available
        if (types.length > 0 && !this.selectedMacroType) {
          this.selectedMacroType = types[0].type;
          await this.loadMacroDataInfo(this.selectedMacroType);
        }
      }
    } catch (error: any) {
      this.handleApiError(error);
    } finally {
      this.loading = false;
      this.markForCheck();
    }
  }

  // Load macro data info by type
  async loadMacroDataInfo(type: string): Promise<void> {
    this.loading = true;
    this.error = '';

    try {

      const info = await this.fireantService.getMacroDataInfo(type).toPromise();

      if (!info || info.length === 0) {
        this.error = 'Không tìm thấy dữ liệu.';
        this.macroDataInfo = [];
        this.filteredMacroDataInfo = [];
      } else {
        this.macroDataInfo = info;
        this.filteredMacroDataInfo = [...this.macroDataInfo];
        this.lastUpdate = new Date();

      }
    } catch (error: any) {
      this.handleApiError(error);
    } finally {
      this.loading = false;
      this.markForCheck();
    }
  }

  // Change macro data type
  async changeMacroType(type: string) {
    this.selectedMacroType = type;
    await this.loadMacroDataInfo(type);
  }

  // Filter macro data
  filterMacroData() {
    const term = this.macroSearchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredMacroDataInfo = [...this.macroDataInfo];
    } else {
      this.filteredMacroDataInfo = this.macroDataInfo.filter(item =>
        (item.nameVN || '').toLowerCase().includes(term) ||
        (item.name || '').toLowerCase().includes(term) ||
        (item['description'] || '').toLowerCase().includes(term)
      );
    }
  }

  switchTab(tab: TabType) {
    this.activeTab = tab;
    this.error = '';
    this.loadTabData();
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
    this.symbolEvents = [];
    this.symbolHolders = [];
    this.historicalQuotes = [];
    this.institutionProfile = null;

    try {
      const symbol = this.fundamentalSymbol.trim().toUpperCase();


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
        events,
        holders,
        historical,
        institution
      ] = await Promise.allSettled([
        this.fireantService.getSymbolFundamental(symbol).toPromise(),
        this.fireantService.getSymbolInfo(symbol).toPromise(),
        this.fireantService.getSymbolPosts(symbol, 10).toPromise(),
        this.fireantService.getSymbolEvents(symbol, formatDate(startDate), formatDate(endDate)).toPromise(),
        this.fireantService.getSymbolHolders(symbol).toPromise(),
        this.fireantService.getHistoricalQuotes(symbol, formatDate(startDate), formatDate(endDate)).toPromise(),
        this.fireantService.getInstitutionProfile(symbol).toPromise()
      ]);

      // Handle fundamental data
      if (fundamental.status === 'fulfilled' && fundamental.value) {
        this.fundamentalData = fundamental.value;

      }

      // Handle symbol info
      if (symbolInfoData.status === 'fulfilled' && symbolInfoData.value) {
        this.symbolInfo = symbolInfoData.value;

      }

      // Handle posts
      if (posts.status === 'fulfilled' && posts.value) {
        this.symbolPosts = posts.value;

      }

      // Handle events
      if (events.status === 'fulfilled' && events.value) {
        this.symbolEvents = events.value;

      }

      // Handle holders
      if (holders.status === 'fulfilled' && holders.value) {
        this.symbolHolders = holders.value;

      }

      // Handle historical quotes
      if (historical.status === 'fulfilled' && historical.value) {
        this.historicalQuotes = historical.value;

      }

      // Handle institution profile
      if (institution.status === 'fulfilled' && institution.value) {
        this.institutionProfile = institution.value;

      }

      // Check if we got at least some data
      const hasAnyData = this.fundamentalData || this.symbolInfo ||
                         this.symbolPosts.length > 0 ||
                         this.symbolEvents.length > 0 ||
                         this.symbolHolders.length > 0 ||
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

    } finally {
      this.fundamentalLoading = false;
      this.markForCheck();
      // Clear caches
      this.priceInfoCache = null;
      this.volumeCache = null;
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

    this.stocks = [];
    this.filteredStocks = [];
  }

  getPriceChangeClass(change: number): string {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
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
    // If value is between 0-1, multiply by 100 to get percentage
    // If value is already > 1, assume it's already a percentage
    const percentValue = value < 1 ? value * 100 : value;
    return percentValue.toFixed(2);
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
      if ((!this.symbolInfo['priceChange'] || this.symbolInfo.priceChange === 0) && yesterdayClose > 0 && todayClose > 0) {
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

      }
    }

    return volume;
  }

  // Get price change between two quotes
  getPriceChange(currentQuote: HistoricalQuote, previousQuote: HistoricalQuote | undefined): number {
    if (!previousQuote) return 0;
    const currentClose = currentQuote.close || 0;
    const previousClose = previousQuote.close || 0;
    return currentClose - previousClose;
  }

  // Get price change percentage
  getPriceChangePercent(currentQuote: HistoricalQuote, previousQuote: HistoricalQuote | undefined): number {
    if (!previousQuote) return 0;
    const currentClose = currentQuote.close || 0;
    const previousClose = previousQuote.close || 1;
    return ((currentClose - previousClose) / previousClose) * 100;
  }

  // ==================== TRACKBY FUNCTIONS FOR PERFORMANCE ====================
  // These prevent unnecessary re-rendering of lists

  trackByTabId(index: number, tab: { id: TabType; name: string; icon: string }): TabType {
    return tab.id;
  }

  trackByMacroType(index: number, type: MacroDataType): string {
    return type.type;
  }

  trackByMacroInfoId(index: number, info: MacroDataInfo): any {
    return info['id'];
  }

  trackBySearchResultKey(index: number, result: SearchResult): any {
    return result.key || result.id || index.toString();
  }

  trackByEventId(index: number, event: SymbolEvent): any {
    return event.eventID || event.eventDate || index.toString();
  }

  trackByHolderId(index: number, holder: SymbolHolder): string | number {
    return holder.majorHolderID || holder.institutionHolderID || holder.individualHolderID || index;
  }

  trackByPostId(index: number, post: SymbolPost): string {
    return post.id as any || index.toString();
  }

  trackByImageId(index: number, img: any): number {
    return img.imageID || index;
  }

  trackByQuoteDate(index: number, quote: HistoricalQuote): string {
    return quote.date || index.toString();
  }

  // Trigger change detection manually when needed
  private markForCheck() {
    this.cdr.markForCheck();
  }
}

