import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-hello-2026',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hello-2026-container">
      <iframe 
        [src]="safeHtmlUrl" 
        frameborder="0"
        style="width: 100%; height: 100vh; border: none;"
        title="Vòng Quay Tết 2026"
      ></iframe>
    </div>
  `,
  styles: [`
    .hello-2026-container {
      width: 100%;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  `]
})
export class Hello2026Component {
  private sanitizer = inject(DomSanitizer);
  
  safeHtmlUrl: SafeResourceUrl;

  constructor() {
    this.safeHtmlUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/assets/lucky-wheel/index.html');
  }
}
