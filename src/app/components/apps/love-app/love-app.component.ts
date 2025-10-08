import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-love-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './love-app.component.html',
  styleUrl: './love-app.component.scss'
})
export class LoveAppComponent {
  @Input() set url(value: string) {
    this._url.set(value);
  }
  get url() {
    return this._url();
  }
  
  @Input() title = 'Love Application';
  
  private _url = signal('https://hbslovely.vercel.app/');
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
