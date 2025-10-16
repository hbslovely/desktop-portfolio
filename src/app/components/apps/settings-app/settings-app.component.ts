import { Component, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WallpaperOption {
  id: string;
  name: string;
  path: string;
  preview: string;
}

export interface SettingsData {
  wallpaper: string;
  theme: 'light' | 'dark' | 'auto';
  themeColor: string;
  backdropEnabled: boolean;
  // New settings
  animations: boolean;
  soundEffects: boolean;
  notifications: boolean;
  autoSave: boolean;
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  transparency: number;
}

@Component({
  selector: 'app-settings-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-app.component.html',
  styleUrl: './settings-app.component.scss',
})
export class SettingsAppComponent implements OnInit {
  @Output() onSettingsChange = new EventEmitter<SettingsData>();

  // Active tab
  activeTab = signal<string>('appearance');

  // Settings state
  selectedWallpaper = signal<string>('1');
  selectedTheme = signal<'light' | 'dark' | 'auto'>('auto');
  selectedThemeColor = signal<string>('#007bff');
  backdropEnabled = signal<boolean>(false);
  animations = signal<boolean>(true);
  soundEffects = signal<boolean>(false);
  notifications = signal<boolean>(true);
  autoSave = signal<boolean>(true);
  language = signal<string>('en');
  fontSize = signal<'small' | 'medium' | 'large'>('medium');
  transparency = signal<number>(90);

  // Original settings for reset/cancel
  originalSettings = signal<SettingsData | null>(null);

  // Tabs configuration
  tabs = [
    { id: 'appearance', name: 'Appearance', icon: 'pi pi-palette' },
    { id: 'personalization', name: 'Personalization', icon: 'pi pi-user' },
    { id: 'system', name: 'System', icon: 'pi pi-cog' },
    { id: 'accessibility', name: 'Accessibility', icon: 'pi pi-eye' },
    { id: 'about', name: 'About', icon: 'pi pi-info-circle' }
  ];

  // Available wallpapers
  wallpapers: WallpaperOption[] = [
    { id: '1', name: 'Wallpaper 1', path: 'assets/images/lib/wallpaper/1.png', preview: 'assets/images/lib/wallpaper/1.png' },
    { id: '2', name: 'Wallpaper 2', path: 'assets/images/lib/wallpaper/2.png', preview: 'assets/images/lib/wallpaper/2.png' },
    { id: '3', name: 'Wallpaper 3', path: 'assets/images/lib/wallpaper/3.png', preview: 'assets/images/lib/wallpaper/3.png' }
  ];

  // Theme options
  themes = [
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'auto', label: 'Auto', icon: 'pi pi-circle' }
  ];

  // Theme colors
  themeColors = [
    { value: '#007bff', label: 'Blue', color: '#007bff' },
    { value: '#28a745', label: 'Green', color: '#28a745' },
    { value: '#dc3545', label: 'Red', color: '#dc3545' },
    { value: '#ffc107', label: 'Yellow', color: '#ffc107' },
    { value: '#6f42c1', label: 'Purple', color: '#6f42c1' },
    { value: '#fd7e14', label: 'Orange', color: '#fd7e14' },
    { value: '#20c997', label: 'Teal', color: '#20c997' },
    { value: '#e83e8c', label: 'Pink', color: '#e83e8c' }
  ];

  // Languages
  languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'vi', label: 'Tiếng Việt' }
  ];

  // Font sizes
  fontSizes = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' }
  ];

  // Computed settings data
  settingsData = computed(() => ({
    wallpaper: this.selectedWallpaper(),
    theme: this.selectedTheme(),
    themeColor: this.selectedThemeColor(),
    backdropEnabled: this.backdropEnabled(),
    animations: this.animations(),
    soundEffects: this.soundEffects(),
    notifications: this.notifications(),
    autoSave: this.autoSave(),
    language: this.language(),
    fontSize: this.fontSize(),
    transparency: this.transparency()
  }));

  // Check for unsaved changes
  hasUnsavedChanges = computed(() => {
    const current = this.settingsData();
    const original = this.originalSettings();
    
    if (!original) return true;
    
    return JSON.stringify(current) !== JSON.stringify(original);
  });

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('desktop-portfolio-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.originalSettings.set(settings);
        
        // Load all settings
        this.selectedWallpaper.set(settings.wallpaper || '1');
        this.selectedTheme.set(settings.theme || 'auto');
        this.selectedThemeColor.set(settings.themeColor || '#007bff');
        this.backdropEnabled.set(settings.backdropEnabled || false);
        this.animations.set(settings.animations !== false);
        this.soundEffects.set(settings.soundEffects || false);
        this.notifications.set(settings.notifications !== false);
        this.autoSave.set(settings.autoSave !== false);
        this.language.set(settings.language || 'en');
        this.fontSize.set(settings.fontSize || 'medium');
        this.transparency.set(settings.transparency || 90);
        
        this.onSettingsChange.emit(settings);
      } catch (error) {

        this.setDefaultSettings();
      }
    } else {
      this.setDefaultSettings();
    }
  }

  setDefaultSettings() {
    const defaultSettings: SettingsData = {
      wallpaper: '1',
      theme: 'auto',
      themeColor: '#007bff',
      backdropEnabled: false,
      animations: true,
      soundEffects: false,
      notifications: true,
      autoSave: true,
      language: 'en',
      fontSize: 'medium',
      transparency: 90
    };
    
    this.originalSettings.set(defaultSettings);
    this.saveSettingsToStorage(defaultSettings);
  }

  selectTab(tabId: string) {
    this.activeTab.set(tabId);
  }

  onWallpaperChange(wallpaperId: string) {
    this.selectedWallpaper.set(wallpaperId);
    this.applySettingsPreview();
  }

  onThemeChange(theme: string) {
    this.selectedTheme.set(theme as 'light' | 'dark' | 'auto');
    this.applySettingsPreview();
  }

  onThemeColorChange(color: string) {
    this.selectedThemeColor.set(color);
    this.applySettingsPreview();
  }

  toggleSetting(setting: 'backdropEnabled' | 'animations' | 'soundEffects' | 'notifications' | 'autoSave') {
    this[setting].update(val => !val);
    this.applySettingsPreview();
  }

  onLanguageChange(lang: string) {
    this.language.set(lang);
    this.applySettingsPreview();
  }

  onFontSizeChange(size: 'small' | 'medium' | 'large') {
    this.fontSize.set(size);
    this.applySettingsPreview();
  }

  onTransparencyChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value);
    this.transparency.set(value);
    this.applySettingsPreview();
  }

  applySettingsPreview() {
    const settings = this.settingsData();
    this.onSettingsChange.emit(settings);
  }

  saveSettings() {
    const settings = this.settingsData();
    this.saveSettingsToStorage(settings);
    this.originalSettings.set(settings);
    this.onSettingsChange.emit(settings);
  }

  private saveSettingsToStorage(settings: SettingsData) {
    localStorage.setItem('desktop-portfolio-settings', JSON.stringify(settings));
  }

  resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      this.setDefaultSettings();
      this.loadSettings();
    }
  }

  exportSettings() {
    const settings = this.settingsData();
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'desktop-portfolio-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  importSettings(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target?.result as string);
          // Apply imported settings
          Object.entries(settings).forEach(([key, value]) => {
            if (key in this.settingsData()) {
              (this as any)[key].set(value);
            }
          });
          this.saveSettings();
          alert('Settings imported successfully!');
        } catch (error) {
          alert('Failed to import settings. Invalid file format.');
        }
      };
      reader.readAsText(file);
    }
  }
}
