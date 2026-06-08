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
    mlPerKg: 'met' | 'partial' | 'unmet';
    perFeed: 'met' | 'partial' | 'unmet';
    remaining: 'met' | 'partial' | 'unmet';
    mlPerKgTitle: string;
    mlPerKgIcon: string;
    perFeedTitle: string;
    perFeedIcon: string;
    remainingTitle: string;
    remainingIcon: string;
    mlPerKgValue: number;
    mlPerKgMin: number;
    mlPerKgMax: number;
    perFeedValue: number;
    perFeedMin: number;
    perFeedMax: number;
    remainingPrimary: string;
    remainingSecondary: string;
  } | null>(() => {
    const ev = this.nutritionEval();
    const weightKg = this.latestWeightKg();
    if (!ev || !weightKg || weightKg <= 0) return null;

    const today = this.todayStats();
    const t = ev.target;
    const count = today.count || 0;
    const typicalMl = today.typicalFeedMl || 0;
    const totalMl = today.total || 0;

    const mlPerKgValue = count > 0 ? Math.round(totalMl / weightKg) : 0;
    const mlPerKgMin = Math.round(t.dailyMlMin / weightKg);
    const mlPerKgMax = Math.round(t.dailyMlMax / weightKg);

    let mlPerKg: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      mlPerKg = 'unmet';
    } else if (mlPerKgValue >= mlPerKgMin && mlPerKgValue <= mlPerKgMax) {
      mlPerKg = 'met';
    } else if (mlPerKgValue >= mlPerKgMin * 0.85 && mlPerKgValue <= mlPerKgMax * 1.12) {
      mlPerKg = 'partial';
    }

    let perFeed: 'met' | 'partial' | 'unmet' = 'unmet';
    if (count === 0) {
      perFeed = 'unmet';
    } else if (typicalMl >= t.perFeedMin && typicalMl <= t.perFeedMax) {
      perFeed = 'met';
    } else if (typicalMl >= t.perFeedMin * 0.78 && typicalMl <= t.perFeedMax * 1.22) {
      perFeed = 'partial';
    }

    let remaining: 'met' | 'partial' | 'unmet' = 'unmet';
    let remainingPrimary = 'Chưa có cữ';
    let remainingSecondary = `Mục tiêu tối thiểu ${ev.target.dailyMlMin}ml`;

    if (count > 0) {
      if (ev.remainingToMin > 0) {
        const feedSize = Math.max(typicalMl, t.perFeedMin, 1);
        const feedsLeft = Math.max(1, Math.ceil(ev.remainingToMin / feedSize));
        remainingPrimary = `${ev.remainingToMin}ml nữa`;
        remainingSecondary = `~${feedsLeft} cữ để đạt mức tối thiểu`;
        remaining = ev.remainingToMin > t.dailyMlMin * 0.25 ? 'unmet' : 'partial';
      } else if (ev.actualMl > ev.target.dailyMlMax) {
        remainingPrimary = `+${ev.actualMl - ev.target.dailyMlMax}ml`;
        remainingSecondary = 'Vượt mức tối đa khuyến nghị';
        remaining = 'partial';
      } else if (ev.remainingToMax > 0) {
        remainingPrimary = 'Đã đủ min';
        remainingSecondary = `Còn có thể bú thêm ${ev.remainingToMax}ml`;
        remaining = 'met';
      } else {
        remainingPrimary = 'Đã đạt mức max';
        remainingSecondary = 'Theo dõi dấu hiệu no';
        remaining = 'met';
      }
    }

    const mlUi = metricMetUi(mlPerKg);
    const feedUi = metricMetUi(perFeed);
    const remUi = metricMetUi(remaining);

    return {
      mlPerKg,
      perFeed,
      remaining,
      mlPerKgTitle: mlUi.title,
      mlPerKgIcon: mlUi.icon,
      perFeedTitle: feedUi.title,
      perFeedIcon: feedUi.icon,
      remainingTitle: remUi.title,
      remainingIcon: remUi.icon,
      mlPerKgValue,
      mlPerKgMin,
      mlPerKgMax,
      perFeedValue: typicalMl,
      perFeedMin: t.perFeedMin,
      perFeedMax: t.perFeedMax,
      remainingPrimary,
      remainingSecondary,
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
