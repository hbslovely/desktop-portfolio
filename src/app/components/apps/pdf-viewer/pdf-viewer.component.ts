import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.scss'
})
export class PdfViewerComponent {
  @Input() set pdfPath(value: string) {
    this._pdfPath = value;
    this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(value);
  }

  private _pdfPath: string = '';
  safePdfUrl: SafeResourceUrl | null = null;
  loading = signal<boolean>(true);
  error = signal<boolean>(false);

  constructor(private sanitizer: DomSanitizer) {}

  onLoadSuccess() {
    this.loading.set(false);
    this.error.set(false);
  }

  onLoadError() {
    this.loading.set(false);
    this.error.set(true);
  }

  downloadPdf() {
    if (this._pdfPath) {
      const link = document.createElement('a');
      link.href = this._pdfPath;
      link.download = this._pdfPath.split('/').pop() || 'document.pdf';
      link.click();
    }
  }

  openInNewTab() {
    if (this._pdfPath) {
      window.open(this._pdfPath, '_blank');
    }
  }
}

