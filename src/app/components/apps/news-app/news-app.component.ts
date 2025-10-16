import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

// Article interface for Dev.to
interface Article {
  id: string;
  title: string;
  url: string;
  image_url: string;
  source: string;
  summary: string;
  published_at: string;
  featured?: boolean;
  category?: string;
  // Detailed content
  body?: string;
  author?: string;
  tags?: string[];
  reading_time?: number;
  reactions?: number;
  comments_count?: number;
  positive_reactions_count?: number;
}

// Dev.to API interfaces
interface DevToArticle {
  id: number;
  title: string;
  url: string;
  cover_image: string;
  user: {
    name: string;
    username: string;
    profile_image?: string;
  };
  description: string;
  published_at: string;
  tag_list: string[];
  body_html?: string;
  body_markdown?: string;
  reading_time_minutes?: number;
  public_reactions_count?: number;
  comments_count?: number;
  positive_reactions_count?: number;
}

interface DevToTag {
  id: number;
  name: string;
  bg_color_hex?: string;
  text_color_hex?: string;
}

@Component({
  selector: 'app-news-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-app.component.html',
  styleUrl: './news-app.component.scss'
})
export class NewsAppComponent implements OnInit {
  private readonly DEVTO_API = 'https://dev.to/api/articles';
  
  articles = signal<Article[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedCategory = signal<string>('latest');
  selectedFilter = signal<string>('all');
  searchTerm = signal<string>('');
  viewMode = signal<'grid' | 'list' | 'compact'>('list');
  
  // Article viewer state
  showArticleViewer = signal<boolean>(false);
  selectedArticle = signal<Article | null>(null);
  articleLoading = signal<boolean>(false);
  articleError = signal<string | null>(null);

  viewModes = [
    { id: 'list' as const, name: 'List View - Compact Flattened', icon: 'pi pi-list', tooltip: 'Compact horizontal list' },
    { id: 'grid' as const, name: 'Grid View - Image Overlay', icon: 'pi pi-th-large', tooltip: 'Grid with image background' },
    { id: 'compact' as const, name: 'Large View - Detailed', icon: 'pi pi-bars', tooltip: 'Large cards with more details' }
  ];

  categories = [
    { id: 'latest', name: 'Latest', icon: 'pi pi-clock', tag: '', per_page: 40 },
    { id: 'trending', name: 'Trending', icon: 'pi pi-bolt', tag: '', per_page: 40, top: 7 },
    { id: 'javascript', name: 'JavaScript', icon: 'pi pi-code', tag: 'javascript', per_page: 30 },
    { id: 'webdev', name: 'Web Dev', icon: 'pi pi-globe', tag: 'webdev', per_page: 30 },
    { id: 'ai', name: 'AI & ML', icon: 'pi pi-microchip', tag: 'ai', per_page: 30 },
    { id: 'career', name: 'Career', icon: 'pi pi-briefcase', tag: 'career', per_page: 30 }
  ];

  filters = [
    { id: 'all', name: 'All', icon: 'pi pi-list' },
    { id: 'popular', name: 'Popular', icon: 'pi pi-star-fill' },
    { id: 'recent', name: 'Recent', icon: 'pi pi-clock' }
  ];

  // Computed property for filtered articles
  filteredArticles = computed(() => {
    const articles = this.articles();
    const filter = this.selectedFilter();
    const search = this.searchTerm().toLowerCase();

    let filtered = articles;

    // Apply filter
    if (filter === 'popular') {
      filtered = filtered.sort((a, b) => (b.reactions || 0) - (a.reactions || 0));
    } else if (filter === 'recent') {
      filtered = filtered.sort((a, b) => 
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    }

    // Apply search
    if (search) {
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(search) || 
        a.summary.toLowerCase().includes(search) ||
        a.source.toLowerCase().includes(search) ||
        a.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    return filtered;
  });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadArticles();
  }

  loadArticles() {
    const category = this.categories.find(c => c.id === this.selectedCategory());
    if (!category) return;

    this.loading.set(true);
    this.error.set(null);
    this.articles.set([]);

    let url = `${this.DEVTO_API}?per_page=${category.per_page}`;
    
    if (category.top) {
      url += `&top=${category.top}`;
    }
    
    if (category.tag) {
      url += `&tag=${category.tag}`;
    }

    this.http.get<DevToArticle[]>(url).subscribe({
      next: (response) => {
        const articles: Article[] = response.map(article => ({
          id: `${article.id}`,
          title: article.title,
          url: article.url,
          image_url: article.cover_image || this.getPlaceholderImage(),
          source: article.user.name,
          summary: article.description || 'Read more on DEV Community',
          published_at: article.published_at,
          featured: (article.public_reactions_count || 0) > 50,
          category: article.tag_list[0],
          author: article.user.name,
          tags: article.tag_list,
          reading_time: article.reading_time_minutes,
          reactions: article.public_reactions_count || 0,
          comments_count: article.comments_count || 0,
          positive_reactions_count: article.positive_reactions_count || 0
        }));
        
        this.articles.set(articles);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('DEV.to API error:', err);
        this.error.set('Failed to load articles. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  async openArticle(article: Article) {
    this.selectedArticle.set(article);
    this.showArticleViewer.set(true);
    this.articleLoading.set(true);
    this.articleError.set(null);

    try {
      // Fetch full article content
      const articleId = article.id;
      const url = `${this.DEVTO_API}/${articleId}`;

      this.http.get<DevToArticle>(url).subscribe({
        next: (response) => {
          const detailedArticle: Article = {
            ...article,
            body: response.body_html || article.summary,
            author: response.user.name,
            tags: response.tag_list,
            reading_time: response.reading_time_minutes,
            reactions: response.public_reactions_count || 0,
            comments_count: response.comments_count || 0
          };
          this.selectedArticle.set(detailedArticle);
          this.articleLoading.set(false);
        },
        error: () => {
          // Fallback to summary if full content fails
          this.selectedArticle.set({
            ...article,
            body: `<p>${article.summary}</p>`
          });
          this.articleLoading.set(false);
        }
      });
    } catch (error) {
      console.error('Error fetching article details:', error);
      this.articleError.set('Failed to load article details.');
      this.articleLoading.set(false);
    }
  }

  getPlaceholderImage(): string {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ff6b6b" width="400" height="300"/%3E%3Ctext fill="%23ffffff" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EDEV Article%3C/text%3E%3C/svg%3E';
  }

  closeArticleViewer() {
    this.showArticleViewer.set(false);
    this.selectedArticle.set(null);
    this.articleError.set(null);
  }

  openInNewTab() {
    const article = this.selectedArticle();
    if (article) {
      window.open(article.url, '_blank');
    }
  }

  selectCategory(category: string) {
    this.selectedCategory.set(category);
    this.loadArticles();
  }

  selectFilter(filter: string) {
    this.selectedFilter.set(filter);
  }

  setViewMode(mode: 'grid' | 'list' | 'compact') {
    this.viewMode.set(mode);
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = this.getPlaceholderImage();
  }

  refreshNews() {
    this.loadArticles();
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }
}
