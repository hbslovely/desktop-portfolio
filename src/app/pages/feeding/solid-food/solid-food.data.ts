import { MONTH_GUIDES, PeriodGuide } from '../feeding-tips.data';
import { SOLID_FOOD_ACTIVATION_DAYS } from './solid-food.constants';

export type SolidFoodMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
/** Phản ứng khi thử món / ghi bữa ăn. */
export type SolidFoodReaction = 'ok' | 'neutral' | 'mild' | 'allergy';

export type FoodTrialOutcome = 'testing' | 'ok' | 'neutral' | 'mild' | 'allergy';

export interface FoodTrialDayEntry {
  date: string;
  reaction: SolidFoodReaction;
  note?: string;
}

export interface FoodTrial {
  id: string;
  user: string;
  food: string;
  startDate: string;
  days: FoodTrialDayEntry[];
  outcome: FoodTrialOutcome;
  summaryNote?: string;
  completedAt?: string;
}

export const FOOD_TRIAL_REQUIRED_DAYS = 3;

export interface SolidFoodStage {
  month: number;
  label: string;
  shortLabel: string;
  accent: 'mint' | 'amber' | 'peach' | 'lavender' | 'rose';
  mealsPerDay: number;
  milkNote: string;
}

export interface ReadinessSign {
  id: string;
  label: string;
  description: string;
}

export interface StarterFood {
  name: string;
  category: 'grain' | 'veg' | 'fruit' | 'protein';
  note: string;
  fromMonth: number;
}

export const READINESS_SIGNS: ReadinessSign[] = [
  {
    id: 'sit',
    label: 'Ngồi vững có đỡ',
    description: 'Bé ngồi thẳng trên ghế ăn hoặc lòng mẹ, không nghiêng đầu quá nhiều.',
  },
  {
    id: 'tongue',
    label: 'Hết phản xạ đẩy lưỡi',
    description: 'Không tự động đẩy thìa/cháo ra ngoài khi cho vào miệng.',
  },
  {
    id: 'reach',
    label: 'Với đồ vào miệng',
    description: 'Bé chủ động cầm đồ vật và đưa vào miệng để khám phá.',
  },
  {
    id: 'interest',
    label: 'Quan tâm đồ ăn người lớn',
    description: 'Nhìn chăm chú, há miệng hoặc vươn tay khi thấy người lớn ăn.',
  },
  {
    id: 'swallow',
    label: 'Nuốt được (không chỉ nhổ)',
    description: 'Biết nuốt thức ăn loãng thay vì chỉ đẩy ra ngoài.',
  },
  {
    id: 'weight',
    label: 'Tăng cân ổn định',
    description: 'Cân nặng đã hồi phục sau sinh và tăng trưởng đều.',
  },
];

export const SOLID_FOOD_STAGES: SolidFoodStage[] = [
  {
    month: 6,
    label: 'Tháng 6',
    shortLabel: '6T',
    accent: 'mint',
    mealsPerDay: 1,
    milkNote: '5 cữ sữa + 1 bữa ăn dặm · sữa vẫn là chính',
  },
  {
    month: 7,
    label: 'Tháng 7',
    shortLabel: '7T',
    accent: 'amber',
    mealsPerDay: 2,
    milkNote: '4–5 cữ sữa + 2 bữa ăn dặm',
  },
  {
    month: 8,
    label: 'Tháng 8',
    shortLabel: '8T',
    accent: 'peach',
    mealsPerDay: 2,
    milkNote: '3–4 cữ sữa + 2–3 bữa ăn dặm + 1 bữa phụ',
  },
  {
    month: 9,
    label: 'Tháng 9',
    shortLabel: '9T',
    accent: 'lavender',
    mealsPerDay: 3,
    milkNote: '3 cữ sữa + 3 bữa ăn dặm + 1–2 bữa phụ',
  },
  {
    month: 10,
    label: 'Tháng 10',
    shortLabel: '10T',
    accent: 'rose',
    mealsPerDay: 3,
    milkNote: '2–3 cữ sữa + 3 bữa ăn dặm + 1–2 bữa phụ',
  },
  {
    month: 11,
    label: 'Tháng 11',
    shortLabel: '11T',
    accent: 'mint',
    mealsPerDay: 3,
    milkNote: '2 cữ sữa + 3 bữa chính + 2 bữa phụ',
  },
  {
    month: 12,
    label: 'Tháng 12',
    shortLabel: '12T',
    accent: 'amber',
    mealsPerDay: 3,
    milkNote: '2 cữ sữa + 3 bữa chính + 2 bữa phụ',
  },
];

