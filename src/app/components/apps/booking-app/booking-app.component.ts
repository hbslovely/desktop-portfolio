import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService, BookingSuggestion, HotelCard } from '../../../services/booking.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-booking-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-app.component.html',
  styleUrls: ['./booking-app.component.scss']
})
export class BookingAppComponent implements OnInit {
  searchQuery = signal<string>('');
  suggestions = signal<BookingSuggestion[]>([]);
  loading = signal<boolean>(false);
  showSuggestions = signal<boolean>(false);
  selectedDestination = signal<BookingSuggestion | null>(null);
  
  // Search parameters
  adults = signal<number>(2);
  rooms = signal<number>(1);
  children = signal<number>(0);
  checkin = signal<string>('');
  checkout = signal<string>('');
  
  // Hotel search results
  hotelResults = signal<HotelCard[]>([]);
  searchingHotels = signal<boolean>(false);
  showResults = signal<boolean>(false);
  
  // Math utility for template
  Math = Math;
  
  private searchSubject = new Subject<string>();

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    // Setup debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.performSearch(query);
    });
  }

  /**
   * Handle search input changes
   */
  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.searchQuery.set(query);

    if (query.trim().length >= 2) {
      this.searchSubject.next(query);
      this.showSuggestions.set(true);
    } else {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
      this.loading.set(false);
    }
  }

  /**
   * Perform autocomplete search
   */
  private performSearch(query: string): void {
    if (!query || query.trim().length < 2) {
      this.suggestions.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    this.bookingService.autoComplete(query, 8).subscribe({
      next: (results) => {
        this.suggestions.set(results);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Search error:', error);
        this.suggestions.set([]);
        this.loading.set(false);
      }
    });
  }

  /**
   * Select a destination from suggestions
   */
  selectDestination(suggestion: BookingSuggestion): void {
    this.selectedDestination.set(suggestion);
    this.searchQuery.set(suggestion.displayInfo.title);
    this.showSuggestions.set(false);
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery.set('');
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.selectedDestination.set(null);
  }

  /**
   * Close suggestions dropdown
   */
  closeSuggestions(): void {
    // Delay to allow click on suggestion to register
    setTimeout(() => {
      this.showSuggestions.set(false);
    }, 200);
  }

  /**
   * Get flag emoji from country code
   */
  getCountryFlag(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Get destination type icon
   */
  getDestTypeIcon(destType: string): string {
    switch (destType.toLowerCase()) {
      case 'city':
        return 'pi-building';
      case 'region':
        return 'pi-map';
      case 'country':
        return 'pi-globe';
      case 'airport':
        return 'pi-send';
      case 'hotel':
        return 'pi-home';
      case 'landmark':
        return 'pi-map-marker';
      default:
        return 'pi-map-marker';
    }
  }

  /**
   * Format destination type for display
   */
  formatDestType(destType: string): string {
    return destType.charAt(0).toUpperCase() + destType.slice(1).toLowerCase();
  }

  /**
   * Search for hotels with current parameters
   */
  searchHotels(): void {
    const dest = this.selectedDestination();
    if (!dest) return;

    this.searchingHotels.set(true);
    this.showResults.set(false);

    this.bookingService.searchHotels({
      destination: dest,
      adults: this.adults(),
      rooms: this.rooms(),
      children: this.children(),
      checkin: this.checkin() || undefined,
      checkout: this.checkout() || undefined
    }).subscribe({
      next: (results) => {
        this.hotelResults.set(results);
        this.searchingHotels.set(false);
        this.showResults.set(true);
        console.log(`Found ${results.length} hotels`);
      },
      error: (error) => {
        console.error('Hotel search error:', error);
        this.searchingHotels.set(false);
        this.hotelResults.set([]);
      }
    });
  }

  /**
   * Open Booking.com search with selected destination
   */
  searchOnBooking(): void {
    const dest = this.selectedDestination();
    if (!dest) return;

    const { destId, destType } = dest.destination;
    const url = `https://www.booking.com/searchresults.html?dest_id=${destId}&dest_type=${destType}`;
    window.open(url, '_blank');
  }

  /**
   * Open hotel detail page
   */
  openHotelDetail(hotel: HotelCard): void {
    if (hotel.link) {
      window.open(hotel.link, '_blank');
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   */
  getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Refresh pageview ID
   */
  refreshPageViewId(): void {
    this.bookingService.refreshPageViewId();
  }

  /**
   * Quick search for popular destination
   */
  quickSearch(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
    this.showSuggestions.set(true);
  }
}

