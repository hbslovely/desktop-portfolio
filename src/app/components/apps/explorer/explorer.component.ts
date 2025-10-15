import { Component, OnInit, Output, EventEmitter, Input, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FileSystemService } from '../../../services/file-system.service';

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

export interface NewFileData {
  fileName: string;
  path: string;
  content: string;
  htmlContent: string;
}

export interface FileOpenEvent {
  item: FileSystemItem;
  fileType: 'text' | 'image' | 'pdf' | 'unknown';
  extension: string;
}

export interface ContextMenuEvent {
  action: 'rename' | 'delete' | 'copy' | 'cut' | 'paste' | 'set-wallpaper' | 'edit';
  item: FileSystemItem;
  newName?: string;
}

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.scss'
})
export class ExplorerComponent implements OnInit {
  @Input() externalFileSystem: FileSystemItem | null = null;
  @Output() onFileOpen = new EventEmitter<FileOpenEvent>();
  @Output() onContextMenuAction = new EventEmitter<ContextMenuEvent>();
  
  fileSystem = signal<FileSystemItem | null>(null);
  currentPath = signal<string>('/');
  selectedItem = signal<FileSystemItem | null>(null);
  viewMode = signal<'list' | 'icons'>('list');
  
  // Navigation history
  navigationHistory = signal<string[]>(['/']);
  historyIndex = signal<number>(0);
  
  // Context menu state
  showContextMenu = signal(false);
  contextMenuPosition = signal({ x: 0, y: 0 });
  contextMenuItem = signal<FileSystemItem | null>(null);
  
  // Clipboard state
  clipboardItem = signal<FileSystemItem | null>(null);
  clipboardAction = signal<'copy' | 'cut' | null>(null);
  
  // Rename state
  renamingItem = signal<FileSystemItem | null>(null);
  newItemName = signal('');
  
  // Search state
  searchQuery = signal('');
  isSearching = signal(false);
  searchResults = signal<FileSystemItem[]>([]);
  
  // Click tracking for double-click detection
  private lastClickTime = 0;
  private lastClickItem: FileSystemItem | null = null;
  
  constructor(
    private http: HttpClient,
    private fileSystemService: FileSystemService
  ) {
    // Watch for changes in the shared file system
    effect(() => {
      const sharedFileSystem = this.fileSystemService.getFileSystem()();
      if (sharedFileSystem && !this.externalFileSystem) {
        this.fileSystem.set(sharedFileSystem);
      }
    });
  }
  
  ngOnInit() {
    if (this.externalFileSystem) {
      this.fileSystem.set(this.externalFileSystem);
    } else {
      this.loadFileSystem();
    }
  }
  
  ngOnChanges() {
    if (this.externalFileSystem) {
      this.fileSystem.set(this.externalFileSystem);
    }
  }
  
  // Method to add a new file to the file system
  addFileToSystem(newFile: NewFileData) {
    const fs = this.fileSystem();
    if (!fs) return;
    
    // Find the parent folder
    const parentPath = newFile.path.substring(0, newFile.path.lastIndexOf('/')) || '/';
    const parent = parentPath === '/' ? fs : this.findItemByPath(fs, parentPath);
    
    if (parent && parent.children) {
      // Check if file already exists
      const existingIndex = parent.children.findIndex(item => item.path === newFile.path);
      
      const fileExtension = newFile.fileName.split('.').pop()?.toLowerCase() || 'html';
      const fileItem: FileSystemItem = {
        type: 'file',
        name: newFile.fileName,
        path: newFile.path,
        icon: this.getIconForFileType(fileExtension),
        size: `${Math.ceil(newFile.htmlContent.length / 1024)} KB`,
        modified: new Date().toISOString(),
        content: `virtual-file://${newFile.path}` // Mark as virtual file
      };
      
      if (existingIndex >= 0) {
        // Update existing file
        parent.children[existingIndex] = fileItem;
      } else {
        // Add new file
        parent.children.push(fileItem);
      }
      
      // Store the actual content in localStorage
      this.saveVirtualFile(newFile.path, newFile.htmlContent, newFile.content);
      
      // Trigger update
      this.fileSystem.set({...fs});
    }
  }
  