export const STARTER_FOODS: StarterFood[] = [
  { name: 'Cháo gạo loãng', category: 'grain', note: '1 gạo : 10 nước', fromMonth: 6 },
  { name: 'Khoai lang', category: 'veg', note: 'Nghiền mịn, thử 3 ngày', fromMonth: 6 },
  { name: 'Bí đỏ', category: 'veg', note: 'Hấp nghiền', fromMonth: 6 },
  { name: 'Cà rốt', category: 'veg', note: 'Hấp mềm, nghiền', fromMonth: 6 },
  { name: 'Chuối chín', category: 'fruit', note: 'Nghiền hoặc miếng mềm', fromMonth: 6 },
  { name: 'Bơ', category: 'fruit', note: 'Nghiền mịn', fromMonth: 6 },
  { name: 'Thịt gà', category: 'protein', note: 'Xay nhỏ, từ tháng 7', fromMonth: 7 },
  { name: 'Lòng đỏ trứng', category: 'protein', note: 'Nấu chín kỹ, từ tháng 7', fromMonth: 7 },
  { name: 'Cá trắng', category: 'protein', note: 'Lọc xương, từ tháng 8', fromMonth: 8 },
];

export const MEAL_TYPE_LABELS: Record<SolidFoodMealType, string> = {
  breakfast: 'Sáng',
  lunch: 'Trưa',
  dinner: 'Tối',
  snack: 'Phụ',
};

export const REACTION_OPTIONS: {
  id: SolidFoodReaction;
  label: string;
  shortLabel: string;
  emoji: string;
  hint: string;
}[] = [
  {
    id: 'ok',
    label: 'Bé ổn',
    shortLabel: 'Ổn',
    emoji: '😊',
    hint: 'Ăn được, vui vẻ, không triệu chứng lạ',
  },
  {
    id: 'neutral',
    label: 'Không thấy gì',
    shortLabel: 'BT',
    emoji: '😐',
    hint: 'Không có dấu hiệu bất thường rõ ràng',
  },
  {
    id: 'mild',
    label: 'Nghi ngờ nhẹ',
    shortLabel: 'Nghi ngờ',
    emoji: '😕',
    hint: 'Ban nhẹ, khó chịu, phân hơi lạ…',
  },
  {
    id: 'allergy',
    label: 'Dị ứng',
    shortLabel: 'Dị ứng',
    emoji: '😢',
    hint: 'Nôn nhiều, phát ban, khó thở — cần theo dõi bác sĩ',
  },
];

export const REACTION_LABELS: Record<SolidFoodReaction, { label: string; emoji: string }> =
  Object.fromEntries(
    REACTION_OPTIONS.map((o) => [o.id, { label: o.label, emoji: o.emoji }])
  ) as Record<SolidFoodReaction, { label: string; emoji: string }>;

export const TRIAL_OUTCOME_LABELS: Record<
  Exclude<FoodTrialOutcome, 'testing'>,
  { label: string; emoji: string }
> = {
  ok: { label: 'An toàn — bé ổn', emoji: '😊' },
  neutral: { label: 'Không thấy phản ứng', emoji: '😐' },
  mild: { label: 'Nghi ngờ nhẹ', emoji: '😕' },
  allergy: { label: 'Có dị ứng', emoji: '😢' },
};

export function normalizeSolidFoodReaction(value: string): SolidFoodReaction {
  if (value === 'ok' || value === 'neutral' || value === 'mild' || value === 'allergy') {
    return value;
  }
  if (value === 'severe') return 'allergy';
  return 'neutral';
}

export function worstReaction(reactions: SolidFoodReaction[]): SolidFoodReaction {
  const rank: Record<SolidFoodReaction, number> = {
    ok: 0,
    neutral: 1,
    mild: 2,
    allergy: 3,
  };
  return reactions.reduce(
    (worst, r) => (rank[r] > rank[worst] ? r : worst),
    'ok' as SolidFoodReaction
  );
}

export function reactionToTrialOutcome(reaction: SolidFoodReaction): Exclude<FoodTrialOutcome, 'testing'> {
  return reaction;
}

export function isSolidFoodUnlocked(ageInDays: number | null): boolean {
  if (ageInDays === null) return false;
  return ageInDays >= SOLID_FOOD_ACTIVATION_DAYS;
}

export function daysUntilSolidFood(ageInDays: number | null): number | null {
  if (ageInDays === null) return null;
  return Math.max(0, SOLID_FOOD_ACTIVATION_DAYS - ageInDays);
}

export function resolveWeaningMonth(ageInDays: number): number {
  const months = Math.floor(ageInDays / 30.4375);
  return Math.min(12, Math.max(6, months));
}

export function getStageForMonth(month: number): SolidFoodStage {
  const clamped = Math.min(12, Math.max(6, month));
  return SOLID_FOOD_STAGES.find((s) => s.month === clamped) ?? SOLID_FOOD_STAGES[0];
}

export function getGuideForMonth(month: number): PeriodGuide | null {
  const clamped = Math.min(12, Math.max(6, month));
  return MONTH_GUIDES[clamped] ?? null;
}

export function getFeedingTipsForMonth(month: number) {
  const guide = getGuideForMonth(month);
  if (!guide) return [];
  return guide.tips.filter((t) => t.category === 'feeding');
}
