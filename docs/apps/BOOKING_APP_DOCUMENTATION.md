# 🗺️ Travel Search (Booking) App Documentation

## Overview
A modern travel search application that uses Booking.com's GraphQL API to provide intelligent autocomplete search for destinations, hotels, landmarks, and more worldwide.

## Features

### ✨ Core Functionality
- **Smart Autocomplete Search**: Real-time destination search as you type
- **Debounced Input**: Efficient API calls with 300ms debounce
- **Rich Results**: Displays destination type, country flags, and details
- **Pageview ID Management**: Automatically fetches and caches pageview ID for 24 hours
- **Advanced Search Parameters**: Check-in/out dates, adults, rooms, and children inputs
- **HTML Parsing Engine**: Extracts hotel data from Booking.com search results
- **Hotel Results Display**: Beautiful grid layout with images, reviews, prices, and amenities
- **Direct Hotel Links**: Opens hotel detail pages on Booking.com

### 🎨 UI Features
- **Flat Modern Design**: Clean, professional interface with no shadows
- **Country Flags**: Emoji flags for visual country identification
- **Destination Type Badges**: City, Region, Hotel, Airport, Landmark icons
- **Popular Search Hints**: Quick access to popular destinations
- **Detailed Destination Info**: Coordinates, country code, and metadata
- **Responsive Design**: Works on all screen sizes

## API Integration

### Endpoints

#### 1. **GraphQL Autocomplete API**
```
POST /api/booking-graphql
Target: https://www.booking.com/dml/graphql?lang=en-us
```

**Request Structure:**
```graphql
query AutoComplete($input: AutoCompleteRequestInput!) {
  autoCompleteSuggestions(input: $input) {
    results {
      destination {
        countryCode
        destId
        destType
        latitude
        longitude
      }
      displayInfo {
        imageUrl
        label
        title
        subTitle
      }
      metaData {
        autocompleteResultId
        autocompleteResultSource
      }
    }
  }
}
```

**Variables:**
- `prefixQuery`: Search query string
- `nbSuggestions`: Number of results (default: 5-8)
- `pageviewId`: Session identifier from homepage
- `fallbackConfig`: Google/HERE fallback configuration

#### 2. **Homepage for Pageview ID**
```
GET /api/booking-home
Target: https://www.booking.com/
```

Extracts `pageview_id` from the HTML response, cached for 24 hours.

#### 3. **Hotel Search Results**
```
GET /api/booking-search
Target: https://www.booking.com/searchresults.html
```

**Query Parameters:**
- `ss`: Destination name (from autocomplete)
- `dest_id`: Destination ID
- `dest_type`: Type (city, region, hotel, airport, etc.)
- `group_adults`: Number of adults (default: 2)
- `no_rooms`: Number of rooms (default: 1)
- `group_children`: Number of children (default: 0)
- `checkin`: Check-in date (YYYY-MM-DD, optional)
- `checkout`: Check-out date (YYYY-MM-DD, optional)
- `map`: Show map (1)
- `search_pageview_id`: Session pageview ID

**Parsed Data:**
The HTML response is parsed to extract hotel cards with:
- Hotel images
- Title and booking link
- Review score, score word, and review count
- Address and distance from destination
- Room type and bed information
- Breakfast inclusion
- Original and current prices
- Taxes and fees information
- Availability warnings

### Proxy Configuration

Added to `proxy.conf.json`:

```json
{
  "/api/booking-graphql": {
    "target": "https://www.booking.com/dml/graphql",
    "secure": true,
    "changeOrigin": true,
    "headers": {
      "Content-Type": "application/json",
      "Referer": "https://www.booking.com/",
      "Origin": "https://www.booking.com"
    }
  },
  "/api/booking-home": {
    "target": "https://www.booking.com",
    "secure": true,
    "changeOrigin": true
  },
  "/api/booking-search": {
    "target": "https://www.booking.com/searchresults.html",
    "secure": true,
    "changeOrigin": true,
    "headers": {
      "Referer": "https://www.booking.com/"
    }
  }
}
```

## Service Architecture

### BookingService (`booking.service.ts`)

#### Key Methods

**`autoComplete(query: string, nbSuggestions: number)`**
- Performs GraphQL query for destination search
- Returns array of `BookingSuggestion` objects
- Handles errors gracefully with empty array fallback

