import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountriesService, Country } from '../../../services/countries.service';

type ViewMode = 'list' | 'detail';
type FilterType = 'all' | 'name' | 'region' | 'capital' | 'language';
type DisplayType = 'grid' | 'list';
type SortType = 'name' | 'population' | 'area' | 'region';
type GroupType = 'none' | 'region' | 'population' | 'size' | 'name';

@Component({
  selector: 'app-countries-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './countries-app.component.html',
  styleUrls: ['./countries-app.component.scss']
})
export class CountriesAppComponent implements OnInit {
  countries = signal<Country[]>([]);
  filteredCountries = signal<Country[]>([]);
  selectedCountry = signal<Country | null>(null);
  borderCountries = signal<Country[]>([]);
  
  loading = signal<boolean>(true);
  loadingDetail = signal<boolean>(false);
  error = signal<string | null>(null);
  viewMode = signal<ViewMode>('list');
  
  searchQuery = signal<string>('');
  filterType = signal<FilterType>('all');
  selectedRegion = signal<string>('all');
  
  // New features
  displayType = signal<DisplayType>('grid');
  sortType = signal<SortType>('name');
  sortOrder = signal<'asc' | 'desc'>('asc');
  groupType = signal<GroupType>('none');
  collapsedGroups = signal<Set<string>>(new Set());
  showAllTranslations = signal<boolean>(false);
  
