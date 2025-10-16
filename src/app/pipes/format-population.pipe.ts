import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatPopulation',
  standalone: true
})
export class FormatPopulationPipe implements PipeTransform {
  transform(population: number | null | undefined): string {
    if (population === null || population === undefined) {
      return 'N/A';
    }
    
    if (population >= 1000000000) {
      return (population / 1000000000).toFixed(2) + 'B';
    } else if (population >= 1000000) {
      return (population / 1000000).toFixed(2) + 'M';
    } else if (population >= 1000) {
      return (population / 1000).toFixed(1) + 'K';
    }
    
    return population.toString();
  }
}

