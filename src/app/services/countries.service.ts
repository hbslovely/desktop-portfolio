import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export interface Country {
  name: {
    common: string;
    official: string;
    nativeName?: { [key: string]: { official: string; common: string } };
  };
  cca2: string;
  cca3: string;
  ccn3?: string;
  cioc?: string;
  capital?: string[];
  region: string;
  subregion?: string;
  languages?: { [key: string]: string };
  currencies?: { [key: string]: { name: string; symbol: string } };
  population?: number;
  area?: number;
  flag?: string;
  flags?: {
    png?: string;
    svg?: string;
    alt?: string;
  };
  coatOfArms?: {
    png?: string;
    svg?: string;
  };
  maps?: {
    googleMaps?: string;
    openStreetMaps?: string;
  };
  timezones: string[];
  continents: string[];
  borders?: string[];
  tld?: string[];
  latlng: number[];
  demonyms?: {
    eng?: {
      f: string;
      m: string;
    };
    fra?: {
      f: string;
      m: string;
    };
  };
  gini?: { [key: string]: number };
  fifa?: string;
  car: {
    signs?: string[];
    side: string;
  };
  startOfWeek?: string;
  capitalInfo?: {
    latlng?: number[];
  };
  postalCode?: {
    format: string;
    regex: string;
  };
  independent?: boolean;
  unMember?: boolean;
  status?: string;
  idd?: {
    root?: string;
    suffixes?: string[];
  };
  altSpellings?: string[];
  translations?: { [key: string]: { official: string; common: string } };
  landlocked?: boolean;
}

export interface CountrySearchParams {
  name?: string;
  region?: string;
  subregion?: string;
  currency?: string;
  language?: string;
  capital?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CountriesService {
  private readonly BASE_URL = 'https://restcountries.com/v3.1';
  
  // Essential fields (limited to important ones for performance)
  // Note: REST Countries API allows us to fetch all fields without limit for non-/all endpoints
  private readonly ESSENTIAL_FIELDS = 'name,flags,capital,region,population,cca2,cca3,area,borders,latlng';

  constructor(private http: HttpClient) {}

  /**
   * Get all countries
   * Note: The /all endpoint requires fields parameter
   */
  getAllCountries(): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.BASE_URL}/all?fields=${this.ESSENTIAL_FIELDS}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error fetching all countries:', error);
          return of([]);
        })
      );
  }

  /**
   * Search countries by name
   */
  searchByName(name: string): Observable<Country[]> {
    if (!name || name.trim().length === 0) {
      return this.getAllCountries();
    }
    return this.http.get<Country[]>(`${this.BASE_URL}/name/${encodeURIComponent(name)}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error searching by name:', error);
          return of([]);
        })
      );
  }

  /**
   * Filter countries by region
   */
  getByRegion(region: string): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.BASE_URL}/region/${encodeURIComponent(region)}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error fetching by region:', error);
          return of([]);
        })
      );
  }

  /**
   * Filter countries by subregion
   */
  getBySubregion(subregion: string): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.BASE_URL}/subregion/${encodeURIComponent(subregion)}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error fetching by subregion:', error);
          return of([]);
        })
      );
  }

  /**
   * Search by capital city
   */
  searchByCapital(capital: string): Observable<Country[]> {
    if (!capital || capital.trim().length === 0) {
      return of([]);
    }
    return this.http.get<Country[]>(`${this.BASE_URL}/capital/${encodeURIComponent(capital)}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error searching by capital:', error);
          return of([]);
        })
      );
  }

  /**
   * Filter by currency
   */
  getByCurrency(currency: string): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.BASE_URL}/currency/${encodeURIComponent(currency)}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error fetching by currency:', error);
          return of([]);
        })
      );
  }

  /**
   * Filter by language
   */
  getByLanguage(language: string): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.BASE_URL}/lang/${encodeURIComponent(language)}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error fetching by language:', error);
          return of([]);
        })
      );
  }

  /**
   * Get country by code (alpha2 or alpha3)
   * This endpoint returns full country details without field restrictions
   */
  getByCode(code: string): Observable<Country | null> {
    return this.http.get<Country>(`${this.BASE_URL}/alpha/${encodeURIComponent(code)}`)
      .pipe(
        map(country => country || null),
        catchError(error => {
          console.error('Error fetching by code:', error);
          return of(null);
        })
      );
  }

  /**
   * Get multiple countries by codes
   */
  getByCodes(codes: string[]): Observable<Country[]> {
    if (!codes || codes.length === 0) {
      return of([]);
    }
    const codesParam = codes.join(',');
    return this.http.get<Country[]>(`${this.BASE_URL}/alpha?codes=${codesParam}`)
      .pipe(
        map(countries => this.sortCountries(countries)),
        catchError(error => {
          console.error('Error fetching by codes:', error);
          return of([]);
        })
      );
  }

  /**
   * Sort countries alphabetically by common name
   */
  private sortCountries(countries: Country[]): Country[] {
    return countries.sort((a, b) => 
      a.name.common.localeCompare(b.name.common)
    );
  }

  /**
   * Get unique regions from all countries
   */
  getRegions(): string[] {
    return ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'];
  }

  /**
   * Format population number
   */
  formatPopulation(population?: number): string {
    if (!population && population !== 0) return 'N/A';
    if (population >= 1000000000) {
      return (population / 1000000000).toFixed(2) + 'B';
    } else if (population >= 1000000) {
      return (population / 1000000).toFixed(2) + 'M';
    } else if (population >= 1000) {
      return (population / 1000).toFixed(2) + 'K';
    }
    return population.toString();
  }

  /**
   * Format area number
   */
  formatArea(area?: number): string {
    if (!area && area !== 0) return 'N/A';
    return area.toLocaleString('en-US') + ' km²';
  }

  /**
   * Get languages as string
   */
  getLanguagesString(languages?: { [key: string]: string }): string {
    if (!languages) return 'N/A';
    return Object.values(languages).join(', ');
  }

  /**
   * Get currencies as string
   */
  getCurrenciesString(currencies?: { [key: string]: { name: string; symbol: string } }): string {
    if (!currencies) return 'N/A';
    return Object.values(currencies).map(c => `${c.name} (${c.symbol})`).join(', ');
  }

  /**
   * Get capital as string
   */
  getCapitalString(capital?: string[]): string {
    if (!capital || capital.length === 0) return 'N/A';
    return capital.join(', ');
  }
}

