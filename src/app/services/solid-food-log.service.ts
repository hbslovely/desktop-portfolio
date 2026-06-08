import { Injectable, signal } from '@angular/core';
import {
  FoodTrial,
  FoodTrialDayEntry,
  FoodTrialOutcome,
  FOOD_TRIAL_REQUIRED_DAYS,
  normalizeSolidFoodReaction,
  reactionToTrialOutcome,
  SolidFoodMealType,
  SolidFoodReaction,
  worstReaction,
} from '../pages/feeding/solid-food/solid-food.data';

export interface SolidFoodLog {
  id: string;
  user: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  food: string;
  mealType: SolidFoodMealType;
  reaction: SolidFoodReaction;
  note?: string;
  /** Liên kết với thử món 3 ngày (nếu có). */
  trialId?: string;
}

const LOGS_PREFIX = 'solid-food-logs::';
const TRIALS_PREFIX = 'solid-food-trials::';
const READINESS_PREFIX = 'solid-food-readiness::';

@Injectable({ providedIn: 'root' })
export class SolidFoodLogService {
  private logsSignal = signal<SolidFoodLog[]>([]);
  private trialsSignal = signal<FoodTrial[]>([]);
  private readinessSignal = signal<Record<string, boolean>>({});

  readonly logs = this.logsSignal.asReadonly();
  readonly trials = this.trialsSignal.asReadonly();
  readonly readiness = this.readinessSignal.asReadonly();

  loadForUser(user: string): void {
    try {
      const raw = localStorage.getItem(`${LOGS_PREFIX}${user}`);
      const logs = raw ? (JSON.parse(raw) as SolidFoodLog[]) : [];
      this.logsSignal.set(
        logs.map((log) => ({
          ...log,
          reaction: normalizeSolidFoodReaction(log.reaction as string),
        }))
      );

      const trialsRaw = localStorage.getItem(`${TRIALS_PREFIX}${user}`);
      const trials = trialsRaw ? (JSON.parse(trialsRaw) as FoodTrial[]) : [];
      this.trialsSignal.set(
        trials.map((trial) => ({
          ...trial,
          days: trial.days.map((d) => ({
            ...d,
            reaction: normalizeSolidFoodReaction(d.reaction as string),
          })),
        }))
      );

      const readinessRaw = localStorage.getItem(`${READINESS_PREFIX}${user}`);
      this.readinessSignal.set(
        readinessRaw ? (JSON.parse(readinessRaw) as Record<string, boolean>) : {}
      );
    } catch {
      this.logsSignal.set([]);
      this.trialsSignal.set([]);
      this.readinessSignal.set({});
    }
  }

