import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface NewsArticle {
  uuid: string;
  title: string;
  description: string;
  snippet: string;
  url: string;
  image_url: string;
  published_at: string;
  source: string;
  categories: string[];
}

interface NewsResponse {
  data: NewsArticle[];
}

@Component({
  selector: 'app-news-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-app.component.html',
  styleUrl: './news-app.component.scss'
})
export class NewsAppComponent implements OnInit {
  articles = signal<NewsArticle[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedCategory = signal<string>('all');

  categories = [
    { id: 'all', name: 'All News', icon: 'pi pi-globe' },
    { id: 'general', name: 'General', icon: 'pi pi-book' },
    { id: 'tech', name: 'Technology', icon: 'pi pi-desktop' },
    { id: 'business', name: 'Business', icon: 'pi pi-briefcase' },
    { id: 'science', name: 'Science', icon: 'pi pi-flask' },
    { id: 'sports', name: 'Sports', icon: 'pi pi-trophy' },
    { id: 'entertainment', name: 'Entertainment', icon: 'pi pi-star' }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadNews();
  }

  loadNews(category: string = 'all') {
    this.loading.set(true);
    this.error.set(null);

    let url = `${environment.newsApiUrl}?language=en&api_token=${environment.newsApiToken}`;

    if (category !== 'all') {
      url += `&categories=${category}`;
    }

    this.http.get<NewsResponse>(url).subscribe({
      next: (response) => {
        this.articles.set(response.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading news:', err);
        this.error.set('Failed to load news. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  selectCategory(category: string) {
    this.selectedCategory.set(category);
    this.loadNews(category);
  }

  openArticle(url: string) {
    window.open(url, '_blank');
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder-news.png';
  }

  refreshNews() {
    this.loadNews(this.selectedCategory());
  }
}
