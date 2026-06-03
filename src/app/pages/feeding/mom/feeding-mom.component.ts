import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  POSTPARTUM_STAGES,
  PostpartumStage,
  resolvePostpartumStage,
} from '../postpartum-food.data';
import { resolveGuide } from '../feeding-tips.data';
import { MOM_WELLNESS_CARDS } from '../mom-wellness.data';

export interface MomTabProfile {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
}

type MomSection = 'overview' | 'care' | 'food' | 'tips';

@Component({
  selector: 'app-feeding-mom',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feeding-mom.component.html',
  styleUrls: ['./feeding-mom.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingMomComponent {
  private destroyRef = inject(DestroyRef);

  profile = input<MomTabProfile | null>(null);
  editing = input(false);

  goToFeeding = output<void>();

  now = signal(new Date());
  activeSection = signal<MomSection>('overview');
  momFoodStageOverride = signal<number | null>(null);

  readonly momWellnessCards = MOM_WELLNESS_CARDS;
  readonly postpartumStages = POSTPARTUM_STAGES;
  readonly momStageTotal = POSTPARTUM_STAGES.length;

  constructor() {
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(new Date()));
  }

  ageInDays = computed(() => {
    const birthDate = this.profile()?.birthDate;
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const diffMs = this.now().getTime() - birth.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  });

  activeMomStage = computed<PostpartumStage>(() => {
    const override = this.momFoodStageOverride();
    if (override !== null) {
      const i = Math.max(0, Math.min(POSTPARTUM_STAGES.length - 1, override));
      return POSTPARTUM_STAGES[i];
    }
    return resolvePostpartumStage(this.ageInDays() ?? 0);
  });

  activeMomStageIndex = computed(() =>
    POSTPARTUM_STAGES.findIndex((s) => s.id === this.activeMomStage().id)
  );

  currentMomStage = computed(() => resolvePostpartumStage(this.ageInDays() ?? 0));

  isMomStageAuto = computed(() => {
    if (this.momFoodStageOverride() === null) return true;
    return this.activeMomStage().id === this.currentMomStage().id;
  });

  momPeriodContext = computed(() => {
    const days = this.ageInDays();
    if (days === null) return null;
    const r = resolveGuide(days);
    if (!r) return null;
    return { label: r.period.label, summary: r.period.summary };
  });

  momTipsThisPeriod = computed(() => {
    const days = this.ageInDays();
    if (days === null) return [];
    const r = resolveGuide(days);
    if (!r) return [];
    return r.period.tips.filter((t) => t.category === 'mom');
  });

  stageProgressPct = computed(() => {
    const idx = this.activeMomStageIndex();
    if (this.momStageTotal <= 1) return 100;
    return Math.round(((idx + 1) / this.momStageTotal) * 100);
  });

  setSection(section: MomSection): void {
    this.activeSection.set(section);
  }

  selectStageIndex(index: number): void {
    const i = Math.max(0, Math.min(POSTPARTUM_STAGES.length - 1, index));
    const autoIdx = POSTPARTUM_STAGES.findIndex((s) => s.id === this.currentMomStage().id);
    this.momFoodStageOverride.set(i === autoIdx ? null : i);
    this.activeSection.set('food');
  }

  prevMomStage(): void {
    const i = this.activeMomStageIndex();
    if (i > 0) this.momFoodStageOverride.set(i - 1);
  }

  nextMomStage(): void {
    const i = this.activeMomStageIndex();
    if (i < POSTPARTUM_STAGES.length - 1) {
      this.momFoodStageOverride.set(i + 1);
    }
  }

  resetMomStage(): void {
    this.momFoodStageOverride.set(null);
  }

  onGoToFeeding(): void {
    this.goToFeeding.emit();
  }
}
