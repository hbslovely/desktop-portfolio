import { Component, signal, computed, ViewChild, AfterViewInit, ChangeDetectorRef, ElementRef } from '@angular/core';
import { WindowComponent } from './components/window/window.component';
import { DesktopIconComponent, DesktopIconData } from './components/desktop-icon/desktop-icon.component';
import { CalculatorComponent } from './components/apps/calculator/calculator.component';
import { IframeAppComponent } from './components/apps/iframe-app/iframe-app.component';
import { LoveAppComponent } from './components/apps/love-app/love-app.component';
import { ExplorerComponent, FileOpenEvent, ContextMenuEvent } from './components/apps/explorer/explorer.component';
import { TextViewerComponent } from './components/apps/text-viewer/text-viewer.component';
import { ImageViewerComponent } from './components/apps/image-viewer/image-viewer.component';
import { MachineInfoComponent } from './components/apps/machine-info/machine-info.component';
import { CreditAppComponent } from './components/apps/credit-app/credit-app.component';
import { PaintAppComponent } from './components/apps/paint-app/paint-app.component';
import { CreditsAppComponent } from './components/apps/credits-app/credits-app.component';
import { HcmcAppComponent } from './components/apps/hcmc-app/hcmc-app.component';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from "@angular/platform-browser";
import { SettingsDialogComponent } from "./components/settings-dialog/settings-dialog.component";
import { APP_ICONS, APP_SEARCH_CONFIG } from './config/app-icons.config';
import { SearchService, SearchResult } from './services/search.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ WelcomeScreenComponent, WindowComponent, DesktopIconComponent, CalculatorComponent, IframeAppComponent, LoveAppComponent, ExplorerComponent, TextViewerComponent, ImageViewerComponent, MachineInfoComponent, CreditAppComponent, PaintAppComponent, CreditsAppComponent, HcmcAppComponent, CommonModule, FormsModule, SettingsDialogComponent ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit {
  @ViewChild(WelcomeScreenComponent) welcomeScreen!: WelcomeScreenComponent;
  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private searchService: SearchService
  ) {
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

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
  showClockWindow = signal(false);

  // File viewer data
  currentTextFile = signal<{ path: string; name: string; type: 'txt' | 'md' } | null>(null);
  currentImageFile = signal<{ path: string; name: string } | null>(null);
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
  showStartSubmenu = signal<string | null>(null);

  // Settings dialog state
  showSettingsDialog = signal(false);
  currentTime = '';
  currentDate = '';

  // Clock properties
  clockNumbers = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ];
  hourAngle = 0;
  minuteAngle = 0;
  secondAngle = 0;
  clockMode: 'analog' | 'digital' = 'digital'; // Default to digital mode

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

  // Desktop icons from configuration
  testIcons: DesktopIconData[] = APP_ICONS;

  // Start menu configuration
  startMenuGroups = [
    {
      id: 'productivity',
      name: 'Productivity',
      icon: 'pi pi-briefcase',
      apps: [
        { id: 'calculator', name: 'Calculator', icon: 'pi pi-calculator' },
        { id: 'credit', name: 'Credit Tracker', icon: 'pi pi-dollar' },
        { id: 'explorer', name: 'File Explorer', icon: 'pi pi-folder' }
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
        { id: 'hcmc', name: 'Ho Chi Minh City', icon: 'pi pi-globe' }
      ]
    },
    {
      id: 'system',
      name: 'System',
      icon: 'pi pi-cog',
      apps: [
        { id: 'credits', name: 'Credits', icon: 'pi pi-star' }
      ]
    }
  ];

  onCloseTestWindow() {
    this.showTestWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'calculator') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeTestWindow() {
    console.log('Calculator window minimized');
    this.minimizedWindows.update(set => new Set(set).add('calculator'));
  }

  onMaximizeTestWindow() {
    console.log('Window maximized');
  }

  onRestoreTestWindow() {
    console.log('Calculator window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('calculator');
      return newSet;
    });
  }

  onFocusTestWindow() {
    console.log('Calculator window focused');
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
    console.log('My Info window minimized');
    this.minimizedWindows.update(set => new Set(set).add('my-info'));
  }

  onMaximizeMyInfoWindow() {
    console.log('My Info window maximized');
  }

  onRestoreMyInfoWindow() {
    console.log('My Info window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('my-info');
      return newSet;
    });
  }

  onFocusMyInfoWindow() {
    console.log('My Info window focused');
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
    console.log('Love window minimized');
    this.minimizedWindows.update(set => new Set(set).add('love'));
  }

  onMaximizeLoveWindow() {
    console.log('Love window maximized');
  }

  onRestoreLoveWindow() {
    console.log('Love window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('love');
      return newSet;
    });
  }

  onFocusLoveWindow() {
    console.log('Love window focused');
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
    console.log('Explorer window minimized');
    this.minimizedWindows.update(set => new Set(set).add('explorer'));
  }

  onMaximizeExplorerWindow() {
    console.log('Explorer window maximized');
  }

  onRestoreExplorerWindow() {
    console.log('Explorer window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('explorer');
      return newSet;
    });
  }

  onFocusExplorerWindow() {
    console.log('Explorer window focused');
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
    console.log('Credit window minimized');
    this.minimizedWindows.update(set => new Set(set).add('credit'));
  }

  onMaximizeCreditWindow() {
    console.log('Credit window maximized');
  }

  onRestoreCreditWindow() {
    console.log('Credit window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('credit');
      return newSet;
    });
  }

  onFocusCreditWindow() {
    console.log('Credit window focused');
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
    console.log('Paint window minimized');
    this.minimizedWindows.update(set => new Set(set).add('paint'));
  }

  onMaximizePaintWindow() {
    console.log('Paint window maximized');
  }

  onRestorePaintWindow() {
    console.log('Paint window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('paint');
      return newSet;
    });
  }

  onFocusPaintWindow() {
    console.log('Paint window focused');
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
    console.log('Credits window minimized');
    this.minimizedWindows.update(set => new Set(set).add('credits'));
  }

  onMaximizeCreditsWindow() {
    console.log('Credits window maximized');
  }

  onRestoreCreditsWindow() {
    console.log('Credits window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('credits');
      return newSet;
    });
  }

  onFocusCreditsWindow() {
    console.log('Credits window focused');
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
    console.log('HCMC window minimized');
    this.minimizedWindows.update(set => new Set(set).add('hcmc'));
  }

  onMaximizeHcmcWindow() {
    console.log('HCMC window maximized');
  }

  onRestoreHcmcWindow() {
    console.log('HCMC window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('hcmc');
      return newSet;
    });
  }

  onFocusHcmcWindow() {
    console.log('HCMC window focused');
    this.focusWindow('hcmc');
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
    console.log('Text viewer window minimized');
    this.minimizedWindows.update(set => new Set(set).add('text-viewer'));
  }

  onMaximizeTextViewerWindow() {
    console.log('Text viewer window maximized');
  }

  onRestoreTextViewerWindow() {
    console.log('Text viewer window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('text-viewer');
      return newSet;
    });
  }

  onFocusTextViewerWindow() {
    console.log('Text viewer window focused');
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
    console.log('Image viewer window minimized');
    this.minimizedWindows.update(set => new Set(set).add('image-viewer'));
  }

  onMaximizeImageViewerWindow() {
    console.log('Image viewer window maximized');
  }

  onRestoreImageViewerWindow() {
    console.log('Image viewer window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('image-viewer');
      return newSet;
    });
  }

  onFocusImageViewerWindow() {
    console.log('Image viewer window focused');
    this.focusWindow('image-viewer');
  }

  // Machine Info Window Methods
  onCloseMachineInfoWindow() {
    this.showMachineInfoWindow.set(false);
    if (this.focusedWindow() === 'machine-info') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeMachineInfoWindow() {
    console.log('Machine info window minimized');
    this.minimizedWindows.update(set => new Set(set).add('machine-info'));
  }

  onMaximizeMachineInfoWindow() {
    console.log('Machine info window maximized');
  }

  onRestoreMachineInfoWindow() {
    console.log('Machine info window restored');
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete('machine-info');
      return newSet;
    });
  }

  onFocusMachineInfoWindow() {
    console.log('Machine info window focused');
    this.focusWindow('machine-info');
  }

  // File Open Handler
  onExplorerFileOpen(event: FileOpenEvent) {
    const { item, fileType, extension } = event;
    console.log('Opening file from Explorer:', item.name, 'Type:', fileType);

    if (fileType === 'text') {
      // Open text file
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
    } else {
      // Unknown file type
      console.log('Unknown file type:', extension);
      alert(`Cannot open ${item.name}. File type .${extension} is not supported.`);
    }
  }

  // Context Menu Handler
  onExplorerContextMenu(event: ContextMenuEvent) {
    const { action, item, newName } = event;
    console.log('Explorer context menu action:', action, item.name);

    switch (action) {
      case 'rename':
        if (newName) {
          console.log(`Renamed "${item.name}" to "${newName}"`);
          // Update the item name in the file system
          item.name = newName;
        }
        break;

      case 'delete':
        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
          console.log(`Deleted "${item.name}"`);
          // Remove the item from its parent's children array
          this.deleteFileSystemItem(item);
        }
        break;

      case 'copy':
        console.log(`Copied "${item.name}"`);
        this.clipboardItem.set(item);
        this.clipboardAction.set('copy');
        break;

      case 'cut':
        console.log(`Cut "${item.name}"`);
        this.clipboardItem.set(item);
        this.clipboardAction.set('cut');
        break;

      case 'paste':
        const clipboardItem = this.clipboardItem();
        const clipboardAction = this.clipboardAction();
        if (clipboardItem && clipboardAction) {
          console.log(`Pasted "${clipboardItem.name}"`);
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
    console.log('Deleting file system item:', item.name);
    // For now, we'll just log the action since we don't have a direct reference to the parent
  }

  pasteFileSystemItem(item: any, action: 'copy' | 'cut') {
    console.log(`Pasting ${action} item:`, item.name);

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
    console.log('Setting wallpaper to:', imagePath);

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

  onCloseClockWindow() {
    this.showClockWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'clock') {
      this.focusedWindow.set(null);
    }
  }

  onDesktopIconSelect(icon: DesktopIconData) {
    console.log('Desktop icon selected:', icon.name);
    // Single click only selects the icon, doesn't open the app
    // This is handled by the desktop-icon component itself
  }

  onDesktopIconDoubleClick(icon: DesktopIconData) {
    console.log('Desktop icon double-clicked:', icon.name);
    // Double-click opens the app
    this.openTestApp(icon);
  }

  openTestApp(icon: DesktopIconData) {
    console.log('Opening app:', icon.name);
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
    }
  }

  onDesktopIconContextMenu(event: any) {
    const { action, icon } = event;
    console.log('Desktop icon context menu action:', action, icon.name);

    switch (action) {
      case 'open':
        this.openTestApp(icon);
        break;
      case 'delete':
        this.deleteDesktopIcon(icon);
        break;
      case 'rename':
        // Rename is handled by the icon component itself
        console.log('Icon renamed to:', icon.name);
        break;
      case 'restore':
        // Handle restore if needed
        console.log('Restore icon:', icon.name);
        break;
      case 'copy':
        console.log('Copied desktop icon:', icon.name);
        // Copy is handled by the icon component itself
        break;
      case 'cut':
        console.log('Cut desktop icon:', icon.name);
        // Cut is handled by the icon component itself
        break;
      case 'paste':
        console.log('Pasting desktop icon:', icon.name);
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
    console.log('Pasted desktop icon:', newIcon.name);
  }

  deleteDesktopIcon(icon: DesktopIconData) {
    // Remove the icon from the testIcons array
    const index = this.testIcons.findIndex(i => i.id === icon.id);
    if (index > -1) {
      this.testIcons.splice(index, 1);
      console.log('Deleted icon:', icon.name);

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
      }
    }
  }

  // Taskbar methods
  toggleStartMenu() {
    this.showStartMenu.set(!this.showStartMenu());
  }

  closeStartMenu() {
    this.showStartMenu.set(false);
    this.showStartSubmenu.set(null);
  }

  openStartSubmenu(groupId: string) {
    this.showStartSubmenu.set(groupId);
  }

  closeStartSubmenu() {
    this.showStartSubmenu.set(null);
  }

  onGroupMouseLeave() {
    // Add a small delay to allow moving to submenu
    setTimeout(() => {
      if (this.showStartSubmenu()) {
        // Check if mouse is still over the submenu area
        const submenu = document.querySelector('.start-submenu');
        if (!submenu || !submenu.matches(':hover')) {
          this.closeStartSubmenu();
        }
      }
    }, 100);
  }

  onSubmenuMouseLeave() {
    // Add a small delay to allow moving back to group
    setTimeout(() => {
      if (this.showStartSubmenu()) {
        // Check if mouse is still over the group area
        const group = document.querySelector('.app-group:hover');
        if (!group) {
          this.closeStartSubmenu();
        }
      }
    }, 100);
  }

  openApp(appId: string) {
    this.closeStartMenu();
    if (appId === 'calculator') {
      this.showTestWindow.set(true);
      this.focusWindow('calculator');
    } else if (appId === 'my-info') {
      this.showMyInfoWindow.set(true);
      this.focusWindow('my-info');
    } else if (appId === 'love') {
      this.showLoveWindow.set(true);
      this.focusWindow('love');
    } else if (appId === 'explorer') {
      this.showExplorerWindow.set(true);
      this.focusWindow('explorer');
    } else if (appId === 'credit') {
      this.showCreditWindow.set(true);
      this.focusWindow('credit');
    } else if (appId === 'paint') {
      this.showPaintWindow.set(true);
      this.focusWindow('paint');
    } else if (appId === 'credits') {
      this.showCreditsWindow.set(true);
      this.focusWindow('credits');
    } else if (appId === 'hcmc') {
      this.showHcmcWindow.set(true);
      this.focusWindow('hcmc');
    }
  }

  // Restore a minimized window
  restoreWindow(windowId: string) {
    console.log('Restoring window:', windowId);
    this.minimizedWindows.update(set => {
      const newSet = new Set(set);
      newSet.delete(windowId);
      return newSet;
    });
  }

  // Minimize a window
  minimizeWindow(windowId: string) {
    console.log('Minimizing window:', windowId);
    this.minimizedWindows.update(set => new Set(set).add(windowId));

    // Clear focus if this was the focused window
    if (this.focusedWindow() === windowId) {
      this.focusedWindow.set(null);
    }
  }

  focusWindow(windowId: string) {
    console.log('Focusing window:', windowId);
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
      console.log('Directly updated DOM z-index for', windowId, 'to', zIndex);
    }
  }

  // Toggle window: minimize if focused, restore/focus if not focused, open if closed
  toggleTaskbarApp(windowId: string) {
    console.log('=== Toggle Taskbar App ===');
    console.log('Toggling taskbar app:', windowId);
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
            console.log('Calculator is minimized, restoring and focusing...');
            // Window is minimized, restore and focus it
            this.focusWindow('calculator');
          } else if (this.focusedWindow() === 'calculator') {
            console.log('Calculator is focused, minimizing...');
            // Window is focused, minimize it
            this.minimizeWindow('calculator');
          } else {
            console.log('Calculator is open but not focused, focusing...');
            // Window is open but not focused, focus it
            this.focusWindow('calculator');
          }
        } else {
          console.log('Calculator is closed, opening...');
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

  updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    this.currentDate = now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculate clock hand angles
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    this.hourAngle = (hours * 30) + (minutes * 0.5); // 30 degrees per hour + minute adjustment
    this.minuteAngle = minutes * 6; // 6 degrees per minute
    this.secondAngle = seconds * 6; // 6 degrees per second
  }


  openClockWindow() {
    this.showClockWindow.set(true);
  }

  toggleClockMode() {
    this.clockMode = this.clockMode === 'analog' ? 'digital' : 'analog';
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
  }

  hideDesktopContextMenu() {
    this.showDesktopContextMenu.set(false);
  }

  openSettings() {
    this.hideDesktopContextMenu();
    console.log('Opening settings dialog...');
    this.showSettingsDialog.set(true);
    console.log('Settings dialog state:', this.showSettingsDialog());
  }

  closeSettingsDialog() {
    this.showSettingsDialog.set(false);
  }

  onSettingsChange(settings: any) {
    console.log('Settings changed:', settings);

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

    console.log('Setting wallpaper styles:', wallpaperId, wallpaperPath);
    console.log('Wallpaper element found:', !!element);

    element.style.backgroundImage = `url('${wallpaperPath}')`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';

    console.log('Wallpaper applied successfully:', wallpaperId, wallpaperPath);
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

    console.log('Theme applied:', theme);
  }

  applyThemeColor(color: string) {
    // Apply theme color to CSS custom properties
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--accent-color', color);

    // Update window title bar colors
    const windowElements = document.querySelectorAll('.window-header');
    windowElements.forEach((element: any) => {
      element.style.backgroundColor = color;
    });

    console.log('Theme color applied:', color);
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

    console.log('Backdrop applied:', enabled);
  }

  loadSettingsOnInit() {
    const savedSettings = localStorage.getItem('desktop-portfolio-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        console.log('Loading settings on app init:', settings);

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

        // Apply other settings as needed
        console.log('Settings loaded and applied on app initialization');
      } catch (error) {
        console.error('Error loading settings on init:', error);
        // Apply default wallpaper on error
        this.applyWallpaper('1');
      }
    } else {
      console.log('No saved settings found, using defaults');
      // Create and save default settings
      const defaultSettings = {
        wallpaper: '1',
        theme: 'auto',
        themeColor: '#007bff',
        backdropEnabled: false
      };
      localStorage.setItem('desktop-portfolio-settings', JSON.stringify(defaultSettings));

      // Apply default wallpaper when no settings exist
      this.applyWallpaper('1');
    }
  }

  refreshDesktop() {
    this.hideDesktopContextMenu();
    console.log('Refreshing desktop...');
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
      this.openFile(result.path!);
    } else if (result.type === 'web') {
      window.open(result.url, '_blank');
    }
    this.closeSearchWindow();
  }

  openFile(filePath: string) {
    // Extract file extension to determine how to open it
    const extension = filePath.split('.').pop()?.toLowerCase();

    if (extension === 'md' || extension === 'txt') {
      // Open text files in text viewer
      this.currentTextFile.set({
        path: filePath,
        name: filePath.split('/').pop() || 'Unknown File',
        type: extension === 'md' ? 'md' : 'txt'
      });
      this.showTextViewerWindow.set(true);
      this.focusWindow('text-viewer');
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      // Open image files in image viewer
      this.currentImageFile.set({
        path: filePath,
        name: filePath.split('/').pop() || 'Unknown Image'
      });
      this.showImageViewerWindow.set(true);
      this.focusWindow('image-viewer');
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
}
