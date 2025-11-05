import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface BookingDestination {
  countryCode: string;
  destId: string;
  destType: string;
  latitude: number;
  longitude: number;
}

export interface BookingLabelComponent {
  name: string;
  type: string;
}

export interface BookingDisplayInfo {
  imageUrl?: string;
  label: string;
  labelComponents: BookingLabelComponent[];
  showEntireHomesCheckbox: boolean;
  title: string;
  subTitle: string;
}

export interface BookingMetaMatch {
  id: string;
  text: string;
  type: string;
}

export interface BookingMetaData {
  isSkiItem: boolean;
  langCode: string;
  metaMatches: BookingMetaMatch[];
  roundTrip: boolean;
  webFilters: any;
  autocompleteResultId: string;
  autocompleteResultSource: string;
  eligiblePages: string[];
}

export interface BookingSuggestion {
  destination: BookingDestination;
  displayInfo: BookingDisplayInfo;
  metaData: BookingMetaData;
}

export interface BookingAutoCompleteResponse {
  data: {
    autoCompleteSuggestions: {
      results: BookingSuggestion[];
    };
  };
}

export interface HotelSearchParams {
  destination: BookingSuggestion;
  checkin?: string;
  checkout?: string;
  adults: number;
  rooms: number;
  children: number;
}

export interface HotelCard {
  imageUrl: string;
  title: string;
  link: string;
  reviewScore?: string;
  reviewScoreWord?: string;
  reviewCount?: string;
  address?: string;
  distance?: string;
  roomType?: string;
  bedInfo?: string;
  breakfastIncluded?: boolean;
  originalPrice?: string;
  currentPrice?: string;
  taxesInfo?: string;
  availability?: string;
}

interface StoredPageViewId {
  pageviewId: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private pageviewIdSubject = new BehaviorSubject<string>('');
  public pageviewId$ = this.pageviewIdSubject.asObservable();

  // API endpoints
  private readonly GRAPHQL_URL = '/api/booking-graphql';
  private readonly BOOKING_HOME_URL = '/api/booking-home';
  private readonly SEARCH_RESULTS_URL = '/api/booking-search';

  // Storage key for localStorage
  private readonly STORAGE_KEY = 'booking_pageview_id';

  // Expiration time: 1 day in milliseconds
  private readonly EXPIRATION_TIME = 24 * 60 * 60 * 1000;

  constructor(private http: HttpClient) {
    // Initialize pageview ID from localStorage or fetch new one
    this.initializePageViewId();
  }

  /**
   * Get current pageview ID
   */
  getPageViewId(): string {
    return this.pageviewIdSubject.value;
  }

  /**
   * Initialize pageview ID from localStorage or fetch new one
   */
  private initializePageViewId(): void {
    const stored = this.getStoredPageViewId();
    if (stored && !this.isExpired(stored.timestamp)) {
      // Use stored pageview ID if not expired
      this.pageviewIdSubject.next(stored.pageviewId);
      console.log('Using cached Booking pageview ID:', stored.pageviewId);
    } else {
      // Fetch new pageview ID if expired or not found
      console.log('Cached pageview ID expired or not found, fetching new one...');
      this.fetchAndStorePageViewId();
    }
  }

