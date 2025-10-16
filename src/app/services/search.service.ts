import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_SEARCH_CONFIG } from '../config/app-icons.config';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface SearchResult {
  type: 'app' | 'file' | 'web';
  name: string;
  icon: string;
  description?: string;
  action?: string; // For apps
  path?: string;   // For files (virtual path)
  content?: string; // For files (actual content path)
  url?: string;    // For web
  score: number;
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

export interface FileSystemData {
  fileSystem: FileSystemItem;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  private fileSystemData: FileSystemItem[] = [];
  private isDataLoaded = false;

  constructor(private http: HttpClient) {
    this.loadFileSystemData();
  }

  private loadFileSystemData(): void {
    this.http.get<FileSystemData>('assets/json/explore.json')
      .pipe(
        map(data => this.flattenFileSystem(data.fileSystem)),
        catchError(error => {

          return of([]);
        })
      )
      .subscribe(files => {
        this.fileSystemData = files;
        this.isDataLoaded = true;
      });
  }

  private flattenFileSystem(item: FileSystemItem): FileSystemItem[] {
    const files: FileSystemItem[] = [];

    if (item.type === 'file') {
      files.push(item);
    }

    if (item.children) {
      item.children.forEach(child => {
        files.push(...this.flattenFileSystem(child));
      });
    }

    return files;
  }

  search(query: string): SearchResult[] {
    if (!query || query.trim().length < 1) {
      return [];
    }

    const lowerCaseQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search apps
    APP_SEARCH_CONFIG.apps.forEach(app => {
      const score = this.calculateScore(app.name, app.description, app.keywords, lowerCaseQuery);
      if (score > 0) {
        results.push({
          type: 'app',
          name: app.name,
          icon: this.getAppIcon(app.id),
          description: app.description,
          action: app.id,
          score: score
        });
      }
    });

    // Search files from JSON data
    if (this.isDataLoaded) {
      this.fileSystemData.forEach(file => {
        const score = this.calculateFileScore(file, lowerCaseQuery);
        if (score > 0) {
          results.push({
            type: 'file',
            name: file.name,
            icon: file.icon,
            description: this.getFileDescription(file),
            path: file.path,
            content: file.content,
            score: score
          });
        }
      });
    }

    // Add web search suggestion if query is long enough
    if (query.length >= 3) {
      results.push({
        type: 'web',
        name: `Search Google for "${query}"`,
        icon: 'pi-google',
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        score: 1 // Base score for web search
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private calculateScore(name: string, description: string, keywords: string[], searchTerm: string): number {
    let score = 0;
    const nameLower = name.toLowerCase();
    const descLower = description.toLowerCase();

    // Exact name match gets highest score
    if (nameLower === searchTerm) {
      score += 10;
    }
    // Name starts with search term
    else if (nameLower.startsWith(searchTerm)) {
      score += 8;
    }
    // Name contains search term
    else if (nameLower.includes(searchTerm)) {
      score += 6;
    }

    // Description contains search term
    if (descLower.includes(searchTerm)) {
      score += 3;
    }

    // Keyword matches
    keywords.forEach(keyword => {
      if (keyword.toLowerCase().includes(searchTerm)) {
        score += 2;
      }
    });

    return score;
  }

  private calculateFileScore(file: FileSystemItem, searchTerm: string): number {
    let score = 0;
    const nameLower = file.name.toLowerCase();
    const pathLower = file.path.toLowerCase();

    // Exact name match gets highest score
    if (nameLower === searchTerm) {
      score += 10;
    }
    // Name starts with search term
    else if (nameLower.startsWith(searchTerm)) {
      score += 8;
    }
    // Name contains search term
    else if (nameLower.includes(searchTerm)) {
      score += 6;
    }

    // Path contains search term
    if (pathLower.includes(searchTerm)) {
      score += 3;
    }

    // File extension match
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension && extension.includes(searchTerm)) {
      score += 4;
    }

    return score;
  }

  private getFileDescription(file: FileSystemItem): string {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const folder = file.path.split('/')[1] || 'Root';

    let description = `File in ${folder} folder`;

    if (extension) {
      switch (extension) {
        case 'txt':
          description = `Text file in ${folder} folder`;
          break;
        case 'md':
          description = `Markdown document in ${folder} folder`;
          break;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
          description = `Image file in ${folder} folder`;
          break;
        case 'pdf':
          description = `PDF document in ${folder} folder`;
          break;
        case 'json':
          description = `JSON configuration file in ${folder} folder`;
          break;
        case 'ts':
          description = `TypeScript source file in ${folder} folder`;
          break;
        case 'html':
          description = `HTML template file in ${folder} folder`;
          break;
        case 'scss':
        case 'css':
          description = `Stylesheet file in ${folder} folder`;
          break;
        default:
          description = `${extension.toUpperCase()} file in ${folder} folder`;
      }
    }

    if (file.size) {
      description += ` (${file.size})`;
    }

    return description;
  }

  private getAppIcon(appId: string): string {
    const icons: { [key: string]: string } = {
      'calculator': 'pi pi-calculator',
      'my-info': 'pi pi-user',
      'love': 'pi pi-heart',
      'explorer': 'pi pi-folder',
      'machine-info': 'pi pi-desktop',
      'credit': 'pi pi-dollar',
      'paint': 'pi pi-palette',
      'credits': 'pi pi-star',
      'hcmc': 'pi pi-globe'
    };
    return icons[appId] || 'pi pi-circle';
  }
}
