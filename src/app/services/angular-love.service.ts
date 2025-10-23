import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom, of, throwError } from 'rxjs';
import { catchError, tap, retry } from 'rxjs/operators';

export interface AngularLoveAuthor {
  slug: string;
  name: string;
  avatarUrl: string;
  titles?: string[];
  github?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  position?: string;
  description?: string;
}

export interface AngularLoveArticle {
  slug: string;
  title: string;
  excerpt: string;
  featuredImageUrl: string;
  readingTime: number;
  publishDate: string;
  hidden?: string;
  author: AngularLoveAuthor;
}

export interface AngularLoveArticlesResponse {
  data: AngularLoveArticle[];
  total: string | number;
}

export interface AngularLoveAnchor {
  title: string;
  type: string;
}

export interface AngularLoveSEO {
  title: string;
  description: string;
  canonical?: string;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_image?: Array<{ url: string; width?: number; height?: number; type?: string }>;
}

export interface AngularLoveArticleDetail {
  id: number;
  content: string;
  slug: string;
  title: string;
  readingTime: number;
  publishDate: string;
  difficulty?: string;
  anchors?: AngularLoveAnchor[];
  seo?: AngularLoveSEO;
  otherTranslations?: any[];
  language?: number;
  author: AngularLoveAuthor;
}

export interface AngularLoveAuthorDetail {
  slug: string;
  name: string;
  description: {
    pl?: string;
    en?: string;
  };
  avatarUrl: string;
  position: string;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  titles: string[];
}

interface StoredApiUrl {
  url: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AngularLoveService {
  private baseUrlSubject = new BehaviorSubject<string>('https://0dd7e866-blog-bff.contact-ef8.workers.dev');
  public baseUrl$ = this.baseUrlSubject.asObservable();
  
  // Fallback URL in case fetching fails
  private readonly FALLBACK_URL = 'https://0dd7e866-blog-bff.contact-ef8.workers.dev';
  
  // Storage key for localStorage
  private readonly STORAGE_KEY = 'angular_love_api_url';
  
  // Expiration time: 3 days in milliseconds
  private readonly EXPIRATION_TIME = 3 * 24 * 60 * 60 * 1000;

  constructor(private http: HttpClient) {
    // Initialize API URL from localStorage or fetch new one
    this.initializeApiUrl();
  }

  /**
   * Initialize API URL from localStorage or fetch new one
   */
  private initializeApiUrl(): void {
    const stored = this.getStoredApiUrl();
    
    if (stored && !this.isExpired(stored.timestamp)) {
      // Use stored URL if not expired
      this.baseUrlSubject.next(stored.url);
      console.log('Using cached API URL:', stored.url);
    } else {
      // Fetch new URL if expired or not found
      console.log('Cached URL expired or not found, fetching new one...');
      this.fetchAndStoreApiUrl();
    }
  }

  /**
   * Get stored API URL from localStorage
   */
  private getStoredApiUrl(): StoredApiUrl | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as StoredApiUrl;
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    return null;
  }

  /**
   * Store API URL in localStorage with timestamp
   */
  private storeApiUrl(url: string): void {
    try {
      const data: StoredApiUrl = {
        url,
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('API URL cached for 3 days:', url);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  /**
   * Check if stored timestamp is expired (older than 3 days)
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.EXPIRATION_TIME;
  }

  /**
   * Fetch and store new API URL
   */
  private fetchAndStoreApiUrl(): void {
    this.fetchApiUrl().then(() => {
      const currentUrl = this.baseUrlSubject.value;
      this.storeApiUrl(currentUrl);
    }).catch(error => {
      console.error('Failed to fetch API URL, using fallback:', error);
    });
  }

  /**
   * Fetch the API URL from angular.love's JavaScript files
   */
  private async fetchApiUrl(): Promise<void> {
    try {
      // First, fetch the main HTML page to get the current script references
      const htmlResponse = await firstValueFrom(
        this.http.get('https://angular.love/news', { responseType: 'text' })
      );
      
      // Look for script tags to find the chunk file that might contain config
      // We're looking for chunk-OCQ5UGTF.js or similar pattern
      const scriptMatches = htmlResponse.match(/chunk-[A-Z0-9]+\.js/g);
      
      if (!scriptMatches) {
        throw new Error('No chunk files found');
      }

      // Try to find the config chunk (usually contains AL_API_URL)
      for (const scriptFile of scriptMatches) {
        try {
          const scriptUrl = `https://angular.love/${scriptFile}`;
          const scriptContent = await firstValueFrom(
            this.http.get(scriptUrl, { responseType: 'text' })
          );

          // Look for AL_API_URL in the script content
          const apiUrlMatch = scriptContent.match(/AL_API_URL\s*:\s*"([^"]+)"/);
          
          if (apiUrlMatch && apiUrlMatch[1]) {
            const newUrl = apiUrlMatch[1];
            this.baseUrlSubject.next(newUrl);
            console.log('Found and updated API URL:', newUrl);
            return;
          }
        } catch (error) {
          // Continue to next file if this one fails
          continue;
        }
      }
      
      console.warn('AL_API_URL not found in any chunk files, using fallback');
      this.baseUrlSubject.next(this.FALLBACK_URL);
    } catch (error) {
      console.error('Error fetching API URL:', error);
      this.baseUrlSubject.next(this.FALLBACK_URL);
    }
  }

  /**
   * Handle API call failure by fetching new URL
   */
  private handleApiFailure(): void {
    console.warn('API call failed, attempting to refresh API URL...');
    this.fetchAndStoreApiUrl();
  }

  /**
   * Get the current BASE_URL
   */
  private getCurrentBaseUrl(): string {
    return this.baseUrlSubject.value;
  }

  /**
   * Get list of articles with pagination and category filter
   */
  getArticles(take: number = 12, skip: number = 0, category?: string): Observable<AngularLoveArticlesResponse> {
    let params = new HttpParams()
      .set('take', take.toString())
      .set('skip', skip.toString());
    
    if (category) {
      params = params.set('category', category);
    }

    return this.http.get<AngularLoveArticlesResponse>(`${this.getCurrentBaseUrl()}/articles`, { params }).pipe(
      catchError((error) => {
        console.error('Failed to fetch articles:', error);
        // Trigger API URL refresh on failure
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get article detail by slug
   */
  getArticleBySlug(slug: string): Observable<AngularLoveArticleDetail> {
    return this.http.get<AngularLoveArticleDetail>(`${this.getCurrentBaseUrl()}/articles/${slug}`).pipe(
      catchError((error) => {
        console.error('Failed to fetch article:', error);
        // Trigger API URL refresh on failure
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get author detail by slug
   */
  getAuthorBySlug(slug: string): Observable<AngularLoveAuthorDetail> {
    return this.http.get<AngularLoveAuthorDetail>(`${this.getCurrentBaseUrl()}/authors/${slug}`).pipe(
      catchError((error) => {
        console.error('Failed to fetch author:', error);
        // Trigger API URL refresh on failure
        this.handleApiFailure();
        return throwError(() => error);
      })
    );
  }
}

