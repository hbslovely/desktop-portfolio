import { Component, Input, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-iframe-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './iframe-app.component.html',
  styleUrl: './iframe-app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IframeAppComponent implements OnInit, OnDestroy {
  @Input() set url(value: string) {
    this._url.set(value);
    // Reset loading state when URL changes
    if (value) {
      this.isLoading.set(true);
      this.hasError.set(false);
      this.startLoadingTimeout();
    }
  }
  get url() {
    return this._url();
  }
  
  @Input() title = 'Web Application';
  
  private _url = signal('');
  isLoading = signal(true);
  hasError = signal(false);
  private loadingTimeout: any;
  
  constructor(private sanitizer: DomSanitizer) {}
  
  ngOnInit() {
    if (this._url()) {
      this.startLoadingTimeout();
    }
  }
  
  ngOnDestroy() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }
  
  // Convert to computed signal to prevent infinite loading
  safeUrl = computed(() => {
    const url = this._url();
    if (!url) return null;
    
    // Convert Facebook URLs to use proxy
    let processedUrl = url;
    if (url.includes('facebook.com')) {
      // Replace https://www.facebook.com with /api/facebook
      processedUrl = url.replace(/^https?:\/\/www\.facebook\.com/, '/api/facebook');
      // Also handle facebook.com without www
      processedUrl = processedUrl.replace(/^https?:\/\/facebook\.com/, '/api/facebook');
    }
    
    return this.sanitizer.bypassSecurityTrustResourceUrl(processedUrl);
  });
  
  private startLoadingTimeout() {
    // Clear any existing timeout
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    // Set timeout to detect if iframe fails to load after 10 seconds
    this.loadingTimeout = setTimeout(() => {
      if (this.isLoading()) {

        this.isLoading.set(false);
        this.hasError.set(true);
      }
    }, 10000);
  }
  
  onIframeLoad() {

    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.isLoading.set(false);
    this.hasError.set(false);
  }
  
  onIframeError() {

    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.isLoading.set(false);
    this.hasError.set(true);
  }
  
  reloadIframe() {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.startLoadingTimeout();
    
    // Force reload by changing src
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      const currentSrc = iframe.src;
      iframe.src = 'about:blank';
      setTimeout(() => {
        iframe.src = currentSrc;
      }, 100);
    }
  }
  
  openInNewTab() {
    const url = this._url();
    if (url) {
      window.open(url, '_blank');
    }
  }
}
