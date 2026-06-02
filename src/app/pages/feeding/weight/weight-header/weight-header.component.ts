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

  formatSigned(n: number, digits = 1): string {
    const abs = Math.abs(n).toFixed(digits);
    return `${n >= 0 ? '+' : '-'}${abs}`;
  }

  weightDeltaLabel(ev: WeightGrowthEvaluation): string {
    const e = ev.estimate;
    return `${this.formatSigned(e.deltaFromMedianKg, 2)} kg`;
  }

  heightDeltaLabel(ev: HeightGrowthEvaluation, currentHeightCm: number): string {
    const diff = Math.round((currentHeightCm - ev.medianCm) * 10) / 10;
    return `${this.formatSigned(diff, 1)} cm`;
  }

  heightMarkerPosition(ev: HeightGrowthEvaluation): number {
    const z = Math.max(-2, Math.min(2, ev.zScore));
    return ((z + 2) / 4) * 100;
  }

  friendlyHeightDetail(ev: HeightGrowthEvaluation, currentHeightCm: number): string {
    const diff = Math.round((currentHeightCm - ev.medianCm) * 10) / 10;
    const absDiff = this.formatCm(Math.abs(diff));
    if (Math.abs(diff) < 0.5) {
      return 'Chiều cao hiện tại gần mốc tham chiếu theo tuổi, tiếp tục theo dõi đều mỗi lần khám.';
    }
    if (diff < 0) {
      return `Hiện tại bé thấp hơn mốc tham chiếu khoảng ${absDiff} cm. Theo dõi thêm qua các lần đo tiếp theo.`;
    }
    return `Hiện tại bé cao hơn mốc tham chiếu khoảng ${absDiff} cm. Thường là khác biệt cá thể, tiếp tục theo dõi xu hướng.`;
  }
}
