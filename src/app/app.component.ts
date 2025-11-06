import { Component, signal, computed, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, inject, HostListener } from '@angular/core';
import { WindowComponent } from './components/window/window.component';
import { DesktopIconComponent, DesktopIconData } from './components/desktop-icon/desktop-icon.component';
import { CalculatorComponent } from './components/apps/calculator/calculator.component';
import { IframeAppComponent } from './components/apps/iframe-app/iframe-app.component';
import { LoveAppComponent } from './components/apps/love-app/love-app.component';
import { ExplorerComponent, FileOpenEvent, ContextMenuEvent } from './components/apps/explorer/explorer.component';
import { TextViewerComponent } from './components/apps/text-viewer/text-viewer.component';
import { ImageViewerComponent } from './components/apps/image-viewer/image-viewer.component';
import { PdfViewerComponent } from './components/apps/pdf-viewer/pdf-viewer.component';
import { MachineInfoComponent } from './components/apps/machine-info/machine-info.component';
import { PaintAppComponent } from './components/apps/paint-app/paint-app.component';
import { HcmcAppComponent } from './components/apps/hcmc-app/hcmc-app.component';
import { NewsAppComponent } from './components/apps/news-app/news-app.component';
import { SettingsAppComponent } from './components/apps/settings-app/settings-app.component';
import { TaskManagerComponent } from './components/apps/task-manager/task-manager.component';
import { WeatherAppComponent } from './components/apps/weather-app/weather-app.component';
import { DictionaryAppComponent } from './components/apps/dictionary-app/dictionary-app.component';
import { CountriesAppComponent } from './components/apps/countries-app/countries-app.component';
import { YugiohAppComponent } from './components/apps/yugioh-app/yugioh-app.component';
import { YugiohCardDetailComponent } from './components/apps/yugioh-card-detail/yugioh-card-detail.component';
import { CalendarAppComponent } from './components/apps/calendar-app/calendar-app.component';
import { AngularLoveAppComponent } from './components/apps/angular-love-app/angular-love-app.component';
import { MusicAppComponent } from './components/apps/music-app/music-app.component';
import { FireantAppComponent } from './components/apps/fireant-app/fireant-app.component';
import { AngularGuidelinesAppComponent } from './components/apps/angular-guidelines-app/angular-guidelines-app.component';
import { BookingAppComponent } from './components/apps/booking-app/booking-app.component';
import { TuoiTreNewsAppComponent } from './components/apps/tuoitre-news-app/tuoitre-news-app.component';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from "@angular/platform-browser";
import { SettingsDialogComponent } from "./components/settings-dialog/settings-dialog.component";
import { APP_ICONS, APP_SEARCH_CONFIG } from './config/app-icons.config';
import { SearchService, SearchResult } from './services/search.service';
import { WindowManagerService } from './services/window-manager.service';
import { getWindowDefinition } from './config/window-registry';
import { SystemRestartService, BootMessage } from './services/system-restart.service';
import { FileSystemService } from './services/file-system.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ WelcomeScreenComponent, WindowComponent, DesktopIconComponent, CalculatorComponent, IframeAppComponent, LoveAppComponent, ExplorerComponent, TextViewerComponent, ImageViewerComponent, PdfViewerComponent, MachineInfoComponent, PaintAppComponent, HcmcAppComponent, NewsAppComponent, SettingsAppComponent, TaskManagerComponent, WeatherAppComponent, DictionaryAppComponent, CountriesAppComponent, YugiohAppComponent, YugiohCardDetailComponent, CalendarAppComponent, AngularLoveAppComponent, MusicAppComponent, FireantAppComponent, AngularGuidelinesAppComponent, BookingAppComponent, TuoiTreNewsAppComponent, CommonModule, FormsModule, SettingsDialogComponent ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild(WelcomeScreenComponent) welcomeScreen!: WelcomeScreenComponent;
  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('startMenuSearchInput', { static: false }) startMenuSearchInput!: ElementRef<HTMLInputElement>;

  windowManager = inject(WindowManagerService);

  // Track subscriptions for cleanup
  private subscriptions: any[] = [];

  // Restart state
  showRestartScreen = signal(false);
  restartMessages: BootMessage[] = [];
  showCursor = signal(false);
  currentTypingText = signal('');
  currentTypingIndex = signal(-1);

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private searchService: SearchService,
    private systemRestartService: SystemRestartService,
    private fileSystemService: FileSystemService
  ) {
    // Listen for restart requests from lock screen
    this.systemRestartHandler = () => this.restartSystem();
    window.addEventListener('system-restart-requested', this.systemRestartHandler);
  }

  private systemRestartHandler!: () => void;

  title = 'Desktop Portfolio';

  // Test windows
  showTestWindow = signal(false); // Start with calculator closed so users can test double-click
  showMyInfoWindow = signal(false);
  showLoveWindow = signal(false);
  showExplorerWindow = signal(false);
  showTextViewerWindow = signal(false);
  showImageViewerWindow = signal(false);
  showMachineInfoWindow = signal(false);
  showCreditWindow = signal(false);
  showPaintWindow = signal(false);
  showCreditsWindow = signal(false);
  showHcmcWindow = signal(false);
  showNewsWindow = signal(false);

  // File viewer data
  currentTextFile = signal<{ path: string; name: string; type: 'txt' | 'md' } | null>(null);
  currentImageFile = signal<{ path: string; name: string } | null>(null);
  currentPdfFile = signal<{ path: string; name: string } | null>(null);
  showPdfViewerWindow = signal(false);
  showSearchWindow = signal(false);

  // Window management
  focusedWindow = signal<string | null>(null);
  maxZIndex = signal(1000); // Track the maximum z-index used

  // Track minimized state for each window
  minimizedWindows = signal<Set<string>>(new Set());

  // Clipboard for copy/cut/paste operations
  clipboardItem = signal<any>(null);
  clipboardAction = signal<'copy' | 'cut' | null>(null);

  // Taskbar state
  showStartMenu = signal(false);
  showDesktopContextMenu = signal(false);
  desktopContextMenuPosition = signal({ x: 0, y: 0 });
  startMenuSearch = signal('');

  // Settings dialog state
  showSettingsDialog = signal(false);
  
  // Search properties
  searchQuery = '';
  searchResults: SearchResult[] = [];
  showSearchSuggestions = false;
  selectedSearchIndex = 0;

  // Computed search results
  get appSearchResults() {
    return this.searchResults.filter(r => r.type === 'app');
  }

  get fileSearchResults() {
    return this.searchResults.filter(r => r.type === 'file');
  }

  get webSearchResults() {
    return this.searchResults.filter(r => r.type === 'web');
  }





  ngAfterViewInit() {
    // Load settings after view is initialized to ensure DOM elements exist
    // Use a small delay to ensure all DOM elements are fully rendered
    setTimeout(() => {
      this.loadSettingsOnInit();
    }, 50);
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeyboard(event: KeyboardEvent) {
    // Ctrl+Shift+Esc opens Task Manager (like Windows)
    if (event.ctrlKey && event.shiftKey && event.key === 'Escape') {
      event.preventDefault();
      this.openApp('task-manager');
    }
  }

  // Desktop icons from configuration
  testIcons: DesktopIconData[] = APP_ICONS;

  // Selected desktop icon
  selectedIconId = signal<string | null>(null);

  // Start menu configuration
  startMenuGroups = [
    {
      id: 'productivity',
      name: 'Productivity',
      icon: 'pi pi-briefcase',
      apps: [
        { id: 'calculator', name: 'Calculator', icon: 'pi pi-calculator' },
        { id: 'credit', name: 'Finance Tracker', icon: 'pi pi-wallet' },
        { id: 'explorer', name: 'File Explorer', icon: 'pi pi-folder' },
        { id: 'dictionary', name: 'Dictionary', icon: 'pi pi-book' },
        { id: 'link-shortener', name: 'Link Shortener', icon: 'pi pi-link' }
      ]
    },
    {
      id: 'creative',
      name: 'Creative',
      icon: 'pi pi-palette',
      apps: [
        { id: 'paint', name: 'Paint', icon: 'pi pi-palette' },
        { id: 'love', name: 'Love', icon: 'pi pi-heart' }
      ]
    },
    {
      id: 'information',
      name: 'Information',
      icon: 'pi pi-info-circle',
      apps: [
        { id: 'my-info', name: 'My Information', icon: 'pi pi-user' },
        { id: 'machine-info', name: 'System Info', icon: 'pi pi-desktop' },
        { id: 'hcmc', name: 'Ho Chi Minh City', icon: 'pi pi-globe' },
        { id: 'news', name: 'News Headlines', icon: 'pi pi-globe' },
        { id: 'weather', name: 'Weather Forecast', icon: 'pi pi-cloud' },
        { id: 'yugioh', name: 'Yu-Gi-Oh! Cards', icon: 'pi pi-images' }
      ]
    },
    {
      id: 'system',
      name: 'System',
      icon: 'pi pi-cog',
      apps: [
        { id: 'settings', name: 'Settings', icon: 'pi pi-cog' },
        { id: 'task-manager', name: 'Task Manager', icon: 'pi pi-th-large' },
        { id: 'credits', name: 'Credits', icon: 'pi pi-star' }
      ]
    }
  ];

  // Filtered groups based on search
  filteredStartMenuGroups = computed(() => {
    const search = this.startMenuSearch().toLowerCase().trim();

    if (!search) {
      return this.startMenuGroups;
    }

    return this.startMenuGroups.map(group => ({
      ...group,
      apps: group.apps.filter(app =>
        app.name.toLowerCase().includes(search) ||
        app.id.toLowerCase().includes(search)
      )
    })).filter(group => group.apps.length > 0);
  });

  onCloseTestWindow() {
    this.showTestWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'calculator') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeTestWindow() {

    this.minimizedWindows.update(set => new Set(set).add('calculator'));
  }

  onMaximizeTestWindow() {

  }

  onRestoreTestWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('calculator');
      return newSet;
    });
  }

  onFocusTestWindow() {

    this.focusWindow('calculator');
  }

  onCloseMyInfoWindow() {
    this.showMyInfoWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'my-info') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeMyInfoWindow() {

    this.minimizedWindows.update(set => new Set(set).add('my-info'));
  }

  onMaximizeMyInfoWindow() {

  }

  onRestoreMyInfoWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('my-info');
      return newSet;
    });
  }

  onFocusMyInfoWindow() {

    this.focusWindow('my-info');
  }


  onCloseLoveWindow() {
    this.showLoveWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'love') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeLoveWindow() {

    this.minimizedWindows.update(set => new Set(set).add('love'));
  }

  onMaximizeLoveWindow() {

  }

  onRestoreLoveWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('love');
      return newSet;
    });
  }

  onFocusLoveWindow() {

    this.focusWindow('love');
  }

  onCloseExplorerWindow() {
    this.showExplorerWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'explorer') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeExplorerWindow() {

    this.minimizedWindows.update(set => new Set(set).add('explorer'));
  }

  onMaximizeExplorerWindow() {

  }

  onRestoreExplorerWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('explorer');
      return newSet;
    });
  }

  onFocusExplorerWindow() {

    this.focusWindow('explorer');
  }

  onCloseCreditWindow() {
    this.showCreditWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'credit') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeCreditWindow() {

    this.minimizedWindows.update(set => new Set(set).add('credit'));
  }

  onMaximizeCreditWindow() {

  }

  onRestoreCreditWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('credit');
      return newSet;
    });
  }

  onFocusCreditWindow() {

    this.focusWindow('credit');
  }

  onClosePaintWindow() {
    this.showPaintWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'paint') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizePaintWindow() {

    this.minimizedWindows.update(set => new Set(set).add('paint'));
  }

  onMaximizePaintWindow() {

  }

  onRestorePaintWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('paint');
      return newSet;
    });
  }

  onFocusPaintWindow() {

    this.focusWindow('paint');
  }

  onCloseCreditsWindow() {
    this.showCreditsWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'credits') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeCreditsWindow() {

    this.minimizedWindows.update(set => new Set(set).add('credits'));
  }

  onMaximizeCreditsWindow() {

  }

  onRestoreCreditsWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('credits');
      return newSet;
    });
  }

  onFocusCreditsWindow() {

    this.focusWindow('credits');
  }

  onCloseHcmcWindow() {
    this.showHcmcWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'hcmc') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeHcmcWindow() {

    this.minimizedWindows.update(set => new Set(set).add('hcmc'));
  }

  onMaximizeHcmcWindow() {

  }

  onRestoreHcmcWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('hcmc');
      return newSet;
    });
  }

  onFocusHcmcWindow() {

    this.focusWindow('hcmc');
  }

  // News Window Methods
  onCloseNewsWindow() {
    this.showNewsWindow.set(false);
    if (this.focusedWindow() === 'news') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeNewsWindow() {

    this.minimizedWindows.update(set => new Set(set).add('news'));
  }

  onMaximizeNewsWindow() {

  }

  onRestoreNewsWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('news');
      return newSet;
    });
  }

  onFocusNewsWindow() {

    this.focusWindow('news');
  }

  // Text Viewer Window Methods
  onCloseTextViewerWindow() {
    this.showTextViewerWindow.set(false);
    this.currentTextFile.set(null);
    if (this.focusedWindow() === 'text-viewer') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeTextViewerWindow() {

    this.minimizedWindows.update(set => new Set(set).add('text-viewer'));
  }

  onMaximizeTextViewerWindow() {

  }

  onRestoreTextViewerWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('text-viewer');
      return newSet;
    });
  }

  onFocusTextViewerWindow() {

    this.focusWindow('text-viewer');
  }

  // Image Viewer Window Methods
  onCloseImageViewerWindow() {
    this.showImageViewerWindow.set(false);
    this.currentImageFile.set(null);
    if (this.focusedWindow() === 'image-viewer') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeImageViewerWindow() {

    this.minimizedWindows.update(set => new Set(set).add('image-viewer'));
  }

  onMaximizeImageViewerWindow() {

  }

  onRestoreImageViewerWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('image-viewer');
      return newSet;
    });
  }

  onFocusImageViewerWindow() {

    this.focusWindow('image-viewer');
  }

  // PDF Viewer Window Methods
  onClosePdfViewerWindow() {
    this.showPdfViewerWindow.set(false);
    this.currentPdfFile.set(null);
    if (this.focusedWindow() === 'pdf-viewer') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizePdfViewerWindow() {

    this.minimizedWindows.update(set => new Set(set).add('pdf-viewer'));
    if (this.focusedWindow() === 'pdf-viewer') {
      this.focusedWindow.set(null);
    }
  }

  onRestorePdfViewerWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('pdf-viewer');
      return newSet;
    });
  }

  onMaximizePdfViewerWindow() {

  }

  onFocusPdfViewerWindow() {

    this.focusWindow('pdf-viewer');
  }

  // Machine Info Window Methods
  onCloseMachineInfoWindow() {
    this.showMachineInfoWindow.set(false);
    if (this.focusedWindow() === 'machine-info') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeMachineInfoWindow() {

    this.minimizedWindows.update(set => new Set(set).add('machine-info'));
  }

  onMaximizeMachineInfoWindow() {

  }

  onRestoreMachineInfoWindow() {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('machine-info');
      return newSet;
    });
  }

  onFocusMachineInfoWindow() {

    this.focusWindow('machine-info');
  }

  // File Open Handler
  onExplorerFileOpen(event: FileOpenEvent) {
    const { item, fileType, extension } = event;



    if (fileType === 'text') {
      // Open all text files in text viewer
      this.currentTextFile.set({
        path: item.content || `assets/explorer${item.path}`,
        name: item.name,
        type: extension === 'md' || extension === 'markdown' ? 'md' : 'txt'
      });
      this.showTextViewerWindow.set(true);
      this.focusWindow('text-viewer');
    } else if (fileType === 'image') {
      // Open image file
      this.currentImageFile.set({
        path: item.content || `assets/explorer${item.path}`,
        name: item.name
      });
      this.showImageViewerWindow.set(true);
      this.focusWindow('image-viewer');
    } else if (fileType === 'pdf') {
      // Open PDF file
      this.currentPdfFile.set({
        path: item.content || `assets/explorer${item.path}`,
        name: item.name
      });
      this.showPdfViewerWindow.set(true);
      this.focusWindow('pdf-viewer');
    } else {
      // Unknown file type

      alert(`Cannot open ${item.name}. File type .${extension} is not supported.`);
    }
  }

  // Context Menu Handler
  onExplorerContextMenu(event: ContextMenuEvent) {
    const { action, item, newName } = event;


    switch (action) {
      case 'edit':
        // Text editor has been removed
        alert('Text editor is not available. Use text viewer to view files.');
        break;

      case 'rename':
        if (newName) {

          // Update the item name in the file system
          item.name = newName;
        }
        break;

      case 'delete':
        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {

          // Remove the item from its parent's children array
          this.deleteFileSystemItem(item);
        }
        break;

      case 'copy':

        this.clipboardItem.set(item);
        this.clipboardAction.set('copy');
        break;

      case 'cut':

        this.clipboardItem.set(item);
        this.clipboardAction.set('cut');
        break;

      case 'paste':
        const clipboardItem = this.clipboardItem();
        const clipboardAction = this.clipboardAction();
        if (clipboardItem && clipboardAction) {

          this.pasteFileSystemItem(clipboardItem, clipboardAction);
        }
        break;

      case 'set-wallpaper':
        this.setImageAsWallpaper(item);
        break;
    }
  }

  // File system operations
  deleteFileSystemItem(item: any) {
    // Find and remove the item from its parent's children array
    // This is a simplified implementation - in a real app, you'd need to traverse the file system

    // For now, we'll just log the action since we don't have a direct reference to the parent
  }

  pasteFileSystemItem(item: any, action: 'copy' | 'cut') {


    if (action === 'cut') {
      // Remove the original item after pasting
      this.deleteFileSystemItem(item);
    }

    // Clear clipboard after paste
    this.clipboardItem.set(null);
    this.clipboardAction.set(null);
  }

  // Set image as wallpaper
  setImageAsWallpaper(item: any) {
    const imagePath = item.content || `assets/explorer${item.path}`;


    // Apply the wallpaper immediately
    const wallpaperElement = document.querySelector('.wallpaper') as HTMLElement;
    if (wallpaperElement) {
      wallpaperElement.style.backgroundImage = `url('${imagePath}')`;
      wallpaperElement.style.background = 'none';
    }

    // Save to settings
    const currentSettings = JSON.parse(localStorage.getItem('desktop-portfolio-settings') || '{}');
    currentSettings.wallpaper = imagePath;
    localStorage.setItem('desktop-portfolio-settings', JSON.stringify(currentSettings));

    alert(`"${item.name}" has been set as your wallpaper!`);
  }

  onDesktopIconSelect(icon: DesktopIconData) {
    // Single click only selects the icon, doesn't open the app
    this.selectedIconId.set(icon.id);
  }

  onDesktopIconDoubleClick(icon: DesktopIconData) {

    // Double-click opens the app
    this.openTestApp(icon);
  }

  openTestApp(icon: DesktopIconData) {


    // Try to use the new WindowManager system first
    const definition = getWindowDefinition(icon.id);
    if (definition) {
      this.windowManager.openWindow({
        id: icon.id,
        title: definition.title,
        icon: definition.icon,
        component: definition.component,
        initialWidth: definition.defaultWidth,
        initialHeight: definition.defaultHeight,
        initialX: definition.defaultX,
        initialY: definition.defaultY,
        maximizable: definition.maximizable,
        statusText: definition.statusText
      });
      return;
    }

    // Fallback to old system for apps not yet in window registry
    if (icon.id === 'calculator') {
      this.showTestWindow.set(true);
      this.focusWindow('calculator');
    } else if (icon.id === 'my-info') {
      this.showMyInfoWindow.set(true);
      this.focusWindow('my-info');
    } else if (icon.id === 'love') {
      this.showLoveWindow.set(true);
      this.focusWindow('love');
    } else if (icon.id === 'explorer') {
      this.showExplorerWindow.set(true);
      this.focusWindow('explorer');
    } else if (icon.id === 'machine-info') {
      this.showMachineInfoWindow.set(true);
      this.focusWindow('machine-info');
    } else if (icon.id === 'credit') {
      this.showCreditWindow.set(true);
      this.focusWindow('credit');
    } else if (icon.id === 'paint') {
      this.showPaintWindow.set(true);
      this.focusWindow('paint');
    } else if (icon.id === 'credits') {
      this.showCreditsWindow.set(true);
      this.focusWindow('credits');
    } else if (icon.id === 'hcmc') {
      this.showHcmcWindow.set(true);
      this.focusWindow('hcmc');
    } else if (icon.id === 'news') {
      this.showNewsWindow.set(true);
      this.focusWindow('news');
    }
  }

  onDesktopIconContextMenu(event: any) {
    const { action, icon } = event;


    switch (action) {
      case 'open':
        this.openTestApp(icon);
        break;
      case 'delete':
        this.deleteDesktopIcon(icon);
        break;
      case 'rename':
        // Rename is handled by the icon component itself

        break;
      case 'restore':
        // Handle restore if needed

        break;
      case 'copy':

        // Copy is handled by the icon component itself
        break;
      case 'cut':

        // Cut is handled by the icon component itself
        break;
      case 'paste':

        this.pasteDesktopIcon(icon);
        break;
    }
  }

  pasteDesktopIcon(icon: DesktopIconData) {
    // Create a new icon with a unique ID and slightly offset position
    const newIcon: DesktopIconData = {
      ...icon,
      id: `${icon.id}_copy_${Date.now()}`,
      name: `${icon.name} (Copy)`,
      position: {
        x: icon.position.x + 20,
        y: icon.position.y + 20
      }
    };

    // Add the new icon to the desktop
    this.testIcons = [...this.testIcons, newIcon];

  }

  deleteDesktopIcon(icon: DesktopIconData) {
    // Remove the icon from the testIcons array
    const index = this.testIcons.findIndex(i => i.id === icon.id);
    if (index > -1) {
      this.testIcons.splice(index, 1);


      // Close the associated window if it's open
      if (icon.id === 'calculator' && this.showTestWindow()) {
        this.onCloseTestWindow();
      } else if (icon.id === 'my-info' && this.showMyInfoWindow()) {
        this.onCloseMyInfoWindow();
      } else if (icon.id === 'love' && this.showLoveWindow()) {
        this.onCloseLoveWindow();
      } else if (icon.id === 'explorer' && this.showExplorerWindow()) {
        this.onCloseExplorerWindow();
      } else if (icon.id === 'credit' && this.showCreditWindow()) {
        this.onCloseCreditWindow();
      } else if (icon.id === 'paint' && this.showPaintWindow()) {
        this.onClosePaintWindow();
      } else if (icon.id === 'credits' && this.showCreditsWindow()) {
        this.onCloseCreditsWindow();
      } else if (icon.id === 'hcmc' && this.showHcmcWindow()) {
        this.onCloseHcmcWindow();
      } else if (icon.id === 'news' && this.showNewsWindow()) {
        this.onCloseNewsWindow();
      }
    }
  }

  // Taskbar methods
  toggleStartMenu() {
    this.showStartMenu.set(!this.showStartMenu());
    
    // Focus and select all text in search input when opening
    if (this.showStartMenu()) {
      setTimeout(() => {
        if (this.startMenuSearchInput?.nativeElement) {
          this.startMenuSearchInput.nativeElement.focus();
          this.startMenuSearchInput.nativeElement.select();
        }
      }, 0);
    }
  }

  closeStartMenu() {
    this.showStartMenu.set(false);
  }


  openApp(appId: string, data?: any) {
    this.closeStartMenu();

    // Use WindowManager system
    const definition = getWindowDefinition(appId);
    if (definition) {
      this.windowManager.openWindow({
        id: appId,
        title: definition.title,
        icon: definition.icon,
        component: definition.component,
        initialWidth: definition.defaultWidth,
        initialHeight: definition.defaultHeight,
        initialX: definition.defaultX,
        initialY: definition.defaultY,
        maximizable: definition.maximizable,
        statusText: definition.statusText,
        data
      });
    }
  }

  // Restore a minimized window
  restoreWindow(windowId: string) {

    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete(windowId);
      return newSet;
    });
  }

  // Minimize a window
  minimizeWindow(windowId: string) {

    this.minimizedWindows.update(set => new Set(set).add(windowId));

    // Clear focus if this was the focused window
    if (this.focusedWindow() === windowId) {
      this.focusedWindow.set(null);
    }
  }

  focusWindow(windowId: string) {

    console.log('Previous focused window:', this.focusedWindow());
    console.log('Previous max z-index:', this.maxZIndex());

    // If window is minimized, restore it first
    if (this.minimizedWindows().has(windowId)) {
      this.restoreWindow(windowId);
    }

    // Set the focused window
    this.focusedWindow.set(windowId);

    // Increment the max z-index for the focused window to bring it to front
    this.maxZIndex.update(max => max + 1);

    console.log('New focused window:', this.focusedWindow());
    console.log('New max z-index:', this.maxZIndex());
    console.log('Window z-index for', windowId, ':', this.getWindowZIndex(windowId));

    // Force change detection to ensure z-index updates are reflected
    this.cdr.detectChanges();

    // Also directly update DOM z-index as a fallback
    setTimeout(() => {
      this.updateWindowZIndex(windowId);
    }, 0);
  }

  // Directly update window z-index in DOM as fallback
  private updateWindowZIndex(windowId: string) {
    const windowElement = document.querySelector(`[data-window-id="${windowId}"]`) as HTMLElement;
    if (windowElement) {
      const zIndex = this.getWindowZIndex(windowId);
      windowElement.style.zIndex = zIndex.toString();

    }
  }

  // Toggle WindowManager windows (for apps opened via WindowManager service)
  toggleWindowManagerWindow(windowId: string) {
    const window = this.windowManager.getWindow(windowId);
    if (!window) return;

    if (window.isMinimized) {
      // Restore if minimized
      this.windowManager.restoreWindow(windowId);
    } else if (this.windowManager.isWindowFocused(windowId)) {
      // Minimize if already focused
      this.windowManager.minimizeWindow(windowId);
    } else {
      // Focus if not focused
      this.windowManager.focusWindow(windowId);
    }
  }

  // Toggle window: minimize if focused, restore/focus if not focused, open if closed
  toggleTaskbarApp(windowId: string) {


    console.log('Current focused window:', this.focusedWindow());
    console.log('Minimized windows:', Array.from(this.minimizedWindows()));
    console.log('Current max z-index:', this.maxZIndex());

    switch (windowId) {
      case 'calculator':
        console.log('Calculator case - showTestWindow:', this.showTestWindow());
        console.log('Calculator is minimized:', this.isWindowMinimized('calculator'));
        console.log('Calculator is focused:', this.isWindowFocused('calculator'));

        if (this.showTestWindow()) {
          if (this.isWindowMinimized('calculator')) {

            // Window is minimized, restore and focus it
            this.focusWindow('calculator');
          } else if (this.focusedWindow() === 'calculator') {

            // Window is focused, minimize it
            this.minimizeWindow('calculator');
          } else {

            // Window is open but not focused, focus it
            this.focusWindow('calculator');
          }
        } else {

          // Window is closed, open it
          this.showTestWindow.set(true);
          this.focusWindow('calculator');
        }
        break;

      case 'my-info':
        if (this.showMyInfoWindow()) {
          if (this.isWindowMinimized('my-info')) {
            // Window is minimized, restore and focus it
            this.focusWindow('my-info');
          } else if (this.focusedWindow() === 'my-info') {
            this.minimizeWindow('my-info');
          } else {
            this.focusWindow('my-info');
          }
        } else {
          this.showMyInfoWindow.set(true);
          this.focusWindow('my-info');
        }
        break;


      case 'love':
        if (this.showLoveWindow()) {
          if (this.isWindowMinimized('love')) {
            this.focusWindow('love');
          } else if (this.focusedWindow() === 'love') {
            this.minimizeWindow('love');
          } else {
            this.focusWindow('love');
          }
        } else {
          this.showLoveWindow.set(true);
          this.focusWindow('love');
        }
        break;

      case 'explorer':
        if (this.showExplorerWindow()) {
          if (this.isWindowMinimized('explorer')) {
            this.focusWindow('explorer');
          } else if (this.focusedWindow() === 'explorer') {
            this.minimizeWindow('explorer');
          } else {
            this.focusWindow('explorer');
          }
        } else {
          this.showExplorerWindow.set(true);
          this.focusWindow('explorer');
        }
        break;

      case 'text-viewer':
        if (this.showTextViewerWindow()) {
          if (this.isWindowMinimized('text-viewer')) {
            this.focusWindow('text-viewer');
          } else if (this.focusedWindow() === 'text-viewer') {
            this.minimizeWindow('text-viewer');
          } else {
            this.focusWindow('text-viewer');
          }
        } else {
          this.showTextViewerWindow.set(true);
          this.focusWindow('text-viewer');
        }
        break;

      case 'image-viewer':
        if (this.showImageViewerWindow()) {
          if (this.isWindowMinimized('image-viewer')) {
            this.focusWindow('image-viewer');
          } else if (this.focusedWindow() === 'image-viewer') {
            this.minimizeWindow('image-viewer');
          } else {
            this.focusWindow('image-viewer');
          }
        } else {
          this.showImageViewerWindow.set(true);
          this.focusWindow('image-viewer');
        }
        break;

      case 'machine-info':
        if (this.showMachineInfoWindow()) {
          if (this.isWindowMinimized('machine-info')) {
            this.focusWindow('machine-info');
          } else if (this.focusedWindow() === 'machine-info') {
            this.minimizeWindow('machine-info');
          } else {
            this.focusWindow('machine-info');
          }
        } else {
          this.showMachineInfoWindow.set(true);
          this.focusWindow('machine-info');
        }
        break;

      case 'credit':
        if (this.showCreditWindow()) {
          if (this.isWindowMinimized('credit')) {
            this.focusWindow('credit');
          } else if (this.focusedWindow() === 'credit') {
            this.minimizeWindow('credit');
          } else {
            this.focusWindow('credit');
          }
        } else {
          this.showCreditWindow.set(true);
          this.focusWindow('credit');
        }
        break;

      case 'paint':
        if (this.showPaintWindow()) {
          if (this.isWindowMinimized('paint')) {
            this.focusWindow('paint');
          } else if (this.focusedWindow() === 'paint') {
            this.minimizeWindow('paint');
          } else {
            this.focusWindow('paint');
          }
        } else {
          this.showPaintWindow.set(true);
          this.focusWindow('paint');
        }
        break;

      case 'credits':
        if (this.showCreditsWindow()) {
          if (this.isWindowMinimized('credits')) {
            this.focusWindow('credits');
          } else if (this.focusedWindow() === 'credits') {
            this.minimizeWindow('credits');
          } else {
            this.focusWindow('credits');
          }
        } else {
          this.showCreditsWindow.set(true);
          this.focusWindow('credits');
        }
        break;

      case 'hcmc':
        if (this.showHcmcWindow()) {
          if (this.isWindowMinimized('hcmc')) {
            this.focusWindow('hcmc');
          } else if (this.focusedWindow() === 'hcmc') {
            this.minimizeWindow('hcmc');
          } else {
            this.focusWindow('hcmc');
          }
        } else {
          this.showHcmcWindow.set(true);
          this.focusWindow('hcmc');
        }
        break;

      case 'news':
        if (this.showNewsWindow()) {
          if (this.isWindowMinimized('news')) {
            this.focusWindow('news');
          } else if (this.focusedWindow() === 'news') {
            this.minimizeWindow('news');
          } else {
            this.focusWindow('news');
          }
        } else {
          this.showNewsWindow.set(true);
          this.focusWindow('news');
        }
        break;
    }
  }

  getWindowZIndex(windowId: string): number {
    // If this is the focused window, return the max z-index
    if (this.focusedWindow() === windowId) {
      return this.maxZIndex();
    }

    // For non-focused windows, return a base z-index
    // But ensure it's lower than the focused window
    return 1000;
  }

  // Check if a window is minimized
  isWindowMinimized(windowId: string): boolean {
    return this.minimizedWindows().has(windowId);
  }

  isWindowFocused(windowId: string): boolean {
    return this.focusedWindow() === windowId;
  }

  // Desktop context menu methods
  onDesktopRightClick(event: MouseEvent) {
    event.preventDefault();
    this.showDesktopContextMenu.set(true);
    this.desktopContextMenuPosition.set({
      x: event.clientX,
      y: event.clientY
    });
    // Close start menu if open
    this.showStartMenu.set(false);
    // Clear icon selection on desktop right-click
    this.selectedIconId.set(null);
  }

  onDesktopClick(event: MouseEvent) {
    // Clear icon selection when clicking on empty desktop area
    this.selectedIconId.set(null);
  }

  hideDesktopContextMenu() {
    this.showDesktopContextMenu.set(false);
  }

  openSettings() {
    this.hideDesktopContextMenu();

    this.showSettingsDialog.set(true);
    console.log('Settings dialog state:', this.showSettingsDialog());
  }

  closeSettingsDialog() {
    this.showSettingsDialog.set(false);
  }


  onSettingsChange(settings: any) {
    // Apply wallpaper change
    if (settings.wallpaper) {
      this.applyWallpaper(settings.wallpaper);
    }

    // Apply theme change
    if (settings.theme) {
      this.applyTheme(settings.theme);
    }

    // Apply theme color change
    if (settings.themeColor) {
      this.applyThemeColor(settings.themeColor);
    }

    // Apply backdrop change
    if (settings.backdropEnabled !== undefined) {
      this.applyBackdrop(settings.backdropEnabled);
    }

    // Apply window color
    if (settings.windowColor) {
      this.applyWindowColor(settings.windowColor);
    }

    // Apply window opacity
    if (settings.windowOpacity !== undefined) {
      this.applyWindowOpacity(settings.windowOpacity);
    }

    // Apply animations
    if (settings.animations !== undefined) {
      this.applyAnimations(settings.animations);
    }

    // Apply font size
    if (settings.fontSize) {
      this.applyFontSize(settings.fontSize);
    }
  }

  applyWallpaper(wallpaperId: string) {
    let wallpaperElement = document.querySelector('.wallpaper') as HTMLElement;

    // If element not found, try again after a short delay
    if (!wallpaperElement) {
      setTimeout(() => {
        wallpaperElement = document.querySelector('.wallpaper') as HTMLElement;
        if (wallpaperElement) {
          this.setWallpaperStyles(wallpaperElement, wallpaperId);
        }
      }, 100);
      return;
    }

    this.setWallpaperStyles(wallpaperElement, wallpaperId);
  }

  private setWallpaperStyles(element: HTMLElement, wallpaperId: string) {
    let wallpaperPath = 'assets/images/lib/wallpaper/1.png'; // Default to first wallpaper

    // Map wallpaper IDs to actual paths
    switch (wallpaperId) {
      case '1':
        wallpaperPath = 'assets/images/lib/wallpaper/1.png';
        break;
      case '2':
        wallpaperPath = 'assets/images/lib/wallpaper/2.png';
        break;
      case '3':
        wallpaperPath = 'assets/images/lib/wallpaper/3.png';
        break;
      default:
        wallpaperPath = 'assets/images/lib/wallpaper/1.png';
    }




    element.style.backgroundImage = `url('${wallpaperPath}')`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';


  }

  applyTheme(theme: string) {
    // Apply theme to the document
    document.documentElement.setAttribute('data-theme', theme);

    // Apply dark theme styles
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--bg-color', '#1a1a1a');
      document.documentElement.style.setProperty('--text-color', '#ffffff');
      document.documentElement.style.setProperty('--window-bg', '#2d2d2d');
      document.documentElement.style.setProperty('--border-color', '#404040');
    } else if (theme === 'light') {
      document.documentElement.style.setProperty('--bg-color', '#ffffff');
      document.documentElement.style.setProperty('--text-color', '#000000');
      document.documentElement.style.setProperty('--window-bg', '#f8f9fa');
      document.documentElement.style.setProperty('--border-color', '#dee2e6');
    } else {
      // Auto theme - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.style.setProperty('--bg-color', '#1a1a1a');
        document.documentElement.style.setProperty('--text-color', '#ffffff');
        document.documentElement.style.setProperty('--window-bg', '#2d2d2d');
        document.documentElement.style.setProperty('--border-color', '#404040');
      } else {
        document.documentElement.style.setProperty('--bg-color', '#ffffff');
        document.documentElement.style.setProperty('--text-color', '#000000');
        document.documentElement.style.setProperty('--window-bg', '#f8f9fa');
        document.documentElement.style.setProperty('--border-color', '#dee2e6');
      }
    }


  }

  applyThemeColor(color: string) {
    // Create a gradient from the selected color
    const gradient = `linear-gradient(135deg, ${color} 0%, ${this.adjustColorBrightness(color, 10)} 50%, ${this.adjustColorBrightness(color, -20)} 100%)`;
    
    // Apply theme color to CSS custom properties
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--accent-color', gradient);
  }

  // Helper function to adjust color brightness
  private adjustColorBrightness(color: string, percent: number): string {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Adjust brightness
    const adjustValue = (val: number) => {
      const adjusted = Math.round(val + (255 - val) * (percent / 100));
      return Math.max(0, Math.min(255, adjusted));
    };

    const newR = adjustValue(r);
    const newG = adjustValue(g);
    const newB = adjustValue(b);

    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  }

  applyBackdrop(enabled: boolean) {
    let backdropElement = document.querySelector('.wallpaper-backdrop') as HTMLElement;

    if (enabled) {
      if (!backdropElement) {
        // Create backdrop element if it doesn't exist
        backdropElement = document.createElement('div');
        backdropElement.className = 'wallpaper-backdrop';
        const wallpaperElement = document.querySelector('.wallpaper');
        if (wallpaperElement) {
          wallpaperElement.appendChild(backdropElement);
        }
      }
      backdropElement.style.display = 'block';
    } else {
      if (backdropElement) {
        backdropElement.style.display = 'none';
      }
    }
  }

  applyWindowColor(color: string) {
    // Apply window color to CSS custom property
    // This affects window backgrounds through the CSS variable
    document.documentElement.style.setProperty('--window-bg-color', color);
    document.documentElement.style.setProperty('--window-header-bg', color);
  }

  applyWindowOpacity(opacity: number) {
    // Apply opacity to window bodies through CSS variable
    document.documentElement.style.setProperty('--window-opacity', `${opacity / 100}`);
  }

  applyAnimations(enabled: boolean) {
    // Enable or disable animations globally
    if (enabled) {
      document.documentElement.classList.remove('no-animations');
    } else {
      document.documentElement.classList.add('no-animations');
    }
  }

  applyFontSize(size: 'small' | 'medium' | 'large') {
    // Apply font size to the entire application
    const fontSizes = {
      'small': '13px',
      'medium': '14px',
      'large': '16px'
    };
    
    document.documentElement.style.setProperty('--base-font-size', fontSizes[size]);
    document.documentElement.style.fontSize = fontSizes[size];
  }

  loadSettingsOnInit() {
    const savedSettings = localStorage.getItem('desktop-portfolio-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);


        // Apply wallpaper
        if (settings.wallpaper) {
          this.applyWallpaper(settings.wallpaper);
        } else {
          // Apply default wallpaper if none is set
          this.applyWallpaper('1');
        }

        // Apply theme
        if (settings.theme) {
          this.applyTheme(settings.theme);
        }

        // Apply theme color
        if (settings.themeColor) {
          this.applyThemeColor(settings.themeColor);
        }

        // Apply backdrop
        if (settings.backdropEnabled !== undefined) {
          this.applyBackdrop(settings.backdropEnabled);
        }

        // Apply window color
        if (settings.windowColor) {
          this.applyWindowColor(settings.windowColor);
        }

        // Apply window opacity
        if (settings.windowOpacity !== undefined) {
          this.applyWindowOpacity(settings.windowOpacity);
        }

        // Apply animations
        if (settings.animations !== undefined) {
          this.applyAnimations(settings.animations);
        }

        // Apply font size
        if (settings.fontSize) {
          this.applyFontSize(settings.fontSize);
        }

      } catch (error) {
        // Apply default wallpaper on error
        this.applyWallpaper('1');
      }
    } else {
      // Create and save default settings
      const defaultSettings = {
        wallpaper: '1',
        theme: 'auto',
        themeColor: '#007bff',
        backdropEnabled: false,
        windowColor: '#1e3a5f',
        windowOpacity: 95,
        animations: true,
        fontSize: 'medium'
      };
      localStorage.setItem('desktop-portfolio-settings', JSON.stringify(defaultSettings));

      // Apply default settings
      this.applyWallpaper('1');
      this.applyWindowColor('#1e3a5f');
      this.applyWindowOpacity(95);
      this.applyAnimations(true);
      this.applyFontSize('medium');
    }
  }

  refreshDesktop() {
    this.hideDesktopContextMenu();

  }

  // Search methods
  openSearchWindow() {
    this.showSearchWindow.set(true);
    // Focus the search input after the view updates
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    }, 100);
  }

  closeSearchWindow() {
    this.showSearchWindow.set(false);
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchSuggestions = false;
    this.selectedSearchIndex = 0;
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.performSearch();
  }

  performSearch() {
    if (this.searchQuery.trim().length < 1) {
      this.searchResults = [];
      this.showSearchSuggestions = false;
      this.selectedSearchIndex = 0;
      return;
    }

    // Use the search service to get comprehensive results
    this.searchResults = this.searchService.search(this.searchQuery);
    this.showSearchSuggestions = this.searchResults.length > 0;
    this.selectedSearchIndex = 0; // Reset selection to first result
  }

  selectSearchResult(result: SearchResult) {
    if (result.type === 'app') {
      this.openApp(result.action!);
    } else if (result.type === 'file') {
      this.openFile(result.content || result.path!, result.path!);
    } else if (result.type === 'web') {
      window.open(result.url, '_blank');
    }
    this.closeSearchWindow();
  }

  openFile(contentPath: string, displayPath: string) {
    // Extract file extension to determine how to open it
    const extension = contentPath.split('.').pop()?.toLowerCase();

    if (extension === 'md' || extension === 'txt') {
      // Open text files in text viewer
      this.currentTextFile.set({
        path: contentPath,
        name: displayPath.split('/').pop() || 'Unknown File',
        type: extension === 'md' ? 'md' : 'txt'
      });
      this.showTextViewerWindow.set(true);
      this.focusWindow('text-viewer');
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      // Open image files in image viewer
      this.currentImageFile.set({
        path: contentPath,
        name: displayPath.split('/').pop() || 'Unknown Image'
      });
      this.showImageViewerWindow.set(true);
      this.focusWindow('image-viewer');
    } else if (extension === 'pdf') {
      // Open PDF files in PDF viewer
      this.currentPdfFile.set({
        path: contentPath,
        name: displayPath.split('/').pop() || 'Unknown PDF'
      });
      this.showPdfViewerWindow.set(true);
      this.focusWindow('pdf-viewer');
    } else {
      // For other files, try to open in explorer
      this.showExplorerWindow.set(true);
      this.focusWindow('explorer');
      // You could add logic here to navigate to the specific file in explorer
    }
  }

  navigateSearchResults(direction: number, event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();

    if (this.searchResults.length === 0) return;

    this.selectedSearchIndex += direction;

    // Wrap around
    if (this.selectedSearchIndex < 0) {
      this.selectedSearchIndex = this.searchResults.length - 1;
    } else if (this.selectedSearchIndex >= this.searchResults.length) {
      this.selectedSearchIndex = 0;
    }
  }

  getResultIndex(type: string, localIndex: number): number {
    let globalIndex = 0;

    // Count results before this type
    if (type === 'file') {
      globalIndex += this.appSearchResults.length;
    } else if (type === 'web') {
      globalIndex += this.appSearchResults.length + this.fileSearchResults.length;
    }

    return globalIndex + localIndex;
  }


  // Lock screen functionality
  lockScreen() {
    if (this.welcomeScreen) {
      this.welcomeScreen.lockScreenFromParent();
    }
  }

  // Restart system functionality
  restartSystem() {
    this.closeStartMenu();
    this.showRestartScreen.set(true);
    this.restartMessages = [];
    this.currentTypingText.set('');
    this.showCursor.set(true);

    // Start the restart animation - type messages character by character
    const sub = this.systemRestartService.startRestart().subscribe({
      next: (message) => {
        this.typeMessage(message);
      },
      complete: () => {
        // After all messages are shown, wait a bit then hide cursor
        setTimeout(() => {
          this.showCursor.set(false);
          this.cdr.detectChanges();

          // Wait another second then complete restart
          setTimeout(() => {
            this.completeRestart();
          }, 1000);
        }, 500);
      }
    });
    this.subscriptions.push(sub);
  }

  // Type message character by character
  private typeMessage(message: BootMessage) {
    const fullText = message.text;
    const timestamp = message.timestamp;
    let charIndex = 0;

    // If empty line, just add it immediately
    if (!fullText) {
      this.restartMessages = [...this.restartMessages, message];
      this.currentTypingText.set('');
      this.currentTypingIndex.set(-1);
      this.cdr.detectChanges();
      return;
    }

    // Create a temporary message object for typing animation
    const typingMessage: BootMessage = {
      text: '',
      type: message.type,
      timestamp: timestamp
    };

    // Add the message container
    this.restartMessages = [...this.restartMessages, typingMessage];
    const messageIndex = this.restartMessages.length - 1;

    // Set this message as currently typing
    this.currentTypingIndex.set(messageIndex);

    // Type each character
    const typeInterval = setInterval(() => {
      if (charIndex < fullText.length) {
        typingMessage.text += fullText[charIndex];
        this.restartMessages = [...this.restartMessages]; // Trigger change detection
        charIndex++;

        // Auto-scroll terminal to bottom
        setTimeout(() => {
          const terminalBody = document.querySelector('.terminal-body');
          if (terminalBody) {
            terminalBody.scrollTop = terminalBody.scrollHeight;
          }
        }, 10);
      } else {
        clearInterval(typeInterval);
        // Clear the typing indicator when done
        this.currentTypingIndex.set(-1);
      }
      this.cdr.detectChanges();
    }, 10); // 10ms per character for smooth typing
  }

  private completeRestart() {
    this.showRestartScreen.set(false);
    this.restartMessages = [];
    this.systemRestartService.completeRestart();

    // Lock the screen after restart
    if (this.welcomeScreen) {
      this.welcomeScreen.lockScreenFromParent();
    }
  }

  ngOnDestroy() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub?.unsubscribe());

    // Remove event listener
    if (this.systemRestartHandler) {
      window.removeEventListener('system-restart-requested', this.systemRestartHandler);
    }
  }
}
