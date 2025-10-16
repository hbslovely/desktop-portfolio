import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatNumberVN',
  standalone: true
})
export class FormatNumberVNPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '0';
    }
    
    return new Intl.NumberFormat('vi-VN').format(value);
  }
}

