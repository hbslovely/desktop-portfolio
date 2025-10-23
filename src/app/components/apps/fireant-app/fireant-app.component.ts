import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FireantService, SearchResult, SymbolPost, InstitutionProfile, SymbolFundamental } from '../../../services/fireant.service';

interface StockInfo {
  symbol: string;
  organName?: string;
  name?: string;
  organShortName?: string;
  organCode?: string;
  floor?: string;
  exchange?: string;
  lastPrice?: number;
  matchedPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  perPriceChange?: number;
  ceilingPrice?: number;
  floorPrice?: number;
  refPrice?: number;
  totalVolume?: number;
  volume?: number;
  totalValue?: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  pb?: number;
  beta?: number;
  roa?: number;
  roe?: number;
  comGroupCode?: string;
  icbCode?: string;
  avgVolume10d?: number;
  sharesOutstanding?: number;
  [key: string]: any;
}

type DetailTab = 'overview' | 'fundamental' | 'profile' | 'posts';

@Component({
  selector: 'app-fireant-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fireant-app.component.html',
  styleUrl: './fireant-app.component.scss'
})
export class FireantAppComponent implements OnInit, OnDestroy {
  // Current view: 'market' or 'stock'
  currentView = signal<'market' | 'stock'>('market');

  // Search
  searchKeyword = signal<string>('');
  searchResults = signal<SearchResult[]>([]);
  selectedStock = signal<StockInfo | null>(null);
  isSearching = signal<boolean>(false);

  // Market Overview
  marketStocks = signal<StockInfo[]>([]);
  isLoadingMarket = signal<boolean>(false);

  // Stock Detail Data
  activeTab = signal<DetailTab>('overview');
  stockFundamental = signal<SymbolFundamental | null>(null);
  stockProfile = signal<InstitutionProfile | null>(null);
  stockPosts = signal<SymbolPost[]>([]);
  isLoadingDetails = signal<boolean>(false);

  // Posts pagination
  postsOffset = signal<number>(0);
  postsLimit = 20;
  hasMorePosts = signal<boolean>(true);
  isLoadingMorePosts = signal<boolean>(false);

  // WebSocket for real-time prices
  private ws: WebSocket | null = null;
  isConnected = signal<boolean>(false);
  realtimeData = signal<Map<string, any>>(new Map());

  // Popular stocks to display
  popularSymbols = ['VNM', 'FPT', 'HPG', 'VCB', 'VHM', 'VIC', 'MSN', 'MWG'];

  // WebSocket base URL
  private readonly WS_BASE_URL = 'wss://tradestation.fireant.vn/quote-lite';

  constructor(private fireantService: FireantService) {}

