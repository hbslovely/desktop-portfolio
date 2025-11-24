import { Injectable, signal } from '@angular/core';

export type ExpenseTheme = 'compact' | 'spacious';
export type ExpenseFontSize = 'small' | 'medium' | 'large';
export type ExpenseLayout = 'v1' | 'v2';

export interface ExpenseSettings {
  layout: ExpenseLayout;
  theme: ExpenseTheme;
  fontSize: ExpenseFontSize;
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
    fontSize: 'medium'
  };

  // Signals for reactive updates
  settings = signal<ExpenseSettings>(this.defaultSettings);
  layout = signal<ExpenseLayout>(this.defaultSettings.layout);
  theme = signal<ExpenseTheme>(this.defaultSettings.theme);
  fontSize = signal<ExpenseFontSize>(this.defaultSettings.fontSize);

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
        this.settings.set(settings);
        this.layout.set(settings.layout);
        this.theme.set(settings.theme);
        this.fontSize.set(settings.fontSize);
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
   * Reset to default settings
   */
  resetSettings(): void {
    this.saveSettings(this.defaultSettings);
  }
}

