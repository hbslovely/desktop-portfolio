import { Component, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface ApiResponse {
  data?: string;
}

interface FacebookProfile {
  id: string;
  link: string;
  name?: string;
  profileImage?: string;
  about?: string;
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
  facebookProfile = signal<FacebookProfile | null>(null);
  loadingProfile = signal<boolean>(false);

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
    this.facebookProfile.set(null);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    this.http.patch<ApiResponse | string>(this.API_URL, { phone: phoneNumber }, { headers }).subscribe({
      next: (response) => {
        this.loading.set(false);
        
        // Handle both text and JSON responses
        let fbId = '';
        if (typeof response === 'string') {
          fbId = response.trim();
          this.result.set(fbId);
        } else if (response && typeof response === 'object' && 'data' in response) {
          fbId = (response.data || '').trim();
          this.result.set(fbId);
        } else {
          const resultStr = JSON.stringify(response, null, 2);
          this.result.set(resultStr);
          // Try to extract ID from JSON
          const idMatch = resultStr.match(/"id"\s*:\s*"([^"]+)"/i) || resultStr.match(/(\d{10,})/);
          if (idMatch) {
            fbId = idMatch[1];
          }
        }

        // If we have a valid ID, create Facebook link and fetch profile info
        if (fbId && /^\d+$/.test(fbId)) {
          const profile: FacebookProfile = {
            id: fbId,
            link: `https://facebook.com/${fbId}`
          };
          this.facebookProfile.set(profile);
          this.fetchFacebookProfile(fbId);
        } else {
          this.facebookProfile.set(null);
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
    this.facebookProfile.set(null);
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

  copyFacebookLink() {
    const profile = this.facebookProfile();
    if (profile?.link) {
      navigator.clipboard.writeText(profile.link).then(() => {
        // Show temporary notification
        const originalLink = profile.link;
        this.facebookProfile.set({ ...profile, link: '✓ Đã sao chép link!' });
        setTimeout(() => {
          this.facebookProfile.set({ ...profile, link: originalLink });
        }, 1000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  }

  openFacebookLink() {
    const profile = this.facebookProfile();
    if (profile?.link) {
      window.open(profile.link, '_blank');
    }
  }

  fetchFacebookProfile(fbId: string) {
    this.loadingProfile.set(true);
    const profileUrl = `/api/facebook/${fbId}`;
    
    this.http.get(profileUrl, { 
      responseType: 'text',
      headers: new HttpHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      })
    }).subscribe({
      next: (html) => {
        this.loadingProfile.set(false);
        this.parseFacebookProfile(html, fbId);
      },
      error: (err) => {
        this.loadingProfile.set(false);
        console.log('Could not fetch Facebook profile (this is normal due to Facebook restrictions):', err);
        // Don't show error to user, just keep the link
      }
    });
  }

  parseFacebookProfile(html: string, fbId: string) {
    const profile = this.facebookProfile();
    if (!profile) return;

    try {
      // Try to extract name from og:title or title tag
      const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const nameMatch = ogTitleMatch || titleMatch;
      if (nameMatch && nameMatch[1]) {
        profile.name = nameMatch[1].replace(/\s*-\s*Facebook$/, '').trim();
      }

      // Try to extract profile image from og:image
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (ogImageMatch && ogImageMatch[1]) {
        profile.profileImage = ogImageMatch[1];
      }

      // Try to extract about/description
      const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (ogDescMatch && ogDescMatch[1]) {
        profile.about = ogDescMatch[1];
      }

      this.facebookProfile.set({ ...profile });
    } catch (e) {
      console.error('Error parsing Facebook profile:', e);
    }
  }
}

