import { Component, Input, Output, EventEmitter, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DesktopIconData {
  id: string;
  name: string;
  icon: string;
  type: 'application' | 'folder' | 'file';
  position: { x: number; y: number };
  isDeleted?: boolean;
}

export interface IconContextMenuEvent {
  action: 'rename' | 'delete' | 'open' | 'restore';
  icon: DesktopIconData;
}

@Component({
  selector: 'app-desktop-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './desktop-icon.component.html',
  styleUrl: './desktop-icon.component.scss'
})
export class DesktopIconComponent implements OnDestroy {
  @Input() iconData!: DesktopIconData;
  @Input() isSelected = false;
  @Input() isInTrash = false;
  
  @Output() onDoubleClick = new EventEmitter<DesktopIconData>();
  @Output() onContextMenu = new EventEmitter<IconContextMenuEvent>();
  @Output() onDragEnd = new EventEmitter<{ icon: DesktopIconData; position: { x: number; y: number } }>();
  @Output() onSelect = new EventEmitter<DesktopIconData>();

  // Dragging state
  isDragging = signal(false);
  dragOffset = signal({ x: 0, y: 0 });
  dragPosition = signal({ x: 0, y: 0 });
  dragStarted = signal(false);
  dragThreshold = 5; // pixels to move before considering it a drag
  
  // Context menu state
  showContextMenu = signal(false);
  contextMenuPosition = signal({ x: 0, y: 0 });
  
  // Rename state
  isRenaming = signal(false);
  newName = signal('');

  // Computed position - use drag position during dragging for smooth performance
  iconPosition = computed(() => {
    if (this.isDragging()) {
      return {
        left: `${this.dragPosition().x}px`,
        top: `${this.dragPosition().y}px`,
        transform: 'none',
        zIndex: '1000'
      };
    }
    return {
      left: `${this.iconData.position.x}px`,
      top: `${this.iconData.position.y}px`,
      transform: 'none',
      zIndex: 'auto'
    };
  });

  onIconClick() {
    this.onSelect.emit(this.iconData);
  }

  onIconDoubleClick() {
    // Prevent double-click if we just finished dragging or are renaming
    if (!this.isRenaming() && !this.dragStarted()) {
      console.log('Double-click detected on:', this.iconData.name);
      this.onDoubleClick.emit(this.iconData);
    }
  }

  onIconMouseDown(event: MouseEvent) {
    if (event.button === 0) { // Left click
      this.dragStarted.set(false); // Reset drag started flag
      this.dragOffset.set({
        x: event.clientX - this.iconData.position.x,
        y: event.clientY - this.iconData.position.y
      });
      // Initialize drag position
      this.dragPosition.set({
        x: this.iconData.position.x,
        y: this.iconData.position.y
      });
      
      // Add global mouse event listeners for potential dragging
      document.addEventListener('mousemove', this.onDocumentMouseMove);
      document.addEventListener('mouseup', this.onDocumentMouseUp);
      
      // Don't prevent default here to allow double-click to work
    }
  }

  private onDocumentMouseMove = (event: MouseEvent) => {
    // Check if we've moved beyond the drag threshold
    const currentPos = { x: event.clientX, y: event.clientY };
    const startPos = {
      x: this.iconData.position.x + this.dragOffset().x,
      y: this.iconData.position.y + this.dragOffset().y
    };
    
    const distance = Math.sqrt(
      Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2)
    );
    
    // Only start dragging if we've moved beyond the threshold
    if (distance > this.dragThreshold && !this.dragStarted()) {
      this.dragStarted.set(true);
      this.isDragging.set(true);
    }
    
    if (this.isDragging()) {
      const newPosition = {
        x: Math.max(0, Math.min(window.innerWidth - 80, event.clientX - this.dragOffset().x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, event.clientY - this.dragOffset().y))
      };
      
      // Update drag position signal for smooth visual feedback
      this.dragPosition.set(newPosition);
    }
  };

  private onDocumentMouseUp = (event: MouseEvent) => {
    // Clean up global event listeners first
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    
    if (this.isDragging()) {
      this.isDragging.set(false);
      
      // Update the actual icon data position
      const finalPosition = this.dragPosition();
      this.iconData.position = finalPosition;
      
      this.onDragEnd.emit({
        icon: this.iconData,
        position: finalPosition
      });
    }
    
    // Reset drag flags
    this.dragStarted.set(false);
  };

  onMouseMove(event: MouseEvent) {
    // Keep this method for compatibility but don't use it for dragging
    // Dragging is now handled by document event listeners for better performance
  }

  onMouseUp(event: MouseEvent) {
    // Keep this method for compatibility but don't use it for dragging
    // Dragging is now handled by document event listeners for better performance
  }

  onIconRightClick(event: MouseEvent) {
    event.preventDefault();
    this.showContextMenu.set(true);
    this.contextMenuPosition.set({
      x: event.clientX,
      y: event.clientY
    });
  }

  onContextMenuAction(action: 'rename' | 'delete' | 'open' | 'restore') {
    this.showContextMenu.set(false);
    
    if (action === 'rename') {
      this.startRename();
    } else {
      this.onContextMenu.emit({ action, icon: this.iconData });
    }
  }

  startRename() {
    this.isRenaming.set(true);
    this.newName.set(this.iconData.name);
  }

  finishRename() {
    if (this.newName().trim()) {
      this.iconData.name = this.newName().trim();
      this.onContextMenu.emit({ action: 'rename', icon: this.iconData });
    }
    this.isRenaming.set(false);
  }

  cancelRename() {
    this.isRenaming.set(false);
    this.newName.set(this.iconData.name);
  }

  onRenameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.newName.set(target.value || '');
  }

  onRenameKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.finishRename();
    } else if (event.key === 'Escape') {
      this.cancelRename();
    }
  }

  hideContextMenu() {
    this.showContextMenu.set(false);
  }

  ngOnDestroy() {
    // Clean up event listeners to prevent memory leaks
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  }
}
