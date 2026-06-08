import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  READINESS_SIGNS,
  SOLID_FOOD_STAGES,
  STARTER_FOODS,
  MEAL_TYPE_LABELS,
  REACTION_LABELS,
  REACTION_OPTIONS,
  TRIAL_OUTCOME_LABELS,
  FOOD_TRIAL_REQUIRED_DAYS,
  daysUntilSolidFood,
  getFeedingTipsForMonth,
  getGuideForMonth,
  getStageForMonth,
  isSolidFoodUnlocked,
  resolveWeaningMonth,
  SolidFoodMealType,
  SolidFoodReaction,
  FoodTrialOutcome,
} from './solid-food.data';
import { SOLID_FOOD_ACTIVATION_DAYS, SOLID_FOOD_PREP_DAYS } from './solid-food.constants';
import { SolidFoodLogService } from '../../../services/solid-food-log.service';

export interface SolidFoodProfile {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
}

type SolidFoodSection = 'trials' | 'log' | 'guide' | 'foods';

@Component({
  selector: 'app-feeding-solid-food',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding-solid-food.component.html',
  styleUrls: ['./feeding-solid-food.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingSolidFoodComponent {
  private destroyRef = inject(DestroyRef);
  private solidFoodLogService = inject(SolidFoodLogService);

  profile = input<SolidFoodProfile | null>(null);
  editing = input(false);
  user = input('guest');

  now = signal(new Date());
  activeSection = signal<SolidFoodSection>('trials');
  stageOverride = signal<number | null>(null);

  readonly readinessSigns = READINESS_SIGNS;
  readonly stages = SOLID_FOOD_STAGES;
  readonly starterFoods = STARTER_FOODS;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly reactionLabels = REACTION_LABELS;
  readonly reactionOptions = REACTION_OPTIONS;
  readonly trialOutcomeLabels = TRIAL_OUTCOME_LABELS;
  readonly activationDays = SOLID_FOOD_ACTIVATION_DAYS;
  readonly trialRequiredDays = FOOD_TRIAL_REQUIRED_DAYS;

  trialDialogOpen = signal(false);
  trialDayDialogOpen = signal(false);
  logDialogOpen = signal(false);

  draftFood = '';
  draftMealType: SolidFoodMealType = 'lunch';
  draftReaction: SolidFoodReaction = 'ok';
  draftNote = '';
  draftTime = this.formatTime(new Date());

  trialDraftFood = '';
  trialDayDraftReaction: SolidFoodReaction = 'ok';
  trialDayDraftNote = '';

  constructor() {
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(new Date()));

    effect(() => {
      const u = this.user();
      this.solidFoodLogService.loadForUser(u);
    });
  }

  ageInDays = computed(() => {
    const birthDate = this.profile()?.birthDate;
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const diffMs = this.now().getTime() - birth.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  });

  unlocked = computed(() => isSolidFoodUnlocked(this.ageInDays()));
  daysUntil = computed(() => daysUntilSolidFood(this.ageInDays()));
  showPrepBanner = computed(() => {
    const days = this.ageInDays();
    if (days === null) return false;
    return days >= SOLID_FOOD_PREP_DAYS && days < SOLID_FOOD_ACTIVATION_DAYS;
  });

  autoMonth = computed(() => {
    const days = this.ageInDays();
    if (days === null) return 6;
    return resolveWeaningMonth(days);
  });

  activeMonth = computed(() => {
    const override = this.stageOverride();
    if (override !== null) return override;
    return this.autoMonth();
  });

  activeStage = computed(() => getStageForMonth(this.activeMonth()));
  activeGuide = computed(() => getGuideForMonth(this.activeMonth()));
  feedingTips = computed(() => getFeedingTipsForMonth(this.activeMonth()));

  todayStr = computed(() => this.formatDate(this.now()));

  activeTrial = computed(() => this.solidFoodLogService.getActiveTrial(this.user()));

  activeTrialProgress = computed(() => {
    const trial = this.activeTrial();
    if (!trial) return null;
    return this.solidFoodLogService.trialProgress(trial);
  });

  todayTrialLogged = computed(() => {
    const trial = this.activeTrial();
    if (!trial) return false;
    return this.solidFoodLogService.hasTrialLogForDate(trial, this.todayStr());
  });

  completedTrials = computed(() => this.solidFoodLogService.getCompletedTrials(this.user()));

  todayLogs = computed(() =>
    this.solidFoodLogService.getLogsForDate(this.user(), this.todayStr())
  );

  introducedFoods = computed(() => this.solidFoodLogService.getIntroducedFoods(this.user()));
  readinessChecked = computed(() => this.solidFoodLogService.readinessCount());
  readinessMap = computed(() => this.solidFoodLogService.readiness());

  isStageAuto = computed(() => {
    if (this.stageOverride() === null) return true;
    return this.activeMonth() === this.autoMonth();
  });

  foodsForMonth = computed(() =>
    this.starterFoods.filter((f) => f.fromMonth <= this.activeMonth())
  );

  setSection(section: SolidFoodSection): void {
    this.activeSection.set(section);
  }

  selectStage(month: number): void {
    this.stageOverride.set(month === this.autoMonth() ? null : month);
  }

  toggleReadiness(signId: string): void {
    this.solidFoodLogService.toggleReadiness(this.user(), signId);
  }

  openStartTrialDialog(food = ''): void {
    if (this.activeTrial()) return;
    this.trialDraftFood = food;
    this.trialDialogOpen.set(true);
  }

  closeStartTrialDialog(): void {
    this.trialDialogOpen.set(false);
  }

  startTrial(): void {
    const food = this.trialDraftFood.trim();
    if (!food) return;
    try {
      this.solidFoodLogService.startTrial(this.user(), food, this.todayStr());
      this.closeStartTrialDialog();
      this.setSection('trials');
      this.openTrialDayDialog();
    } catch {
      /* active trial exists */
    }
  }

  openTrialDayDialog(): void {
    const trial = this.activeTrial();
    if (!trial) return;
    const todayEntry = trial.days.find((d) => d.date === this.todayStr());
    this.trialDayDraftReaction = todayEntry?.reaction ?? 'ok';
    this.trialDayDraftNote = todayEntry?.note ?? '';
    this.trialDayDialogOpen.set(true);
  }

  closeTrialDayDialog(): void {
    this.trialDayDialogOpen.set(false);
  }

  saveTrialDay(): void {
    const trial = this.activeTrial();
    if (!trial) return;
    this.solidFoodLogService.logTrialDay(
      this.user(),
      trial.id,
      this.todayStr(),
      this.trialDayDraftReaction,
      this.trialDayDraftNote
    );
    this.solidFoodLogService.deleteLogsForTrialDate(this.user(), trial.id, this.todayStr());
    this.solidFoodLogService.addLog({
      user: this.user(),
      date: this.todayStr(),
      time: this.formatTime(this.now()),
      food: trial.food,
      mealType: 'lunch',
      reaction: this.trialDayDraftReaction,
      note: this.trialDayDraftNote.trim() || undefined,
      trialId: trial.id,
    });
    this.closeTrialDayDialog();
  }

  completeActiveTrial(): void {
    const trial = this.activeTrial();
    if (!trial) return;
    this.solidFoodLogService.completeTrial(this.user(), trial.id);
  }

  cancelActiveTrial(): void {
    const trial = this.activeTrial();
    if (!trial) return;
    this.solidFoodLogService.cancelTrial(this.user(), trial.id);
  }

  openLogDialog(): void {
    this.draftFood = '';
    this.draftMealType = 'lunch';
    this.draftReaction = 'ok';
    this.draftNote = '';
    this.draftTime = this.formatTime(this.now());
    this.logDialogOpen.set(true);
  }

  closeLogDialog(): void {
    this.logDialogOpen.set(false);
  }

  saveLog(): void {
    const food = this.draftFood.trim();
    if (!food) return;
    this.solidFoodLogService.addLog({
      user: this.user(),
      date: this.todayStr(),
      time: this.draftTime,
      food,
      mealType: this.draftMealType,
      reaction: this.draftReaction,
      note: this.draftNote.trim() || undefined,
    });
    this.closeLogDialog();
  }

  deleteLog(id: string): void {
    this.solidFoodLogService.deleteLog(this.user(), id);
  }

  quickStartTrial(name: string): void {
    this.openStartTrialDialog(name);
  }

  formatTrialDate(date: string): string {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }

  completedOutcomeMeta(outcome: Exclude<FoodTrialOutcome, 'testing'>) {
    return this.trialOutcomeLabels[outcome];
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