  /**
   * Get stored pageview ID from localStorage
   */
  private getStoredPageViewId(): StoredPageViewId | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as StoredPageViewId;
      }
    } catch (error) {
      console.error('Error reading pageview ID from localStorage:', error);
    }
    return null;
  }

  /**
   * Store pageview ID in localStorage with timestamp
   */
  private storePageViewId(pageviewId: string): void {
    try {
      const data: StoredPageViewId = {
        pageviewId,
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('Booking pageview ID cached for 1 day:', pageviewId);
    } catch (error) {
      console.error('Error writing pageview ID to localStorage:', error);
    }
  }

  /**
   * Check if stored timestamp is expired (older than 1 day)
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.EXPIRATION_TIME;
  }

  /**
   * Fetch and store new pageview ID
   */
  private fetchAndStorePageViewId(): void {
    this.fetchPageViewId().then(() => {
      const currentId = this.pageviewIdSubject.value;
      if (currentId) {
        this.storePageViewId(currentId);
      }
    }).catch(error => {
      console.error('Failed to fetch pageview ID:', error);
    });
  }

  /**
   * Fetch the pageview ID from Booking.com homepage
   */
  private async fetchPageViewId(): Promise<void> {
    try {
      const htmlResponse = await firstValueFrom(
        this.http.get(this.BOOKING_HOME_URL, { responseType: 'text' })
      );

      // Look for pageview_id pattern in the HTML
      // Pattern: pageview_id: 'xxxxxxxxxxxxxxxx'
      const pageviewMatch = htmlResponse.match(/pageview_id['":\s]+['"]([a-f0-9]+)['"]/i);

      if (pageviewMatch && pageviewMatch[1]) {
        const pageviewId = pageviewMatch[1];
        this.pageviewIdSubject.next(pageviewId);
        console.log('✅ Found and updated pageview ID:', pageviewId);
        return;
      }

      console.warn('⚠️ pageview_id not found in Booking.com homepage');
      // Use a fallback ID if not found
      const fallbackId = this.generateFallbackPageViewId();
      this.pageviewIdSubject.next(fallbackId);
      console.log('Using fallback pageview ID:', fallbackId);
    } catch (error) {
      console.error('❌ Error fetching pageview ID:', error);
      // Use a fallback ID on error
      const fallbackId = this.generateFallbackPageViewId();
      this.pageviewIdSubject.next(fallbackId);
    }
  }

  /**
   * Generate a fallback pageview ID (16 hex characters)
   */
  private generateFallbackPageViewId(): string {
    return Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Search for destinations using autocomplete
   */
  autoComplete(query: string, nbSuggestions: number = 5): Observable<BookingSuggestion[]> {
    const pageviewId = this.getPageViewId() || this.generateFallbackPageViewId();

    const graphqlQuery = {
      operationName: 'AutoComplete',
      variables: {
        input: {
          prefixQuery: query,
          nbSuggestions: nbSuggestions,
          fallbackConfig: {
            mergeResults: true,
            nbMaxMergedResults: 6,
            nbMaxThirdPartyResults: 3,
            sources: ['GOOGLE', 'HERE']
          },
          requestConfig: {
            enableRequestContextBoost: true
          },
          requestContext: {
            pageviewId: pageviewId,
            location: null
          }
        }
      },
      extensions: {},
      query: `query AutoComplete($input: AutoCompleteRequestInput!) {
  autoCompleteSuggestions(input: $input) {
    results {
      destination {
        countryCode
        destId
        destType
        latitude
        longitude
        __typename
      }
      displayInfo {
        imageUrl
        label
        labelComponents {
          name
          type
          __typename
        }
        showEntireHomesCheckbox
        title
        subTitle
        __typename
      }
      metaData {
        isSkiItem
        langCode
        maxLosData {
          extendedLoS
          __typename
        }
        metaMatches {
          id
          text
          type
          __typename
        }
        roundTrip
        webFilters
        autocompleteResultId
        autocompleteResultSource
        eligiblePages
        __typename
      }
      __typename
    }
    __typename
  }
}
`
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<BookingAutoCompleteResponse>(
      this.GRAPHQL_URL,
      graphqlQuery,
      { headers }
    ).pipe(
      map(response => response.data.autoCompleteSuggestions.results),
      catchError(error => {
        console.error('Error fetching autocomplete suggestions:', error);
        return of([]);
      })
    );
  }

  /**
   * Refresh pageview ID
   */
  refreshPageViewId(): void {
    console.log('Refreshing pageview ID...');
    this.fetchAndStorePageViewId();
  }

  /**
   * Search for hotels with given parameters
   */
  searchHotels(params: HotelSearchParams): Observable<HotelCard[]> {
    const { destination, checkin, checkout, adults, rooms, children } = params;
    
    console.log('🔍 Searching hotels with params:', {
      destination: destination.displayInfo.title,
      destId: destination.destination.destId,
      adults,
      rooms,
      children,
      checkin,
      checkout
    });
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('ss', destination.displayInfo.title);
    queryParams.append('dest_id', destination.destination.destId);
    queryParams.append('dest_type', destination.destination.destType);
    queryParams.append('group_adults', adults.toString());
    queryParams.append('no_rooms', rooms.toString());
    queryParams.append('group_children', children.toString());
    
    if (checkin) queryParams.append('checkin', checkin);
    if (checkout) queryParams.append('checkout', checkout);
    
    // Add additional params
    queryParams.append('map', '1');
    queryParams.append('lang', 'en-us');
    queryParams.append('sb', '1');
    queryParams.append('src_elem', 'sb');
    queryParams.append('src', 'index');
    queryParams.append('search_selected', 'true');
    queryParams.append('search_pageview_id', this.getPageViewId());

    const url = `${this.SEARCH_RESULTS_URL}?${queryParams.toString()}`;
    console.log('📡 Fetching from URL:', url);
    
    return this.http.get(url, { responseType: 'text' }).pipe(
      map(html => this.parseHotelCards(html)),
      catchError(error => {
        console.error('Error searching hotels:', error);
        return of([]);
      })
    );
  }

  /**
   * Parse HTML response to extract hotel cards
   */
  private parseHotelCards(html: string): HotelCard[] {
    console.log('📄 Parsing HTML response, length:', html.length);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const cards: HotelCard[] = [];
    const propertyCards = doc.querySelectorAll('[data-testid="property-card"]');
    
    console.log(`🔍 Found ${propertyCards.length} property cards in HTML`);
    
    if (propertyCards.length === 0) {
      console.warn('⚠️ No property cards found. Checking for other possible selectors...');
      // Log some HTML structure to help debug
      const bodyText = doc.body?.textContent?.substring(0, 500) || 'No body content';
      console.log('Body preview:', bodyText);
    }
    
    propertyCards.forEach((card, index) => {
      try {
        // Extract image
        const imageEl = card.querySelector('[data-testid="property-card-desktop-single-image"] [data-testid="image"]') as HTMLImageElement;
        const imageUrl = imageEl?.src || imageEl?.getAttribute('data-src') || '';
        
        // Extract title and link
        const titleLinkEl = card.querySelector('[data-testid="title-link"]') as HTMLAnchorElement;
        const titleEl = titleLinkEl?.querySelector('[data-testid="title"]');
        const title = titleEl?.textContent?.trim() || '';
        const link = titleLinkEl?.href || '';
        
        // Extract review score
        const reviewScoreEl = card.querySelector('[data-testid="review-score"]');
        const reviewScoreValue = reviewScoreEl?.querySelector('[aria-label]')?.getAttribute('aria-label') || 
                                 reviewScoreEl?.querySelector('div[class*="review-score"]')?.textContent?.trim() || '';
        const reviewScoreWord = reviewScoreEl?.querySelector('[data-testid="review-score-word"]')?.textContent?.trim() || '';
        const reviewCountEl = reviewScoreEl?.querySelector('[data-testid="review-score-reviews-count"]');
        const reviewCount = reviewCountEl?.textContent?.trim() || '';
        
        // Extract address
        const addressEl = card.querySelector('[data-testid="address"]');
        const address = addressEl?.textContent?.trim() || '';
        
        // Extract distance
        const distanceEl = card.querySelector('[data-testid="distance"]');
        const distance = distanceEl?.textContent?.trim() || '';
        
        // Extract room type
        const roomTypeEl = card.querySelector('[data-testid="recommended-units"]') || 
                          card.querySelector('[data-testid="room-name"]');
        const roomType = roomTypeEl?.textContent?.trim() || '';
        
        // Extract bed info
        const bedInfoEl = card.querySelector('[data-testid="bed-information"]');
        const bedInfo = bedInfoEl?.textContent?.trim() || '';
        
        // Check breakfast
        const breakfastEl = card.querySelector('[data-testid="availability-group-breakfast"]');
        const breakfastIncluded = breakfastEl?.textContent?.toLowerCase().includes('breakfast') || false;
        
        // Extract prices
        const priceContainerEl = card.querySelector('[data-testid="price-and-discounted-price"]');
        const originalPriceEl = priceContainerEl?.querySelector('[data-testid="price-for-x-nights"]') ||
                                priceContainerEl?.querySelector('[aria-hidden="true"]');
        const originalPrice = originalPriceEl?.textContent?.trim() || '';
        
        const currentPriceEl = card.querySelector('[data-testid="price-and-discounted-price"] [data-testid="price-and-discounted-price"]') ||
                              card.querySelector('[data-testid="price-and-discounted-price"]');
        let currentPrice = '';
        if (currentPriceEl) {
          const priceText = currentPriceEl.textContent || '';
          const priceMatch = priceText.match(/VND\s*[\d,]+/);
          if (priceMatch) {
            currentPrice = priceMatch[0];
          }
        }
        
        // Extract taxes info
        const taxesEl = card.querySelector('[data-testid="taxes-and-charges"]');
        const taxesInfo = taxesEl?.textContent?.trim() || '';
        
        // Extract availability
        const availabilityEl = card.querySelector('[data-testid="availability"]');
        const availability = availabilityEl?.textContent?.trim() || '';
        
        // Only add if we have at least title and image
        if (title && imageUrl) {
          const hotelCard = {
            imageUrl,
            title,
            link,
            reviewScore: reviewScoreValue,
            reviewScoreWord,
            reviewCount,
            address,
            distance,
            roomType,
            bedInfo,
            breakfastIncluded,
            originalPrice,
            currentPrice,
            taxesInfo,
            availability
          };
          cards.push(hotelCard);
          
          if (index === 0) {
            console.log('📋 Sample hotel card (first one):', {
              title: hotelCard.title,
              reviewScore: hotelCard.reviewScore,
              currentPrice: hotelCard.currentPrice,
              address: hotelCard.address
            });
          }
        } else {
          console.warn(`⚠️ Skipping card ${index}: missing title or image`, { title, imageUrl });
        }
      } catch (error) {
        console.error(`❌ Error parsing hotel card ${index}:`, error);
      }
    });
    
    console.log(`✅ Successfully parsed ${cards.length} hotel cards`);
    return cards;
  }
}

