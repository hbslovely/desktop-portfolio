import { Component, Input, OnInit, Output, EventEmitter, signal, computed, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface SaveFileEvent {
  fileName: string;
  path: string;
  content: string;
  htmlContent: string;
}

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

@Component({
  selector: 'app-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-editor.component.html',
  styleUrl: './text-editor.component.scss'
})
export class TextEditorComponent implements OnInit {
  @ViewChild('editorContent', { static: false }) editorContentRef!: ElementRef<HTMLDivElement>;
  
  @Input() filePath = '';
  @Input() fileName = '';
  @Input() mode: 'new' | 'edit' = 'new';
  
  @Output() onFileSave = new EventEmitter<SaveFileEvent>();
  
  private http = inject(HttpClient);
  
  // Editor state
  content = signal<string>('');
  isModified = signal(false);
  isLoading = signal(false);
  currentFileName = signal('Untitled.txt');
  
  // Save dialog state
  showSaveDialog = signal(false);
  saveFileName = signal('');
  saveCurrentPath = signal('/Documents');
  fileSystem = signal<FileSystemItem | null>(null);
  
  // Success dialog state
  showSuccessDialog = signal(false);
  successMessage = signal('');
  
  // Toolbar state
  isBold = signal(false);
  isItalic = signal(false);
  isUnderline = signal(false);
  currentFontSize = signal('14px');
  currentAlignment = signal('left');
  
  // Computed properties for save dialog
  currentFolderItems = computed(() => {
    const fs = this.fileSystem();
    if (!fs) return [];
    
    const path = this.saveCurrentPath();
    if (path === '/') {
      return fs.children || [];
    }
    
    return this.findItemByPath(fs, path)?.children || [];
  });
  
  currentFolders = computed(() => {
    return this.currentFolderItems().filter(item => item.type === 'folder');
  });
  
  breadcrumbs = computed(() => {
    const path = this.saveCurrentPath();
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
  
  ngOnInit() {
    if (this.mode === 'edit' && this.filePath) {
      this.loadFile();
      this.currentFileName.set(this.fileName || 'Untitled.txt');
    }
    
    this.loadFileSystem();
  }
  
  private loadFile() {
    if (!this.filePath) return;
    
    this.isLoading.set(true);
    this.http.get(this.filePath, { responseType: 'text' })
      .subscribe({
        next: (data) => {
          this.content.set(data);
          if (this.editorContentRef) {
            this.editorContentRef.nativeElement.innerHTML = data;
          }
          this.isLoading.set(false);
          this.isModified.set(false);
        },
        error: (error) => {
          console.error('Error loading file:', error);
          this.isLoading.set(false);
        }
      });
  }
  
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
  
  onContentChange() {
    if (this.editorContentRef) {
      this.content.set(this.editorContentRef.nativeElement.innerHTML);
      this.isModified.set(true);
    }
  }
  
  // Formatting commands
  execCommand(command: string, value: string | null = null) {
    document.execCommand(command, false, value || undefined);
    this.editorContentRef?.nativeElement.focus();
    this.updateToolbarState();
  }
  
  formatBold() {
    this.execCommand('bold');
  }
  
  formatItalic() {
    this.execCommand('italic');
  }
  
  formatUnderline() {
    this.execCommand('underline');
  }
  
  formatAlignment(align: string) {
    switch(align) {
      case 'left':
        this.execCommand('justifyLeft');
        break;
      case 'center':
        this.execCommand('justifyCenter');
        break;
      case 'right':
        this.execCommand('justifyRight');
        break;
      case 'justify':
        this.execCommand('justifyFull');
        break;
    }
    this.currentAlignment.set(align);
  }
  
  formatList(type: 'ordered' | 'unordered') {
    if (type === 'ordered') {
      this.execCommand('insertOrderedList');
    } else {
      this.execCommand('insertUnorderedList');
    }
  }
  
  changeFontSize(size: string) {
    // Map CSS sizes to execCommand font sizes (1-7)
    const sizeMap: {[key: string]: string} = {
      '12px': '2',
      '14px': '3',
      '16px': '4',
      '18px': '5',
      '24px': '6',
      '32px': '7'
    };
    
    this.execCommand('fontSize', sizeMap[size] || '3');
    this.currentFontSize.set(size);
  }
  
  formatHeading(level: string) {
    this.execCommand('formatBlock', `<h${level}>`);
  }
  
  insertLink() {
    const url = prompt('Enter URL:');
    if (url) {
      this.execCommand('createLink', url);
    }
  }
  
  insertImage() {
    const url = prompt('Enter image URL:');
    if (url) {
      this.execCommand('insertImage', url);
    }
  }
  
  clearFormatting() {
    this.execCommand('removeFormat');
  }
  
  updateToolbarState() {
    this.isBold.set(document.queryCommandState('bold'));
    this.isItalic.set(document.queryCommandState('italic'));
    this.isUnderline.set(document.queryCommandState('underline'));
  }
  
  // File operations
  newDocument() {
    if (this.isModified() && !confirm('You have unsaved changes. Continue?')) {
      return;
    }
    
    this.content.set('');
    if (this.editorContentRef) {
      this.editorContentRef.nativeElement.innerHTML = '';
    }
    this.currentFileName.set('Untitled.txt');
    this.isModified.set(false);
  }
  
  openSaveDialog() {
    // Initialize save dialog with current file name or default
    const fileName = this.currentFileName();
    this.saveFileName.set(fileName === 'Untitled.txt' ? '' : fileName);
    this.showSaveDialog.set(true);
  }
  
  closeSaveDialog() {
    this.showSaveDialog.set(false);
  }
  
  navigateToPath(path: string) {
    this.saveCurrentPath.set(path);
  }
  
  selectFolder(folder: FileSystemItem) {
    if (folder.type === 'folder') {
      this.saveCurrentPath.set(folder.path);
    }
  }
  
  saveFile() {
    const fileName = this.saveFileName().trim();
    if (!fileName) {
      alert('Please enter a file name');
      return;
    }
    
    // Ensure file has an extension
    const finalFileName = fileName.includes('.') ? fileName : `${fileName}.html`;
    const savePath = `${this.saveCurrentPath()}/${finalFileName}`;
    
    // Get content from editor
    const htmlContent = this.editorContentRef?.nativeElement.innerHTML || '';
    const textContent = this.editorContentRef?.nativeElement.innerText || '';
    
    // Emit save event to parent component (app.component)
    this.onFileSave.emit({
      fileName: finalFileName,
      path: savePath,
      content: textContent,
      htmlContent: htmlContent
    });
    
    this.currentFileName.set(finalFileName);
    this.isModified.set(false);
    this.closeSaveDialog();
    
    // Show success dialog instead of alert
    this.successMessage.set(`File saved successfully to ${savePath}`);
    this.showSuccessDialog.set(true);
  }
  
  private downloadFile(fileName: string, content: string, contentType: string = 'text/html') {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
  
  exportAsText() {
    const content = this.editorContentRef?.nativeElement.innerText || '';
    const fileName = this.currentFileName().replace(/\.[^/.]+$/, '') + '.txt';
    this.downloadFile(fileName, content, 'text/plain');
  }
  
  exportAsHtml() {
    const content = this.editorContentRef?.nativeElement.innerHTML || '';
    const fileName = this.currentFileName().replace(/\.[^/.]+$/, '') + '.html';
    this.downloadFile(fileName, content, 'text/html');
  }
  
  closeSuccessDialog() {
    this.showSuccessDialog.set(false);
  }
}