  private getIconForFileType(extension: string): string {
    const iconMap: {[key: string]: string} = {
      'txt': 'pi pi-file',
      'md': 'pi pi-file-edit',
      'html': 'pi pi-file-edit',
      'css': 'pi pi-file-edit',
      'js': 'pi pi-file-edit',
      'ts': 'pi pi-file-edit',
      'json': 'pi pi-file',
      'pdf': 'pi pi-file-pdf',
      'png': 'pi pi-image',
      'jpg': 'pi pi-image',
      'jpeg': 'pi pi-image',
      'gif': 'pi pi-image'
    };
    return iconMap[extension] || 'pi pi-file';
  }
  
  private saveVirtualFile(path: string, htmlContent: string, textContent: string) {
    const virtualFiles = JSON.parse(localStorage.getItem('virtual-files') || '{}');
    virtualFiles[path] = {
      htmlContent,
      textContent,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('virtual-files', JSON.stringify(virtualFiles));
  }
  
  private loadVirtualFile(path: string): string | null {
    const virtualFiles = JSON.parse(localStorage.getItem('virtual-files') || '{}');
    return virtualFiles[path]?.htmlContent || virtualFiles[path]?.textContent || null;
  }
  
  // Computed current folder items
  currentItems = computed(() => {
    // If searching, return search results
    if (this.isSearching() && this.searchQuery().trim()) {
      return this.searchResults();
    }
    
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
          // Also update the shared file system service
          this.fileSystemService.setFileSystem(data.fileSystem);
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
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - this.lastClickTime;
    
    // If this is a double-click (same item, within 300ms), don't show preview
    if (this.lastClickItem === item && timeSinceLastClick < 300) {
      return;
    }
    
    // Update click tracking
    this.lastClickTime = currentTime;
    this.lastClickItem = item;
    
    // Show preview panel for single click
    this.selectedItem.set(item);
  }
  
  onItemDoubleClick(item: FileSystemItem) {
    // Clear the selected item to hide preview panel
    this.selectedItem.set(null);
    
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
  
  private getFileType(extension: string): 'text' | 'image' | 'pdf' | 'unknown' {
    const textExtensions = ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'rtf'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    const pdfExtensions = ['pdf'];
    
    if (textExtensions.includes(extension)) {
      return 'text';
    } else if (imageExtensions.includes(extension)) {
      return 'image';
    } else if (pdfExtensions.includes(extension)) {
      return 'pdf';
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

  // Context menu methods
  onItemRightClick(event: MouseEvent, item: FileSystemItem) {
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenuItem.set(item);
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.showContextMenu.set(true);
  }

  hideContextMenu() {
    this.showContextMenu.set(false);
    this.contextMenuItem.set(null);
  }

  handleContextMenuAction(action: string) {
    const item = this.contextMenuItem();
    if (!item) return;

    this.hideContextMenu();

    switch (action) {
      case 'rename':
        this.startRename(item);
        break;
      case 'delete':
        this.deleteItem(item);
        break;
      case 'copy':
        this.copyItem(item);
        break;
      case 'cut':
        this.cutItem(item);
        break;
      case 'paste':
        this.pasteItem();
        break;
      case 'set-wallpaper':
        this.setAsWallpaper(item);
        break;
    }
  }

  startRename(item: FileSystemItem) {
    this.renamingItem.set(item);
    this.newItemName.set(item.name);
    
    // Focus the input after a short delay
    setTimeout(() => {
      const input = document.querySelector('.rename-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  finishRename() {
    const item = this.renamingItem();
    const newName = this.newItemName().trim();
    
    if (item && newName && newName !== item.name) {
      // Emit rename event to parent
      this.onContextMenuAction.emit({
        action: 'rename',
        item,
        newName
      });
      
      // Update the item name locally
      item.name = newName;
    }
    
    this.cancelRename();
  }

  cancelRename() {
    this.renamingItem.set(null);
    this.newItemName.set('');
  }

  onRenameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.newItemName.set(target.value || '');
  }

  onRenameKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.finishRename();
    } else if (event.key === 'Escape') {
      this.cancelRename();
    }
  }

  deleteItem(item: FileSystemItem) {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      this.onContextMenuAction.emit({
        action: 'delete',
        item
      });
    }
  }

  copyItem(item: FileSystemItem) {
    this.clipboardItem.set(item);
    this.clipboardAction.set('copy');
    this.onContextMenuAction.emit({
      action: 'copy',
      item
    });
  }

  cutItem(item: FileSystemItem) {
    this.clipboardItem.set(item);
    this.clipboardAction.set('cut');
    this.onContextMenuAction.emit({
      action: 'cut',
      item
    });
  }

  pasteItem() {
    const clipboardItem = this.clipboardItem();
    const action = this.clipboardAction();
    
    if (clipboardItem && action) {
      this.onContextMenuAction.emit({
        action: 'paste',
        item: clipboardItem
      });
    }
  }

  setAsWallpaper(item: FileSystemItem) {
    if (this.getFileType(item.name.split('.').pop() || '') === 'image') {
      this.onContextMenuAction.emit({
        action: 'set-wallpaper',
        item
      });
    }
  }

  // Computed properties for context menu
  get canPaste(): boolean {
    return this.clipboardItem() !== null && this.clipboardAction() !== null;
  }

  isImageFile(item: any): boolean {
    if (!item) return false;
    return this.getFileType(item.name.split('.').pop() || '') === 'image';
  }

  get contextMenuItems() {
    const item = this.contextMenuItem();
    if (!item) return [];

    const items = [];

    // Edit option for text files
    if (this.isTextFile(item) && item.type === 'file') {
      items.push({ action: 'edit', label: 'Edit', icon: 'pi pi-file-edit' });
    }

    // Always available
    items.push({ action: 'rename', label: 'Rename', icon: 'pi pi-pencil' });
    items.push({ action: 'copy', label: 'Copy', icon: 'pi pi-copy' });
    items.push({ action: 'cut', label: 'Cut', icon: 'pi pi-scissors' });

    // Paste if clipboard has item
    if (this.canPaste) {
      items.push({ action: 'paste', label: 'Paste', icon: 'pi pi-clone' });
    }

    // Set as wallpaper for images
    if (this.isImageFile(item)) {
      items.push({ action: 'set-wallpaper', label: 'Set as Wallpaper', icon: 'pi pi-image' });
    }

    // Delete
    items.push({ action: 'delete', label: 'Delete', icon: 'pi pi-trash' });

    return items;
  }

  // Search functionality
  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.trim();
    this.searchQuery.set(query);
    
    if (query.length > 0) {
      this.performSearch(query);
    } else {
      this.clearSearch();
    }
  }

  performSearch(query: string) {
    this.isSearching.set(true);
    const results: FileSystemItem[] = [];
    
    if (this.fileSystem()) {
      this.searchInDirectory(this.fileSystem()!, query.toLowerCase(), results);
    }
    
    this.searchResults.set(results);
  }

  private searchInDirectory(directory: FileSystemItem, query: string, results: FileSystemItem[]) {
    if (directory.children) {
      for (const item of directory.children) {
        // Check if item name matches search query
        if (item.name.toLowerCase().includes(query)) {
          results.push(item);
        }
        
        // Recursively search in subdirectories
        if (item.type === 'folder' && item.children) {
          this.searchInDirectory(item, query, results);
        }
      }
    }
  }

  clearSearch() {
    this.isSearching.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  onSearchKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.clearSearch();
      // Clear the search input
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = '';
      }
    }
  }

  // Computed search status
  get searchStatus() {
    if (this.isSearching() && this.searchQuery().trim()) {
      const resultCount = this.searchResults().length;
      return `Found ${resultCount} item${resultCount !== 1 ? 's' : ''} for "${this.searchQuery()}"`;
    }
    return '';
  }

  // Preview functionality
  getFileTypeDisplay(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'txt': return 'Text File';
      case 'md': return 'Markdown File';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg': return 'Image File';
      case 'pdf': return 'PDF Document';
      case 'doc':
      case 'docx': return 'Word Document';
      case 'xls':
      case 'xlsx': return 'Excel Spreadsheet';
      default: return 'File';
    }
  }

  getImagePath(item: any): string {
    if (item.content) {
      return item.content;
    }
    return `assets/explorer${item.path}`;
  }

  isTextFile(item: any): boolean {
    if (!item) return false;
    const extension = item.name.split('.').pop()?.toLowerCase();
    return ['txt', 'md'].includes(extension);
  }
}
