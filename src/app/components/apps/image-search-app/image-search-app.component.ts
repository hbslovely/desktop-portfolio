import { Component, signal, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  ImageSearchService, 
  ImageRecord, 
  SearchResult, 
  SearchWeights 
} from '../../../services/image-search.service';

type ViewMode = 'gallery' | 'search' | 'results' | 'detail';
type TabMode = 'upload' | 'gallery' | 'search';

@Component({
  selector: 'app-image-search-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-search-app.component.html',
  styleUrl: './image-search-app.component.scss',
})
export class ImageSearchAppComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchFileInput') searchFileInput!: ElementRef<HTMLInputElement>;

  // State
  activeTab = signal<TabMode>('gallery');
  viewMode = signal<ViewMode>('gallery');
  selectedImage = signal<ImageRecord | null>(null);
  searchResults = signal<SearchResult[]>([]);
  searchQueryImage = signal<string | null>(null);
  error = signal<string | null>(null);
  
  // Drag state
  isDragging = signal<boolean>(false);

  // Search weights
  weights = signal<SearchWeights>({
    pHash: 0.25,
    dHash: 0.20,
    aHash: 0.10,
    colorHistogram: 0.20,
    colorMoments: 0.15,
    edgeHistogram: 0.10
  });

  // Algorithm descriptions
  algorithmInfo: Record<string, { name: string; icon: string; description: string }> = {
    pHash: {
      name: 'pHash (Perceptual)',
      icon: '🔍',
      description: 'DCT-based hash, tìm ảnh có cấu trúc tương tự'
    },
    dHash: {
      name: 'dHash (Difference)',
      icon: '📊',
      description: 'So sánh gradient, phát hiện ảnh gần giống'
    },
    aHash: {
      name: 'aHash (Average)',
      icon: '📈',
      description: 'Hash đơn giản dựa trên độ sáng trung bình'
    },
    colorHistogram: {
      name: 'Color Histogram',
      icon: '🎨',
      description: 'Phân bố màu sắc RGB'
    },
    colorMoments: {
      name: 'Color Moments',
      icon: '📉',
      description: 'Thống kê màu: Mean, Std, Skewness'
    },
    edgeHistogram: {
      name: 'Edge Detection',
      icon: '📐',
      description: 'Sobel operator, so sánh hình dạng/cạnh'
    }
  };

  constructor(public imageSearchService: ImageSearchService) {}

  ngOnInit() {
    // Service loads images from IndexedDB on init
  }

  // Tab navigation
  setTab(tab: TabMode) {
    this.activeTab.set(tab);
    this.error.set(null);
    
    if (tab === 'gallery') {
      this.viewMode.set('gallery');
    } else if (tab === 'search') {
      this.viewMode.set('search');
    }
  }

  // File handling
  triggerFileInput() {
    this.fileInput?.nativeElement?.click();
  }

  triggerSearchFileInput() {
    this.searchFileInput?.nativeElement?.click();
  }

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) return;

    this.error.set(null);
    
    try {
      const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      
      if (validFiles.length === 0) {
        this.error.set('Vui lòng chọn file hình ảnh hợp lệ');
        return;
      }

      if (validFiles.length === 1) {
        await this.imageSearchService.addImage(validFiles[0]);
      } else {
        await this.imageSearchService.addMultipleImages(validFiles);
      }
      
      this.setTab('gallery');
    } catch (err: any) {
      this.error.set(`Lỗi: ${err.message || 'Không thể thêm hình ảnh'}`);
    }

    // Reset input
    input.value = '';
  }

  async onSearchFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Vui lòng chọn file hình ảnh');
      return;
    }

    this.error.set(null);

    try {
      // Show preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        this.searchQueryImage.set(e.target?.result as string);
        
        // Search
        const results = await this.imageSearchService.searchByImage(file, this.weights());
        this.searchResults.set(results);
        this.viewMode.set('results');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      this.error.set(`Lỗi: ${err.message || 'Không thể tìm kiếm'}`);
    }

    input.value = '';
  }

  // Drag and drop
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  async onDrop(event: DragEvent, mode: 'upload' | 'search') {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.error.set('Vui lòng thả file hình ảnh');
      return;
    }

    this.error.set(null);

    try {
      if (mode === 'upload') {
        if (imageFiles.length === 1) {
          await this.imageSearchService.addImage(imageFiles[0]);
        } else {
          await this.imageSearchService.addMultipleImages(imageFiles);
        }
        this.setTab('gallery');
      } else if (mode === 'search') {
        const file = imageFiles[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
          this.searchQueryImage.set(e.target?.result as string);
          const results = await this.imageSearchService.searchByImage(file, this.weights());
          this.searchResults.set(results);
          this.viewMode.set('results');
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      this.error.set(`Lỗi: ${err.message}`);
    }
  }

  // Image actions
  viewImage(image: ImageRecord) {
    this.selectedImage.set(image);
    this.viewMode.set('detail');
  }

  async deleteImage(image: ImageRecord, event?: Event) {
    event?.stopPropagation();
    
    if (!confirm(`Xóa "${image.name}"?`)) return;
    
    try {
      await this.imageSearchService.deleteImage(image.id);
      if (this.selectedImage()?.id === image.id) {
        this.selectedImage.set(null);
        this.viewMode.set('gallery');
      }
    } catch (err: any) {
      this.error.set(`Lỗi xóa: ${err.message}`);
    }
  }

  async searchSimilar(image: ImageRecord) {
    this.searchQueryImage.set(image.thumbnail);
    
    try {
      const results = await this.imageSearchService.searchByImageUrl(image.dataUrl, this.weights());
      // Filter out the query image itself
      this.searchResults.set(results.filter(r => r.image.id !== image.id));
      this.viewMode.set('results');
      this.activeTab.set('search');
    } catch (err: any) {
      this.error.set(`Lỗi tìm kiếm: ${err.message}`);
    }
  }

  clearAllImages() {
    if (!confirm('Xóa tất cả hình ảnh trong kho?')) return;
    
    this.imageSearchService.clearAllImages();
    this.selectedImage.set(null);
    this.viewMode.set('gallery');
  }

  // Weight adjustments
  updateWeight(key: keyof SearchWeights, value: number) {
    this.weights.update(w => ({ ...w, [key]: value / 100 }));
  }

  resetWeights() {
    this.weights.set({
      pHash: 0.25,
      dHash: 0.20,
      aHash: 0.10,
      colorHistogram: 0.20,
      colorMoments: 0.15,
      edgeHistogram: 0.10
    });
  }

  // Navigation
  backToGallery() {
    this.viewMode.set('gallery');
    this.selectedImage.set(null);
  }

  backToSearch() {
    this.viewMode.set('search');
    this.searchResults.set([]);
    this.searchQueryImage.set(null);
  }

  // Utilities
  getSimilarityClass(similarity: number): string {
    if (similarity >= 0.8) return 'excellent';
    if (similarity >= 0.6) return 'good';
    if (similarity >= 0.4) return 'moderate';
    return 'low';
  }

  getSimilarityLabel(similarity: number): string {
    if (similarity >= 0.8) return 'Rất giống';
    if (similarity >= 0.6) return 'Tương tự';
    if (similarity >= 0.4) return 'Hơi giống';
    return 'Khác biệt';
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getWeightKeys(): (keyof SearchWeights)[] {
    return ['pHash', 'dHash', 'aHash', 'colorHistogram', 'colorMoments', 'edgeHistogram'];
  }
}
