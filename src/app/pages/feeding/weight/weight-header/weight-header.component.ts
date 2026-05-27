import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TimelineMilestone } from '../../baby-timeline.data';
import type {
  HeightGrowthEvaluation,
  WeightGrowthEvaluation,
} from '../../baby-weight-growth';
import type { WeightLog } from '../../../../services/weight-log.service';
import {
  formatWeightCm,
  formatWeightDateDisplay,
  formatWeightKg,
  growthStatusClass,
} from '../weight-display.utils';

@Component({
  selector: 'app-weight-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weight-header.component.html',
  styleUrls: ['./weight-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightHeaderComponent {
  errorMsg = input<string>('');
  successMsg = input<string>('');
  birthDate = input<string | undefined>(undefined);

  currentTimelineMilestone = input<TimelineMilestone | null>(null);
  timelineStats = input<{ total: number; past: number }>({ total: 0, past: 0 });

  latestGrowthEval = input<WeightGrowthEvaluation | null>(null);
  latestHeightEval = input<HeightGrowthEvaluation | null>(null);
  sortedLogsDesc = input<WeightLog[]>([]);
  latestHeightLog = input<WeightLog | null>(null);

  openWhoTable = output<void>();
  openTimeline = output<void>();

  statusClass(status: string): string {
    return growthStatusClass(status);
  }

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
