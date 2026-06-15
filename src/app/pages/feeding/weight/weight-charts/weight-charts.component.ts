import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

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
  imports: [],
  templateUrl: './weight-charts.component.html',
  styleUrls: ['./weight-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightChartsComponent {
  readonly spanPreset = signal<'30d' | '90d' | '180d' | 'all'>('90d');
  readonly pinLatestPoint = signal(true);

  weightVsStandardChart = input<WeightVsStandardChartVm | null>(null);
  heightVsStandardChart = input<HeightVsStandardChartVm | null>(null);
  weightTrendChart = input<WeightTrendChartVm | null>(null);
  simpleTrendMode = input<boolean>(false);
  weightVelocityLineChart = input<WeightVelocityChartVm | null>(null);

  readonly spanDays = computed(() => {
    const preset = this.spanPreset();
    if (preset === '30d') return 30;
    if (preset === '90d') return 90;
    if (preset === '180d') return 180;
    return null;
  });

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

  setSpanPreset(preset: '30d' | '90d' | '180d' | 'all'): void {
    this.spanPreset.set(preset);
  }

  togglePinLatest(): void {
    this.pinLatestPoint.update((v) => !v);
  }

  private spanStartX(maxDays: number, width: number, left: number, right: number): number {
    const span = this.spanDays();
    if (span === null || maxDays <= 0) return left - 8;
    const visibleStartDays = Math.max(0, maxDays - span);
    const ratio = visibleStartDays / maxDays;
    return left + ratio * (width - left - right) - 8;
  }

  weightSpanStartX(cmp: WeightVsStandardChartVm): number {
    const maxDays = cmp.pts.length > 0 ? Math.max(...cmp.pts.map((p) => p.days)) : 0;
    return this.spanStartX(maxDays, cmp.W, cmp.PAD_L, cmp.PAD_R);
  }

  heightSpanStartX(cmp: HeightVsStandardChartVm): number {
    const maxDays = cmp.pts.length > 0 ? Math.max(...cmp.pts.map((p) => p.days)) : 0;
    return this.spanStartX(maxDays, cmp.W, cmp.PAD_L, cmp.PAD_R);
  }

  showWeightPointLabel(
    p: WeightVsStandardChartVm['pts'][number],
    list: WeightVsStandardChartVm['pts']
  ): boolean {
    if (!this.pinLatestPoint()) return p.showKgLabel;
    return list.length > 0 && p === list[list.length - 1];
  }

  showHeightPointLabel(
    p: HeightVsStandardChartVm['pts'][number],
    list: HeightVsStandardChartVm['pts']
  ): boolean {
    if (!this.pinLatestPoint()) return p.showLabel;
    return list.length > 0 && p === list[list.length - 1];
  }
}
