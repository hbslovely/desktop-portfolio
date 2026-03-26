import { Component, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy, TrackByFunction } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { YugiohService, YugiohCard, FilterOptions } from '../../../services/yugioh.service';
import { YugiohCardDetailComponent } from '../yugioh-card-detail/yugioh-card-detail.component';

@Component({
  selector: 'app-yugioh-app',
  standalone: true,
  imports: [CommonModule, FormsModule, YugiohCardDetailComponent],
  templateUrl: './yugioh-app.component.html',
  styleUrls: ['./yugioh-app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class YugiohAppComponent implements OnInit, OnDestroy {
  // State signals
  allCards = signal<YugiohCard[]>([]);
  displayedCards = signal<YugiohCard[]>([]);
  filteredCards = signal<YugiohCard[]>([]);
  isLoading = signal(false);
  isLoadingMore = signal(false);
  
  // Favorites
  favorites = signal<Set<number>>(new Set());
  showFavoritesOnly = signal(false);
  
  // Deck Builder
  deck = signal<YugiohCard[]>([]);
  showDeckPanel = signal(false);
  maxDeckSize = 60;
  
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();
  
  // Filter state
  searchQuery = signal('');
  selectedType = signal('');
  selectedRace = signal('');
  selectedFrameType = signal('');
  selectedAttribute = signal('');
  selectedSort = signal('name');
  
  // View mode
  viewMode = signal<'grid' | 'list' | 'compact'>('grid');
  
  // Navigation state
  currentView = signal<'list' | 'detail'>('list');
  selectedCard = signal<YugiohCard | null>(null);
  
  // Lazy Loading with requestAnimationFrame
  batchSize = 50;
  currentBatchIndex = signal(0);
  isRendering = signal(false);
  
  hasMoreCards = computed(() => {
    return this.displayedCards().length < this.filteredCards().length;
  });
  
  // Computed values
  availableTypes = computed(() => {
    return this.yugiohService.getUniqueTypes(this.allCards());
  });
  
  availableRaces = computed(() => {
    return this.yugiohService.getUniqueRaces(this.allCards());
  });
  
  availableFrameTypes = computed(() => {
    return this.yugiohService.getUniqueFrameTypes(this.allCards());
  });
  
  availableAttributes = computed(() => {
    return this.yugiohService.getUniqueAttributes(this.allCards());
  });
  
  // Statistics
  totalCards = computed(() => this.filteredCards().length);
  displayedCount = computed(() => this.displayedCards().length);
  monsterCards = computed(() => this.filteredCards().filter(c => c.frameType !== 'spell' && c.frameType !== 'trap').length);
  spellCards = computed(() => this.filteredCards().filter(c => c.frameType === 'spell').length);
  trapCards = computed(() => this.filteredCards().filter(c => c.frameType === 'trap').length);
  
  // Deck statistics
  deckCount = computed(() => this.deck().length);
  deckMonsters = computed(() => this.deck().filter(c => c.frameType !== 'spell' && c.frameType !== 'trap').length);
  deckSpells = computed(() => this.deck().filter(c => c.frameType === 'spell').length);
  deckTraps = computed(() => this.deck().filter(c => c.frameType === 'trap').length);
  
  // TrackBy for performance
  trackByCardId: TrackByFunction<YugiohCard> = (index, card) => card.id;

  constructor(private yugiohService: YugiohService) {
    // Debounced search
    this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.applyFilters();
    });
  }

  ngOnInit(): void {
    this.loadFavorites();
    this.loadDeck();
    this.loadInitialBatch();
  }

  // === DATA LOADING ===
  
  loadInitialBatch(): void {
    this.isLoading.set(true);
    
    this.yugiohService.getAllCards().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (cards) => {
        // Use requestAnimationFrame to prevent UI blocking
        requestAnimationFrame(() => {
          this.allCards.set(cards);
          this.applyFilters();
          this.isLoading.set(false);
        });
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  loadMoreCards(): void {
    if (!this.hasMoreCards() || this.isLoadingMore() || this.isRendering()) return;
    
    this.isLoadingMore.set(true);
    this.isRendering.set(true);
    
    const currentLength = this.displayedCards().length;
    const nextBatch = this.filteredCards().slice(currentLength, currentLength + this.batchSize);
    
    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
      this.displayedCards.update(cards => [...cards, ...nextBatch]);
      this.currentBatchIndex.update(i => i + 1);
      this.isLoadingMore.set(false);
      
      // Small delay to prevent rapid consecutive loads
      setTimeout(() => this.isRendering.set(false), 100);
    });
  }

  // === FILTERING ===
  
  applyFilters(): void {
    const hasFilters = this.selectedType() || this.selectedRace() || 
                      this.selectedFrameType() || this.selectedAttribute();
    
    if (hasFilters || this.searchQuery()) {
      this.searchWithAPI();
    } else {
      let cards = this.allCards();
      
      // Filter favorites if enabled
      if (this.showFavoritesOnly()) {
        cards = cards.filter(c => this.favorites().has(c.id));
      }
      
      const sort = this.selectedSort();
      cards = this.sortCards(cards, sort);
      this.filteredCards.set(cards);
      this.loadFirstBatch();
    }
  }

  loadFirstBatch(): void {
    this.currentBatchIndex.set(0);
    const firstBatch = this.filteredCards().slice(0, this.batchSize);
    this.displayedCards.set(firstBatch);
  }

  searchWithAPI(): void {
    this.isLoading.set(true);
    
    const filters: Record<string, string> = {
      sort: this.selectedSort()
    };
    
    if (this.searchQuery()) {
      filters['fname'] = this.searchQuery();
    }
    
    if (this.selectedType()) filters['type'] = this.selectedType();
    if (this.selectedRace()) filters['race'] = this.selectedRace();
    if (this.selectedAttribute()) filters['attribute'] = this.selectedAttribute();
    
    this.yugiohService.searchCards(filters).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (cards) => {
        requestAnimationFrame(() => {
          let filteredCards = cards;
          
          if (this.selectedFrameType()) {
            filteredCards = cards.filter(card => card.frameType === this.selectedFrameType());
          }
          
          if (this.showFavoritesOnly()) {
            filteredCards = filteredCards.filter(c => this.favorites().has(c.id));
          }
          
          this.filteredCards.set(filteredCards);
          this.loadFirstBatch();
          this.isLoading.set(false);
        });
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  sortCards(cards: YugiohCard[], sortBy: string): YugiohCard[] {
    return [...cards].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'atk':
          return (b.atk || 0) - (a.atk || 0);
        case 'def':
          return (b.def || 0) - (a.def || 0);
        case 'level':
          return (b.level || 0) - (a.level || 0);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
  }

  // === EVENT HANDLERS ===
  
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject$.next(value);
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedType.set('');
    this.selectedRace.set('');
    this.selectedFrameType.set('');
    this.selectedAttribute.set('');
    this.selectedSort.set('name');
    this.showFavoritesOnly.set(false);
    this.applyFilters();
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const threshold = 300;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    if (atBottom && this.hasMoreCards() && !this.isLoadingMore() && !this.isRendering()) {
      this.loadMoreCards();
    }
  }

  // === VIEW MODES ===
  
  setViewMode(mode: 'grid' | 'list' | 'compact'): void {
    this.viewMode.set(mode);
  }

  openCardDetail(card: YugiohCard): void {
    this.selectedCard.set(card);
    this.currentView.set('detail');
  }
  
  backToList(): void {
    this.currentView.set('list');
    this.selectedCard.set(null);
  }

  // === FAVORITES ===
  
  toggleFavorite(card: YugiohCard, event?: Event): void {
    event?.stopPropagation();
    
    this.favorites.update(favs => {
      const newFavs = new Set(favs);
      if (newFavs.has(card.id)) {
        newFavs.delete(card.id);
      } else {
        newFavs.add(card.id);
      }
      return newFavs;
    });
    
    this.saveFavorites();
  }

  isFavorite(cardId: number): boolean {
    return this.favorites().has(cardId);
  }

  toggleFavoritesFilter(): void {
    this.showFavoritesOnly.update(v => !v);
    this.applyFilters();
  }

  private loadFavorites(): void {
    const saved = localStorage.getItem('yugioh-favorites');
    if (saved) {
      try {
        const ids = JSON.parse(saved) as number[];
        this.favorites.set(new Set(ids));
      } catch {}
    }
  }

  private saveFavorites(): void {
    const ids = Array.from(this.favorites());
    localStorage.setItem('yugioh-favorites', JSON.stringify(ids));
  }

  // === DECK BUILDER ===
  
  toggleDeckPanel(): void {
    this.showDeckPanel.update(v => !v);
  }

  addToDeck(card: YugiohCard, event?: Event): void {
    event?.stopPropagation();
    
    if (this.deck().length >= this.maxDeckSize) return;
    
    // Check if card already exists 3 times
    const cardCount = this.deck().filter(c => c.id === card.id).length;
    if (cardCount >= 3) return;
    
    this.deck.update(d => [...d, card]);
    this.saveDeck();
  }

  removeFromDeck(index: number, event?: Event): void {
    event?.stopPropagation();
    this.deck.update(d => d.filter((_, i) => i !== index));
    this.saveDeck();
  }

  clearDeck(): void {
    if (confirm('Clear all cards from deck?')) {
      this.deck.set([]);
      this.saveDeck();
    }
  }

  isInDeck(cardId: number): boolean {
    return this.deck().some(c => c.id === cardId);
  }

  getCardCountInDeck(cardId: number): number {
    return this.deck().filter(c => c.id === cardId).length;
  }

  private loadDeck(): void {
    const saved = localStorage.getItem('yugioh-deck');
    if (saved) {
      try {
        const cards = JSON.parse(saved) as YugiohCard[];
        this.deck.set(cards);
      } catch {}
    }
  }

  private saveDeck(): void {
    localStorage.setItem('yugioh-deck', JSON.stringify(this.deck()));
  }

  // === UTILITIES ===
  
  getRandomCard(): void {
    this.yugiohService.getRandomCard().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (card) => {
        if (card) {
          this.openCardDetail(card);
        }
      }
    });
  }

  getCardImageUrl(card: YugiohCard, size: 'normal' | 'small' | 'cropped' = 'small'): string {
    const imageId = card.card_images[0]?.id || card.id;
    return this.yugiohService.getCardImageUrl(imageId, size);
  }

  getFrameTypeClass(frameType: string): string {
    return `frame-${frameType.toLowerCase().replace(/\s+/g, '-')}`;
  }

  getAttributeIcon(attribute?: string): string {
    if (!attribute) return '';
    const icons: { [key: string]: string } = {
      'DARK': '🌑',
      'LIGHT': '☀️',
      'EARTH': '🌍',
      'WATER': '💧',
      'FIRE': '🔥',
      'WIND': '💨',
      'DIVINE': '✨'
    };
    return icons[attribute.toUpperCase()] || '';
  }

  getFrameTypeIcon(frameType: string): string {
    const icons: { [key: string]: string } = {
      'normal': '⭐',
      'effect': '✨',
      'ritual': '🔮',
      'fusion': '🌀',
      'synchro': '⚡',
      'xyz': '🌟',
      'link': '🔗',
      'spell': '📜',
      'trap': '⚠️'
    };
    return icons[frameType.toLowerCase()] || '🃏';
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    this.allCards.set([]);
    this.filteredCards.set([]);
    this.displayedCards.set([]);
  }
}
