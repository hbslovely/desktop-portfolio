import { Component, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface ApiResponse {
  data?: string;
}

@Component({
  selector: 'app-fb-id-finder-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fb-id-finder-app.component.html',
  styleUrl: './fb-id-finder-app.component.scss',
})
export class FbIdFinderAppComponent implements AfterViewInit {
  @ViewChild('phoneInput') phoneInput!: ElementRef<HTMLInputElement>;

  private readonly API_URL = 'https://api.shopeelike.com/facebook-info/api/guest/get/fid';

  phone = signal<string>('');
  result = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  searchHistory = signal<string[]>([]);

  constructor(private http: HttpClient) {
    this.loadSearchHistory();
  }

  ngAfterViewInit() {
    // Auto-focus phone input
    setTimeout(() => {
      this.phoneInput?.nativeElement?.focus();
    }, 100);
  }

  searchFbId() {
    const phoneNumber = this.phone().trim();
    
    if (!phoneNumber) {
      this.error.set('Vui lòng nhập số điện thoại');
      return;
    }

    // Validate phone number (basic check)
    if (!/^\d+$/.test(phoneNumber)) {
      this.error.set('Số điện thoại chỉ được chứa số');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set('');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    this.http.patch<ApiResponse | string>(this.API_URL, { phone: phoneNumber }, { headers }).subscribe({
      next: (response) => {
        this.loading.set(false);
        
        // Handle both text and JSON responses
        if (typeof response === 'string') {
          this.result.set(response);
        } else if (response && typeof response === 'object' && 'data' in response) {
          this.result.set(response.data || '');
        } else {
          this.result.set(JSON.stringify(response, null, 2));
        }

        this.addToHistory(phoneNumber);
      },
      error: (err) => {
        this.loading.set(false);
        
        // Try to extract error message
        if (err.error) {
          if (typeof err.error === 'string') {
            this.error.set(err.error);
          } else if (err.error.data) {
            this.error.set(err.error.data);
          } else if (err.error.message) {
            this.error.set(err.error.message);
          } else {
            this.error.set('Có lỗi xảy ra khi tìm Facebook ID');
          }
        } else {
          this.error.set('Không thể kết nối đến server');
        }
        
        console.error('Error searching FB ID:', err);
      }
    });
  }

  onPhoneKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.searchFbId();
    }
  }

  clearResult() {
    this.result.set('');
    this.error.set(null);
  }

  clearPhone() {
    this.phone.set('');
    this.clearResult();
  }

  useHistory(phone: string) {
    this.phone.set(phone);
    this.searchFbId();
  }

  addToHistory(phone: string) {
    const history = this.searchHistory();
    const updatedHistory = [phone, ...history.filter(p => p !== phone)].slice(0, 10);
    this.searchHistory.set(updatedHistory);
    this.saveSearchHistory();
  }

  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('fb-id-finder-history');
      if (saved) {
        this.searchHistory.set(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading search history:', e);
    }
  }

  saveSearchHistory() {
    try {
      localStorage.setItem('fb-id-finder-history', JSON.stringify(this.searchHistory()));
    } catch (e) {
      console.error('Error saving search history:', e);
    }
  }

  clearHistory() {
    this.searchHistory.set([]);
    this.saveSearchHistory();
  }

  copyResult() {
    const result = this.result();
    if (result) {
      navigator.clipboard.writeText(result).then(() => {
        // Show temporary notification
        const originalResult = this.result();
        this.result.set('✓ Đã sao chép!');
        setTimeout(() => {
          this.result.set(originalResult);
        }, 1000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  }
}

