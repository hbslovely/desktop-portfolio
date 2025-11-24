import { Component, Input, OnInit, signal, computed, HostListener, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileSystemService } from '../../../services/file-system.service';

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss',
})
export class ImageViewerComponent implements OnInit {
  @Input() imagePath = '';
  @Input() imageName = '';
  @ViewChild('imageElement', { static: false }) imageElement!: ElementRef<HTMLImageElement>;
  
  private fileSystemService = inject(FileSystemService);
  
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
  
  // Save dialog states
  showSaveDialog = signal(false);
  saveFileName = signal('');
  savePath = signal('/Pictures');
  availableFolders = ['/Pictures', '/Documents', '/Downloads'];
  
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

  // Save as PNG functionality
  openSaveDialog() {
    if (this.hasError() || this.isLoading()) {
      alert('Không thể lưu ảnh. Vui lòng đợi ảnh tải xong hoặc kiểm tra lại ảnh!');
      return;
    }
    
    // Generate default filename from current image name
    const baseName = this.imageName.split('.')[0] || 'image';
    this.saveFileName.set(`${baseName}.png`);
    this.showSaveDialog.set(true);
  }

  closeSaveDialog() {
    this.showSaveDialog.set(false);
    this.saveFileName.set('');
  }

  async saveAsPNG() {
    const fileName = this.saveFileName().trim();
    const savePath = this.savePath();
    
    if (!fileName) {
      alert('Vui lòng nhập tên file!');
      return;
    }

    if (!fileName.toLowerCase().endsWith('.png')) {
      this.saveFileName.set(fileName + '.png');
    }

    try {
      // Get the image element
      const img = this.imageElement?.nativeElement;
      if (!img) {
        alert('Không thể tải ảnh. Vui lòng thử lại!');
        return;
      }

      // Create a canvas to convert image to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        alert('Không thể tạo canvas. Vui lòng thử lại!');
        return;
      }

      // Set canvas size to match image
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      // Apply transformations if needed
      ctx.save();
      
      // Apply rotation
      if (this.rotation() !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((this.rotation() * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      // Draw the image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Convert canvas to PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png');

      // Save to file system
      const finalPath = `${savePath}/${this.saveFileName()}`;
      await this.fileSystemService.addImageFile({
        fileName: this.saveFileName(),
        path: finalPath,
        imageData: pngDataUrl,
        fileType: 'png'
      });

      // Show success message
      alert(`Đã lưu file PNG thành công!\nĐường dẫn: ${finalPath}`);
      
      // Close dialog
      this.closeSaveDialog();
    } catch (error) {
      console.error('Error saving PNG:', error);
      alert('Có lỗi xảy ra khi lưu file PNG. Vui lòng thử lại!');
    }
  }
}
