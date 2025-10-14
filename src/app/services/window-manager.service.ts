import { Injectable, signal, computed } from '@angular/core';

export interface WindowConfig {
  id: string;
  title: string;
  icon: string;
  component: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  zIndex: number;
  initialWidth: number;
  initialHeight: number;
  initialX: number;
  initialY: number;
  maximizable: boolean;
  statusText?: string;
  data?: any; // Additional data for the window (e.g., file path, content)
}

@Injectable({
  providedIn: 'root'
})
export class WindowManagerService {
  private windows = signal<Map<string, WindowConfig>>(new Map());
  private maxZIndex = signal<number>(1000);
  private focusedWindowId = signal<string | null>(null);

  // Computed values
  windowList = computed(() => Array.from(this.windows().values()));
  openWindows = computed(() => this.windowList().filter(w => !w.isMinimized));
  minimizedWindows = computed(() => this.windowList().filter(w => w.isMinimized));
  focusedWindow = computed(() => {
    const id = this.focusedWindowId();
    return id ? this.windows().get(id) : null;
  });

  // Window operations
  openWindow(config: Partial<WindowConfig> & { id: string; component: string }): void {
    const windows = new Map(this.windows());
    
    // Check if window already exists
    const existingWindow = windows.get(config.id);
    if (existingWindow) {
      // If minimized, restore it
      if (existingWindow.isMinimized) {
        this.restoreWindow(config.id);
      } else {
        this.focusWindow(config.id);
      }
      return;
    }

    // Create new window with defaults
    const newWindow: WindowConfig = {
      id: config.id,
      title: config.title || 'Window',
      icon: config.icon || 'pi pi-window-maximize',
      component: config.component,
      isMinimized: false,
      isMaximized: false,
      isFocused: true,
      zIndex: this.maxZIndex() + 1,
      initialWidth: config.initialWidth || 800,
      initialHeight: config.initialHeight || 600,
      initialX: config.initialX || 100,
      initialY: config.initialY || 100,
      maximizable: config.maximizable !== false,
      statusText: config.statusText,
      data: config.data
    };

    windows.set(config.id, newWindow);
    this.windows.set(windows);
    this.maxZIndex.update(z => z + 1);
    this.focusWindow(config.id);
  }

  closeWindow(id: string): void {
    const windows = new Map(this.windows());
    windows.delete(id);
    this.windows.set(windows);

    // Update focused window
    if (this.focusedWindowId() === id) {
      const remaining = Array.from(windows.values()).filter(w => !w.isMinimized);
      if (remaining.length > 0) {
        // Focus the window with highest z-index
        const topWindow = remaining.reduce((max, w) => w.zIndex > max.zIndex ? w : max);
        this.focusedWindowId.set(topWindow.id);
      } else {
        this.focusedWindowId.set(null);
      }
    }
  }

  minimizeWindow(id: string): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    if (window) {
      window.isMinimized = true;
      window.isFocused = false;
      windows.set(id, window);
      this.windows.set(windows);

      if (this.focusedWindowId() === id) {
        // Focus next available window
        const remaining = Array.from(windows.values()).filter(w => !w.isMinimized);
        if (remaining.length > 0) {
          const topWindow = remaining.reduce((max, w) => w.zIndex > max.zIndex ? w : max);
          this.focusWindow(topWindow.id);
        } else {
          this.focusedWindowId.set(null);
        }
      }
    }
  }

  restoreWindow(id: string): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    if (window) {
      window.isMinimized = false;
      windows.set(id, window);
      this.windows.set(windows);
      this.focusWindow(id);
    }
  }

  maximizeWindow(id: string): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    if (window) {
      window.isMaximized = true;
      windows.set(id, window);
      this.windows.set(windows);
    }
  }

  unmaximizeWindow(id: string): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    if (window) {
      window.isMaximized = false;
      windows.set(id, window);
      this.windows.set(windows);
    }
  }

  focusWindow(id: string): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    
    if (window) {
      // Unfocus all windows
      windows.forEach(w => w.isFocused = false);
      
      // Focus the target window and bring to front
      window.isFocused = true;
      window.zIndex = this.maxZIndex() + 1;
      windows.set(id, window);
      
      this.windows.set(windows);
      this.maxZIndex.update(z => z + 1);
      this.focusedWindowId.set(id);
    }
  }

  getWindow(id: string): WindowConfig | undefined {
    return this.windows().get(id);
  }

  updateWindowData(id: string, data: any): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    if (window) {
      window.data = { ...window.data, ...data };
      windows.set(id, window);
      this.windows.set(windows);
    }
  }

  updateWindowTitle(id: string, title: string): void {
    const windows = new Map(this.windows());
    const window = windows.get(id);
    if (window) {
      window.title = title;
      windows.set(id, window);
      this.windows.set(windows);
    }
  }

  isWindowOpen(id: string): boolean {
    return this.windows().has(id);
  }

  isWindowMinimized(id: string): boolean {
    const window = this.windows().get(id);
    return window?.isMinimized || false;
  }

  isWindowFocused(id: string): boolean {
    return this.focusedWindowId() === id;
  }

  getWindowZIndex(id: string): number {
    const window = this.windows().get(id);
    return window?.zIndex || 1000;
  }

  closeAllWindows(): void {
    this.windows.set(new Map());
    this.focusedWindowId.set(null);
  }

  minimizeAllWindows(): void {
    const windows = new Map(this.windows());
    windows.forEach(window => {
      window.isMinimized = true;
      window.isFocused = false;
    });
    this.windows.set(windows);
    this.focusedWindowId.set(null);
  }

  // Get windows for taskbar (exclude certain windows if needed)
  getTaskbarWindows(): WindowConfig[] {
    return this.windowList().filter(w => {
      // You can filter out certain windows here
      return true;
    });
  }
}

