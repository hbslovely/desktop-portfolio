import { Component, signal, computed } from '@angular/core';
import { WindowComponent } from './components/window/window.component';
import { DesktopIconComponent, DesktopIconData } from './components/desktop-icon/desktop-icon.component';
import { CalculatorComponent } from './components/apps/calculator/calculator.component';
import { IframeAppComponent } from './components/apps/iframe-app/iframe-app.component';
import { LoveAppComponent } from './components/apps/love-app/love-app.component';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from "@angular/platform-browser";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ WindowComponent, DesktopIconComponent, CalculatorComponent, IframeAppComponent, LoveAppComponent, CommonModule ],
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
  showClockWindow = signal(false);

  // Window management
  focusedWindow = signal<string | null>(null);
  windowZIndex = signal(1000);

  // Taskbar state
  showStartMenu = signal(false);
  currentTime = '';
  currentDate = '';

  // Clock properties
  clockNumbers = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ];
  hourAngle = 0;
  minuteAngle = 0;
  secondAngle = 0;
  clockMode: 'analog' | 'digital' = 'digital'; // Default to digital mode

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
    }
  ];

  onCloseTestWindow() {
    this.showTestWindow.set(false);
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

  onCloseClockWindow() {
    this.showClockWindow.set(false);
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
    }
  }

  focusWindow(windowId: string) {
    console.log('Focusing window:', windowId);
    this.focusedWindow.set(windowId);
    this.windowZIndex.update(z => z + 1);

    // If window is minimized, restore it
    if (windowId === 'calculator' && this.showTestWindow()) {
      // Calculator window focus logic can be added here if needed
    } else if (windowId === 'my-info' && this.showMyInfoWindow()) {
      // My Info window focus logic can be added here if needed
    } else if (windowId === 'my-page' && this.showMyPageWindow()) {
      // My Page window focus logic can be added here if needed
    } else if (windowId === 'love' && this.showLoveWindow()) {
      // Love window focus logic can be added here if needed
    }
  }

  getWindowZIndex(windowId: string): number {
    return this.focusedWindow() === windowId ? this.windowZIndex() : 1000;
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

  openSettings() {
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
