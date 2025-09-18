import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
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
  styleUrl: './window.component.scss'
})
export class WindowComponent implements OnInit {
  @Input() title = 'Window';
  @Input() icon = '';
  @Input() statusText = 'Ready';
  @Input() initialWidth = 800;
  @Input() initialHeight = 600;
  @Input() initialX = 100;
  @Input() initialY = 100;
  @Input() resizable = true;
  @Input() minimizable = true;
  @Input() maximizable = true;
  @Input() closable = true;
  @Input() zIndex = 1000;
  @Input() isFocused = false;

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

  // Computed styles
  windowStyles = computed(() => {
    const state = this.windowState();
    const baseStyles = {
      zIndex: this.zIndex.toString()
    };
    
    if (state.isMaximized) {
      return {
        ...baseStyles,
        left: '0px',
        top: '0px',
        width: '100vw',
        height: 'calc(100vh - 48px)', // Subtract taskbar height
        transform: 'none'
      };
    }
    return {
      ...baseStyles,
      left: `${state.position.x}px`,
      top: `${state.position.y}px`,
      width: `${state.size.width}px`,
      height: `${state.size.height}px`,
      transform: 'none'
    };
  });

  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private isResizing = false;
  private resizeDirection = '';
  private resizeStartPos = { x: 0, y: 0 };
  private resizeStartSize = { width: 0, height: 0 };
  private resizeStartWindowPos = { x: 0, y: 0 };

  ngOnInit() {
    // Initialize position and size
    this.windowState.update(state => ({
      ...state,
      position: { x: this.initialX, y: this.initialY },
      size: { width: this.initialWidth, height: this.initialHeight }
    }));
  }

  onWindowClick() {
    this.onFocus.emit();
  }

  onTitleBarMouseDown(event: MouseEvent) {
    if (this.windowState().isMaximized) return;
    
    this.isDragging = true;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - this.windowState().position.x,
      y: event.clientY - this.windowState().position.y
    };
    
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent) {
    if (this.isDragging && !this.windowState().isMaximized) {
      this.windowState.update(state => ({
        ...state,
        position: {
          x: event.clientX - this.dragOffset.x,
          y: event.clientY - this.dragOffset.y
        }
      }));
    } else if (this.isResizing) {
      this.handleResize(event);
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeDirection = '';
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
    
    event.preventDefault();
    event.stopPropagation();
    
    // Add global event listeners
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  private onDocumentMouseMove = (event: MouseEvent) => {
    if (this.isResizing) {
      this.handleResize(event);
    }
  };

  private onDocumentMouseUp = (event: MouseEvent) => {
    this.isResizing = false;
    this.isDragging = false;
    this.resizeDirection = '';
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  };

  private handleResize(event: MouseEvent) {
    if (!this.isResizing) return;

    const deltaX = event.clientX - this.resizeStartPos.x;
    const deltaY = event.clientY - this.resizeStartPos.y;
    
    let newWidth = this.resizeStartSize.width;
    let newHeight = this.resizeStartSize.height;
    let newX = this.resizeStartWindowPos.x;
    let newY = this.resizeStartWindowPos.y;

    // Handle different resize directions
    if (this.resizeDirection.includes('e')) {
      newWidth = Math.max(200, this.resizeStartSize.width + deltaX);
    }
    if (this.resizeDirection.includes('w')) {
      newWidth = Math.max(200, this.resizeStartSize.width - deltaX);
      newX = this.resizeStartWindowPos.x + (this.resizeStartSize.width - newWidth);
    }
    if (this.resizeDirection.includes('s')) {
      newHeight = Math.max(150, this.resizeStartSize.height + deltaY);
    }
    if (this.resizeDirection.includes('n')) {
      newHeight = Math.max(150, this.resizeStartSize.height - deltaY);
      newY = this.resizeStartWindowPos.y + (this.resizeStartSize.height - newHeight);
    }

    this.windowState.update(state => ({
      ...state,
      size: { width: newWidth, height: newHeight },
      position: { x: newX, y: newY }
    }));
  }
}
