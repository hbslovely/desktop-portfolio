import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatArea',
  standalone: true
})
export class FormatAreaPipe implements PipeTransform {
  transform(area: number | null | undefined): string {
    if (area === null || area === undefined) {
      return 'N/A';
    }
    
    return area.toLocaleString() + ' km²';
  }
}

