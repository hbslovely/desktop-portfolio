import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatFileSize',
  standalone: true
})
export class FormatFileSizePipe implements PipeTransform {
  transform(value: string | number | undefined): string {
    // If it's already a formatted string, return it
    if (typeof value === 'string') {
      return value || '';
    }
    
    // If it's a number, format it
    if (typeof value === 'number') {
      if (value === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(value) / Math.log(k));
      
      return Math.round((value / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
    
    return '';
  }
}

