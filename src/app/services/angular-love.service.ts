import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class AngularLoveService {
  private readonly BASE_URL = 'https://28db4e59-blog-bff.contact-ef8.workers.dev';

  constructor(private http: HttpClient) {}

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

    return this.http.get<AngularLoveArticlesResponse>(`${this.BASE_URL}/articles`, { params });
  }

  /**
   * Get article detail by slug
   */
  getArticleBySlug(slug: string): Observable<AngularLoveArticleDetail> {
    return this.http.get<AngularLoveArticleDetail>(`${this.BASE_URL}/articles/${slug}`);
  }

  /**
   * Get author detail by slug
   */
  getAuthorBySlug(slug: string): Observable<AngularLoveAuthorDetail> {
    return this.http.get<AngularLoveAuthorDetail>(`${this.BASE_URL}/authors/${slug}`);
  }
}

