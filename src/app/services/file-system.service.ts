import { Injectable, signal } from '@angular/core';

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

@Injectable({
  providedIn: 'root'
})
export class FileSystemService {
  // Global file system signal that all Explorer instances can share
  private fileSystemSignal = signal<FileSystemItem | null>(null);
  
  // Observable for file system changes
  getFileSystem() {
    return this.fileSystemSignal;
  }
  
  setFileSystem(fileSystem: FileSystemItem) {
    this.fileSystemSignal.set(fileSystem);
  }
  
  // Add a new file to the file system
  addFile(newFile: NewFileData) {
    const fs = this.fileSystemSignal();
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
      
      // Trigger update by creating a new object reference
      this.fileSystemSignal.set({...fs});
    }
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
  
  loadVirtualFile(path: string): string | null {
    const virtualFiles = JSON.parse(localStorage.getItem('virtual-files') || '{}');
    return virtualFiles[path]?.htmlContent || virtualFiles[path]?.textContent || null;
  }
}

