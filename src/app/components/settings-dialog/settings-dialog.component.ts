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
  windowColor: string;
  windowOpacity: number;
  animations: boolean;
  fontSize: 'small' | 'medium' | 'large';
  taskbarPosition: 'bottom' | 'top';
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
  selectedWindowColor = signal<string>('#1e3a5f');
  windowOpacity = signal<number>(95);
  animations = signal<boolean>(true);
  fontSize = signal<'small' | 'medium' | 'large'>('medium');
  taskbarPosition = signal<'bottom' | 'top'>('bottom');

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

  // Window color options
  windowColors = [
    { value: '#1e3a5f', label: 'Navy Blue', color: '#1e3a5f' },
    { value: '#2d2d2d', label: 'Dark Grey', color: '#2d2d2d' },
    { value: '#1a1a1a', label: 'Black', color: '#1a1a1a' },
    { value: '#2c3e50', label: 'Dark Blue', color: '#2c3e50' },
    { value: '#34495e', label: 'Slate', color: '#34495e' },
    { value: '#1e272e', label: 'Dark Navy', color: '#1e272e' }
  ];

  // Font size options
  readonly fontSizes = [
    { value: 'small' as const, label: 'Small' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'large' as const, label: 'Large' }
  ] as const;

  // Taskbar position options
  readonly taskbarPositions = [
    { value: 'bottom' as const, label: 'Bottom', icon: 'pi pi-arrow-down' },
    { value: 'top' as const, label: 'Top', icon: 'pi pi-arrow-up' }
  ] as const;

  // Computed settings data
  settingsData = computed(() => ({
    wallpaper: this.selectedWallpaper(),
    theme: this.selectedTheme(),
    themeColor: this.selectedThemeColor(),
    backdropEnabled: this.backdropEnabled(),
    windowColor: this.selectedWindowColor(),
    windowOpacity: this.windowOpacity(),
    animations: this.animations(),
    fontSize: this.fontSize(),
    taskbarPosition: this.taskbarPosition()
  }));

  // Check if there are unsaved changes
  hasUnsavedChanges = computed(() => {
    const current = this.settingsData();
    const original = this.originalSettings();
    
    if (!original) return true;
    
    return JSON.stringify(current) !== JSON.stringify(original);
  });

  ngOnInit() {
    // Load saved settings from localStorage
    this.loadSettings();

  }

  loadSettings() {
    const savedSettings = localStorage.getItem('desktop-portfolio-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        
        // Store original settings for cancel functionality
        this.originalSettings.set(settings);
        
        // Set current values (these can be changed temporarily)
        this.selectedWallpaper.set(settings.wallpaper || '1');
        this.selectedTheme.set(settings.theme || 'auto');
        this.selectedThemeColor.set(settings.themeColor || '#007bff');
        this.backdropEnabled.set(settings.backdropEnabled || false);
        this.selectedWindowColor.set(settings.windowColor || '#1e3a5f');
        this.windowOpacity.set(settings.windowOpacity || 95);
        this.animations.set(settings.animations !== false);
        this.fontSize.set(settings.fontSize || 'medium');
        this.taskbarPosition.set(settings.taskbarPosition || 'bottom');
        
        // Emit the loaded settings to parent component
        this.onSettingsChange.emit(settings);
      } catch (error) {
        // Use default settings if there's an error
        this.setDefaultSettings();
      }
    } else {
      // No saved settings, use defaults
      this.setDefaultSettings();
    }
  }

  setDefaultSettings() {
    const defaultSettings: SettingsData = {
      wallpaper: '1',
      theme: 'auto',
      themeColor: '#007bff',
      backdropEnabled: false,
      windowColor: '#1e3a5f',
      windowOpacity: 95,
      animations: true,
      fontSize: 'medium',
      taskbarPosition: 'bottom'
    };
    
    // Store original settings
    this.originalSettings.set(defaultSettings);
    
    this.selectedWallpaper.set(defaultSettings.wallpaper);
    this.selectedTheme.set(defaultSettings.theme);
    this.selectedThemeColor.set(defaultSettings.themeColor);
    this.backdropEnabled.set(defaultSettings.backdropEnabled);
    this.selectedWindowColor.set(defaultSettings.windowColor);
    this.windowOpacity.set(defaultSettings.windowOpacity);
    this.animations.set(defaultSettings.animations);
    this.fontSize.set(defaultSettings.fontSize);
    this.taskbarPosition.set(defaultSettings.taskbarPosition);
    
    // Save default settings
    this.saveSettingsToStorage(defaultSettings);
  }

  saveSettings() {
    const settings = this.settingsData();

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
    this.applySettingsPreview();
  }

  onWindowColorChange(color: string) {
    this.selectedWindowColor.set(color);
    this.applySettingsPreview();
  }

  onWindowOpacityChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value);
    this.windowOpacity.set(value);
    this.applySettingsPreview();
  }

  onAnimationsToggle() {
    this.animations.update(enabled => !enabled);
    this.applySettingsPreview();
  }

  onFontSizeChange(size: string) {
    this.fontSize.set(size as 'small' | 'medium' | 'large');
    this.applySettingsPreview();
  }

  onTaskbarPositionChange(position: string) {
    this.taskbarPosition.set(position as 'bottom' | 'top');
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
      // Restore all original settings
      this.selectedWallpaper.set(original.wallpaper);
      this.selectedTheme.set(original.theme);
      this.selectedThemeColor.set(original.themeColor);
      this.backdropEnabled.set(original.backdropEnabled);
      this.selectedWindowColor.set(original.windowColor);
      this.windowOpacity.set(original.windowOpacity);
      this.animations.set(original.animations);
      this.fontSize.set(original.fontSize);
      this.taskbarPosition.set(original.taskbarPosition);
      
      // Apply the restored settings
      this.onSettingsChange.emit(original);
    }
    
    // Close dialog
    this.onClose.emit();
  }

  // Apply button - save settings but keep dialog open
  onApply() {
    const settings = this.settingsData();

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