  regions = ['all', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'];
  
  // Common languages for translations
  private readonly COMMON_LANGUAGES = ['ENG', 'ZHO', 'SPA', 'FRA', 'DEU', 'JPN', 'POR', 'RUS', 'ARA', 'KOR', 'ITA', 'NLD'];
  
  // Computed values
  displayedCountries = computed(() => {
    let countries = this.filteredCountries();
    const query = this.searchQuery().toLowerCase();
    
    // Apply search filter
    if (query) {
      countries = countries.filter(country => 
        country.name.common.toLowerCase().includes(query) ||
        country.name.official.toLowerCase().includes(query) ||
        country.capital?.some(cap => cap.toLowerCase().includes(query)) ||
        country.region.toLowerCase().includes(query) ||
        this.countriesService.getLanguagesString(country.languages).toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    countries = this.sortCountries(countries, this.sortType(), this.sortOrder());
    
    return countries;
  });

  // Grouped countries for display
  groupedCountries = computed(() => {
    const countries = this.displayedCountries();
    const groupType = this.groupType();
    
    if (groupType === 'none') {
      return { 'All Countries': countries };
    }
    
    const grouped: { [key: string]: Country[] } = {};
    
    countries.forEach(country => {
      let key = 'Other';
      
      switch (groupType) {
        case 'region':
          key = country.region || 'Unknown';
          break;
        case 'population':
          key = this.getPopulationCategory(country.population);
          break;
        case 'size':
          key = this.getSizeCategory(country.area);
          break;
        case 'name':
          key = this.getNameCategory(country.name.common);
          break;
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(country);
    });
    
    // Sort groups with custom order for population and size
    const sortOrder = this.getGroupSortOrder(groupType);
    const sortedKeys = sortOrder.length > 0
      ? sortOrder.filter(key => grouped[key])
      : Object.keys(grouped).sort();
    
    return sortedKeys.reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {} as { [key: string]: Country[] });
  });

  getGroupKeys(): string[] {
    return Object.keys(this.groupedCountries());
  }

  getPopulationCategory(population?: number): string {
    if (!population && population !== 0) return '❓ Unknown';
    if (population >= 100000000) return '🌟 Very Large (100M+)';
    if (population >= 50000000) return '🔷 Large (50M - 100M)';
    if (population >= 10000000) return '🔹 Medium-Large (10M - 50M)';
    if (population >= 1000000) return '🔸 Medium (1M - 10M)';
    if (population >= 100000) return '⚪ Small (100K - 1M)';
    return '⚫ Very Small (< 100K)';
  }

  getSizeCategory(area?: number): string {
    if (!area && area !== 0) return '❓ Unknown';
    if (area >= 5000000) return '🌍 Massive (5M+ km²)';
    if (area >= 1000000) return '🗺️ Very Large (1M - 5M km²)';
    if (area >= 500000) return '📍 Large (500K - 1M km²)';
    if (area >= 100000) return '📌 Medium (100K - 500K km²)';
    if (area >= 10000) return '📎 Small (10K - 100K km²)';
    return '🔹 Very Small (< 10K km²)';
  }

  getNameCategory(name: string): string {
    if (!name) return '#';
    const firstChar = name.charAt(0).toUpperCase();
    // Check if it's a letter
    if (firstChar >= 'A' && firstChar <= 'Z') {
      return firstChar;
    }
    return '#'; // For names starting with numbers or special characters
  }

  getGroupSortOrder(groupType: GroupType): string[] {
    switch (groupType) {
      case 'population':
        return [
          '🌟 Very Large (100M+)',
          '🔷 Large (50M - 100M)',
          '🔹 Medium-Large (10M - 50M)',
          '🔸 Medium (1M - 10M)',
          '⚪ Small (100K - 1M)',
          '⚫ Very Small (< 100K)'
        ];
      case 'size':
        return [
          '🌍 Massive (5M+ km²)',
          '🗺️ Very Large (1M - 5M km²)',
          '📍 Large (500K - 1M km²)',
          '📌 Medium (100K - 500K km²)',
          '📎 Small (10K - 100K km²)',
          '🔹 Very Small (< 10K km²)'
        ];
      case 'name':
        // A-Z alphabetical order, with # at the end
        return [
          'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
          'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'
        ];
      default:
        return [];
    }
  }

  constructor(private countriesService: CountriesService) {}

  ngOnInit() {
    this.loadAllCountries();
  }

  async loadAllCountries() {
    this.loading.set(true);
    this.error.set(null);

    this.countriesService.getAllCountries().subscribe({
      next: (data) => {
        this.countries.set(data);
        this.filteredCountries.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load countries data. Please try again.');
        this.loading.set(false);
        console.error('Countries error:', err);
      }
    });
  }

  onSearchChange(query: string) {
    this.searchQuery.set(query);
  }

  filterByRegion(region: string) {
    this.selectedRegion.set(region);
    
    if (region === 'all') {
      this.filteredCountries.set(this.countries());
      return;
    }

    // Filter from existing countries instead of making new API call
    const filtered = this.countries().filter(c => c.region === region);
    this.filteredCountries.set(filtered);
  }

  sortCountries(countries: Country[], sortType: SortType, order: 'asc' | 'desc'): Country[] {
    const sorted = [...countries].sort((a, b) => {
      let comparison = 0;
      
      switch (sortType) {
        case 'name':
          comparison = a.name.common.localeCompare(b.name.common);
          break;
        case 'population':
          comparison = (a.population || 0) - (b.population || 0);
          break;
        case 'area':
          comparison = (a.area || 0) - (b.area || 0);
          break;
        case 'region':
          comparison = a.region.localeCompare(b.region);
          break;
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }

  setSortType(type: SortType) {
    if (this.sortType() === type) {
      // Toggle sort order if same type
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortType.set(type);
      this.sortOrder.set('asc');
    }
  }

  setDisplayType(type: DisplayType) {
    this.displayType.set(type);
  }

  setGroupType(type: GroupType) {
    this.groupType.set(type);
    // Clear collapsed groups when changing group type
    this.collapsedGroups.set(new Set());
  }

  toggleGroupCollapse(groupKey: string) {
    const collapsed = new Set(this.collapsedGroups());
    if (collapsed.has(groupKey)) {
      collapsed.delete(groupKey);
    } else {
      collapsed.add(groupKey);
    }
    this.collapsedGroups.set(collapsed);
  }

  isGroupCollapsed(groupKey: string): boolean {
    return this.collapsedGroups().has(groupKey);
  }

  selectCountry(country: Country) {
    // Switch to detail view immediately with basic data
    this.selectedCountry.set(country);
    this.viewMode.set('detail');
    this.loadingDetail.set(true);
    
    // Fetch full country details in the background
    // This ensures we have all fields, not just the 10 from the list view
    this.countriesService.getByCode(country.cca2 || country.cca3).subscribe({
      next: (fullCountry) => {
        if (fullCountry) {
          this.selectedCountry.set(fullCountry);
          this.loadBorderCountries(fullCountry);
        } else {
          // Keep the basic country data if full fetch fails
          this.loadBorderCountries(country);
        }
        this.loadingDetail.set(false);
      },
      error: (err) => {
        console.error('Error fetching full country details:', err);
        // Keep the basic country data and still load borders
        this.loadBorderCountries(country);
        this.loadingDetail.set(false);
      }
    });
  }

  loadBorderCountries(country: Country) {
    if (!country.borders || country.borders.length === 0) {
      this.borderCountries.set([]);
      return;
    }

    this.countriesService.getByCodes(country.borders).subscribe({
      next: (data) => {
        this.borderCountries.set(data);
      },
      error: (err) => {
        console.error('Error loading border countries:', err);
        this.borderCountries.set([]);
      }
    });
  }

  backToList() {
    this.viewMode.set('list');
    this.selectedCountry.set(null);
    this.borderCountries.set([]);
  }

  openMap(country: Country, type: 'google' | 'osm' = 'google') {
    if (!country.maps) return;
    const url = type === 'google' ? country.maps.googleMaps : country.maps.openStreetMaps;
    if (url) {
      window.open(url, '_blank');
    }
  }

  openCapitalOnMap(country: Country) {
    if (country.capitalInfo?.latlng && country.capitalInfo.latlng.length >= 2) {
      const lat = country.capitalInfo.latlng[0];
      const lng = country.capitalInfo.latlng[1];
      const capitalName = this.getCapital(country);
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(capitalName)}`;
      window.open(url, '_blank');
    }
  }

  toggleAllTranslations() {
    this.showAllTranslations.set(!this.showAllTranslations());
  }

  // Helper methods
  formatPopulation(population?: number): string {
    return this.countriesService.formatPopulation(population);
  }

  formatArea(area?: number): string {
    return this.countriesService.formatArea(area);
  }

  getLanguages(country: Country): string {
    return this.countriesService.getLanguagesString(country.languages);
  }

  getCurrencies(country: Country): string {
    return this.countriesService.getCurrenciesString(country.currencies);
  }

  getCapital(country: Country): string {
    return this.countriesService.getCapitalString(country.capital);
  }

  getNativeName(country: Country): string {
    if (!country.name?.nativeName) return country.name?.common || 'N/A';
    const firstNative = Object.values(country.name.nativeName)[0];
    return firstNative ? firstNative.common : country.name?.common || 'N/A';
  }

  getNativeNames(country: Country): { lang: string; official: string; common: string }[] {
    if (!country.name?.nativeName) return [];
    return Object.entries(country.name.nativeName).map(([code, names]) => ({
      lang: code.toUpperCase(),
      official: names.official,
      common: names.common
    }));
  }

  getCurrencyList(country: Country): { name: string; symbol: string; code: string }[] {
    if (!country.currencies) return [];
    return Object.entries(country.currencies).map(([code, curr]) => ({
      code,
      name: curr.name,
      symbol: curr.symbol
    }));
  }

  getLanguageList(country: Country): { code: string; name: string }[] {
    if (!country.languages) return [];
    return Object.entries(country.languages).map(([code, name]) => ({
      code,
      name
    }));
  }

  getTimezones(country: Country): string[] {
    return country.timezones || [];
  }

  getDemonym(country: Country): string {
    if (country.demonyms?.eng) {
      const m = country.demonyms.eng.m;
      const f = country.demonyms.eng.f;
      if (m && f && m !== f) {
        return `${m} (m) / ${f} (f)`;
      }
      return m || f || 'N/A';
    }
    if (country.demonyms?.fra) {
      const m = country.demonyms.fra.m;
      const f = country.demonyms.fra.f;
      if (m && f && m !== f) {
        return `${m} (m) / ${f} (f)`;
      }
      return m || f || 'N/A';
    }
    return 'N/A';
  }

  getGini(country: Country): string {
    if (!country.gini) return 'N/A';
    const latestYear = Object.keys(country.gini).sort().reverse()[0];
    return `${country.gini[latestYear]} (${latestYear})`;
  }

  getTLD(country: Country): string {
    return country.tld?.join(', ') || 'N/A';
  }

  getTLDList(country: Country): string[] {
    return country.tld || [];
  }

  getCarInfo(country: Country): string {
    if (!country.car) return 'N/A';
    const signs = country.car.signs?.filter(s => s).join(', ') || 'No international signs';
    const side = country.car.side === 'right' ? 'right side' : 'left side';
    return `Signs: ${signs} • Drives on the ${side}`;
  }

  getCallingCode(country: Country): string {
    if (!country.idd || !country.idd.root) return 'N/A';
    const root = country.idd.root;
    const suffixes = country.idd.suffixes || [];
    if (suffixes.length === 0) return root;
    if (suffixes.length === 1) return root + suffixes[0];
    return root + ' (' + suffixes.join(', ') + ')';
  }

  getAltSpellings(country: Country): string[] {
    // Remove duplicates and limit to reasonable number
    const spellings = country.altSpellings || [];
    const unique = [...new Set(spellings)];
    return unique.filter(s => s !== country.name.common && s !== country.cca2 && s !== country.cca3);
  }

  getTranslations(country: Country): { lang: string; name: string }[] {
    if (!country.translations) return [];
    return Object.entries(country.translations)
      .slice(0, 8)
      .map(([code, trans]) => ({
        lang: code.toUpperCase(),
        name: trans.common
      }));
  }

  getAllTranslations(country: Country): { lang: string; common: string; official: string }[] {
    if (!country.translations) return [];
    return Object.entries(country.translations).map(([code, trans]) => ({
      lang: code.toUpperCase(),
      common: trans.common,
      official: trans.official
    }));
  }

  getCommonTranslations(country: Country): { lang: string; common: string; official: string }[] {
    const all = this.getAllTranslations(country);
    return all.filter(trans => this.COMMON_LANGUAGES.includes(trans.lang));
  }

  getOtherTranslations(country: Country): { lang: string; common: string; official: string }[] {
    const all = this.getAllTranslations(country);
    return all.filter(trans => !this.COMMON_LANGUAGES.includes(trans.lang));
  }

  isPopularLanguage(lang: string): boolean {
    return ['ENG', 'ZHO', 'SPA', 'FRA', 'DEU', 'JPN'].includes(lang);
  }

  getStatus(country: Country): string {
    const status = country.status || 'unknown';
    return status.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  isLandlocked(country: Country): boolean {
    return country.landlocked || false;
  }

  getCIOC(country: Country): string {
    return country.cioc || 'N/A';
  }

  getCCN3(country: Country): string {
    return country.ccn3 || 'N/A';
  }

  getPopulationDensity(country: Country): string {
    if (!country.area || country.area === 0 || !country.population) return 'N/A';
    const density = country.population / country.area;
    return density.toFixed(2) + ' per km²';
  }

  getCapitalCoordinates(country: Country): string {
    if (!country.capitalInfo?.latlng || country.capitalInfo.latlng.length !== 2) {
      return 'N/A';
    }
    return `${country.capitalInfo.latlng[0].toFixed(4)}°, ${country.capitalInfo.latlng[1].toFixed(4)}°`;
  }

  refresh() {
    this.backToList();
    this.selectedRegion.set('all');
    this.searchQuery.set('');
    this.loadAllCountries();
  }
}

