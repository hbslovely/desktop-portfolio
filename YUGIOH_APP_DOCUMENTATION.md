# Yu-Gi-Oh! Card Database App

## Overview

A comprehensive Yu-Gi-Oh! card database application that integrates with the YGOPRODeck API to provide access to the complete card collection with powerful search, filtering, and viewing capabilities.

## Features

### 1. Complete Card Database
- **13,000+ Cards**: Access to the entire Yu-Gi-Oh! card database
- **Real-time Data**: Fetches fresh data from YGOPRODeck API
- **Smart Caching**: Caches data locally to reduce API calls

### 2. Advanced Search & Filtering
- **Text Search**: Search by card name or description
- **Frame Type Filter**: Normal, Effect, Fusion, Synchro, XYZ, Link, Ritual, Spell, Trap
- **Type Filter**: Effect Monster, Normal Monster, Spell Card, Trap Card, etc.
- **Race Filter**: Spellcaster, Warrior, Dragon, Machine, etc.
- **Attribute Filter**: DARK, LIGHT, EARTH, WATER, FIRE, WIND, DIVINE
- **Sort Options**: Name, ATK, DEF, Level, Type

### 3. View Modes
- **Grid View**: Card thumbnail grid with images
- **List View**: Detailed list with descriptions and stats
- **Responsive Layout**: Adapts to different screen sizes

### 4. Card Details
- **Full Card Image**: High-resolution card artwork
- **Complete Stats**: ATK, DEF, Level, Scale, Link values
- **Card Description**: Full effect text
- **Archetype Information**: Shows card archetype when available
- **External Link**: Direct link to YGOPRODeck website

### 5. Statistics Dashboard
- **Total Cards**: Count of filtered results
- **Monster Cards**: Count of monster type cards
- **Spell Cards**: Count of spell cards
- **Trap Cards**: Count of trap cards

### 6. Additional Features
- **Random Card**: Get a random card from the database
- **Pagination**: Browse through results 50 cards at a time
- **Lazy Loading**: Images load as you scroll for better performance
- **Attribute Icons**: Visual emoji indicators for card attributes

## API Integration

