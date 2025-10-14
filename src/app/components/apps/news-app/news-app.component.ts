import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

// Generic Article interface to support multiple sources
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
  type: 'news' | 'blog' | 'report';
  // Detailed content
  body?: string;
  author?: string;
  tags?: string[];
  reading_time?: number;
}

// Spaceflight News API interfaces
interface SpaceflightArticle {
  id: number;
  title: string;
  url: string;
  image_url: string;
  news_site: string;
  summary: string;
  published_at: string;
  updated_at: string;
  featured: boolean;
  launches: any[];
  events: any[];
}

interface SpaceflightResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SpaceflightArticle[];
}

// Dev.to Blog API interfaces
interface DevToBlogArticle {
  id: number;
  title: string;
  url: string;
  cover_image: string;
  user: {
    name: string;
    username: string;
  };
  description: string;
  published_at: string;
  tag_list: string[];
  body_html?: string;
  body_markdown?: string;
  reading_time_minutes?: number;
}

// GitHub API for reports (using README as report content)
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  stargazers_count: number;
  language: string;
}

@Component({
  selector: 'app-news-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-app.component.html',
  styleUrl: './news-app.component.scss'
})
export class NewsAppComponent implements OnInit {
  private readonly SPACEFLIGHT_API = 'https://api.spaceflightnewsapi.net/v4/articles/';
  private readonly DEVTO_API = 'https://dev.to/api/articles';
  private readonly GITHUB_API = 'https://api.github.com/search/repositories';
  