  ngOnInit(): void {
    this.loadMarketOverview();

    // Wait for token before connecting WebSocket
    this.fireantService.token$.subscribe(token => {
      if (token && !this.ws) {
        console.log('🔑 Token ready, connecting WebSocket...');
        this.connectWebSocket();
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnectWebSocket();
  }

  /**
   * Build WebSocket URL with access token from service
   */
  private buildWebSocketUrl(): string {
    const token = this.fireantService.getToken();
    return `${this.WS_BASE_URL}?access_token=${token}`;
  }

  /**
   * Send SignalR handshake message
   * Must be sent first before any other messages
   */
  private sendHandshake(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const handshake = JSON.stringify({
        protocol: 'messagepack',
        version: 1
      }) + '\x1E'; // SignalR uses \x1E as record separator

      this.ws.send(handshake);
      console.log('🤝 Sent handshake:', handshake);

      // Wait a bit for handshake to complete, then subscribe
      setTimeout(() => {
        this.subscribeToSymbols(this.popularSymbols);
      }, 100);
    }
  }

  /**
   * Build subscribe message for FireAnt WebSocket
   * Format: '\x1E\x95\x01\x80¡0¯SubscribeQuotes\x91§SYMBOLS'
   * Returns binary ArrayBuffer for WebSocket
   */
  private buildSubscribeMessage(symbols: string[]): ArrayBuffer {
    const symbolsStr = symbols.join(',');
    // FireAnt WebSocket uses MessagePack-like binary format
    const message = `\x1E\x95\x01\x80\xa10\xafSubscribeQuotes\x91\xa7${symbolsStr}`;

    // Convert string to binary ArrayBuffer
    const encoder = new TextEncoder();
    return encoder.encode(message).buffer;
  }

  /**
   * Connect to WebSocket for real-time price updates
   */
  connectWebSocket(): void {
    try {
      const wsUrl = this.buildWebSocketUrl();
      console.log('📡 Connecting to WebSocket with dynamic token...');
      this.ws = new WebSocket(wsUrl);

      // Set binary type to handle binary messages
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected (binary mode)');
        this.isConnected.set(true);

        // Step 1: Send SignalR handshake first
        this.sendHandshake();
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            // Binary data - decode MessagePack format
            const uint8Array = new Uint8Array(event.data);

            // Log binary data for debugging
            console.log('📨 Received binary message:', uint8Array.length, 'bytes');

            // Try to decode as text and parse as JSON (if possible)
            try {
              const decoder = new TextDecoder();
              const text = decoder.decode(uint8Array);
              const data = JSON.parse(text);
              this.handleRealtimeData(data);
            } catch {
              // If not JSON, it's MessagePack binary format
              // For now, log the raw data
              console.log('📦 MessagePack data (first 50 bytes):',
                Array.from(uint8Array.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));

              // TODO: Implement MessagePack parser if needed
              // For now, we'll wait to see the actual format from the server
            }
          } else if (typeof event.data === 'string') {
            // Text data - try JSON parse
            try {
              const data = JSON.parse(event.data);
              this.handleRealtimeData(data);
            } catch {
              console.warn('Could not parse text message:', event.data);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected.set(false);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected.set(false);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to symbols for real-time updates
   * FireAnt WebSocket requires MessagePack-like binary format
   */
  subscribeToSymbols(symbols: string[]): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const binaryMessage = this.buildSubscribeMessage(symbols);
      this.ws.send(binaryMessage);

      // Log for debugging
      const uint8Array = new Uint8Array(binaryMessage);
      console.log('📡 Subscribed to symbols:', symbols);
      console.log('📦 Binary message:', uint8Array.length, 'bytes');
      console.log('📦 Hex:', Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
  }

  /**
   * Handle real-time data from WebSocket
   */
  handleRealtimeData(data: any): void {
    if (data && data.symbol) {
      const currentMap = this.realtimeData();
      currentMap.set(data.symbol, data);
      this.realtimeData.set(new Map(currentMap));

      // Update market stocks with real-time data
      const stocks = this.marketStocks();
      const updatedStocks = stocks.map(stock => {
        if (stock.symbol === data.symbol) {
          return { ...stock, ...data };
        }
        return stock;
      });
      this.marketStocks.set(updatedStocks);

      // Update selected stock if it matches
      const selected = this.selectedStock();
      if (selected && selected.symbol === data.symbol) {
        this.selectedStock.set({ ...selected, ...data });
      }
    }
  }

  /**
   * Get real-time data for a symbol
   */
  getRealtimeData(symbol: string): any {
    return this.realtimeData().get(symbol);
  }

  /**
   * Load market overview with popular stocks
   */
  loadMarketOverview(): void {
    this.isLoadingMarket.set(true);
    const stocks: StockInfo[] = [];
    let completed = 0;

    this.popularSymbols.forEach(symbol => {
      this.fireantService.getStockInfo(symbol).subscribe({
        next: (data: StockInfo) => {
          stocks.push(data);
          completed++;
          if (completed === this.popularSymbols.length) {
            this.marketStocks.set(stocks);
            this.isLoadingMarket.set(false);
          }
        },
        error: (error) => {
          console.error(`Error loading ${symbol}:`, error);
          completed++;
          if (completed === this.popularSymbols.length) {
            this.marketStocks.set(stocks);
            this.isLoadingMarket.set(false);
          }
        }
      });
    });
  }

  /**
   * Search for stocks
   */
  searchStock(): void {
    const keyword = this.searchKeyword().trim();

    if (!keyword) {
      return;
    }

    this.isSearching.set(true);
    this.searchResults.set([]);

    this.fireantService.search(keyword.toUpperCase()).subscribe({
      next: (results: SearchResult[]) => {
        this.searchResults.set(results || []);
        this.isSearching.set(false);

        // Auto-select if only one result
        if (results && results.length === 1) {
          this.viewStockDetail(results[0]);
        }
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isSearching.set(false);
      }
    });
  }

  /**
   * View stock detail by symbol
   */
  viewStockDetail(stock: SearchResult | string): void {
    this.isSearching.set(true);

    const symbol = typeof stock === 'string' ? stock : (stock.symbol || stock.key || '');

    if (!symbol) {
      console.error('No symbol found');
      this.isSearching.set(false);
      return;
    }

    this.fireantService.getStockInfo(symbol).subscribe({
      next: (data: StockInfo) => {
        this.selectedStock.set(data);
        this.currentView.set('stock');
        this.searchResults.set([]);
        this.isSearching.set(false);

        // Load additional data based on active tab
        this.loadStockDetails(symbol);
      },
      error: (error) => {
        console.error('Error loading stock:', error);
        this.isSearching.set(false);
      }
    });
  }

  /**
   * Load additional stock details based on active tab
   */
  loadStockDetails(symbol: string): void {
    const tab = this.activeTab();

    switch (tab) {
      case 'fundamental':
        this.loadFundamental(symbol);
        break;
      case 'profile':
        this.loadProfile(symbol);
        break;
      case 'posts':
        this.loadPosts(symbol);
        break;
      default:
        // Overview tab doesn't need additional data
        break;
    }
  }

  /**
   * Switch tab and load corresponding data
   */
  switchTab(tab: DetailTab): void {
    this.activeTab.set(tab);
    const stock = this.selectedStock();
    if (stock && stock.symbol) {
      this.loadStockDetails(stock.symbol);
    }
  }

  /**
   * Load fundamental data
   */
  loadFundamental(symbol: string): void {
    this.isLoadingDetails.set(true);
    this.fireantService.getSymbolFundamental(symbol).subscribe({
      next: (data) => {
        this.stockFundamental.set(data);
        this.isLoadingDetails.set(false);
      },
      error: (error) => {
        console.error('Error loading fundamental:', error);
        this.isLoadingDetails.set(false);
      }
    });
  }

  /**
   * Load profile/company info
   */
  loadProfile(symbol: string): void {
    this.isLoadingDetails.set(true);
    this.fireantService.getInstitutionProfile(symbol).subscribe({
      next: (data) => {
        this.stockProfile.set(data);
        this.isLoadingDetails.set(false);
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.isLoadingDetails.set(false);
      }
    });
  }

  /**
   * Load posts/discussions
   */
  loadPosts(symbol: string, reset: boolean = true): void {
    if (reset) {
      this.postsOffset.set(0);
      this.stockPosts.set([]);
      this.hasMorePosts.set(true);
    }

    this.isLoadingDetails.set(true);

    // Note: FireAnt API might not support offset/limit, adjust based on actual API
    this.fireantService.getSymbolPosts(symbol, this.postsLimit).subscribe({
      next: (data: any) => {
        // API returns array directly or in data property
        const newPosts = Array.isArray(data) ? data : (data.data || []);

        if (reset) {
          this.stockPosts.set(newPosts);
        } else {
          this.stockPosts.set([...this.stockPosts(), ...newPosts]);
        }

        // Check if we have more posts
        if (newPosts.length < this.postsLimit) {
          this.hasMorePosts.set(false);
        }

        this.isLoadingDetails.set(false);
      },
      error: (error) => {
        console.error('Error loading posts:', error);
        this.isLoadingDetails.set(false);
      }
    });
  }

  /**
   * Load more posts (infinite scroll)
   */
  loadMorePosts(): void {
    const stock = this.selectedStock();
    if (!stock || !this.hasMorePosts() || this.isLoadingMorePosts()) {
      return;
    }

    this.isLoadingMorePosts.set(true);
    this.postsOffset.update(offset => offset + this.postsLimit);

    this.fireantService.getSymbolPosts(stock.symbol, this.postsLimit).subscribe({
      next: (data: any) => {
        const newPosts = Array.isArray(data) ? data : (data.data || []);
        this.stockPosts.set([...this.stockPosts(), ...newPosts]);

        if (newPosts.length < this.postsLimit) {
          this.hasMorePosts.set(false);
        }

        this.isLoadingMorePosts.set(false);
      },
      error: (error) => {
        console.error('Error loading more posts:', error);
        this.isLoadingMorePosts.set(false);
      }
    });
  }

  /**
   * Handle scroll event for infinite scroll
   */
  onPostsScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const threshold = 200; // pixels from bottom
    const position = element.scrollTop + element.clientHeight;
    const height = element.scrollHeight;

    if (position > height - threshold) {
      this.loadMorePosts();
    }
  }

  /**
   * Back to market overview
   */
  backToMarket(): void {
    this.currentView.set('market');
    this.selectedStock.set(null);
    this.searchKeyword.set('');
    this.searchResults.set([]);
  }

  /**
   * Handle search input keydown
   */
  onSearchKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.searchStock();
    }
  }

  /**
   * Get price change CSS class
   */
  getPriceChangeClass(change: number): string {
    if (change > 0) return 'price-up';
    if (change < 0) return 'price-down';
    return 'price-neutral';
  }

  /**
   * Format number with Vietnamese locale
   */
  formatNumber(value: number | undefined): string {
    if (!value) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  /**
   * Format large numbers (millions, billions)
   */
  formatLargeNumber(value: number | undefined): string {
    if (!value) return '0';

    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(2)}B`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }

    return this.formatNumber(value);
  }

  /**
   * Format percentage
   */
  formatPercent(value: number | undefined): string {
    if (value === undefined || value === null) return '0.00%';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
}

