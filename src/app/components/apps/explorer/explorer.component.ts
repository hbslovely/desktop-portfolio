import { Component, OnInit, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface FileSystemItem {
  type: 'file' | 'folder';
  name: string;
  path: string;
  icon: string;
  size?: string;
  modified?: string;
  content?: string;
  children?: FileSystemItem[];
}

export interface FileOpenEvent {
  item: FileSystemItem;
  fileType: 'text' | 'image' | 'unknown';
  extension: string;
}

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.scss'
})
export class ExplorerComponent implements OnInit {
  @Output() onFileOpen = new EventEmitter<FileOpenEvent>();
  
  fileSystem = signal<FileSystemItem | null>(null);
  currentPath = signal<string>('/');
  selectedItem = signal<FileSystemItem | null>(null);
  viewMode = signal<'list' | 'icons'>('list');
  
  // Navigation history
  navigationHistory = signal<string[]>(['/']);
  historyIndex = signal<number>(0);
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadFileSystem();
  }
  
  // Computed current folder items
  currentItems = computed(() => {
    const fs = this.fileSystem();
    if (!fs) return [];
    
    const path = this.currentPath();
    if (path === '/') {
      return fs.children || [];
    }
    
    return this.findItemByPath(fs, path)?.children || [];
  });
  
  // Computed navigation state
  canGoBack = computed(() => this.historyIndex() > 0);
  canGoForward = computed(() => this.historyIndex() < this.navigationHistory().length - 1);
  
  // Computed breadcrumb path
  breadcrumbs = computed(() => {
    const path = this.currentPath();
    if (path === '/') return [{ name: 'Explorer', path: '/' }];
    
    const parts = path.split('/').filter(part => part);
    const breadcrumbs = [{ name: 'Explorer', path: '/' }];
    
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      breadcrumbs.push({ name: part, path: currentPath });
    }
    
    return breadcrumbs;
  });
  
  private loadFileSystem() {
    this.http.get<{fileSystem: FileSystemItem}>('assets/json/explore.json')
      .subscribe({
        next: (data) => {
          this.fileSystem.set(data.fileSystem);
        },
        error: (error) => {
          console.error('Failed to load file system:', error);
        }
      });
  }
  
  private findItemByPath(root: FileSystemItem, path: string): FileSystemItem | null {
    if (root.path === path) return root;
    
    if (root.children) {
      for (const child of root.children) {
        const found = this.findItemByPath(child, path);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  navigateToPath(path: string) {
    this.currentPath.set(path);
    this.selectedItem.set(null);
    
    // Update navigation history
    const history = this.navigationHistory();
    const currentIndex = this.historyIndex();
    
    // Remove forward history if we're navigating from middle
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(path);
    
    this.navigationHistory.set(newHistory);
    this.historyIndex.set(newHistory.length - 1);
  }
  
  onItemClick(item: FileSystemItem) {
    this.selectedItem.set(item);
  }
  
  onItemDoubleClick(item: FileSystemItem) {
    if (item.type === 'folder') {
      this.navigateToPath(item.path);
    } else {
      // Handle file opening based on file type
      this.openFile(item);
    }
  }
  
  openFile(item: FileSystemItem) {
    const fileName = item.name.toLowerCase();
    const fileExtension = fileName.split('.').pop() || '';
    
    console.log('Opening file:', item.name, 'Extension:', fileExtension);
    
    // Emit file open event to parent component
    this.onFileOpen.emit({
      item,
      fileType: this.getFileType(fileExtension),
      extension: fileExtension
    });
  }
  
  private getFileType(extension: string): 'text' | 'image' | 'unknown' {
    const textExtensions = ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    
    if (textExtensions.includes(extension)) {
      return 'text';
    } else if (imageExtensions.includes(extension)) {
      return 'image';
    }
    
    return 'unknown';
  }
  
  goBack() {
    if (this.canGoBack()) {
      const newIndex = this.historyIndex() - 1;
      this.historyIndex.set(newIndex);
      const path = this.navigationHistory()[newIndex];
      this.currentPath.set(path);
      this.selectedItem.set(null);
    }
  }
  
  goForward() {
    if (this.canGoForward()) {
      const newIndex = this.historyIndex() + 1;
      this.historyIndex.set(newIndex);
      const path = this.navigationHistory()[newIndex];
      this.currentPath.set(path);
      this.selectedItem.set(null);
    }
  }
  
  goUp() {
    const currentPath = this.currentPath();
    if (currentPath === '/') return;
    
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    this.navigateToPath(parentPath);
  }
  
  refresh() {
    this.loadFileSystem();
  }
  
  toggleViewMode() {
    this.viewMode.set(this.viewMode() === 'list' ? 'icons' : 'list');
  }
  
  formatFileSize(size: string | undefined): string {
    return size || '';
  }
  
  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  }
}
