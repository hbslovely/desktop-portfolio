import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface TuoiTreCategory {
  id: string;
  name: string;
  url: string;
}

export interface TuoiTreNewsItem {
  id: string;
  title: string;
  url: string;
  summary?: string;
  imageUrl?: string;
  publishedAt?: string;
  category?: string;
}

export interface TuoiTreArticle {
  title: string;
  content: string;
  author?: string;
  publishedAt?: string;
  imageUrl?: string;
  category?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TuoiTreService {
  private readonly BASE_URL = '/api/tuoitre';
  private readonly BASE_DOMAIN = 'https://tuoitre.vn';

  constructor(private http: HttpClient) {}

  /**
   * Fetch homepage HTML and parse categories and news
   */
  async getHomepage(): Promise<{ categories: TuoiTreCategory[]; news: TuoiTreNewsItem[] }> {
    try {
      const htmlResponse = await firstValueFrom(
        this.http.get(this.BASE_URL, { responseType: 'text' })
      );

      const categories = this.parseCategories(htmlResponse);
      const news = this.parseNewsItems(htmlResponse);

      return { categories, news };
    } catch (error) {
      console.error('Error fetching TuoiTre homepage:', error);
      throw error;
    }
  }

  /**
   * Search for news articles
   */
  async searchNews(keywords: string): Promise<TuoiTreNewsItem[]> {
    try {
      const encodedKeywords = encodeURIComponent(keywords.trim());
      const searchUrl = `/tim-kiem.htm?keywords=${encodedKeywords}`;
      const htmlResponse = await firstValueFrom(
        this.http.get(`${this.BASE_URL}${searchUrl}`, { responseType: 'text' })
      );

      return this.parseNewsItems(htmlResponse);
    } catch (error) {
      console.error('Error searching news:', error);
      throw error;
    }
  }

  /**
   * Fetch news by category
   */
  async getNewsByCategory(categoryUrl: string): Promise<TuoiTreNewsItem[]> {
    try {
      // Handle search URLs (e.g., /tim-kiem.htm?keywords=...)
      let url = categoryUrl;

      // If it's a full URL, extract the path and query
      if (categoryUrl.startsWith('http')) {
        const urlObj = new URL(categoryUrl);
        url = urlObj.pathname + urlObj.search;
      } else if (!categoryUrl.startsWith('/')) {
        url = `/${categoryUrl}`;
      }

      const htmlResponse = await firstValueFrom(
        this.http.get(`${this.BASE_URL}${url}`, { responseType: 'text' })
      );

      return this.parseNewsItems(htmlResponse);
    } catch (error) {
      console.error('Error fetching category news:', error);
      throw error;
    }
  }

  /**
   * Fetch full article content
   */
  async getArticle(articleUrl: string): Promise<TuoiTreArticle> {
    try {
      // Remove leading slash if present
      const url = articleUrl.startsWith('/') ? articleUrl : `/${articleUrl}`;
      const htmlResponse = await firstValueFrom(
        this.http.get(`${this.BASE_URL}${url}`, { responseType: 'text' })
      );

      return this.parseArticle(htmlResponse, articleUrl);
    } catch (error) {
      console.error('Error fetching article:', error);
      throw error;
    }
  }

  /**
   * Parse categories from navigation menu
   */
  private parseCategories(html: string): TuoiTreCategory[] {
    const categories: TuoiTreCategory[] = [];

    // Try to find navigation menu items
    // Look for links in navigation that match category patterns
    const navPatterns = [
      /<a[^>]*href=["']([^"']*\/video[^"']*)["'][^>]*>([^<]*Video[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/thoi-su[^"']*)["'][^>]*>([^<]*Thời sự[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/the-gioi[^"']*)["'][^>]*>([^<]*Thế giới[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/phap-luat[^"']*)["'][^>]*>([^<]*Pháp luật[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/kinh-doanh[^"']*)["'][^>]*>([^<]*Kinh doanh[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/cong-nghe[^"']*)["'][^>]*>([^<]*Công nghệ[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/xe[^"']*)["'][^>]*>([^<]*Xe[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/du-lich[^"']*)["'][^>]*>([^<]*Du lịch[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/nhip-song-tre[^"']*)["'][^>]*>([^<]*Nhịp sống trẻ[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/van-hoa[^"']*)["'][^>]*>([^<]*Văn hóa[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/giai-tri[^"']*)["'][^>]*>([^<]*Giải trí[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/the-thao[^"']*)["'][^>]*>([^<]*Thể thao[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/giao-duc[^"']*)["'][^>]*>([^<]*Giáo dục[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/nha-dat[^"']*)["'][^>]*>([^<]*Nhà đất[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']*\/suc-khoe[^"']*)["'][^>]*>([^<]*Sức khỏe[^<]*)<\/a>/i
    ];

    // Also try to find categories from the navigation structure
    // Look for common navigation patterns
    const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i) ||
                     html.match(/<ul[^>]*class=["'][^"']*nav[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);

    if (navMatch) {
      const navContent = navMatch[1];

      // Extract links from navigation
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      let match;
      const seenUrls = new Set<string>();

      while ((match = linkPattern.exec(navContent)) !== null) {
        const url = match[1];
        const text = match[2].trim();

        // Filter out non-category links
        if (url && text &&
            !url.includes('#') &&
            !url.includes('javascript:') &&
            !url.includes('mailto:') &&
            url.startsWith('/') &&
            text.length < 30 &&
            !seenUrls.has(url)) {

          // Check if it's a category link (common patterns)
          const categoryNames = ['Video', 'Thời sự', 'Thế giới', 'Pháp luật', 'Kinh doanh',
                                'Công nghệ', 'Xe', 'Du lịch', 'Nhịp sống trẻ', 'Văn hóa',
                                'Giải trí', 'Thể thao', 'Giáo dục', 'Nhà đất', 'Sức khỏe'];

          if (categoryNames.some(name => text.includes(name))) {
            const categoryId = url.split('/').filter(Boolean).pop() || url.replace(/\//g, '-');
            categories.push({
              id: categoryId,
              name: text,
              url: url
            });
            seenUrls.add(url);
          }
        }
      }
    }

    // Fallback: Use predefined categories if parsing fails
    if (categories.length === 0) {
      categories.push(
        { id: 'video', name: 'Video', url: '/video' },
        { id: 'thoi-su', name: 'Thời sự', url: '/thoi-su' },
        { id: 'the-gioi', name: 'Thế giới', url: '/the-gioi' },
        { id: 'phap-luat', name: 'Pháp luật', url: '/phap-luat' },
        { id: 'kinh-doanh', name: 'Kinh doanh', url: '/kinh-doanh' },
        { id: 'cong-nghe', name: 'Công nghệ', url: '/cong-nghe' },
        { id: 'xe', name: 'Xe', url: '/xe' },
        { id: 'du-lich', name: 'Du lịch', url: '/du-lich' },
        { id: 'nhip-song-tre', name: 'Nhịp sống trẻ', url: '/nhip-song-tre' },
        { id: 'van-hoa', name: 'Văn hóa', url: '/van-hoa' },
        { id: 'giai-tri', name: 'Giải trí', url: '/giai-tri' },
        { id: 'the-thao', name: 'Thể thao', url: '/the-thao' },
        { id: 'giao-duc', name: 'Giáo dục', url: '/giao-duc' },
        { id: 'nha-dat', name: 'Nhà đất', url: '/nha-dat' },
        { id: 'suc-khoe', name: 'Sức khỏe', url: '/suc-khoe' }
      );
    }

    return categories;
  }

  /**
   * Parse news items from HTML using DOM parsing
   * Structure: .box-category-item-main or .box-category-item
   *   - Contains: image or video
   *   - Contains: .box-category-content (title and description)
   */
  private parseNewsItems(html: string): TuoiTreNewsItem[] {
    const newsItems: TuoiTreNewsItem[] = [];
    const seenUrls = new Set<string>();
    const doc = this.parseHtmlToDom(html);

    // Find all post containers: either .box-category-item-main or .box-category-item
    const containers = doc.querySelectorAll('.box-category-item-main, .box-category-item');

    for (let i = 0; i < Math.min(containers.length, 50); i++) {
      const container = containers[i];

      // Extract image or video from the container
      let imageUrl: string | undefined;
      
      // Try to find image first
      const img = container.querySelector('img');
      if (img) {
        imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || undefined;
      } else {
        // Try to find video thumbnail
        const video = container.querySelector('video');
        if (video) {
          imageUrl = video.getAttribute('poster') || undefined;
          if (!imageUrl) {
            const videoImg = video.querySelector('img');
            imageUrl = videoImg?.getAttribute('src') || undefined;
          }
        }
      }

      // Extract content from .box-category-content
      const contentElement = container.querySelector('.box-category-content');
      if (!contentElement) continue;

      // Extract URL from link inside the box-category-content
      const link = contentElement.querySelector('a');
      if (!link) continue;

      const url = link.getAttribute('href');
      if (!url || seenUrls.has(url) || url.includes('#') || url.includes('javascript:')) {
        continue;
      }

      // Extract title - try multiple sources
      let title = '';
      
      // Try h2 or h3 first
      const heading = contentElement.querySelector('h2, h3');
      if (heading) {
        title = heading.textContent?.trim() || '';
      }
      
      // Try link title attribute
      if (!title) {
        title = link.getAttribute('title')?.trim() || '';
      }
      
      // Try span inside link
      if (!title) {
        const span = link.querySelector('span');
        title = span?.textContent?.trim() || '';
      }
      
      // Try link text content
      if (!title) {
        title = link.textContent?.trim() || '';
      }

      title = this.decodeHtmlEntities(title);
      if (!title || title.length < 10) continue;

      // Extract summary/description from box-category-content
      let summary: string | undefined;
      const sapo = contentElement.querySelector('p.sapo');
      if (sapo) {
        summary = sapo.textContent?.trim();
      } else {
        const p = contentElement.querySelector('p');
        summary = p?.textContent?.trim();
      }
      if (!summary) {
        const desc = contentElement.querySelector('.description');
        summary = desc?.textContent?.trim();
      }
      summary = summary ? this.decodeHtmlEntities(summary) : undefined;

      // Extract date - look for time or date elements in container or content
      let publishedAt: string | undefined;
      const timeElement = container.querySelector('time') || contentElement.querySelector('time');
      if (timeElement) {
        publishedAt = timeElement.textContent?.trim();
      } else {
        const timeSpan = container.querySelector('span.time, .time') || contentElement.querySelector('span.time, .time');
        publishedAt = timeSpan?.textContent?.trim();
      }
      if (!publishedAt) {
        const containerText = container.textContent || '';
        const dateMatch = containerText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
        publishedAt = dateMatch ? dateMatch[1].trim() : undefined;
      }

      // Generate ID from URL
      const id = url.split('/').filter(Boolean).pop()?.replace(/\.(html|htm)$/, '') ||
                 `article-${newsItems.length}`;

      // Only add if it looks like a news article URL
      if (url.includes('.html') || url.includes('.htm') || url.match(/\/\d{4}\/\d{2}\/\d{2}\//) || url.match(/\/\d{4}\/\d{2}\//)) {
        newsItems.push({
          id,
          title,
          url: url.startsWith('http') ? url.replace(this.BASE_DOMAIN, '') : url,
          summary,
          imageUrl: imageUrl?.startsWith('http') ? imageUrl :
                   imageUrl?.startsWith('//') ? `https:${imageUrl}` :
                   imageUrl?.startsWith('/') ? `${this.BASE_DOMAIN}${imageUrl}` : imageUrl,
          publishedAt,
          category: this.extractCategoryFromUrl(url)
        });

        seenUrls.add(url);
      }
    }

    // Fallback: Try other patterns if box-category-item didn't yield results
    if (newsItems.length === 0) {
      const articlePatterns = [
        // Pattern for article cards/items
        /<article[^>]*>([\s\S]*?)<\/article>/gi,
        // Pattern for news list items
        /<div[^>]*class=["'][^"']*article[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
        // Pattern for links with news titles
        /<a[^>]*href=["']([^"']+\/[^"']+\.(html|htm))["'][^>]*>([\s\S]*?)<\/a>/gi
      ];

      // Try to find article containers
      for (const pattern of articlePatterns) {
        let patternMatch;
        while ((patternMatch = pattern.exec(html)) !== null && newsItems.length < 50) {
          const content = patternMatch[1] || patternMatch[0];

          // Extract URL
          const urlMatch = content.match(/href=["']([^"']+)["']/i);
          if (!urlMatch) continue;

          const url = urlMatch[1];
          if (!url || seenUrls.has(url) || url.includes('#') || url.includes('javascript:')) {
            continue;
          }

          // Extract title
          const titleMatch = content.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i) ||
                              content.match(/title=["']([^"']+)["']/i) ||
                              content.match(/<a[^>]*>([^<]+)<\/a>/i);

          if (!titleMatch) continue;

          const title = this.decodeHtmlEntities(titleMatch[1].trim());
          if (!title || title.length < 10) continue;

          // Extract image
          const imageMatch = content.match(/<img[^>]*src=["']([^"']+)["']/i);
          const imageUrl = imageMatch ? imageMatch[1] : undefined;

          // Extract summary/description
          const summaryMatch = content.match(/<p[^>]*>([^<]+)<\/p>/i);
          const summary = summaryMatch ? summaryMatch[1].trim() : undefined;

          // Extract date
          const dateMatch = content.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
          const publishedAt = dateMatch ? dateMatch[1] : undefined;

          // Generate ID from URL
          const id = url.split('/').filter(Boolean).pop()?.replace(/\.(html|htm)$/, '') ||
                     `article-${newsItems.length}`;

          // Only add if it looks like a news article URL
          if (url.includes('.html') || url.includes('.htm') || url.match(/\/\d{4}\/\d{2}\/\d{2}\//)) {
            newsItems.push({
              id,
              title,
              url: url.startsWith('http') ? url.replace(this.BASE_DOMAIN, '') : url,
              summary,
              imageUrl: imageUrl?.startsWith('http') ? imageUrl :
                       imageUrl?.startsWith('//') ? `https:${imageUrl}` :
                       imageUrl?.startsWith('/') ? `${this.BASE_DOMAIN}${imageUrl}` : imageUrl,
              publishedAt,
              category: this.extractCategoryFromUrl(url)
            });

            seenUrls.add(url);
          }
        }

        if (newsItems.length > 0) break;
      }

      // Final fallback: Try simpler pattern - just find all article links
      if (newsItems.length === 0) {
        const simplePattern = /<a[^>]*href=["']([^"']+\/\d{4}\/\d{2}\/\d{2}\/[^"']+\.(?:html|htm))["'][^>]*>([^<]+)<\/a>/gi;
        let simpleMatch;
        while ((simpleMatch = simplePattern.exec(html)) !== null && newsItems.length < 50) {
          const url = simpleMatch[1];
          const title = this.decodeHtmlEntities(simpleMatch[2].trim());

          if (url && title && title.length > 10 && !seenUrls.has(url)) {
            newsItems.push({
              id: url.split('/').pop()?.replace(/\.(html|htm)$/, '') || `article-${newsItems.length}`,
              title,
              url: url.startsWith('http') ? url.replace(this.BASE_DOMAIN, '') : url,
              category: this.extractCategoryFromUrl(url)
            });
            seenUrls.add(url);
          }
        }
      }
    }

    return newsItems;
  }

  /**
   * Parse HTML string into a DOM Document
   */
  private parseHtmlToDom(html: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  /**
   * Extract innerHTML from a DOM element
   */
  private getElementContent(element: Element | null): string {
    if (!element) return '';
    return element.innerHTML || '';
  }

  /**
   * Parse full article content using DOM parsing
   */
  private parseArticle(html: string, articleUrl: string): TuoiTreArticle {
    const doc = this.parseHtmlToDom(html);

    // Extract title
    let title = '';
    const h1 = doc.querySelector('h1');
    if (h1) {
      title = h1.textContent?.trim() || '';
    }
    if (!title) {
      const titleTag = doc.querySelector('title');
      title = titleTag?.textContent?.trim() || '';
    }
    if (!title) {
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      title = ogTitle?.getAttribute('content')?.trim() || '';
    }
    title = title ? this.decodeHtmlEntities(title) : 'Untitled';

    // Extract main content - prioritize .detail__main
    let content = '';
    let contentElement: Element | null = null;

    // Try to find .detail__main element
    contentElement = doc.querySelector('.detail__main');
    if (contentElement) {
      content = this.getElementContent(contentElement);
    }

    // Try other class selectors
    if (!content) {
      const selectors = ['.detail-info', '.main-detail', '.article-content', '.content'];
      for (const selector of selectors) {
        contentElement = doc.querySelector(selector);
        if (contentElement) {
          content = this.getElementContent(contentElement);
          if (content && content.trim().length > 50) break;
        }
      }
    }

    // Try ID-based extraction
    if (!content) {
      const idSelectors = ['#main-detail', '#content'];
      for (const selector of idSelectors) {
        contentElement = doc.querySelector(selector);
        if (contentElement) {
          content = this.getElementContent(contentElement);
          if (content && content.trim().length > 50) break;
        }
      }
    }

    // Try article tag
    if (!content) {
      const article = doc.querySelector('article');
      if (article) {
        content = this.getElementContent(article);
      }
    }

    // If no specific content area found, try to extract paragraphs
    if (!content || content.trim().length < 50) {
      const paragraphs = doc.querySelectorAll('p');
      if (paragraphs.length > 0) {
        const paragraphArray: string[] = [];
        for (let i = 0; i < Math.min(20, paragraphs.length); i++) {
          paragraphArray.push(paragraphs[i].outerHTML);
        }
        content = paragraphArray.join('');
      }
    }

    // Clean up content - remove scripts, styles, ads
    content = this.cleanHtmlContent(content);

    // Extract image
    let imageUrl: string | undefined;
    const featuredImg = doc.querySelector('img.featured');
    if (featuredImg) {
      imageUrl = featuredImg.getAttribute('src') || undefined;
    }
    if (!imageUrl) {
      const ogImage = doc.querySelector('meta[property="og:image"]');
      imageUrl = ogImage?.getAttribute('content') || undefined;
    }
    if (!imageUrl) {
      const firstImg = doc.querySelector('img');
      imageUrl = firstImg?.getAttribute('src') || undefined;
    }

    // Extract author
    let author: string | undefined;
    const authorSpan = doc.querySelector('span.author, .author');
    if (authorSpan) {
      author = authorSpan.textContent?.trim();
    }
    if (!author) {
      // Try to find author in text content
      const bodyText = doc.body?.textContent || '';
      const authorMatch = bodyText.match(/Tác giả[^:]*:\s*([^\n]+)/i);
      if (authorMatch) {
        author = authorMatch[1].trim();
      }
    }

    // Extract date
    let publishedAt: string | undefined;
    const timeElement = doc.querySelector('time');
    if (timeElement) {
      publishedAt = timeElement.textContent?.trim();
    }
    if (!publishedAt) {
      const timeSpan = doc.querySelector('span.time, .time');
      publishedAt = timeSpan?.textContent?.trim();
    }
    if (!publishedAt) {
      const bodyText = doc.body?.textContent || '';
      const dateMatch = bodyText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
      publishedAt = dateMatch ? dateMatch[1] : undefined;
    }

    return {
      title,
      content: content || '<p>Nội dung không khả dụng.</p>',
      author,
      publishedAt,
      imageUrl: imageUrl?.startsWith('http') ? imageUrl :
               imageUrl?.startsWith('//') ? `https:${imageUrl}` :
               imageUrl?.startsWith('/') ? `${this.BASE_DOMAIN}${imageUrl}` : imageUrl,
      category: this.extractCategoryFromUrl(articleUrl)
    };
  }

  /**
   * Clean HTML content - remove scripts, styles, ads, etc.
   */
  private cleanHtmlContent(html: string): string {
    if (!html) return '';

    // Remove scripts
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Remove styles
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

    // Remove ads and tracking
    html = html.replace(/<div[^>]*class=["'][^"']*ad[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<div[^>]*id=["'][^"']*ad[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');

    // Fix image URLs to use proxy
    html = html.replace(/src=["']([^"']+)["']/gi, (match, url) => {
      if (url.startsWith('http')) {
        return `src="${url}"`;
      } else if (url.startsWith('//')) {
        return `src="https:${url}"`;
      } else if (url.startsWith('/')) {
        return `src="${this.BASE_DOMAIN}${url}"`;
      }
      return match;
    });

    // Fix relative links
    html = html.replace(/href=["']\/([^"']+)["']/gi, `href="/api/tuoitre/$1"`);

    return html;
  }

  /**
   * Decode HTML entities (e.g., &#7897; -> ộ)
   */
  private decodeHtmlEntities(text: string): string {
    if (!text) return '';

    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Extract category from URL
   */
  private extractCategoryFromUrl(url: string): string | undefined {
    const categoryMatch = url.match(/\/(video|thoi-su|the-gioi|phap-luat|kinh-doanh|cong-nghe|xe|du-lich|nhip-song-tre|van-hoa|giai-tri|the-thao|giao-duc|nha-dat|suc-khoe)\//i);
    return categoryMatch ? categoryMatch[1] : undefined;
  }
}

