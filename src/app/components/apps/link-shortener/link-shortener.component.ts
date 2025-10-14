import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

interface ShortenedLink {
  long: string;
  code: string;
  shortUrl: string;
  timestamp: number;
}

interface CleanURIRequest {
  url: string;
}

interface CleanURIResponse {
  result_url: string;
}

@Component({
  selector: 'app-link-shortener',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './link-shortener.component.html',
  styleUrl: './link-shortener.component.scss'
})
export class LinkShortenerComponent {
  private readonly API_URL = 'https://cleanuri.com/api/v1/shorten';
  
  inputUrl = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  
  // History of shortened links
  linkHistory = signal<ShortenedLink[]>([]);
  copiedCode = signal<string | null>(null);

  constructor(private http: HttpClient) {
    this.loadHistory();
  }

  onInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.inputUrl.set(input.value);
    this.error.set(null);
  }

  shortenLink() {
    const url = this.inputUrl().trim();
    
    if (!url) {
      this.error.set('Please enter a URL to shorten');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // Prepare request body for CleanURI
    const requestBody: CleanURIRequest = {
      url: url
    };

    this.http.post<CleanURIResponse>(this.API_URL, requestBody)
      .pipe(
        catchError((err) => {
          console.error('CleanURI API error:', err);
          
          if (err.status === 400) {
            this.error.set('Invalid URL format. Please enter a valid URL.');
          } else if (err.status === 429) {
            this.error.set('Rate limit exceeded. Please try again later.');
          } else if (err.error && err.error.error) {
            this.error.set(err.error.error);
          } else {
            this.error.set('Failed to shorten link. Please try again.');
          }
          
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response && response.result_url) {
          // Extract code from the shortened URL
          const shortUrl = response.result_url;
          const code = shortUrl.split('/').pop() || '';
          
          const shortenedLink: ShortenedLink = {
            long: url,
            code: code,
            shortUrl: shortUrl,
            timestamp: Date.now()
          };

          // Add to history
          const history = this.linkHistory();
          history.unshift(shortenedLink);
          
          // Keep only last 20 links
          if (history.length > 20) {
            history.pop();
          }
          
          this.linkHistory.set([...history]);
          this.saveHistory();

          // Clear input
          this.inputUrl.set('');
        }
        
        this.loading.set(false);
      });
  }

  copyToClipboard(shortUrl: string, code: string) {
    navigator.clipboard.writeText(shortUrl).then(() => {
      this.copiedCode.set(code);
      setTimeout(() => {
        this.copiedCode.set(null);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      this.error.set('Failed to copy to clipboard');
    });
  }

  openLink(url: string) {
    window.open(url, '_blank');
  }

  deleteFromHistory(code: string) {
    const history = this.linkHistory().filter(link => link.code !== code);
    this.linkHistory.set(history);
    this.saveHistory();
  }

  clearHistory() {
    this.linkHistory.set([]);
    this.saveHistory();
  }

  getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  }

  private saveHistory() {
    try {
      localStorage.setItem('linkShortenerHistory', JSON.stringify(this.linkHistory()));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem('linkShortenerHistory');
      if (saved) {
        this.linkHistory.set(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }
}

