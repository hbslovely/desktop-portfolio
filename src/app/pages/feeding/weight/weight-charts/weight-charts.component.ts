import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  formatWeightCm,
  formatWeightDateShort,
  formatWeightGPerDay,
  formatWeightKg,
} from '../weight-display.utils';
import type {
  HeightVsStandardChartVm,
  WeightTrendChartVm,
  WeightVelocityChartVm,
  WeightVsStandardChartVm,
} from '../weight-chart.vm';

@Component({
  selector: 'app-weight-charts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weight-charts.component.html',
  styleUrls: ['./weight-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightChartsComponent {
  weightVsStandardChart = input<WeightVsStandardChartVm | null>(null);
  heightVsStandardChart = input<HeightVsStandardChartVm | null>(null);
  weightTrendChart = input<WeightTrendChartVm | null>(null);
  simpleTrendMode = input<boolean>(false);
  weightVelocityLineChart = input<WeightVelocityChartVm | null>(null);

  formatKg(n: number): string {
    return formatWeightKg(n);
  }

  formatCm(n: number): string {
    return formatWeightCm(n);
  }

  formatDateShort(iso: string): string {
    return formatWeightDateShort(iso);
  }

  formatGPerDay(n: number): string {
    return formatWeightGPerDay(n);
  }
}
