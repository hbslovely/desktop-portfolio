import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WallpaperOption {
  id: string;
  name: string;
  path: string;
  thumbnail?: string;
}

export interface SettingsData {
  wallpaper: string;
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  soundEffects: boolean;
  autoLock: boolean;
  lockTimeout: number; // in minutes
}

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss'
})
export class SettingsDialogComponent implements OnInit {
  // Settings state
  settings = signal<SettingsData>({
    wallpaper: 'assets/images/wallpaper.jpg',
    theme: 'dark',
    animations: true,
    soundEffects: true,
    autoLock: false,
    lockTimeout: 15
  });

  // Dialog state
  isVisible = signal(false);
  activeTab = signal<'appearance' | 'security' | 'system'>('appearance');

  // Wallpaper options
  wallpaperOptions: WallpaperOption[] = [
    {
      id: 'default',
      name: 'Default Wallpaper',
      path: 'assets/images/wallpaper.jpg',
      thumbnail: 'assets/images/wallpaper.jpg'
    },
    {
      id: 'gradient1',
      name: 'Blue Gradient',
      path: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2NjdlZWEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3NjRiYTIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=='
    },
    {
      id: 'gradient2',
      name: 'Sunset Gradient',
      path: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZjlhOWUiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iI2ZlY2ZlZiIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2ZlY2ZlZiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+'
    },
    {
      id: 'gradient3',
      name: 'Ocean Gradient',
      path: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM3NGI5ZmYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwOTg0ZTMiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=='
    },
    {
      id: 'gradient4',
      name: 'Forest Gradient',
      path: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwMGI4OTQiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMGEwODUiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=='
    },
    {
      id: 'gradient5',
      name: 'Purple Gradient',
      path: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNhMjliZmUiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2YzVjZTciLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=='
    }
  ];

  constructor() {}

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('desktop-portfolio-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        this.settings.set({ ...this.settings(), ...parsed });
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }
  }

  saveSettings() {
    localStorage.setItem('desktop-portfolio-settings', JSON.stringify(this.settings()));
    this.applySettings();
  }

  applySettings() {
    // Apply wallpaper
    this.applyWallpaper();
    
    // Apply theme
    this.applyTheme();
    
    // Emit settings change event
    this.onSettingsChange.emit(this.settings());
  }

  private applyWallpaper() {
    const wallpaper = this.settings().wallpaper;
    const wallpaperElement = document.querySelector('.wallpaper') as HTMLElement;
    if (wallpaperElement) {
      if (wallpaper.startsWith('linear-gradient')) {
        wallpaperElement.style.background = wallpaper;
        wallpaperElement.style.backgroundImage = 'none';
      } else {
        wallpaperElement.style.backgroundImage = `url('${wallpaper}')`;
        wallpaperElement.style.background = 'none';
      }
    }
  }

  private applyTheme() {
    const theme = this.settings().theme;
    document.body.setAttribute('data-theme', theme);
  }

  show() {
    this.isVisible.set(true);
  }

  hide() {
    this.isVisible.set(false);
  }

  setActiveTab(tab: 'appearance' | 'security' | 'system') {
    this.activeTab.set(tab);
  }

  selectWallpaper(wallpaper: WallpaperOption) {
    this.settings.update(s => ({ ...s, wallpaper: wallpaper.path }));
    this.applyWallpaper();
  }

  updateSetting<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    this.settings.update(s => ({ ...s, [key]: value }));
  }

  resetToDefaults() {
    this.settings.set({
      wallpaper: 'assets/images/wallpaper.jpg',
      theme: 'dark',
      animations: true,
      soundEffects: true,
      autoLock: false,
      lockTimeout: 15
    });
    this.applySettings();
  }

  // Event emitter for parent component
  onSettingsChange = new EventEmitter<SettingsData>();

  // Computed properties
  get currentWallpaper() {
    return this.wallpaperOptions.find(w => w.path === this.settings().wallpaper) || this.wallpaperOptions[0];
  }

  get isCurrentWallpaper() {
    return (wallpaper: WallpaperOption) => wallpaper.path === this.settings().wallpaper;
  }
}