### YGOPRODeck API v7
- **Base URL**: `https://db.ygoprodeck.com/api/v7/`
- **Documentation**: [https://ygoprodeck.com/api-guide/](https://ygoprodeck.com/api-guide/)
- **Rate Limit**: 20 requests per second
- **Caching**: 2-day cache on API responses

### API Endpoints Used
1. **Get All Cards**: `/cardinfo.php`
2. **Search Cards**: `/cardinfo.php?fname={query}&type={type}&race={race}`
3. **Random Card**: `/randomcard.php`
4. **Card Sets**: `/cardsets.php`
5. **Archetypes**: `/archetypes.php`

### Card Image URLs
- **Normal**: `https://images.ygoprodeck.com/images/cards/{cardId}.jpg`
- **Small**: `https://images.ygoprodeck.com/images/cards_small/{cardId}.jpg`
- **Cropped**: `https://images.ygoprodeck.com/images/cards_cropped/{cardId}.jpg`

## File Structure

```
src/app/
├── services/
│   └── yugioh.service.ts                    # API service
└── components/apps/yugioh-app/
    ├── yugioh-app.component.ts              # Component logic
    ├── yugioh-app.component.html            # Template
    └── yugioh-app.component.scss            # Styles
```

## Technical Implementation

### Service Layer (yugioh.service.ts)

```typescript
export class YugiohService {
  // Core Methods
  getAllCards(): Observable<YugiohCard[]>
  searchCards(filters: FilterOptions): Observable<YugiohCard[]>
  getCardById(id: number): Observable<YugiohCard | null>
  getRandomCard(): Observable<YugiohCard | null>
  
  // Helper Methods
  getCardImageUrl(cardId: number, size: string): string
  getUniqueTypes(cards: YugiohCard[]): string[]
  getUniqueRaces(cards: YugiohCard[]): string[]
  getUniqueFrameTypes(cards: YugiohCard[]): string[]
  getUniqueAttributes(cards: YugiohCard[]): string[]
}
```

### Component Features

#### State Management with Signals
```typescript
allCards = signal<YugiohCard[]>([]);
filteredCards = signal<YugiohCard[]>([]);
isLoading = signal(true);
selectedCard = signal<YugiohCard | null>(null);
searchQuery = signal('');
selectedType = signal('');
selectedRace = signal('');
selectedFrameType = signal('');
```

#### Computed Values
```typescript
availableTypes = computed(() => /* unique types from all cards */);
paginatedCards = computed(() => /* paginated results */);
totalPages = computed(() => /* total page count */);
totalCards = computed(() => /* filtered count */);
monsterCards = computed(() => /* monster count */);
```

### UI Design

#### Color-Coded Frame Types
- **Normal**: Yellow (#fde68a)
- **Effect**: Orange (#fb923c)
- **Ritual**: Blue (#60a5fa)
- **Fusion**: Purple (#a78bfa)
- **Synchro**: White (#f0f0f0)
- **XYZ**: Black (#1f2937)
- **Link**: Blue (#3b82f6)
- **Spell**: Green (#34d399)
- **Trap**: Pink (#ec4899)

#### Responsive Breakpoints
- **Desktop**: Multi-column grid (auto-fill, minmax(180px, 1fr))
- **Tablet**: Adjusted column count
- **Mobile**: Single column list view

## Usage Guide

### Opening the App
1. Double-click the "Yu-Gi-Oh! Cards" desktop icon
2. Or open from Start Menu → Information → Yu-Gi-Oh! Cards
3. Or search for "yugioh" or "cards" in the system search

### Searching for Cards
1. Type in the search box to filter by name or description
2. Use dropdown filters to narrow results:
   - Frame Type (e.g., Effect Monster, Spell)
   - Type (e.g., Effect Monster, Fusion Monster)
   - Race (e.g., Dragon, Spellcaster)
   - Attribute (e.g., DARK, LIGHT)
3. Change sort order using the Sort dropdown
4. Click "Clear Filters" to reset all filters

### Viewing Card Details
1. Click any card in grid or list view
2. Modal opens with full details:
   - High-resolution card image
   - Complete stats (ATK, DEF, Level, etc.)
   - Full card description/effect
   - Archetype information
   - Link to YGOPRODeck website
3. Click outside modal or X button to close

### Switching View Modes
- Click the grid/list icon in the header to toggle between:
  - **Grid View**: Compact card thumbnails
  - **List View**: Detailed list with descriptions

### Navigation
- Use pagination buttons at the bottom to browse through results
- Shows 50 cards per page
- Page X of Y indicator shows current position

## Performance Optimizations

1. **Image Lazy Loading**: Images load only when scrolling into view
2. **API Caching**: First load caches all cards locally
3. **Virtual Scrolling**: Only renders visible cards
4. **Debounced Search**: Search executes after user stops typing
5. **Computed Signals**: Efficient reactive updates

## API Compliance

As per YGOPRODeck API guidelines:

### ✅ What We Do Right
- Cache API responses locally
- Use proper rate limiting (20 req/sec)
- Reference card images from YGOPRODeck CDN
- Provide attribution to YGOPRODeck
- Handle error responses gracefully

### ⚠️ Important Notes
- **Do NOT hotlink images repeatedly**: Images are loaded from YGOPRODeck CDN
- **Do NOT download all images**: This would violate API terms
- **Store locally**: We cache card data, not images
- Images are loaded on-demand from CDN URLs

## Browser Compatibility

✅ Chrome/Edge: Full support
✅ Firefox: Full support
✅ Safari: Full support
✅ Mobile browsers: Responsive design

## Future Enhancements

Potential features to add:
- [ ] Deck building functionality
- [ ] Card comparison tool
- [ ] Advanced filters (ATK/DEF ranges)
- [ ] Save favorite cards
- [ ] Export card lists
- [ ] Price tracking integration
- [ ] Card set filters
- [ ] Format legality filters (TCG, OCG, etc.)
- [ ] Offline mode with IndexedDB
- [ ] Card game simulator

## Integration with Desktop Portfolio

### Window Manager
- Registered in `window-registry.ts`
- Opens via WindowManager service
- Fully integrated with window management system

### App Configuration
- Added to `app-icons.config.ts`
- Desktop icon position: (320, 120)
- Start menu category: Information
- Search keywords: cards, trading, game, deck, monster, spell, trap, duel

### Component Registration
- Imported in `app.component.ts`
- Added to dynamic component rendering
- Handles window lifecycle events

## Credits

- **API Provider**: [YGOPRODeck](https://ygoprodeck.com/)
- **Card Data**: Konami Digital Entertainment
- **Card Images**: YGOPRODeck CDN
- **Implementation**: Desktop Portfolio Team

## License Notice

The literal and graphical information presented about Yu-Gi-Oh!, including card images, the attribute, level/rank and type symbols, and card text, is copyright 4K Media Inc, a subsidiary of Konami Digital Entertainment, Inc. This application is not produced by, endorsed by, supported by, or affiliated with 4k Media or Konami Digital Entertainment.

## Support

For issues or suggestions:
1. Check the console for error messages
2. Verify internet connection for API access
3. Clear browser cache if data seems stale
4. Report bugs via the project repository

## API Rate Limit Handling

The app includes built-in rate limiting protection:
- Maximum 20 requests per second
- If exceeded, 1-hour block from API
- Caching minimizes API calls
- Batch operations for efficiency

