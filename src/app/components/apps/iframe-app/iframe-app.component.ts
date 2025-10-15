import { Component, Input, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-iframe-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './iframe-app.component.html',
  styleUrl: './iframe-app.component.scss'
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
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  
  private startLoadingTimeout() {
    // Clear any existing timeout
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    // Set timeout to detect if iframe fails to load after 10 seconds
    this.loadingTimeout = setTimeout(() => {
      if (this.isLoading()) {
        console.warn('Iframe loading timeout - treating as error');
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    }, 10000);
  }
  
  onIframeLoad() {
    console.log('Iframe loaded successfully');
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.isLoading.set(false);
    this.hasError.set(false);
  }
  
  onIframeError() {
    console.error('Iframe error occurred');
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