  getLogsForDate(user: string, date: string): SolidFoodLog[] {
    return this.logsSignal()
      .filter((l) => l.user === user && l.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  getIntroducedFoods(user: string): string[] {
    const foods = new Set<string>();
    for (const trial of this.trialsSignal()) {
      if (trial.user === user && trial.outcome !== 'testing' && trial.outcome !== 'allergy') {
        foods.add(trial.food.trim());
      }
    }
    for (const log of this.logsSignal()) {
      if (log.user === user && log.food.trim()) {
        foods.add(log.food.trim());
      }
    }
    return [...foods].sort((a, b) => a.localeCompare(b, 'vi'));
  }

  getActiveTrial(user: string): FoodTrial | null {
    return this.trialsSignal().find((t) => t.user === user && t.outcome === 'testing') ?? null;
  }

  getCompletedTrials(user: string): Array<FoodTrial & { outcome: Exclude<FoodTrialOutcome, 'testing'> }> {
    return this.trialsSignal()
      .filter((t): t is FoodTrial & { outcome: Exclude<FoodTrialOutcome, 'testing'> } =>
        t.user === user && t.outcome !== 'testing'
      )
      .sort((a, b) => (b.completedAt ?? b.startDate).localeCompare(a.completedAt ?? a.startDate));
  }

  getTrialDayNumber(trial: FoodTrial, date: string): number | null {
    const idx = trial.days.findIndex((d) => d.date === date);
    return idx >= 0 ? idx + 1 : null;
  }

  hasTrialLogForDate(trial: FoodTrial, date: string): boolean {
    return trial.days.some((d) => d.date === date);
  }

  startTrial(user: string, food: string, startDate: string): FoodTrial {
    const active = this.getActiveTrial(user);
    if (active) {
      throw new Error('Đang có món đang thử — hoàn thành trước khi thử món mới.');
    }
    const trial: FoodTrial = {
      id: crypto.randomUUID(),
      user,
      food: food.trim(),
      startDate,
      days: [],
      outcome: 'testing',
    };
    const next = [...this.trialsSignal(), trial];
    this.persistTrials(user, next);
    return trial;
  }

  logTrialDay(
    user: string,
    trialId: string,
    date: string,
    reaction: SolidFoodReaction,
    note?: string
  ): FoodTrial {
    const trials = this.trialsSignal().map((trial) => {
      if (trial.id !== trialId || trial.user !== user) return trial;
      const days = trial.days.filter((d) => d.date !== date);
      const entry: FoodTrialDayEntry = { date, reaction, note: note?.trim() || undefined };
      return { ...trial, days: [...days, entry].sort((a, b) => a.date.localeCompare(b.date)) };
    });
    this.persistTrials(user, trials);
    const updated = trials.find((t) => t.id === trialId);
    if (!updated) throw new Error('Không tìm thấy thử món');
    return updated;
  }

  completeTrial(
    user: string,
    trialId: string,
    outcome?: Exclude<FoodTrialOutcome, 'testing'>,
    summaryNote?: string
  ): FoodTrial {
    const trials = this.trialsSignal().map((trial) => {
      if (trial.id !== trialId || trial.user !== user) return trial;
      const autoOutcome =
        outcome ??
        (trial.days.length > 0
          ? reactionToTrialOutcome(worstReaction(trial.days.map((d) => d.reaction)))
          : 'neutral');
      return {
        ...trial,
        outcome: autoOutcome,
        summaryNote: summaryNote?.trim() || trial.summaryNote,
        completedAt: new Date().toISOString().slice(0, 10),
      };
    });
    this.persistTrials(user, trials);
    const updated = trials.find((t) => t.id === trialId);
    if (!updated) throw new Error('Không tìm thấy thử món');
    return updated;
  }

  cancelTrial(user: string, trialId: string): void {
    const next = this.trialsSignal().filter((t) => !(t.user === user && t.id === trialId));
    this.persistTrials(user, next);
  }

  addLog(log: Omit<SolidFoodLog, 'id'>): SolidFoodLog {
    const entry: SolidFoodLog = { ...log, id: crypto.randomUUID() };
    const next = [...this.logsSignal(), entry];
    this.persistLogs(log.user, next);
    return entry;
  }

  deleteLog(user: string, id: string): void {
    const next = this.logsSignal().filter((l) => !(l.user === user && l.id === id));
    this.persistLogs(user, next);
  }

  deleteLogsForTrialDate(user: string, trialId: string, date: string): void {
    const next = this.logsSignal().filter(
      (l) => !(l.user === user && l.trialId === trialId && l.date === date)
    );
    this.persistLogs(user, next);
  }

  toggleReadiness(user: string, signId: string): void {
    const current = { ...this.readinessSignal() };
    current[signId] = !current[signId];
    this.readinessSignal.set(current);
    try {
      localStorage.setItem(`${READINESS_PREFIX}${user}`, JSON.stringify(current));
    } catch {
      /* ignore quota errors */
    }
  }

  readinessCount(): number {
    return Object.values(this.readinessSignal()).filter(Boolean).length;
  }

  trialProgress(trial: FoodTrial): { logged: number; required: number; canComplete: boolean } {
    const logged = trial.days.length;
    return {
      logged,
      required: FOOD_TRIAL_REQUIRED_DAYS,
      canComplete: logged >= FOOD_TRIAL_REQUIRED_DAYS,
    };
  }

  private persistLogs(user: string, logs: SolidFoodLog[]): void {
    this.logsSignal.set(logs);
    try {
      localStorage.setItem(`${LOGS_PREFIX}${user}`, JSON.stringify(logs));
    } catch {
      /* ignore quota errors */
    }
  }

  private persistTrials(user: string, trials: FoodTrial[]): void {
    this.trialsSignal.set(trials);
    try {
      localStorage.setItem(`${TRIALS_PREFIX}${user}`, JSON.stringify(trials));
    } catch {
      /* ignore quota errors */
    }
  }
}
