import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnDestroy, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

@Component({
  selector: 'app-window',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window.component.html',
  styleUrl: './window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WindowComponent implements OnInit, OnDestroy, OnChanges {
  @Input() title = 'Window';
  @Input() icon = '';
  @Input() statusText = 'Ready';
  @Input() showStatusBar = true; // New property to control status bar visibility
  @Input() initialWidth = 800;
  @Input() initialHeight = 600;
  @Input() initialX = 100;
  @Input() initialY = 100;
  @Input() resizable = true;
  @Input() minimizable = true;
  @Input() maximizable = true;
  @Input() closable = true;
  @Input() isFocused = false;
  @Input() isMinimizedExternal = false;
  @Input() windowId = ''; // Window ID for DOM selection

  // Track previous external minimize state to detect changes
  private previousIsMinimizedExternal = false;

  // Make z-index reactive
  private _zIndex = signal(1000);
  
  @Input() 
  set zIndex(value: number) {
    this._zIndex.set(value);
  }
  
  get zIndex(): number {
    return this._zIndex();
  }

  @Output() onClose = new EventEmitter<void>();
  @Output() onMinimize = new EventEmitter<void>();
  @Output() onMaximize = new EventEmitter<void>();
  @Output() onRestore = new EventEmitter<void>();
  @Output() onFocus = new EventEmitter<void>();

  // Window state using signals
  windowState = signal<WindowState>({
    isMaximized: false,
    isMinimized: false,
    position: { x: this.initialX, y: this.initialY },
    size: { width: this.initialWidth, height: this.initialHeight }
  });

  // Computed CSS variables for positioning (much simpler than inline styles)
  windowCssVars = computed(() => {
    const state = this.windowState();
    return {
      '--window-x': `${state.position.x}px`,
      '--window-y': `${state.position.y}px`,
      '--window-width': `${state.size.width}px`,
      '--window-height': `${state.size.height}px`,
      '--window-z-index': this._zIndex().toString()
    };
  });

  // Simple computed classes
  isMinimized = computed(() => this.windowState().isMinimized || this.isMinimizedExternal);
  isMaximized = computed(() => this.windowState().isMaximized);

  // Make isDragging public for template access
  isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private isResizing = false;
  private resizeDirection = '';
  private resizeStartPos = { x: 0, y: 0 };
  private resizeStartSize = { width: 0, height: 0 };
  private resizeStartWindowPos = { x: 0, y: 0 };
  private animationFrameId: number | null = null;
  private pendingUpdate = false;

  ngOnInit() {
    // Initialize position and size
    this.windowState.update(state => ({
      ...state,
      position: { x: this.initialX, y: this.initialY },
      size: { width: this.initialWidth, height: this.initialHeight }
    }));
    
    // Initialize previous external minimize state
    this.previousIsMinimizedExternal = this.isMinimizedExternal;
  }

  ngOnChanges() {
    // Check if external minimize state changed from true to false
    if (this.previousIsMinimizedExternal && !this.isMinimizedExternal) {
      this.resetMinimizeState();
    }
    
    // Update previous state
    this.previousIsMinimizedExternal = this.isMinimizedExternal;
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    document.removeEventListener('mouseleave', this.onDocumentMouseUp);
  }

  onWindowClick() {
    this.onFocus.emit();
  }

  onTitleBarMouseDown(event: MouseEvent) {
    // Focus the window first
    this.onFocus.emit();
    
    if (this.windowState().isMaximized) return;
    
    this.isDragging = true;
    this.dragOffset = {
      x: event.clientX - this.windowState().position.x,
      y: event.clientY - this.windowState().position.y
    };
    
    // Add global event listeners for smooth dragging
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
    document.addEventListener('mouseleave', this.onDocumentMouseUp);
    
    event.preventDefault();
  }

  private onDocumentMouseMove = (event: MouseEvent) => {
    if (this.isDragging && !this.windowState().isMaximized) {
      // Use requestAnimationFrame for smooth updates
      if (!this.pendingUpdate) {
        this.pendingUpdate = true;
        this.animationFrameId = requestAnimationFrame(() => {
          const newX = event.clientX - this.dragOffset.x;
          const newY = event.clientY - this.dragOffset.y;
          this.updateWindowPosition(newX, newY);
          this.pendingUpdate = false;
        });
      }
    } else if (this.isResizing) {
      // Use requestAnimationFrame for smooth resize too
      if (!this.pendingUpdate) {
        this.pendingUpdate = true;
        this.animationFrameId = requestAnimationFrame(() => {
          this.handleResize(event);
          this.pendingUpdate = false;
        });
      }
    }
  };

  private onDocumentMouseUp = () => {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeDirection = '';
    this.pendingUpdate = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    document.removeEventListener('mouseleave', this.onDocumentMouseUp);
  };

  private updateWindowPosition(x: number, y: number) {
    // Constrain to viewport bounds
    const maxX = window.innerWidth - this.windowState().size.width;
    const maxY = window.innerHeight - 48 - this.windowState().size.height; // Account for taskbar
    
    const constrainedX = Math.max(0, Math.min(x, maxX));
    const constrainedY = Math.max(0, Math.min(y, maxY));
    
    this.windowState.update(state => ({
      ...state,
      position: { x: constrainedX, y: constrainedY }
    }));
  }

  minimize() {
    if (!this.minimizable) return;
    this.windowState.update(state => ({ ...state, isMinimized: true }));
    this.onMinimize.emit();
  }

  maximize() {
    if (!this.maximizable) return;
    this.windowState.update(state => ({ ...state, isMaximized: true }));
    this.onMaximize.emit();
  }

  restore() {
    this.windowState.update(state => ({ 
      ...state, 
      isMaximized: false, 
      isMinimized: false 
    }));
    this.onRestore.emit();
  }

  // Reset minimize state (called externally)
  resetMinimizeState() {
    this.windowState.update(state => ({ 
      ...state, 
      isMinimized: false 
    }));
  }

  close() {
    if (!this.closable) return;
    this.onClose.emit();
  }

  onTitleBarDoubleClick() {
    if (this.windowState().isMaximized) {
      this.restore();
    } else {
      this.maximize();
    }
  }

  onResizeStart(event: MouseEvent, direction: string) {
    if (!this.resizable || this.windowState().isMaximized) return;
    
    this.isResizing = true;
    this.resizeDirection = direction;
    this.resizeStartPos = { x: event.clientX, y: event.clientY };
    this.resizeStartSize = { 
      width: this.windowState().size.width, 
      height: this.windowState().size.height 
    };
    this.resizeStartWindowPos = { 
      x: this.windowState().position.x, 
      y: this.windowState().position.y 
    };
    
    // Add global event listeners for resize
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
    document.addEventListener('mouseleave', this.onDocumentMouseUp);
    
    event.preventDefault();
    event.stopPropagation();
  }

  private handleResize(event: MouseEvent) {
    if (!this.isResizing) return;

    const deltaX = event.clientX - this.resizeStartPos.x;
    const deltaY = event.clientY - this.resizeStartPos.y;
    
    let newWidth = this.resizeStartSize.width;
    let newHeight = this.resizeStartSize.height;
    let newX = this.resizeStartWindowPos.x;
    let newY = this.resizeStartWindowPos.y;

    // Minimum window size
    const minWidth = 200;
    const minHeight = 150;

    // Handle different resize directions
    if (this.resizeDirection.includes('e')) {
      newWidth = Math.max(minWidth, this.resizeStartSize.width + deltaX);
    }
    if (this.resizeDirection.includes('w')) {
      const oldWidth = newWidth;
      newWidth = Math.max(minWidth, this.resizeStartSize.width - deltaX);
      newX = this.resizeStartWindowPos.x + (this.resizeStartSize.width - newWidth);
    }
    if (this.resizeDirection.includes('s')) {
      newHeight = Math.max(minHeight, this.resizeStartSize.height + deltaY);
    }
    if (this.resizeDirection.includes('n')) {
      const oldHeight = newHeight;
      newHeight = Math.max(minHeight, this.resizeStartSize.height - deltaY);
      newY = this.resizeStartWindowPos.y + (this.resizeStartSize.height - newHeight);
    }

    // Constrain to viewport
    const maxWidth = window.innerWidth - newX;
    const maxHeight = window.innerHeight - 48 - newY; // Account for taskbar
    
    newWidth = Math.min(newWidth, maxWidth);
    newHeight = Math.min(newHeight, maxHeight);

    this.windowState.update(state => ({
      ...state,
      size: { width: newWidth, height: newHeight },
      position: { x: newX, y: newY }
    }));
  }
}
