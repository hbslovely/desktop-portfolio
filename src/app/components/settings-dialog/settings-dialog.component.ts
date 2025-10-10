import { Component, Input, Output, EventEmitter, signal, computed, OnChanges } from '@angular/core';
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
}

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss'
})
export class SettingsDialogComponent implements OnChanges {
  @Input() isVisible = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onSettingsChange = new EventEmitter<SettingsData>();

  ngOnChanges() {
    console.log('Settings dialog visibility changed:', this.isVisible);
    
    // Reload settings when dialog becomes visible
    if (this.isVisible) {
      this.loadSettings();
    }
  }

  // Settings state - these are the temporary/preview values
  selectedWallpaper = signal<string>('1');
  selectedTheme = signal<'light' | 'dark' | 'auto'>('auto');
  selectedThemeColor = signal<string>('#007bff');
  backdropEnabled = signal<boolean>(false);

  // Original settings - used to restore on cancel
  originalSettings = signal<SettingsData | null>(null);

  // Available wallpapers
  wallpapers: WallpaperOption[] = [
    {
      id: '1',
      name: 'Wallpaper 1',
      path: 'assets/images/lib/wallpaper/1.png',
      preview: 'assets/images/lib/wallpaper/1.png'
    },
    {
      id: '2',
      name: 'Wallpaper 2',
      path: 'assets/images/lib/wallpaper/2.png',
      preview: 'assets/images/lib/wallpaper/2.png'
    },
    {
      id: '3',
      name: 'Wallpaper 3',
      path: 'assets/images/lib/wallpaper/3.png',
      preview: 'assets/images/lib/wallpaper/3.png'
    }
  ];

  // Theme options
  themes = [
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'auto', label: 'Auto', icon: 'pi pi-circle' }
  ];

  // Theme color options
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

  // Computed settings data
  settingsData = computed(() => ({
    wallpaper: this.selectedWallpaper(),
    theme: this.selectedTheme(),
    themeColor: this.selectedThemeColor(),
    backdropEnabled: this.backdropEnabled()
  }));

  // Check if there are unsaved changes
  hasUnsavedChanges = computed(() => {
    const current = this.settingsData();
    const original = this.originalSettings();
    
    if (!original) return true; // If no original settings, consider as changed
    
    return (
      current.wallpaper !== original.wallpaper ||
      current.theme !== original.theme ||
      current.themeColor !== original.themeColor ||
      current.backdropEnabled !== original.backdropEnabled
    );
  });

  ngOnInit() {
    // Load saved settings from localStorage
    this.loadSettings();
    console.log('Settings dialog component initialized');
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('desktop-portfolio-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        console.log('Loading settings from localStorage:', settings);
        
        // Store original settings for cancel functionality
        this.originalSettings.set(settings);
        
        // Set current values (these can be changed temporarily)
        this.selectedWallpaper.set(settings.wallpaper || '1');
        this.selectedTheme.set(settings.theme || 'auto');
        this.selectedThemeColor.set(settings.themeColor || '#007bff');
        this.backdropEnabled.set(settings.backdropEnabled || false);
        
        // Emit the loaded settings to parent component
        this.onSettingsChange.emit(settings);
      } catch (error) {
        console.error('Error loading settings:', error);
        // Use default settings if there's an error
        this.setDefaultSettings();
      }
    } else {
      // No saved settings, use defaults
      this.setDefaultSettings();
    }
  }

  setDefaultSettings() {
    const defaultSettings = {
      wallpaper: '1',
      theme: 'auto' as 'light' | 'dark' | 'auto',
      themeColor: '#007bff',
      backdropEnabled: false
    };
    
    // Store original settings
    this.originalSettings.set(defaultSettings);
    
    this.selectedWallpaper.set(defaultSettings.wallpaper);
    this.selectedTheme.set(defaultSettings.theme);
    this.selectedThemeColor.set(defaultSettings.themeColor);
    this.backdropEnabled.set(defaultSettings.backdropEnabled);
    
    // Save default settings
    this.saveSettingsToStorage(defaultSettings);
  }

  saveSettings() {
    const settings = this.settingsData();
    console.log('Saving settings to localStorage:', settings);
    this.saveSettingsToStorage(settings);
    this.onSettingsChange.emit(settings);
  }

  private saveSettingsToStorage(settings: any) {
    localStorage.setItem('desktop-portfolio-settings', JSON.stringify(settings));
  }

  onWallpaperChange(wallpaperId: string) {
    this.selectedWallpaper.set(wallpaperId);
    // Apply changes immediately for preview but don't save
    this.applySettingsPreview();
  }

  onThemeChange(theme: string) {
    this.selectedTheme.set(theme as 'light' | 'dark' | 'auto');
    // Apply changes immediately for preview but don't save
    this.applySettingsPreview();
  }

  onThemeColorChange(color: string) {
    this.selectedThemeColor.set(color);
    // Apply changes immediately for preview but don't save
    this.applySettingsPreview();
  }

  onBackdropToggle() {
    this.backdropEnabled.update(enabled => !enabled);
    // Apply changes immediately for preview but don't save
    this.applySettingsPreview();
  }

  // Apply settings preview (temporary changes)
  applySettingsPreview() {
    const settings = this.settingsData();
    this.onSettingsChange.emit(settings);
  }

  // Cancel button - restore original settings
  onCancel() {
    const original = this.originalSettings();
    if (original) {
      // Restore original settings
      this.selectedWallpaper.set(original.wallpaper);
      this.selectedTheme.set(original.theme);
      this.selectedThemeColor.set(original.themeColor);
      this.backdropEnabled.set(original.backdropEnabled);
      
      // Apply the restored settings
      this.onSettingsChange.emit(original);
    }
    
    // Close dialog
    this.onClose.emit();
  }

  // Apply button - save settings but keep dialog open
  onApply() {
    const settings = this.settingsData();
    console.log('Applying settings:', settings);
    this.saveSettingsToStorage(settings);
    
    // Update original settings to current values
    this.originalSettings.set(settings);
    
    // Emit the applied settings
    this.onSettingsChange.emit(settings);
  }

  // Save button - save settings and close dialog
  onSave() {
    this.onApply();
    this.onClose.emit();
  }

  onCloseDialog() {
    this.onClose.emit();
  }

  onBackdropClick() {
    this.onCloseDialog();
  }

  onDialogClick(event: Event) {
    event.stopPropagation();
  }
}