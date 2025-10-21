import { Component, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import {
  AngularLoveService,
  AngularLoveArticle,
  AngularLoveArticleDetail,
  AngularLoveAuthorDetail
} from '../../../services/angular-love.service';

@Component({
  selector: 'app-angular-love-app',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [AngularLoveService],
  templateUrl: './angular-love-app.component.html',
  styleUrl: './angular-love-app.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class AngularLoveAppComponent implements OnInit {
  // Make Math available in template
  Math = Math;

  // Signals for state management
  articles = signal<AngularLoveArticle[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  selectedArticle = signal<AngularLoveArticleDetail | null>(null);
  articleLoading = signal<boolean>(false);
  articleError = signal<string | null>(null);
  showArticleViewer = signal<boolean>(false);

  selectedAuthor = signal<AngularLoveAuthorDetail | null>(null);
  authorLoading = signal<boolean>(false);
  authorError = signal<string | null>(null);
  showAuthorViewer = signal<boolean>(false);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('angular-in-depth');
  currentPage = signal<number>(0);
  totalArticles = signal<number>(0);
  articlesPerPage = signal<number>(12);
  viewMode = signal<'grid' | 'list' | 'compact'>('grid');

  // Available categories
  categories = [
    { value: 'angular-in-depth', label: 'Angular InDepth', icon: 'pi-code' },
    { value: 'guides', label: 'Guides', icon: 'pi-book' },
    { value: 'news', label: 'News', icon: 'pi-megaphone' },
    { value: '', label: 'All Articles', icon: 'pi-th-large' }
  ];

  constructor(private angularLoveService: AngularLoveService) {}

  ngOnInit(): void {
    this.loadArticles();
  }

  /**
   * Load articles from API
   */
  loadArticles(): void {
    this.loading.set(true);
    this.error.set(null);

    const skip = this.currentPage() * this.articlesPerPage();
    const category = this.selectedCategory();

    this.angularLoveService.getArticles(this.articlesPerPage(), skip, category)
      .subscribe({
        next: (response) => {
          this.articles.set(response.data);
          this.totalArticles.set(typeof response.total === 'string' ? parseInt(response.total) : response.total);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading articles:', err);
          this.error.set('Failed to load articles. Please try again later.');
          this.loading.set(false);
        }
      });
  }

  /**
   * Filter articles based on search query
   */
  filteredArticles(): AngularLoveArticle[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.articles();
    }

    return this.articles().filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.excerpt.toLowerCase().includes(query) ||
      article.author.name.toLowerCase().includes(query)
    );
  }

  /**
   * Open article detail view
   */
  openArticle(article: AngularLoveArticle): void {
    this.showArticleViewer.set(true);
    this.articleLoading.set(true);
    this.articleError.set(null);
    this.selectedArticle.set(null);

    this.angularLoveService.getArticleBySlug(article.slug)
      .subscribe({
        next: (detail) => {
          this.selectedArticle.set(detail);
          this.articleLoading.set(false);
          // Setup code blocks after content is loaded
          this.setupCodeBlocks();
        },
        error: (err) => {
          console.error('Error loading article detail:', err);
          this.articleError.set('Failed to load article details.');
          this.articleLoading.set(false);
        }
      });
  }

  /**
   * Close article detail view
   */
  closeArticleViewer(): void {
    this.showArticleViewer.set(false);
    this.selectedArticle.set(null);
    this.articleError.set(null);
  }

  /**
   * Open author detail view
   */
  openAuthor(authorSlug: string): void {
    this.showAuthorViewer.set(true);
    this.authorLoading.set(true);
    this.authorError.set(null);
    this.selectedAuthor.set(null);

    this.angularLoveService.getAuthorBySlug(authorSlug)
      .subscribe({
        next: (author) => {
          this.selectedAuthor.set(author);
          this.authorLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading author detail:', err);
          this.authorError.set('Failed to load author details.');
          this.authorLoading.set(false);
        }
      });
  }

  /**
   * Close author detail view
   */
  closeAuthorViewer(): void {
    this.showAuthorViewer.set(false);
    this.selectedAuthor.set(null);
    this.authorError.set(null);
  }

  /**
   * Select category filter
   */
  selectCategory(category: string): void {
    this.selectedCategory.set(category);
    this.currentPage.set(0);
    this.loadArticles();
  }

  /**
   * Search articles
   */
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  /**
   * Refresh articles
   */
  refreshArticles(): void {
    this.currentPage.set(0);
    this.loadArticles();
  }

  /**
   * Load next page
   */
  nextPage(): void {
    const totalPages = Math.ceil(this.totalArticles() / this.articlesPerPage());
    if (this.currentPage() < totalPages - 1) {
      this.currentPage.update(page => page + 1);
      this.loadArticles();
    }
  }

  /**
   * Load previous page
   */
  previousPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(page => page - 1);
      this.loadArticles();
    }
  }

  /**
   * Format date to readable string
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get time ago string
   */
  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) return `${diffYears}y ago`;
    if (diffMonths > 0) return `${diffMonths}mo ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  }

  /**
   * Get difficulty badge color
   */
  getDifficultyClass(difficulty?: string): string {
    switch(difficulty?.toLowerCase()) {
      case 'beginner': return 'difficulty-beginner';
      case 'intermediate': return 'difficulty-intermediate';
      case 'advanced': return 'difficulty-advanced';
      default: return 'difficulty-default';
    }
  }

  /**
   * Handle image error
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://via.placeholder.com/800x400/ff4757/ffffff?text=Angular.love';
  }

  /**
   * Change view mode
   */
  changeViewMode(mode: 'grid' | 'list' | 'compact'): void {
    this.viewMode.set(mode);
  }


  /**
   * Setup code blocks with copy buttons (call after article content is rendered)
   */
  setupCodeBlocks(): void {
    setTimeout(() => {
      const codeBlocks = document.querySelectorAll('.article-body pre');
      codeBlocks.forEach((pre) => {
        if (!pre.querySelector('.code-copy-btn')) {
          // Create copy button
          const copyBtn = document.createElement('button');
          copyBtn.className = 'code-copy-btn';
          copyBtn.type = 'button';
          
          // Add inline styles to ensure it displays correctly
          copyBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 14px;
            background: white;
            border: 2px solid #dfe3e8;
            border-radius: 6px;
            color: #5a6c7d;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            z-index: 999;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          `;
          
          copyBtn.innerHTML = '<i class="pi pi-copy" style="font-size: 13px; line-height: 1;"></i><span style="line-height: 1;">Copy</span>';

          const code = pre.querySelector('code');
          if (code) {
            copyBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.copyCode(code as HTMLElement, copyBtn);
            };
            
            // Add hover effect
            copyBtn.onmouseenter = () => {
              copyBtn.style.background = '#dd0031';
              copyBtn.style.borderColor = '#dd0031';
              copyBtn.style.color = 'white';
              copyBtn.style.transform = 'translateY(-1px)';
              copyBtn.style.boxShadow = '0 4px 8px rgba(221, 0, 49, 0.2)';
            };
            
            copyBtn.onmouseleave = () => {
              if (!copyBtn.classList.contains('copied')) {
                copyBtn.style.background = 'white';
                copyBtn.style.borderColor = '#dfe3e8';
                copyBtn.style.color = '#5a6c7d';
                copyBtn.style.transform = 'translateY(0)';
                copyBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }
            };
          }

          // Make sure pre is positioned relatively
          const preElement = pre as HTMLElement;
          preElement.style.position = 'relative';
          
          // Insert button at the beginning of pre
          pre.insertBefore(copyBtn, pre.firstChild);
        }
      });
    }, 300);
  }

  /**
   * Copy code to clipboard (updated version)
   */
  copyCode(codeElement: HTMLElement, button: HTMLElement): void {
    const code = codeElement.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      // Add visual feedback
      const originalHTML = button.innerHTML;
      button.classList.add('copied');
      button.style.background = '#4caf50';
      button.style.borderColor = '#4caf50';
      button.style.color = 'white';
      button.innerHTML = '<i class="pi pi-check" style="font-size: 13px; line-height: 1; color: white;"></i><span style="line-height: 1;">Copied!</span>';

      setTimeout(() => {
        button.classList.remove('copied');
        button.style.background = 'white';
        button.style.borderColor = '#dfe3e8';
        button.style.color = '#5a6c7d';
        button.innerHTML = originalHTML;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code:', err);
      button.style.background = '#f44336';
      button.style.borderColor = '#f44336';
      button.style.color = 'white';
      button.innerHTML = '<i class="pi pi-times" style="font-size: 13px; line-height: 1;"></i><span style="line-height: 1;">Failed</span>';
      
      setTimeout(() => {
        button.style.background = 'white';
        button.style.borderColor = '#dfe3e8';
        button.style.color = '#5a6c7d';
        button.innerHTML = '<i class="pi pi-copy" style="font-size: 13px; line-height: 1;"></i><span style="line-height: 1;">Copy</span>';
      }, 2000);
    });
  }
}

