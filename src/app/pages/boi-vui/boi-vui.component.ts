import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-boi-vui',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="boi-vui-container">
      <iframe
        [src]="safeHtmlUrl"
        frameborder="0"
        style="width: 100%; height: 100vh; border: none;"
        title="Bói Vui"
      ></iframe>
    </div>
  `,
  styles: [`
    .boi-vui-container {
      width: 100%;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  `]
})
export class BoiVuiComponent {
  private sanitizer = inject(DomSanitizer);

  safeHtmlUrl: SafeResourceUrl;

  constructor() {
    this.safeHtmlUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/assets/boi-vui/index.html');
  }
}
