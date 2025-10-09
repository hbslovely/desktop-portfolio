import { Component, Input, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss'
})
export class ImageViewerComponent implements OnInit {
  @Input() imagePath = '';
  @Input() imageName = '';
  
  isLoading = signal(true);
  hasError = signal(false);
  errorMessage = signal('');
  
  // Image transformation states
  scale = signal(1);
  rotation = signal(0);
  position = signal({ x: 0, y: 0 });
  
  // UI states
  isDragging = signal(false);
  dragStart = signal({ x: 0, y: 0 });
  initialPosition = signal({ x: 0, y: 0 });
  
  // Computed properties
  imageTransform = computed(() => {
    const pos = this.position();
    const scaleValue = this.scale();
    const rotationValue = this.rotation();
    
    return `translate(${pos.x}px, ${pos.y}px) scale(${scaleValue}) rotate(${rotationValue}deg)`;
  });
  
  canZoomIn = computed(() => this.scale() < 5);
  canZoomOut = computed(() => this.scale() > 0.2);
  
  ngOnInit() {
    this.resetView();
  }
  
  onImageLoad() {
    this.isLoading.set(false);
    this.hasError.set(false);
  }
  
  onImageError() {
    this.isLoading.set(false);
    this.hasError.set(true);
    this.errorMessage.set(`Failed to load ${this.imageName}`);
  }
  
  // Zoom controls
  zoomIn() {
    if (this.canZoomIn()) {
      this.scale.update(s => Math.min(s + 0.25, 5));
    }
  }
  
  zoomOut() {
    if (this.canZoomOut()) {
      this.scale.update(s => Math.max(s - 0.25, 0.2));
    }
  }
  
  resetZoom() {
    this.scale.set(1);
    this.position.set({ x: 0, y: 0 });
  }
  
  fitToWindow() {
    // This would ideally calculate the best fit based on container size
    // For now, we'll just reset to 1:1
    this.resetZoom();
  }
  
  // Rotation controls
  rotateLeft() {
    this.rotation.update(r => r - 90);
  }
  
  rotateRight() {
    this.rotation.update(r => r + 90);
  }
  
  resetRotation() {
    this.rotation.set(0);
  }
  
  // Reset all transformations
  resetView() {
    this.scale.set(1);
    this.rotation.set(0);
    this.position.set({ x: 0, y: 0 });
  }
  
  // Mouse wheel zoom
  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent) {
    event.preventDefault();
    
    if (event.deltaY < 0 && this.canZoomIn()) {
      this.zoomIn();
    } else if (event.deltaY > 0 && this.canZoomOut()) {
      this.zoomOut();
    }
  }
  
  // Drag functionality
  onMouseDown(event: MouseEvent) {
    if (event.button === 0) { // Left click only
      this.isDragging.set(true);
      this.dragStart.set({ x: event.clientX, y: event.clientY });
      this.initialPosition.set(this.position());
      event.preventDefault();
    }
  }
  
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isDragging()) {
      const dragStart = this.dragStart();
      const initialPos = this.initialPosition();
      
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      
      this.position.set({
        x: initialPos.x + deltaX,
        y: initialPos.y + deltaY
      });
    }
  }
  
  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    this.isDragging.set(false);
  }
  
  // Double-click to reset zoom
  onDoubleClick() {
    this.resetZoom();
  }
  
  // Get file extension for display
  getFileExtension(): string {
    if (!this.imageName) return '';
    const parts = this.imageName.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
  }
}
