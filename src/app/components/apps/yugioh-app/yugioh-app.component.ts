import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YugiohService, YugiohCard, FilterOptions } from '../../../services/yugioh.service';
import { YugiohCardDetailComponent } from '../yugioh-card-detail/yugioh-card-detail.component';

@Component({
  selector: 'app-yugioh-app',
  standalone: true,
  imports: [CommonModule, FormsModule, YugiohCardDetailComponent],
  templateUrl: './yugioh-app.component.html',
  styleUrl: './yugioh-app.component.scss',
})
export class YugiohAppComponent implements OnInit, OnDestroy {
  // State signals
  allCards = signal<YugiohCard[]>([]);
  displayedCards = signal<YugiohCard[]>([]); // Cards currently displayed (lazy loaded)
  filteredCards = signal<YugiohCard[]>([]);
  isLoading = signal(false);
  isLoadingMore = signal(false);
  
  private subscriptions: any[] = [];
  
  // Filter state
  searchQuery = signal('');
  selectedType = signal('');
  selectedRace = signal('');
  selectedFrameType = signal('');
  selectedAttribute = signal('');
  selectedSort = signal('name');
  
  // View mode
  viewMode = signal<'grid' | 'list'>('grid');
  
  // Navigation state
  currentView = signal<'list' | 'detail'>('list');
  selectedCard = signal<YugiohCard | null>(null);
  
  // Lazy Loading
  batchSize = 100; // Load 100 cards at a time
  currentBatchIndex = signal(0);
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
  
  // Statistics (based on filtered, not displayed)
  totalCards = computed(() => this.filteredCards().length);
  displayedCount = computed(() => this.displayedCards().length);
  monsterCards = computed(() => this.filteredCards().filter(c => c.frameType !== 'spell' && c.frameType !== 'trap').length);
  spellCards = computed(() => this.filteredCards().filter(c => c.frameType === 'spell').length);
  trapCards = computed(() => this.filteredCards().filter(c => c.frameType === 'trap').length);

  constructor(
    private yugiohService: YugiohService
  ) {}

  ngOnInit() {
    this.loadInitialBatch();
  }

  loadInitialBatch() {
    this.isLoading.set(true);
    // Load all cards for filtering purposes, but only display first batch
    const sub = this.yugiohService.getAllCards().subscribe({
      next: (cards) => {
        this.allCards.set(cards);
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {

        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(sub);
  }

  loadMoreCards() {
    if (!this.hasMoreCards() || this.isLoadingMore()) return;
    
    this.isLoadingMore.set(true);
    const currentLength = this.displayedCards().length;
    const nextBatch = this.filteredCards().slice(currentLength, currentLength + this.batchSize);
    
    // Simulate async loading for smooth UX
    setTimeout(() => {
      this.displayedCards.update(cards => [...cards, ...nextBatch]);
      this.currentBatchIndex.update(i => i + 1);
      this.isLoadingMore.set(false);
    }, 100);
  }

  applyFilters() {
    // Check if we should use API filtering (when any filter is selected)
    const hasFilters = this.selectedType() || this.selectedRace() || 
                      this.selectedFrameType() || this.selectedAttribute();
    
    if (hasFilters || this.searchQuery()) {
      // Use API filtering for better performance
      this.searchWithAPI();
    } else {
      // No filters - show all cards
      let cards = this.allCards();
      const sort = this.selectedSort();
      cards = this.sortCards(cards, sort);
      this.filteredCards.set(cards);
      this.loadFirstBatch();
    }
  }

  loadFirstBatch() {
    // Reset and load first batch of filtered cards
    this.currentBatchIndex.set(0);
    const firstBatch = this.filteredCards().slice(0, this.batchSize);
    this.displayedCards.set(firstBatch);
  }

  searchWithAPI() {
    this.isLoading.set(true);
    
    const filters: any = {
      sort: this.selectedSort()
    };
    
    // Add search query
    if (this.searchQuery()) {
      filters.fname = this.searchQuery(); // Fuzzy search
    }
    
    // Add filters
    if (this.selectedType()) filters.type = this.selectedType();
    if (this.selectedRace()) filters.race = this.selectedRace();
    if (this.selectedFrameType()) {
      // Note: API doesn't support frameType filter directly
      // We'll filter client-side for frameType
    }
    if (this.selectedAttribute()) filters.attribute = this.selectedAttribute();
    
    const sub = this.yugiohService.searchCards(filters).subscribe({
      next: (cards) => {
        // Apply frameType filter client-side if needed
        let filteredCards = cards;
        if (this.selectedFrameType()) {
          filteredCards = cards.filter(card => card.frameType === this.selectedFrameType());
        }
        
        this.filteredCards.set(filteredCards);
        this.loadFirstBatch();
        this.isLoading.set(false);
      },
      error: (error) => {

        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(sub);
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

  onSearchChange() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedType.set('');
    this.selectedRace.set('');
    this.selectedFrameType.set('');
    this.selectedAttribute.set('');
    this.selectedSort.set('name');
    this.applyFilters();
  }

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const threshold = 200; // Load more when 200px from bottom
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    if (atBottom && this.hasMoreCards() && !this.isLoadingMore()) {
      this.loadMoreCards();
    }
  }

  toggleViewMode() {
    this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
  }

  openCardDetail(card: YugiohCard) {
    // Show card detail within the same component
    this.selectedCard.set(card);
    this.currentView.set('detail');
  }
  
  backToList() {
    this.currentView.set('list');
    this.selectedCard.set(null);
  }

  getRandomCard() {
    const sub = this.yugiohService.getRandomCard().subscribe({
      next: (card) => {
        if (card) {
          this.openCardDetail(card);
        }
      }
    });
    this.subscriptions.push(sub);
  }
  getCardImageUrl(card: YugiohCard, size: 'normal' | 'small' | 'cropped' = 'small'): string {
    // Use local images - use the first image ID from card_images array
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
  
  ngOnDestroy() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub?.unsubscribe());
    
    // Clear large data structures to free memory
    this.allCards.set([]);
    this.filteredCards.set([]);
    this.displayedCards.set([]);
  }
}
