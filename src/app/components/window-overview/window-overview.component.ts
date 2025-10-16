import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService, WindowConfig } from '../../services/window-manager.service';

@Component({
  selector: 'app-window-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window-overview.component.html',
  styleUrl: './window-overview.component.scss',
})
export class WindowOverviewComponent {
  @Output() onClose = new EventEmitter<void>();
  
  windowManager = inject(WindowManagerService);

  selectWindow(window: WindowConfig) {
    if (window.isMinimized) {
      this.windowManager.restoreWindow(window.id);
    } else {
      this.windowManager.focusWindow(window.id);
    }
    this.onClose.emit();
  }

  closeWindow(event: Event, windowId: string) {
    event.stopPropagation();
    this.windowManager.closeWindow(windowId);
  }

  close() {
    this.onClose.emit();
  }

  closeAllWindows() {
    if (confirm('Close all windows?')) {
      this.windowManager.closeAllWindows();
      this.onClose.emit();
    }
  }

  minimizeAllWindows() {
    this.windowManager.minimizeAllWindows();
    this.onClose.emit();
  }
}