**`getPageViewId()`**
- Returns current cached pageview ID
- Used in all autocomplete requests

**`refreshPageViewId()`**
- Manually triggers pageview ID refresh
- Useful when session expires

**`fetchPageViewId()`**
- Fetches pageview ID from Booking.com homepage
- Parses HTML to extract ID pattern: `pageview_id: 'xxxxx'`
- Falls back to generated ID if not found

**`generateFallbackPageViewId()`**
- Creates 16-character hex ID
- Used when homepage fetch fails

**`searchHotels(params: HotelSearchParams)`**
- Performs hotel search with given parameters
- Builds query string with destination, dates, and guest info
- Returns observable of parsed `HotelCard[]` array
- Gracefully handles errors with empty array

**`parseHotelCards(html: string)`**
- Parses HTML response using DOMParser
- Extracts data from `[data-testid="property-card"]` elements
- Maps all hotel information to structured objects
- Returns array of `HotelCard` objects

#### Storage Management
- **Key**: `booking_pageview_id`
- **Expiration**: 24 hours
- **Format**: `{ pageviewId: string, timestamp: number }`

## Component Architecture

### BookingAppComponent

#### Signals
- `searchQuery`: Current search input
- `suggestions`: Array of autocomplete results
- `loading`: Loading state for autocomplete
- `showSuggestions`: Dropdown visibility
- `selectedDestination`: Currently selected destination
- `adults`: Number of adults (default: 2)
- `rooms`: Number of rooms (default: 1)
- `children`: Number of children (default: 0)
- `checkin`: Check-in date string
- `checkout`: Check-out date string
- `hotelResults`: Array of hotel search results
- `searchingHotels`: Loading state for hotel search
- `showResults`: Whether to show hotel results view

#### Key Methods

**`onSearchInput(event)`**
- Handles input changes
- Triggers search for queries ≥2 characters
- Uses RxJS Subject for debouncing

**`selectDestination(suggestion)`**
- Sets selected destination
- Updates search query with destination title
- Hides suggestions dropdown

**`getCountryFlag(countryCode)`**
- Converts 2-letter country code to emoji flag
- Returns 🌍 for invalid codes

**`searchHotels()`**
- Initiates hotel search with current parameters
- Calls `BookingService.searchHotels()` with destination and guest info
- Updates `hotelResults` signal with parsed results
- Switches to results view when complete

**`openHotelDetail(hotel: HotelCard)`**
- Opens hotel detail page on Booking.com in new tab
- Uses hotel's booking link from parsed data

**`getTodayDate()`**
- Returns today's date in YYYY-MM-DD format
- Used for check-in date minimum value

**`getTomorrowDate()`**
- Returns tomorrow's date in YYYY-MM-DD format
- Used for check-out date minimum value

**`searchOnBooking()`**
- Opens Booking.com search with selected destination
- Constructs URL with destId and destType parameters
- Alternative to the new hotel search feature

## UI Components

### Search Box
- Large input with icon
- Clear button when has value
- Search button when destination selected
- Loading indicator during API calls

### Suggestions Dropdown
- Animated slide-down entrance
- Country flag + title + subtitle
- Destination type badge
- Scrollable list (max 400px)

### Popular Searches
- Quick-access chips
- Pre-populated destinations: Paris, Tokyo, New York, London, Barcelona

### Search Parameters Form
- **Date Pickers**: Check-in and check-out dates with min date validation
- **Counter Inputs**: Adults (1-30), Rooms (1-30), Children (0-10)
- **+/- Buttons**: Increment/decrement with visual feedback
- **Responsive Grid**: Auto-fit layout for different screen sizes

### Hotel Results Grid
- **Responsive Grid**: Auto-fill with 380px minimum card width
- **Hotel Cards**: Image, title, review score, address, distance, pricing
- **Hover Effects**: Border color change and elevation on hover
- **Click to Detail**: Opens full hotel page on Booking.com

### Hotel Card Components
- **Hero Image**: 220px height with zoom on hover
- **Breakfast Badge**: Green badge if breakfast included
- **Review Badge**: Score with colored background
- **Price Display**: Original price (strikethrough) + current price
- **Availability Warning**: Orange alert for limited rooms
- **View Details Button**: Primary action with arrow icon

### Results Header
- **Title with Count**: Shows number of hotels found
- **Back Button**: Returns to search parameters view

