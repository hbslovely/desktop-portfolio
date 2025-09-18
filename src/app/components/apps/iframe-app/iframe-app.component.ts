import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-iframe-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './iframe-app.component.html',
  styleUrl: './iframe-app.component.scss'
})
export class IframeAppComponent {
  @Input() set url(value: string) {
    this._url.set(value);
  }
  get url() {
    return this._url();
  }
  
  @Input() title = 'Web Application';
  
  private _url = signal('');
  isLoading = signal(true);
  hasError = signal(false);
  
  constructor(private sanitizer: DomSanitizer) {}
  
  // Convert to computed signal to prevent infinite loading
  safeUrl = computed(() => {
    const url = this._url();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  
  onIframeLoad() {
    this.isLoading.set(false);
    this.hasError.set(false);
  }
  
  onIframeError() {
    this.isLoading.set(false);
    this.hasError.set(true);
  }
  
  reloadIframe() {
    this.isLoading.set(true);
    this.hasError.set(false);
    // Force reload by changing src
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  }
}
