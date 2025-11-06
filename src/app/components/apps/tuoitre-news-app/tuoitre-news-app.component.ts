import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuoiTreService, TuoiTreCategory, TuoiTreNewsItem, TuoiTreArticle } from '../../../services/tuoitre.service';

@Component({
  selector: 'app-tuoitre-news-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tuoitre-news-app.component.html',
  styleUrl: './tuoitre-news-app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TuoiTreNewsAppComponent implements OnInit {
  categories = signal<TuoiTreCategory[]>([]);
  newsItems = signal<TuoiTreNewsItem[]>([]);
  selectedCategory = signal<string>('all');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Article viewer state
  showArticleViewer = signal<boolean>(false);
  selectedArticle = signal<TuoiTreArticle | null>(null);
  selectedArticleUrl = signal<string>('');
  articleLoading = signal<boolean>(false);
  articleError = signal<string | null>(null);

  // Zoom state
  zoomLevel = signal<number>(100);
  readonly MIN_ZOOM = 50;
  readonly MAX_ZOOM = 200;
  readonly ZOOM_STEP = 10;

  // Expose constants for template
  get minZoom() { return this.MIN_ZOOM; }
  get maxZoom() { return this.MAX_ZOOM; }

  // Search
  searchTerm = signal<string>('');

  // Filtered news items (only for client-side filtering when not searching)
  filteredNewsItems = computed(() => {
    const items = this.newsItems();
    const search = this.searchTerm().toLowerCase().trim();
    const category = this.selectedCategory();

    // If searching via API, return items as-is (already filtered)
    if (category === 'search') {
      return items;
    }

    // Client-side filtering for local search
    if (!search) return items;

    return items.filter(item =>
      item.title.toLowerCase().includes(search) ||
      item.summary?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search)
    );
  });

  constructor(private tuoitreService: TuoiTreService) {}

  ngOnInit() {
    this.loadHomepage();
  }

  async loadHomepage() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { categories, news } = await this.tuoitreService.getHomepage();
      this.categories.set(categories);
      this.newsItems.set(news);
      this.loading.set(false);
    } catch (err) {
      console.error('Error loading homepage:', err);
      this.error.set('Không thể tải trang chủ. Vui lòng thử lại sau.');
      this.loading.set(false);
    }
  }

  async selectCategory(categoryId: string) {
    if (categoryId === 'all') {
      await this.loadHomepage();
      this.selectedCategory.set('all');
      return;
    }

    const category = this.categories().find(c => c.id === categoryId);
    if (!category) return;

    this.selectedCategory.set(categoryId);
    this.loading.set(true);
    this.error.set(null);

    try {
      const news = await this.tuoitreService.getNewsByCategory(category.url);
      this.newsItems.set(news);
      this.loading.set(false);
    } catch (err) {
      console.error('Error loading category:', err);
      this.error.set(`Không thể tải tin tức từ ${category.name}. Vui lòng thử lại sau.`);
      this.loading.set(false);
    }
  }

  async openArticle(newsItem: TuoiTreNewsItem) {
    this.selectedArticle.set(null);
    this.selectedArticleUrl.set(newsItem.url);
    this.showArticleViewer.set(true);
    this.articleLoading.set(true);
    this.articleError.set(null);

    try {
      const article = await this.tuoitreService.getArticle(newsItem.url);
      this.selectedArticle.set(article);
      this.articleLoading.set(false);
      
      // Fix image URLs after content is rendered
      setTimeout(() => {
        this.fixImageUrls();
        this.enhanceArticleContent();
        this.applyZoom(); // Apply initial zoom
      }, 100);
    } catch (err) {
      console.error('Error loading article:', err);
      this.articleError.set('Không thể tải bài viết. Vui lòng thử lại sau.');
      this.articleLoading.set(false);
    }
  }

  closeArticleViewer() {
    this.showArticleViewer.set(false);
    this.selectedArticle.set(null);
    this.selectedArticleUrl.set('');
    this.articleError.set(null);
    this.zoomLevel.set(100); // Reset zoom
  }

  zoomIn() {
    const current = this.zoomLevel();
    if (current < this.MAX_ZOOM) {
      this.zoomLevel.set(Math.min(current + this.ZOOM_STEP, this.MAX_ZOOM));
      this.applyZoom();
    }
  }

  zoomOut() {
    const current = this.zoomLevel();
    if (current > this.MIN_ZOOM) {
      this.zoomLevel.set(Math.max(current - this.ZOOM_STEP, this.MIN_ZOOM));
      this.applyZoom();
    }
  }

  resetZoom() {
    this.zoomLevel.set(100);
    this.applyZoom();
  }

  private applyZoom() {
    const zoom = this.zoomLevel();
    const articleContent = document.querySelector('.article-content') as HTMLElement;
    if (articleContent) {
      articleContent.style.fontSize = `${zoom}%`;
    }
  }

  openInNewTab() {
    const url = this.selectedArticleUrl();
    if (url) {
      window.open(`https://tuoitre.vn${url}`, '_blank');
    }
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  onSearchSubmit() {
    const search = this.searchTerm().trim();
    if (search.length > 0) {
      this.performSearch(search);
    }
  }

  async performSearch(keywords: string) {
    this.loading.set(true);
    this.error.set(null);
    this.selectedCategory.set('search');

    try {
      const news = await this.tuoitreService.searchNews(keywords);
      this.newsItems.set(news);
      this.loading.set(false);
    } catch (err) {
      console.error('Error searching news:', err);
      this.error.set('Không thể tìm kiếm tin tức. Vui lòng thử lại sau.');
      this.loading.set(false);
    }
  }

  clearSearch() {
    this.searchTerm.set('');
    // Reset to current category
    if (this.selectedCategory() === 'all' || this.selectedCategory() === 'search') {
      this.loadHomepage();
      this.selectedCategory.set('all');
    } else {
      this.selectCategory(this.selectedCategory());
    }
  }

  refreshNews() {
    if (this.selectedCategory() === 'all') {
      this.loadHomepage();
    } else if (this.selectedCategory() === 'search') {
      const search = this.searchTerm();
      if (search.trim().length > 2) {
        this.performSearch(search.trim());
      }
    } else {
      this.selectCategory(this.selectedCategory());
    }
  }

  /**
   * Fix image URLs in article content to use proxy
   */
  private fixImageUrls(): void {
    const articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    const images = articleContent.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('/api/tuoitre')) {
        if (src.startsWith('/')) {
          img.setAttribute('src', `/api/tuoitre${src}`);
        } else if (src.startsWith('//')) {
          img.setAttribute('src', `https:${src}`);
        }
      }
    });
  }

  /**
   * Enhance article content with beautiful decorations
   */
  private enhanceArticleContent(): void {
    const articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    // Wrap images in decorative containers
    const images = articleContent.querySelectorAll('img');
    images.forEach((img, index) => {
      // Skip if already wrapped
      if (img.parentElement?.classList.contains('image-wrapper')) {
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'image-wrapper';
      
      // Add caption if image has alt text
      if (img.alt && img.alt.trim()) {
        const caption = document.createElement('div');
        caption.className = 'image-caption';
        caption.textContent = img.alt;
        wrapper.appendChild(img.cloneNode(true));
        wrapper.appendChild(caption);
      } else {
        wrapper.appendChild(img.cloneNode(true));
      }

      img.parentNode?.replaceChild(wrapper, img);
    });

    // Add decorative elements to paragraphs
    const paragraphs = articleContent.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      // Add drop cap to first paragraph
      if (index === 0 && p.textContent && p.textContent.length > 0) {
        const firstChar = p.textContent.charAt(0);
        if (firstChar.match(/[A-Za-zÀ-ỹ]/)) {
          p.classList.add('has-dropcap');
          const dropCap = document.createElement('span');
          dropCap.className = 'dropcap';
          dropCap.textContent = firstChar;
          p.innerHTML = dropCap.outerHTML + p.textContent.substring(1);
        }
      }

      // Add decorative quote marks to paragraphs with quotes
      if (p.textContent && (p.textContent.startsWith('"') || p.textContent.startsWith('"'))) {
        p.classList.add('has-quote');
      }
    });

    // Enhance blockquotes
    const blockquotes = articleContent.querySelectorAll('blockquote');
    blockquotes.forEach(blockquote => {
      blockquote.classList.add('decorated-quote');
    });

    // Add decorative dividers between sections
    const headings = articleContent.querySelectorAll('h2, h3');
    headings.forEach((heading, index) => {
      if (index > 0) {
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        heading.parentNode?.insertBefore(divider, heading);
      }
    });
  }

  getTimeAgo(dateString?: string): string {
    if (!dateString) return '';
    
    try {
      // Parse Vietnamese date format (dd-MM-yyyy or dd/MM/yyyy)
      const parts = dateString.split(/[-\/]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Vừa xong';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;

        return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    
    return dateString;
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e0e0e0" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="16" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EKhông có hình ảnh%3C/text%3E%3C/svg%3E';
  }
}

