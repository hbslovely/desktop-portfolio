import { Injectable, signal } from '@angular/core';

export type ExpenseTheme = 'compact' | 'spacious';
export type ExpenseFontSize = 'small' | 'medium' | 'large';
export type ExpenseLayout = 'v1' | 'v2';

export interface PredictionWeights {
  linear: number;
  moving: number;
  exponential: number;
  seasonal: number;
}

export interface PredictionSettings {
  weights: PredictionWeights;
  exponentialAlpha: number; // 0-1, default 0.3
  movingAveragePeriod: number; // default 7
  historicalDays: number; // default 60
  enableLinearRegression: boolean;
  enableMovingAverage: boolean;
  enableExponentialSmoothing: boolean;
  enableSeasonalPattern: boolean;
}

export interface ExpenseSettings {
  layout: ExpenseLayout;
  theme: ExpenseTheme;
  fontSize: ExpenseFontSize;
  prediction?: PredictionSettings;
  excludeCategories?: string[]; // Categories to exclude from lists and filters
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseSettingsService {
  private readonly STORAGE_KEY = 'expense-app-settings';

  // Default settings
  private defaultSettings: ExpenseSettings = {
    layout: 'v1',
    theme: 'compact',
    fontSize: 'medium',
    prediction: {
      weights: {
        linear: 0.3,
        moving: 0.3,
        exponential: 0.2,
        seasonal: 0.2
      },
      exponentialAlpha: 0.3,
      movingAveragePeriod: 7,
      historicalDays: 60,
      enableLinearRegression: true,
      enableMovingAverage: true,
      enableExponentialSmoothing: true,
      enableSeasonalPattern: true
    },
    excludeCategories: []
  };

  // Signals for reactive updates
  settings = signal<ExpenseSettings>(this.defaultSettings);
  layout = signal<ExpenseLayout>(this.defaultSettings.layout);
  theme = signal<ExpenseTheme>(this.defaultSettings.theme);
  fontSize = signal<ExpenseFontSize>(this.defaultSettings.fontSize);
  predictionSettings = signal<PredictionSettings>(this.defaultSettings.prediction!);

  constructor() {
    this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  loadSettings(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const settings: ExpenseSettings = JSON.parse(saved);
        // Ensure layout exists (for backward compatibility)
        if (!settings.layout) {
          settings.layout = 'v1';
        }
        // Ensure prediction settings exist (for backward compatibility)
        if (!settings.prediction) {
          settings.prediction = this.defaultSettings.prediction!;
        }
        // Ensure excludeCategories exists (for backward compatibility)
        if (!settings.excludeCategories) {
          settings.excludeCategories = [];
        }
        this.settings.set(settings);
        this.layout.set(settings.layout);
        this.theme.set(settings.theme);
        this.fontSize.set(settings.fontSize);
        this.predictionSettings.set(settings.prediction);
      } else {
        this.settings.set(this.defaultSettings);
        this.layout.set(this.defaultSettings.layout);
        this.theme.set(this.defaultSettings.theme);
        this.fontSize.set(this.defaultSettings.fontSize);
      }
    } catch (error) {
      console.error('Error loading expense settings:', error);
      this.settings.set(this.defaultSettings);
      this.layout.set(this.defaultSettings.layout);
      this.theme.set(this.defaultSettings.theme);
      this.fontSize.set(this.defaultSettings.fontSize);
      this.predictionSettings.set(this.defaultSettings.prediction!);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings: ExpenseSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      this.settings.set(settings);
      this.layout.set(settings.layout);
      this.theme.set(settings.theme);
      this.fontSize.set(settings.fontSize);
      this.predictionSettings.set(settings.prediction || this.defaultSettings.prediction!);
    } catch (error) {
      console.error('Error saving expense settings:', error);
    }
  }

  /**
   * Update layout
   */
  updateLayout(layout: ExpenseLayout): void {
    const current = this.settings();
    this.saveSettings({ ...current, layout });
  }

  /**
   * Update theme
   */
  updateTheme(theme: ExpenseTheme): void {
    const current = this.settings();
    this.saveSettings({ ...current, theme });
  }

  /**
   * Update font size
   */
  updateFontSize(fontSize: ExpenseFontSize): void {
    const current = this.settings();
    this.saveSettings({ ...current, fontSize });
  }

  /**
   * Update prediction settings
   */
  updatePredictionSettings(prediction: PredictionSettings): void {
    const current = this.settings();
    this.saveSettings({ ...current, prediction });
  }

  /**
   * Reset to default settings
   */
  resetSettings(): void {
    this.saveSettings(this.defaultSettings);
  }

  /**
   * Reset prediction settings to default
   */
  resetPredictionSettings(): void {
    const current = this.settings();
    this.saveSettings({ ...current, prediction: this.defaultSettings.prediction! });
  }

  /**
   * Update excluded categories
   */
  updateExcludeCategories(categories: string[]): void {
    const current = this.settings();
    this.saveSettings({ ...current, excludeCategories: categories });
  }
}