## Styling

### Color Palette
- **Primary**: `#003580` (Booking blue)
- **Secondary**: `#0057b8`
- **Accent**: `#febb02` (Booking yellow)
- **Gradient**: Blue gradient for primary actions

### Design Principles
- **Flat Design**: No box shadows, uses borders for depth
- **3px Borders**: Consistent border thickness
- **12-16px Border Radius**: Modern rounded corners
- **Hover Animations**: Subtle translateY transforms
- **Focus States**: Primary color borders with no shadow rings

## Usage Example

### Full Hotel Search Flow
1. User types "Paris" in search box
2. After 300ms debounce, autocomplete API request is sent
3. Suggestions dropdown appears with results
4. User selects "Paris, Île-de-France, France"
5. Search parameters form is displayed
6. User sets check-in/out dates (optional)
7. User adjusts adults (default: 2), rooms (default: 1), children (default: 0)
8. User clicks "Search Hotels" button
9. App fetches search results HTML from Booking.com
10. HTML is parsed to extract hotel card data
11. Hotel results grid displays with images, reviews, prices
12. User clicks on a hotel card
13. Hotel detail page opens on Booking.com in new tab

### Quick Search Flow (No Parameters)
1. User clicks popular search chip (e.g., "Tokyo")
2. Autocomplete results appear immediately
3. User selects destination from dropdown
4. User clicks "Search Hotels" with default parameters
5. Results are displayed instantly

### Code Examples

**Autocomplete Search:**
```typescript
// In your component
constructor(private bookingService: BookingService) {}

ngOnInit() {
  this.bookingService.autoComplete('Paris', 5).subscribe(results => {
    console.log('Found destinations:', results);
  });
}
```

**Hotel Search:**
```typescript
// Search for hotels in selected destination
searchHotels(destination: BookingSuggestion) {
  this.bookingService.searchHotels({
    destination: destination,
    adults: 2,
    rooms: 1,
    children: 0,
    checkin: '2025-12-20',
    checkout: '2025-12-25'
  }).subscribe(hotels => {
    console.log(`Found ${hotels.length} hotels:`, hotels);
    // Display hotel cards
  });
}
```

**Parse Hotel Data:**
```typescript
// The service automatically parses HTML to extract:
interface HotelCard {
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
```

## File Structure
```
src/app/
├── services/
│   └── booking.service.ts              # API service
├── components/apps/booking-app/
│   ├── booking-app.component.ts        # Component logic
│   ├── booking-app.component.html      # Template
│   └── booking-app.component.scss      # Flat UI styles
├── config/
│   ├── window-registry.ts              # Window config
│   └── app-icons.config.ts             # App icon & metadata
└── proxy.conf.json                     # API proxy config
```

## Development Notes

### Important Considerations
1. **Pageview ID**: Required for all API calls, refreshed daily
2. **CORS**: Handled via Angular proxy configuration
3. **Rate Limiting**: Debounce prevents excessive API calls
4. **Fallback**: Generates random ID if homepage fetch fails
5. **Error Handling**: All API errors return empty arrays gracefully
6. **HTML Parsing**: Uses DOMParser to extract structured data from Booking.com HTML
7. **Data Testids**: Relies on Booking.com's `data-testid` attributes for reliable parsing
8. **Image URLs**: May need to handle lazy-loaded images with `data-src` attribute
9. **Price Parsing**: Uses regex to extract currency and amounts from text
10. **Cross-Origin**: All hotel links open in new tabs to Booking.com

### Future Enhancements
- ✅ ~~Date range picker for hotel search~~ (Completed)
- ✅ ~~Guest count selector~~ (Completed)
- Recent searches history with localStorage
- Favorites/bookmarks for hotels
- Map integration for destinations (Google Maps/Leaflet)
- Filters (price range, rating, amenities)
- Sorting options (price, rating, distance)
- Pagination for large result sets
- Hotel comparison feature
- Price alerts and notifications

## References
- [Booking.com GraphQL API](https://www.booking.com/dml/graphql)
- Component based on Booking.com search UI patterns
- Uses RxJS for reactive programming patterns

## License
This is a demonstration project using Booking.com's public API endpoints.

---

**Created**: November 2024  
**Last Updated**: November 2024  
**Status**: ✅ Fully Functional