  articles = signal<Article[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedSource = signal<string>('all');
  selectedFilter = signal<string>('all');
  searchTerm = signal<string>('');
  
  // Article viewer state
  showArticleViewer = signal<boolean>(false);
  selectedArticle = signal<Article | null>(null);
  articleLoading = signal<boolean>(false);
  articleError = signal<string | null>(null);

  sources = [
    { id: 'all', name: 'All Sources', icon: 'pi pi-th-large' },
    { id: 'news', name: 'Space News', icon: 'pi pi-globe' },
    { id: 'blog', name: 'Dev Blogs', icon: 'pi pi-bookmark' },
    { id: 'report', name: 'Tech Reports', icon: 'pi pi-file-pdf' }
  ];

  filters = [
    { id: 'all', name: 'All', icon: 'pi pi-list' },
    { id: 'featured', name: 'Featured', icon: 'pi pi-star-fill' },
    { id: 'recent', name: 'Recent', icon: 'pi pi-clock' }
  ];

  // Computed property for filtered articles
  filteredArticles = computed(() => {
    const articles = this.articles();
    const filter = this.selectedFilter();
    const search = this.searchTerm().toLowerCase();
    const source = this.selectedSource();

    let filtered = articles;

    // Apply source filter
    if (source !== 'all') {
      filtered = filtered.filter(a => a.type === source);
    }

    // Apply filter
    if (filter === 'featured') {
      filtered = filtered.filter(a => a.featured);
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
        a.source.toLowerCase().includes(search)
      );
    }

    return filtered;
  });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAllContent();
  }

  loadAllContent() {
    this.loading.set(true);
    this.error.set(null);
    
    // Load all content types in parallel
    Promise.all([
      this.loadSpaceflightNews(),
      this.loadDevToBlogs(),
      this.loadGitHubReports()
    ]).then(() => {
      this.loading.set(false);
    }).catch((err) => {
      console.error('Error loading content:', err);
      this.error.set('Failed to load content. Please try again later.');
      this.loading.set(false);
    });
  }

  async loadSpaceflightNews(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.SPACEFLIGHT_API}?limit=30`;
      
      this.http.get<SpaceflightResponse>(url).subscribe({
        next: (response) => {
          const newsArticles: Article[] = response.results.map(article => ({
            id: `news-${article.id}`,
            title: article.title,
            url: article.url,
            image_url: article.image_url,
            source: article.news_site,
            summary: article.summary,
            published_at: article.published_at,
            featured: article.featured,
            type: 'news' as const,
            author: article.news_site,
            tags: []
          }));
          
          this.articles.update(current => [...current, ...newsArticles]);
          resolve();
        },
        error: (err) => {
          console.error('Space news error:', err);
          reject(err);
        }
      });
    });
  }

  async loadDevToBlogs(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.DEVTO_API}?per_page=30&top=7`;
      
      this.http.get<DevToBlogArticle[]>(url).subscribe({
        next: (response) => {
          const blogArticles: Article[] = response.map(article => ({
            id: `blog-${article.id}`,
            title: article.title,
            url: article.url,
            image_url: article.cover_image || this.getPlaceholderImage('blog'),
            source: article.user.name,
            summary: article.description || 'Developer blog post',
            published_at: article.published_at,
            featured: false,
            category: article.tag_list[0],
            type: 'blog' as const,
            author: article.user.name,
            tags: article.tag_list,
            reading_time: article.reading_time_minutes
          }));
          
          this.articles.update(current => [...current, ...blogArticles]);
          resolve();
        },
        error: (err) => {
          console.error('Dev.to blog error:', err);
          reject(err);
        }
      });
    });
  }

  async loadGitHubReports(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Search for popular repositories with good documentation (as "reports")
      const topics = ['artificial-intelligence', 'machine-learning', 'data-science', 'blockchain'];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const url = `${this.GITHUB_API}?q=topic:${topic}+stars:>1000&sort=stars&order=desc&per_page=15`;
      
      this.http.get<{ items: GitHubRepo[] }>(url).subscribe({
        next: (response) => {
          const reportArticles: Article[] = response.items.map(repo => ({
            id: `report-${repo.id}`,
            title: repo.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: repo.html_url,
            image_url: repo.owner.avatar_url || this.getPlaceholderImage('report'),
            source: repo.owner.login,
            summary: repo.description || 'Technical repository and documentation',
            published_at: repo.updated_at,
            featured: repo.stargazers_count > 5000,
            category: repo.language,
            type: 'report' as const,
            author: repo.owner.login,
            tags: [repo.language].filter(Boolean)
          }));
          
          this.articles.update(current => [...current, ...reportArticles]);
          resolve();
        },
        error: (err) => {
          console.error('GitHub reports error:', err);
          reject(err);
        }
      });
    });
  }

  async openArticle(article: Article) {
    this.selectedArticle.set(article);
    this.showArticleViewer.set(true);
    this.articleLoading.set(true);
    this.articleError.set(null);

    try {
      // Fetch detailed content based on article type
      let detailedArticle: Article;

      if (article.type === 'news') {
        detailedArticle = await this.fetchNewsDetail(article);
      } else if (article.type === 'blog') {
        detailedArticle = await this.fetchBlogDetail(article);
      } else if (article.type === 'report') {
        detailedArticle = await this.fetchReportDetail(article);
      } else {
        detailedArticle = article;
      }

      this.selectedArticle.set(detailedArticle);
      this.articleLoading.set(false);
    } catch (error) {
      console.error('Error fetching article details:', error);
      this.articleError.set('Failed to load article details.');
      this.articleLoading.set(false);
    }
  }

  async fetchNewsDetail(article: Article): Promise<Article> {
    return new Promise((resolve) => {
      const articleId = article.id.replace('news-', '');
      const url = `${this.SPACEFLIGHT_API}${articleId}/`;

      this.http.get<SpaceflightArticle>(url).subscribe({
        next: (response) => {
          resolve({
            ...article,
            body: this.formatNewsBody(response),
            author: response.news_site
          });
        },
        error: () => {
          resolve({
            ...article,
            body: article.summary
          });
        }
      });
    });
  }

  async fetchBlogDetail(article: Article): Promise<Article> {
    return new Promise((resolve) => {
      const articleId = article.id.replace('blog-', '');
      const url = `${this.DEVTO_API}/${articleId}`;

      this.http.get<DevToBlogArticle>(url).subscribe({
        next: (response) => {
          resolve({
            ...article,
            body: response.body_html || response.body_markdown || article.summary,
            author: response.user.name,
            tags: response.tag_list,
            reading_time: response.reading_time_minutes
          });
        },
        error: () => {
          resolve({
            ...article,
            body: article.summary
          });
        }
      });
    });
  }

  async fetchReportDetail(article: Article): Promise<Article> {
    return new Promise((resolve) => {
      const repoPath = article.url.replace('https://github.com/', '');
      const url = `https://api.github.com/repos/${repoPath}/readme`;

      this.http.get<{ content: string; encoding: string }>(url).subscribe({
        next: (response) => {
          // Decode base64 content
          const decodedContent = atob(response.content);
          resolve({
            ...article,
            body: this.formatMarkdownToHtml(decodedContent),
            author: article.source
          });
        },
        error: () => {
          resolve({
            ...article,
            body: `<p>${article.summary}</p><p><a href="${article.url}" target="_blank" rel="noopener noreferrer">View on GitHub →</a></p>`
          });
        }
      });
    });
  }

  formatNewsBody(article: SpaceflightArticle): string {
    let html = `<div class="article-detail">`;
    html += `<p class="article-summary">${article.summary}</p>`;
    
    if (article.launches && article.launches.length > 0) {
      html += `<div class="article-section"><h3>Related Launches</h3><ul>`;
      article.launches.forEach((launch: any) => {
        html += `<li>${launch.name || 'Launch information'}</li>`;
      });
      html += `</ul></div>`;
    }

    if (article.events && article.events.length > 0) {
      html += `<div class="article-section"><h3>Related Events</h3><ul>`;
      article.events.forEach((event: any) => {
        html += `<li>${event.name || 'Event information'}</li>`;
      });
      html += `</ul></div>`;
    }

    html += `<div class="article-footer-link">`;
    html += `<a href="${article.url}" target="_blank" rel="noopener noreferrer">Read full article on ${article.news_site} →</a>`;
    html += `</div>`;
    html += `</div>`;

    return html;
  }

  formatMarkdownToHtml(markdown: string): string {
    // Basic markdown to HTML conversion
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    // Code blocks
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    return html;
  }

  getPlaceholderImage(type: string): string {
    const placeholders: Record<string, string> = {
      'blog': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%233b82f6" width="400" height="300"/%3E%3Ctext fill="%23ffffff" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EDev Blog%3C/text%3E%3C/svg%3E',
      'report': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f59e0b" width="400" height="300"/%3E%3Ctext fill="%23ffffff" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ETech Report%3C/text%3E%3C/svg%3E'
    };
    return placeholders[type] || placeholders['blog'];
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

  selectSource(source: string) {
    this.selectedSource.set(source);
  }

  selectFilter(filter: string) {
    this.selectedFilter.set(filter);
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
    img.src = this.getPlaceholderImage('blog');
  }

  refreshNews() {
    this.articles.set([]);
    this.loadAllContent();
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  getArticleTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'news': 'News',
      'blog': 'Blog',
      'report': 'Report'
    };
    return labels[type] || type;
  }

  getArticleTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'news': '#10b981',
      'blog': '#3b82f6',
      'report': '#f59e0b'
    };
    return colors[type] || '#6b7280';
  }
}
