import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  private http = inject(HttpClient);
  
  // Global file system signal that all Explorer instances can share
  private fileSystemSignal = signal<FileSystemItem | null>(null);
  private loadPromise: Promise<void> | null = null;
  
  // Observable for file system changes
  getFileSystem() {
    return this.fileSystemSignal;
  }
  
  setFileSystem(fileSystem: FileSystemItem) {
    this.fileSystemSignal.set(fileSystem);
  }
  
  // Ensure file system is loaded
  async ensureFileSystemLoaded(): Promise<void> {
    // If already loaded, return immediately
    if (this.fileSystemSignal()) {
      return Promise.resolve();
    }
    
    // If already loading, return the existing promise
    if (this.loadPromise) {
      return this.loadPromise;
    }
    
    // Start loading
    this.loadPromise = this.loadFileSystemFromJson();
    return this.loadPromise;
  }
  
  private async loadFileSystemFromJson(): Promise<void> {
    try {
      console.log('FileSystemService: Loading file system from JSON...');
      const data = await firstValueFrom(
        this.http.get<{fileSystem: FileSystemItem}>('assets/json/explore.json')
      );
      this.fileSystemSignal.set(data.fileSystem);
      console.log('FileSystemService: File system loaded successfully');
    } catch (error) {
      console.error('FileSystemService: Failed to load file system:', error);
      throw error;
    } finally {
      this.loadPromise = null;
    }
  }
  
  // Add a new file to the file system
  async addFile(newFile: NewFileData): Promise<void> {
    // Ensure file system is loaded
    await this.ensureFileSystemLoaded();
    
    const fs = this.fileSystemSignal();
    if (!fs) {
      console.error('File system not initialized after loading attempt');
      return;
    }
    
    console.log('Adding file to file system:', newFile);
    
    // Find the parent folder
    const parentPath = newFile.path.substring(0, newFile.path.lastIndexOf('/')) || '/';
    const parent = parentPath === '/' ? fs : this.findItemByPath(fs, parentPath);
    
    console.log('Parent path:', parentPath, 'Parent found:', !!parent);
    
    if (parent) {
      // Ensure children array exists
      if (!parent.children) {
        parent.children = [];
      }
      
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
        console.log('Updating existing file at index:', existingIndex);
        parent.children[existingIndex] = fileItem;
      } else {
        // Add new file
        console.log('Adding new file to parent');
        parent.children.push(fileItem);
      }
      
      // Store the actual content in localStorage
      this.saveVirtualFile(newFile.path, newFile.htmlContent, newFile.content);
      
      // Trigger update by creating a deep copy of the file system
      // This ensures Angular's change detection picks up the change
      const updatedFs = JSON.parse(JSON.stringify(fs));
      this.fileSystemSignal.set(updatedFs);
      console.log('File system updated, new file count in parent:', parent.children.length);
    } else {
      console.error('Parent folder not found:', parentPath);
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

