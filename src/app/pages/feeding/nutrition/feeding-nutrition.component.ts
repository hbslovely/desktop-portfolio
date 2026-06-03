import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  computeNutritionPace,
  evaluateNutrition,
  NutritionEvaluation,
  NutritionPaceInfo,
  NutritionTarget,
} from '../feeding-nutrition';

export interface NutritionTodayStats {
  total: number;
  count: number;
  typicalFeedMl: number;
}

function nutritionPaceLabelFromStatus(status: NutritionPaceInfo['paceStatus']): string {
  switch (status) {
    case 'ahead':
      return 'Nhanh hơn mức trung bình hiện tại';
    case 'on-track':
      return 'Đúng mức trung bình hiện tại';
    case 'behind':
    default:
      return 'Chậm hơn mức trung bình hiện tại';
  }
}

function metricMetUi(s: 'met' | 'partial' | 'unmet'): {
  title: string;
  icon: string;
} {
  switch (s) {
    case 'met':
      return { title: 'Đã đáp ứng', icon: 'pi-check-circle' };
    case 'partial':
      return { title: 'Gần đạt', icon: 'pi-check-circle' };
    case 'unmet':
    default:
      return { title: 'Chưa đáp ứng', icon: 'pi-times-circle' };
  }
}

@Component({
  selector: 'app-feeding-nutrition',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feeding-nutrition.component.html',
  styleUrls: ['./feeding-nutrition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingNutritionComponent {
  nutritionTarget = input<NutritionTarget | null>(null);
  todayStats = input<NutritionTodayStats>({
    total: 0,
    count: 0,
    typicalFeedMl: 0,
  });
  now = input<Date>(new Date());
  latestWeightKg = input<number | undefined>(undefined);
  editing = input(false);

  goToWeight = output<void>();

  nutritionEval = computed<NutritionEvaluation | null>(() => {
    const target = this.nutritionTarget();
    if (!target) return null;
    const today = this.todayStats();
    return evaluateNutrition(target, today.total, today.count);
  });

  nutritionPace = computed<(NutritionPaceInfo & { paceLabelVi: string }) | null>(() => {
    const target = this.nutritionTarget();
    if (!target) return null;
    const p = computeNutritionPace(target, this.todayStats().total, this.now());
    return { ...p, paceLabelVi: nutritionPaceLabelFromStatus(p.paceStatus) };
  });

  nutritionMetricsStatus = computed<{
    avgPerFeed: 'met' | 'partial' | 'unmet';
    feedsByNow: 'met' | 'partial' | 'unmet';
    volumeByNow: 'met' | 'partial' | 'unmet';
    avgPerFeedTitle: string;
    avgPerFeedIcon: string;
    feedsByNowTitle: string;
    feedsByNowIcon: string;
    volumeByNowTitle: string;
    volumeByNowIcon: string;
    modelAvgMl: number;
    feedsLow: number;
    feedsHigh: number;
    pctPaceMid: number;
  } | null>(() => {
    const ev = this.nutritionEval();
    const pace = this.nutritionPace();
    if (!ev || !pace) return null;
    const today = this.todayStats();
    const t = ev.target;
    const typicalMl = today.typicalFeedMl || 0;
    const count = today.count || 0;
    const frac = pace.dayFraction;

    const feedsMidDaily = (t.feedsPerDayMin + t.feedsPerDayMax) / 2;
    const expFeedsMid = Math.max(0.35, feedsMidDaily * frac);
    const modelAvgMl = pace.expectedMidMl / expFeedsMid;

    let avgPerFeed: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      avgPerFeed = frac < 0.05 ? 'partial' : 'unmet';
    } else if (typicalMl >= modelAvgMl * 0.88 && typicalMl <= modelAvgMl * 1.14) {
      avgPerFeed = 'met';
    } else if (typicalMl >= modelAvgMl * 0.75 && typicalMl <= modelAvgMl * 1.28) {
      avgPerFeed = 'partial';
    } else if (typicalMl >= t.perFeedMin * 0.72 && typicalMl <= t.perFeedMax * 1.32) {
      avgPerFeed = 'partial';
    }

    const effMinF = t.feedsPerDayMin * frac;
    const effMaxF = t.feedsPerDayMax * frac;
    const feedsLow = Math.max(0, Math.floor(effMinF));
    const feedsHigh = Math.max(feedsLow, Math.ceil(effMaxF));

    let feedsByNow: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      feedsByNow = frac < 0.05 ? 'partial' : 'unmet';
    } else if (count >= feedsLow && count <= feedsHigh + 1) {
      feedsByNow = 'met';
    } else if (count >= feedsLow - 1 && count <= feedsHigh + 2) {
      feedsByNow = 'partial';
    } else if (count < feedsLow - 1) {
      feedsByNow = 'unmet';
    } else {
      feedsByNow = 'partial';
    }

    const pct = pace.percentOfPaceMid;
    let volumeByNow: 'met' | 'partial' | 'unmet' = 'unmet';
    if (pace.paceStatus === 'on-track') {
      volumeByNow = 'met';
    } else if (pace.paceStatus === 'ahead') {
      volumeByNow = pct > 125 ? 'partial' : 'met';
    } else {
      volumeByNow = pct >= 72 ? 'partial' : 'unmet';
    }

    const avgUi = metricMetUi(avgPerFeed);
    const feedsUi = metricMetUi(feedsByNow);
    const volUi = metricMetUi(volumeByNow);
    return {
      avgPerFeed,
      feedsByNow,
      volumeByNow,
      avgPerFeedTitle: avgUi.title,
      avgPerFeedIcon: avgUi.icon,
      feedsByNowTitle: feedsUi.title,
      feedsByNowIcon: feedsUi.icon,
      volumeByNowTitle: volUi.title,
      volumeByNowIcon: volUi.icon,
      modelAvgMl: Math.round(modelAvgMl),
      feedsLow,
      feedsHigh,
      pctPaceMid: pct,
    };
  });

  nutritionZones = computed(() => {
    const ev = this.nutritionEval();
    if (!ev) return null;
    const min = ev.target.dailyMlMin;
    const max = ev.target.dailyMlMax;
    const scaleMax = Math.max(max * 1.2, ev.actualMl + 10);
    const roundedMax = Math.round(scaleMax);
    const pointerPct = Math.max(0, Math.min(100, (ev.actualMl / roundedMax) * 100));
    const pointerVisPct = pointerPct < 5 ? 5 : pointerPct > 95 ? 95 : pointerPct;
    return {
      minLabel: min,
      maxLabel: max,
      scaleMax: roundedMax,
      pointerPct,
      pointerVisPct,
    };
  });

  nutritionPaceZones = computed(() => {
    const ev = this.nutritionEval();
    const pace = this.nutritionPace();
    if (!ev || !pace) return null;
    const min = pace.expectedMinMl;
    const max = pace.expectedMaxMl;
    const actual = ev.actualMl;
    const scaleMax = Math.max(Math.round(max * 1.2), actual + 20, Math.max(min + 30, 50));
    const pointerPct = Math.max(0, Math.min(100, (actual / scaleMax) * 100));
    const pointerVisPct = pointerPct < 5 ? 5 : pointerPct > 95 ? 95 : pointerPct;
    const bandLeft = (min / scaleMax) * 100;
    const bandW = ((max - min) / scaleMax) * 100;
    const minTickPct = Math.max(0, Math.min(100, (min / scaleMax) * 100));
    const maxTickPct = Math.max(0, Math.min(100, (max / scaleMax) * 100));
    return {
      minLabel: min,
      maxLabel: max,
      scaleMax,
      bandLeftPct: Math.max(0, Math.min(100, bandLeft)),
      bandWidthPct: Math.max(0, Math.min(100 - bandLeft, bandW)),
      minTickPct,
      maxTickPct,
      pointerPct,
      pointerVisPct,
      paceStatus: pace.paceStatus,
    };
  });

  formatWeightKg(kg: number | undefined): string {
    if (kg === undefined || !Number.isFinite(kg) || kg <= 0) return '';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);
  }

  onGoToWeight(): void {
    this.goToWeight.emit();
  }
}
