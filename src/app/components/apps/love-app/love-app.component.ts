import { Component, Input, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-love-app',
  standalone: true,
  imports: [],
  templateUrl: './love-app.component.html',
  styleUrl: './love-app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoveAppComponent {
  private sanitizer = inject(DomSanitizer);

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
      // eslint-disable-next-line no-self-assign
      iframe.src = iframe.src;
    }
  }
}
