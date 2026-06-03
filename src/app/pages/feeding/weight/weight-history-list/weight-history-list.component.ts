import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WeightLog } from '../../../../services/weight-log.service';
import { formatWeightCm, formatWeightDateDisplay, formatWeightKg } from '../weight-display.utils';

@Component({
  selector: 'app-weight-history-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weight-history-list.component.html',
  styleUrls: ['./weight-history-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightHistoryListComponent {
  private readonly previewLimit = 10;

  loading = input<boolean>(false);
  logs = input<WeightLog[]>([]);
  fullHistoryOpen = signal(false);

  edit = output<WeightLog>();
  remove = output<WeightLog>();

  previewLogs = computed(() => this.logs().slice(0, this.previewLimit));
  hasMoreLogs = computed(() => this.logs().length > this.previewLimit);
  hiddenLogsCount = computed(() => Math.max(0, this.logs().length - this.previewLimit));

  formatDate(iso: string): string {
    return formatWeightDateDisplay(iso);
  }

  formatKg(n: number): string {
    return formatWeightKg(n);
  }

  formatCm(n: number): string {
    return formatWeightCm(n);
  }

  openFullHistory(): void {
    this.fullHistoryOpen.set(true);
  }

  closeFullHistory(): void {
    this.fullHistoryOpen.set(false);
  }
}
