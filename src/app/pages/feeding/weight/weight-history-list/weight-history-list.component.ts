import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WeightLog } from '../../../../services/weight-log.service';
import {
  formatWeightCm,
  formatWeightDateDisplay,
  formatWeightKg,
} from '../weight-display.utils';

@Component({
  selector: 'app-weight-history-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weight-history-list.component.html',
  styleUrls: ['./weight-history-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightHistoryListComponent {
  loading = input<boolean>(false);
  logs = input<WeightLog[]>([]);

  edit = output<WeightLog>();
  remove = output<WeightLog>();

  formatDate(iso: string): string {
    return formatWeightDateDisplay(iso);
  }

  formatKg(n: number): string {
    return formatWeightKg(n);
  }

  formatCm(n: number): string {
    return formatWeightCm(n);
  }
}
