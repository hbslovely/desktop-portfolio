import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface YugiohCard {
  id: number;
  name: string;
  type: string;
  frameType: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race: string;
  attribute?: string;
  archetype?: string;
  scale?: number;
  linkval?: number;
  linkmarkers?: string[];
  card_sets?: CardSet[];
  card_images: CardImage[];
  card_prices?: CardPrice[];
  ygoprodeck_url?: string;
}

export interface CardImage {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped: string;
}

export interface CardSet {
  set_name: string;
  set_code: string;
  set_rarity: string;
  set_rarity_code: string;
  set_price: string;
}

export interface CardPrice {
  cardmarket_price: string;
  tcgplayer_price: string;
  ebay_price: string;
  amazon_price: string;
  coolstuffinc_price: string;
}

export interface YugiohApiResponse {
  data: YugiohCard[];
}

export interface FilterOptions {
  name?: string;        // Exact name match
  fname?: string;       // Fuzzy name search
  type?: string;
  race?: string;
  attribute?: string;
  level?: string;
  atk?: string;
  def?: string;
  archetype?: string;
  format?: string;
  sort?: string;
  linkmarker?: string;
  scale?: string;
  frameType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class YugiohService {
  private readonly API_BASE_URL = 'https://db.ygoprodeck.com/api/v7';
  private readonly IMAGE_BASE_URL = 'assets/images/yugi'; // Local images
  
  // Cache for all cards
  private allCardsCache: YugiohCard[] | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Get all cards from the API
   */
  getAllCards(): Observable<YugiohCard[]> {
    // Return cached data if available
    if (this.allCardsCache) {
      return of(this.allCardsCache);
    }

    return this.http.get<YugiohApiResponse>(`${this.API_BASE_URL}/cardinfo.php`).pipe(
      map(response => {
        this.allCardsCache = response.data;
        return response.data;
      }),
      catchError(error => {
        console.error('Error fetching Yu-Gi-Oh! cards:', error);
        return of([]);
      })
    );
  }

  /**
   * Search cards with filters - uses API for better performance
   * Example: searchCards({ level: '4', attribute: 'water', sort: 'atk' })
   */
  searchCards(filters: FilterOptions): Observable<YugiohCard[]> {
    let params = new HttpParams();
    
    // Exact name match
    if (filters.name) params = params.set('name', filters.name);
    
    // Fuzzy name search
    if (filters.fname) params = params.set('fname', filters.fname);
    
    // Type filters
    if (filters.type) params = params.set('type', filters.type);
    if (filters.race) params = params.set('race', filters.race);
    if (filters.attribute) params = params.set('attribute', filters.attribute);
    if (filters.frameType) params = params.set('frameType', filters.frameType);
    
    // Stat filters
    if (filters.level) params = params.set('level', filters.level);
    if (filters.atk) params = params.set('atk', filters.atk);
    if (filters.def) params = params.set('def', filters.def);
    if (filters.scale) params = params.set('scale', filters.scale);
    if (filters.linkmarker) params = params.set('linkmarker', filters.linkmarker);
    
    // Other filters
    if (filters.archetype) params = params.set('archetype', filters.archetype);
    if (filters.format) params = params.set('format', filters.format);
    
    // Sorting
    if (filters.sort) params = params.set('sort', filters.sort);

    return this.http.get<YugiohApiResponse>(`${this.API_BASE_URL}/cardinfo.php`, { params }).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Error searching Yu-Gi-Oh! cards:', error);
        return of([]);
      })
    );
  }

  /**
   * Get card by exact name
   * Example: getCardByName('Dark Magician')
   */
  getCardByName(name: string): Observable<YugiohCard | null> {
    return this.http.get<YugiohApiResponse>(`${this.API_BASE_URL}/cardinfo.php?name=${encodeURIComponent(name)}`).pipe(
      map(response => response.data[0] || null),
      catchError(error => {
        console.error('Error fetching card by name:', error);
        return of(null);
      })
    );
  }

  /**
   * Get a single card by ID
   */
  getCardById(id: number): Observable<YugiohCard | null> {
    return this.http.get<YugiohApiResponse>(`${this.API_BASE_URL}/cardinfo.php?id=${id}`).pipe(
      map(response => response.data[0] || null),
      catchError(error => {
        console.error('Error fetching card by ID:', error);
        return of(null);
      })
    );
  }

  /**
   * Get a random card
   */
  getRandomCard(): Observable<YugiohCard | null> {
    return this.http.get<YugiohCard>(`${this.API_BASE_URL}/randomcard.php`).pipe(
      catchError(error => {
        console.error('Error fetching random card:', error);
        return of(null);
      })
    );
  }

  /**
   * Get all card sets
   */
  getAllCardSets(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE_URL}/cardsets.php`).pipe(
      catchError(error => {
        console.error('Error fetching card sets:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all archetypes
   */
  getAllArchetypes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE_URL}/archetypes.php`).pipe(
      catchError(error => {
        console.error('Error fetching archetypes:', error);
        return of([]);
      })
    );
  }

  /**
   * Get card image URL - now using local images
   */
  getCardImageUrl(cardId: number, size: 'normal' | 'small' | 'cropped' = 'normal'): string {
    switch (size) {
      case 'small':
        return `${this.IMAGE_BASE_URL}/small/${cardId}.jpg`;
      case 'cropped':
        return `${this.IMAGE_BASE_URL}/cropped/${cardId}.jpg`;
      default:
        return `${this.IMAGE_BASE_URL}/${cardId}.jpg`;
    }
  }

  /**
   * Get unique card types from all cards
   */
  getUniqueTypes(cards: YugiohCard[]): string[] {
    const types = new Set<string>();
    cards.forEach(card => types.add(card.type));
    return Array.from(types).sort();
  }

  /**
   * Get unique races from all cards
   */
  getUniqueRaces(cards: YugiohCard[]): string[] {
    const races = new Set<string>();
    cards.forEach(card => races.add(card.race));
    return Array.from(races).sort();
  }

  /**
   * Get unique frame types from all cards
   */
  getUniqueFrameTypes(cards: YugiohCard[]): string[] {
    const frameTypes = new Set<string>();
    cards.forEach(card => frameTypes.add(card.frameType));
    return Array.from(frameTypes).sort();
  }

  /**
   * Get unique attributes from all cards
   */
  getUniqueAttributes(cards: YugiohCard[]): string[] {
    const attributes = new Set<string>();
    cards.forEach(card => {
      if (card.attribute) attributes.add(card.attribute);
    });
    return Array.from(attributes).sort();
  }
}

