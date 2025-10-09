import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-text-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './text-viewer.component.html',
  styleUrl: './text-viewer.component.scss'
})
export class TextViewerComponent implements OnInit {
  @Input() filePath = '';
  @Input() fileName = '';
  @Input() fileType: 'txt' | 'md' = 'txt';
  
  content = signal<string>('');
  isLoading = signal(true);
  hasError = signal(false);
  errorMessage = signal('');
  
  // Computed properties for rendering
  isMarkdown = computed(() => this.fileType === 'md');
  
  // Simple markdown parser for basic formatting
  formattedContent = computed(() => {
    const rawContent = this.content();
    if (this.fileType === 'md') {
      return this.parseMarkdown(rawContent);
    }
    return rawContent;
  });
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadFile();
  }
  
  private loadFile() {
    if (!this.filePath) {
      this.hasError.set(true);
      this.errorMessage.set('No file path provided');
      this.isLoading.set(false);
      return;
    }
    
    this.isLoading.set(true);
    this.hasError.set(false);
    
    this.http.get(this.filePath, { responseType: 'text' })
      .subscribe({
        next: (data) => {
          this.content.set(data);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading file:', error);
          this.hasError.set(true);
          this.errorMessage.set(`Failed to load ${this.fileName}`);
          this.isLoading.set(false);
        }
      });
  }
  
  private parseMarkdown(content: string): string {
    // Simple markdown parser for basic formatting
    let html = content
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Line breaks
      .replace(/\n/g, '<br>');
    
    return html;
  }
  
  reload() {
    this.loadFile();
  }
}
