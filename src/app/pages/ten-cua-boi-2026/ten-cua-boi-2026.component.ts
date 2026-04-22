import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-ten-cua-boi-2026',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ten-cua-boi-2026-container">
      <iframe
        [src]="safeHtmlUrl"
        frameborder="0"
        style="width: 100%; height: 100vh; border: none;"
        title="Tên của Bối"
      ></iframe>
    </div>
  `,
  styles: [`
    .ten-cua-boi-2026-container {
      width: 100%;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  `]
})
export class TenCuaBoi2026Component {
  private sanitizer = inject(DomSanitizer);

  safeHtmlUrl: SafeResourceUrl;

  constructor() {
    this.safeHtmlUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/assets/boi/index.html');
  }
}
