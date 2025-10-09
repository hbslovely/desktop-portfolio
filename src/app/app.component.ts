import { Component, signal, computed } from '@angular/core';
import { WindowComponent } from './components/window/window.component';
import { DesktopIconComponent, DesktopIconData } from './components/desktop-icon/desktop-icon.component';
import { CalculatorComponent } from './components/apps/calculator/calculator.component';
import { IframeAppComponent } from './components/apps/iframe-app/iframe-app.component';
import { LoveAppComponent } from './components/apps/love-app/love-app.component';
import { ExplorerComponent, FileOpenEvent } from './components/apps/explorer/explorer.component';
import { TextViewerComponent } from './components/apps/text-viewer/text-viewer.component';
import { ImageViewerComponent } from './components/apps/image-viewer/image-viewer.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from "@angular/platform-browser";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ WindowComponent, DesktopIconComponent, CalculatorComponent, IframeAppComponent, LoveAppComponent, ExplorerComponent, TextViewerComponent, ImageViewerComponent, CommonModule, FormsModule ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Desktop Portfolio';

  // Test windows
  showTestWindow = signal(false); // Start with calculator closed so users can test double-click
  showMyInfoWindow = signal(false);
  showMyPageWindow = signal(false);
  showLoveWindow = signal(false);
  showExplorerWindow = signal(false);
  showTextViewerWindow = signal(false);
  showImageViewerWindow = signal(false);
  showClockWindow = signal(false);
  
  // File viewer data
  currentTextFile = signal<{ path: string; name: string; type: 'txt' | 'md' } | null>(null);
  currentImageFile = signal<{ path: string; name: string } | null>(null);
  showSearchWindow = signal(false);

  // Window management
  focusedWindow = signal<string | null>(null);
  maxZIndex = signal(1000); // Track the maximum z-index used

  // Taskbar state
  showStartMenu = signal(false);
  showDesktopContextMenu = signal(false);
  desktopContextMenuPosition = signal({ x: 0, y: 0 });
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
  searchResults: any[] = [];
  showSearchSuggestions = false;

  // Computed search results
  get appSearchResults() {
    return this.searchResults.filter(r => r.type === 'app');
  }

  get webSearchResults() {
    return this.searchResults.filter(r => r.type === 'web');
  }

  // Browser properties
  private _currentUrl = signal('https://www.google.com');
  canGoBack = false;
  canGoForward = false;
  isLoading = false;
  isBookmarked = false;
  showBookmarksBar = true;
  showBrowserMenu = false;
  hasIframeError = false;

  // Computed properties
  get currentUrl() {
    return this._currentUrl();
  }

  set currentUrl(value: string) {
    this._currentUrl.set(value);
  }

  // Computed iframe src to prevent infinite recomputation
  iframeSrc = computed(() => {
    const url = this._currentUrl();
    if (!url) return null;
    
    // Don't use toLowerCase() as it might interfere with URL structure
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  bookmarks = [
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'Wikipedia', url: 'https://en.wikipedia.org' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
    { name: 'Example.com', url: 'https://example.com' },
    { name: 'HTTPBin', url: 'https://httpbin.org' }
  ];

  constructor(private sanitizer: DomSanitizer) {
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

  // Test icons
  testIcons: DesktopIconData[] = [
    {
      id: 'calculator',
      name: 'Calculator',
      icon: 'assets/images/icons/calculator.png',
      type: 'application',
      position: { x: 50, y: 50 }
    },
    {
      id: 'my-info',
      name: 'My Information',
      icon: 'assets/images/icons/profile.png',
      type: 'application',
      position: { x: 50, y: 150 }
    },
    {
      id: 'my-page',
      name: 'My Page',
      icon: 'assets/images/icons/info.png',
      type: 'application',
      position: { x: 50, y: 250 }
    },
    {
      id: 'love',
      name: 'Love',
      icon: 'assets/images/icons/love.png',
      type: 'application',
      position: { x: 50, y: 350 }
    },
    {
      id: 'explorer',
      name: 'Explorer',
      icon: 'assets/images/icons/explorer.png',
      type: 'application',
      position: { x: 150, y: 50 }
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
    console.log('Window minimized');
  }

  onMaximizeTestWindow() {
    console.log('Window maximized');
  }

  onRestoreTestWindow() {
    console.log('Window restored');
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
  }

  onMaximizeMyInfoWindow() {
    console.log('My Info window maximized');
  }

  onRestoreMyInfoWindow() {
    console.log('My Info window restored');
  }

  onFocusMyInfoWindow() {
    console.log('My Info window focused');
    this.focusWindow('my-info');
  }

  onCloseMyPageWindow() {
    this.showMyPageWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'my-page') {
      this.focusedWindow.set(null);
    }
  }

  onMinimizeMyPageWindow() {
    console.log('My Page window minimized');
  }

  onMaximizeMyPageWindow() {
    console.log('My Page window maximized');
  }

  onRestoreMyPageWindow() {
    console.log('My Page window restored');
  }

  onFocusMyPageWindow() {
    console.log('My Page window focused');
    this.focusWindow('my-page');
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
  }

  onMaximizeLoveWindow() {
    console.log('Love window maximized');
  }

  onRestoreLoveWindow() {
    console.log('Love window restored');
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
  }

  onMaximizeExplorerWindow() {
    console.log('Explorer window maximized');
  }

  onRestoreExplorerWindow() {
    console.log('Explorer window restored');
  }

  onFocusExplorerWindow() {
    console.log('Explorer window focused');
    this.focusWindow('explorer');
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
  }

  onMaximizeTextViewerWindow() {
    console.log('Text viewer window maximized');
  }

  onRestoreTextViewerWindow() {
    console.log('Text viewer window restored');
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
  }

  onMaximizeImageViewerWindow() {
    console.log('Image viewer window maximized');
  }

  onRestoreImageViewerWindow() {
    console.log('Image viewer window restored');
  }

  onFocusImageViewerWindow() {
    console.log('Image viewer window focused');
    this.focusWindow('image-viewer');
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

  onCloseClockWindow() {
    this.showClockWindow.set(false);
    // Clear focus if this was the focused window
    if (this.focusedWindow() === 'clock') {
      this.focusedWindow.set(null);
    }
  }

  onDesktopIconClick(icon: DesktopIconData) {
    console.log('Desktop icon clicked:', icon.name);
    
    // Check if the application is already open
    if (icon.id === 'calculator' && this.showTestWindow()) {
      // App is already open, restore/focus it
      this.focusWindow('calculator');
    } else if (icon.id === 'my-info' && this.showMyInfoWindow()) {
      // App is already open, restore/focus it
      this.focusWindow('my-info');
    } else if (icon.id === 'my-page' && this.showMyPageWindow()) {
      // App is already open, restore/focus it
      this.focusWindow('my-page');
    } else if (icon.id === 'love' && this.showLoveWindow()) {
      // App is already open, restore/focus it
      this.focusWindow('love');
    } else if (icon.id === 'explorer' && this.showExplorerWindow()) {
      // App is already open, restore/focus it
      this.focusWindow('explorer');
    } else {
      // App is not open, open it
      this.openTestApp(icon);
    }
  }

  openTestApp(icon: DesktopIconData) {
    console.log('Opening app:', icon.name);
    if (icon.id === 'calculator') {
      this.showTestWindow.set(true);
      this.focusWindow('calculator');
    } else if (icon.id === 'my-info') {
      this.showMyInfoWindow.set(true);
      this.focusWindow('my-info');
    } else if (icon.id === 'my-page') {
      this.showMyPageWindow.set(true);
      this.focusWindow('my-page');
    } else if (icon.id === 'love') {
      this.showLoveWindow.set(true);
      this.focusWindow('love');
    } else if (icon.id === 'explorer') {
      this.showExplorerWindow.set(true);
      this.focusWindow('explorer');
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
    }
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
      } else if (icon.id === 'my-page' && this.showMyPageWindow()) {
        this.onCloseMyPageWindow();
      } else if (icon.id === 'love' && this.showLoveWindow()) {
        this.onCloseLoveWindow();
      } else if (icon.id === 'explorer' && this.showExplorerWindow()) {
        this.onCloseExplorerWindow();
      }
    }
  }

  // Taskbar methods
  toggleStartMenu() {
    this.showStartMenu.set(!this.showStartMenu());
  }

  closeStartMenu() {
    this.showStartMenu.set(false);
  }

  openApp(appId: string) {
    this.closeStartMenu();
    if (appId === 'calculator') {
      this.showTestWindow.set(true);
      this.focusWindow('calculator');
    } else if (appId === 'my-info') {
      this.showMyInfoWindow.set(true);
      this.focusWindow('my-info');
    } else if (appId === 'my-page') {
      this.showMyPageWindow.set(true);
      this.focusWindow('my-page');
    } else if (appId === 'love') {
      this.showLoveWindow.set(true);
      this.focusWindow('love');
    } else if (appId === 'explorer') {
      this.showExplorerWindow.set(true);
      this.focusWindow('explorer');
    }
  }

  focusWindow(windowId: string) {
    console.log('Focusing window:', windowId);
    
    // Set the focused window
    this.focusedWindow.set(windowId);
    
    // Increment the max z-index for the focused window
    this.maxZIndex.update(max => max + 1);

    // If window is minimized, restore it
    if (windowId === 'calculator' && this.showTestWindow()) {
      // Calculator window focus logic can be added here if needed
    } else if (windowId === 'my-info' && this.showMyInfoWindow()) {
      // My Info window focus logic can be added here if needed
    } else if (windowId === 'my-page' && this.showMyPageWindow()) {
      // My Page window focus logic can be added here if needed
    } else if (windowId === 'love' && this.showLoveWindow()) {
      // Love window focus logic can be added here if needed
    } else if (windowId === 'explorer' && this.showExplorerWindow()) {
      // Explorer window focus logic can be added here if needed
    } else if (windowId === 'text-viewer' && this.showTextViewerWindow()) {
      // Text viewer window focus logic can be added here if needed
    } else if (windowId === 'image-viewer' && this.showImageViewerWindow()) {
      // Image viewer window focus logic can be added here if needed
    }
  }

  getWindowZIndex(windowId: string): number {
    // If this is the focused window, return the max z-index
    if (this.focusedWindow() === windowId) {
      return this.maxZIndex();
    }
    
    // For non-focused windows, return a base z-index
    return 1000;
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
    console.log('Opening Settings...');
    // TODO: Implement settings dialog
  }

  refreshDesktop() {
    this.hideDesktopContextMenu();
    console.log('Refreshing desktop...');
  }

  // Search methods
  openSearchWindow() {
    this.showSearchWindow.set(true);
  }

  closeSearchWindow() {
    this.showSearchWindow.set(false);
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchSuggestions = false;
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.performSearch();
  }

  performSearch() {
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      this.showSearchSuggestions = false;
      return;
    }

    // Mock search results - in a real app, this would be API calls
    this.searchResults = [
      { type: 'app', name: 'Calculator', icon: 'pi-calculator', action: 'calculator' },
      { type: 'app', name: 'My Information', icon: 'pi-user', action: 'my-info' },
      { type: 'app', name: 'My Page', icon: 'pi-globe', action: 'my-page' },
      { type: 'app', name: 'Love', icon: 'pi-heart', action: 'love' },
      { type: 'app', name: 'Explorer', icon: 'pi-folder', action: 'explorer' },
      { type: 'web', name: 'Google Search', icon: 'pi-search', url: `https://www.google.com/search?q=${encodeURIComponent(this.searchQuery)}` },
      { type: 'web', name: 'Wikipedia', icon: 'pi-book', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(this.searchQuery)}` }
    ].filter(item => 
      item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    this.showSearchSuggestions = this.searchResults.length > 0;
  }

  selectSearchResult(result: any) {
    if (result.type === 'app') {
      this.openApp(result.action);
    } else if (result.type === 'web') {
      window.open(result.url, '_blank');
    }
    this.closeSearchWindow();
  }

  // Browser methods
  navigateToUrl(event: any) {
    const url = event.target.value.trim();
    if (url) {
      this.isLoading = true;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // If it's not a URL, treat as search
        this.currentUrl = `https://www.google.com/search?q=${ encodeURIComponent(url) }`;
      } else {
        this.currentUrl = url;
      }
      this.canGoBack = true;

      // Check if current URL is bookmarked
      this.isBookmarked = this.bookmarks.some(b => b.url === this.currentUrl);

      // Force iframe reload with new URL
      setTimeout(() => {
        this.reloadIframe();
      }, 100);

      // Simulate loading time
      setTimeout(() => {
        this.isLoading = false;
      }, 1000);
    }
  }

  selectUrl(event: any) {
    event.target.select();
  }

  goBack() {
    if (this.canGoBack) {
      console.log('Going back');
      this.canGoForward = true;
      // In a real browser, this would navigate to previous page
      alert('Going back - this is a demo browser');
    }
  }

  goForward() {
    if (this.canGoForward) {
      console.log('Going forward');
      // In a real browser, this would navigate to next page
      alert('Going forward - this is a demo browser');
    }
  }

  refreshPage() {
    console.log('Refreshing page...');
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  goHome() {
    this.currentUrl = 'https://www.google.com';
    this.isLoading = true;
    this.isBookmarked = this.bookmarks.some(b => b.url === this.currentUrl);

    // Force iframe reload with home URL
    setTimeout(() => {
      this.reloadIframe();
    }, 100);

    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  toggleBookmark() {
    this.isBookmarked = !this.isBookmarked;
    if (this.isBookmarked) {
      console.log('Bookmarked:', this.currentUrl);
    } else {
      console.log('Removed bookmark:', this.currentUrl);
    }
  }

  toggleBookmarks() {
    this.showBookmarksBar = !this.showBookmarksBar;
  }

  toggleBrowserMenu() {
    this.showBrowserMenu = !this.showBrowserMenu;
  }

  navigateToBookmark(bookmark: any) {
    console.log('Navigating to bookmark:', bookmark.name, bookmark.url);
    this.currentUrl = bookmark.url;
    this.isLoading = true;
    this.canGoBack = true;

    // Check if this bookmark is already bookmarked
    this.isBookmarked = this.bookmarks.some(b => b.url === bookmark.url);

    // Force iframe reload with new URL
    setTimeout(() => {
      this.reloadIframe();
    }, 100);

    // Simulate loading time
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  addBookmark() {
    const name = prompt('Bookmark name:', 'New Bookmark');
    if (name) {
      this.bookmarks.push({ name, url: this.currentUrl });
    }
  }

  newTab() {
    this.showBrowserMenu = false;
    alert('New tab - this is a demo browser');
  }

  newWindow() {
    this.showBrowserMenu = false;
    alert('New window - this is a demo browser');
  }

  openHistory() {
    this.showBrowserMenu = false;
    alert('History - this is a demo browser');
  }

  openDownloads() {
    this.showBrowserMenu = false;
    alert('Downloads - this is a demo browser');
  }

  openBookmarks() {
    this.showBrowserMenu = false;
    alert('Bookmarks manager - this is a demo browser');
  }

  openBrowserSettings() {
    this.showBrowserMenu = false;
    alert('Settings - this is a demo browser');
  }

  openDevTools() {
    this.showBrowserMenu = false;
    alert('Developer tools - this is a demo browser');
  }

  onPageLoad() {
    this.isLoading = false;
    console.log('Page loaded:', this.currentUrl);
  }

  onPageError() {
    this.isLoading = false;
    console.log('Page failed to load:', this.currentUrl);
    // Could show an error message or fallback content here
  }

  // Force iframe to reload when URL changes
  reloadIframe() {
    const iframe = document.querySelector('.content-iframe') as HTMLIFrameElement;
    if (iframe && this._currentUrl()) {
      // Use the raw URL string instead of the SafeResourceUrl to avoid routing conflicts
      const rawUrl = this._currentUrl();
      if (iframe.src !== rawUrl) {
        iframe.src = rawUrl;
      }
    }
  }
}
