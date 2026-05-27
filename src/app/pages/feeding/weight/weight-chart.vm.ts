/**
 * View-models passed from `WeightComponent` computeds into chart templates.
 * Shapes mirror `weight.component.ts` chart builders.
 */

import type { WeightLog } from '../../../services/weight-log.service';

export interface WeightComparePt {
  log: WeightLog;
  days: number;
  x: number;
  y: number;
  showKgLabel: boolean;
  showXLabel: boolean;
  ageLabel: string;
}

export interface WeightVsStandardChartVm {
  regionCode: string;
  referenceCaption: string;
  W: number;
  H: number;
  PAD_L: number;
  PAD_R: number;
  PAD_T: number;
  PAD_B: number;
  bottomY: number;
  pathMedian: string;
  pathLow: string;
  pathHigh: string;
  bandPath: string;
  pathActual: string;
  pts: WeightComparePt[];
  gridLines: Array<{ y: number; label: string }>;
  xTicks: Array<{
    x: number;
    label: string;
    subLabel?: string;
    tickY: number;
  }>;
  minKg: number;
  maxKg: number;
  birthRecordLine: string;
  sexLabelVi: string;
}

export interface HeightComparePt {
  log: WeightLog;
  days: number;
  heightCm: number;
  x: number;
  y: number;
  showLabel: boolean;
  showXLabel: boolean;
  ageLabel: string;
}

export interface HeightVsStandardChartVm {
  regionCode: string;
  referenceCaption: string;
  W: number;
  H: number;
  PAD_L: number;
  PAD_R: number;
  PAD_T: number;
  PAD_B: number;
  bottomY: number;
  pathMedian: string;
  pathLow: string;
  pathHigh: string;
  bandPath: string;
  pathActual: string;
  pts: HeightComparePt[];
  gridLines: Array<{ y: number; label: string }>;
  xTicks: Array<{ x: number; label: string; subLabel?: string }>;
  sexLabelVi: string;
}

export interface WeightTrendPt {
  log: WeightLog;
  x: number;
  y: number;
  showXLabel: boolean;
  showKgLabel: boolean;
}

export interface WeightTrendChartVm {
  W: number;
  H: number;
  PAD_L: number;
  PAD_R: number;
  PAD_T: number;
  PAD_B: number;
  bottomY: number;
  pathActual: string;
  areaPath: string;
  pts: WeightTrendPt[];
  gridLines: Array<{ y: number; label: string }>;
  minKg: number;
  maxKg: number;
}

export interface WeightVelocityPt {
  x: number;
  y: number;
  gPerDay: number;
  label: string;
  showValue: boolean;
  showXLabel: boolean;
}

export interface WeightVelocityChartVm {
  W: number;
  H: number;
  PAD_L: number;
  innerW: number;
  PAD_T: number;
  PAD_B: number;
  pathLine: string;
  pts: WeightVelocityPt[];
  gridLines: Array<{ y: number; label: string }>;
  zeroY: number;
  showZeroLine: boolean;
}
