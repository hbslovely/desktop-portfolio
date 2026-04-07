import { Component, signal, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ImageSearchService,
  ImageRecord,
  SearchResult,
  SearchWeights,
  MatchReason,
  LearnedWeights
} from '../../../services/image-search.service';

type ViewMode = 'gallery' | 'search' | 'results' | 'detail' | 'result-detail';
type TabMode = 'upload' | 'gallery' | 'search';

export interface UploadFileItem {
  file: File;
  name: string;
  size: number;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

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
  selectedResult = signal<SearchResult | null>(null);
  searchResults = signal<SearchResult[]>([]);
  searchQueryImage = signal<string | null>(null);
  error = signal<string | null>(null);

  // Drag state
  isDragging = signal<boolean>(false);

  // Upload dialog state
  showUploadDialog = signal<boolean>(false);
  uploadFiles = signal<UploadFileItem[]>([]);
  isUploading = signal<boolean>(false);

  // Search weights - Matching service default weights with CBIR algorithms
  weights = signal<SearchWeights>({
    pHash: 0.12,
    dHash: 0.10,
    aHash: 0.03,
    colorHistogramRGB: 0.08,
    colorHistogramHSV: 0.10,
    colorMoments: 0.07,
    edgeHistogram: 0.07,
    lbpHistogram: 0.06,
    huMoments: 0.05,
    // CBIR Advanced
    colorLayout: 0.10,
    hogDescriptor: 0.08,
    gaborFeatures: 0.06,
    glcmFeatures: 0.05,
    spatialHistogram: 0.03
  });

  // Search settings
  maxResults = signal<number>(10);
  minSimilarity = signal<number>(0); // 0 = show all, 0.3 = 30% min, etc.

  // Similarity threshold options
  similarityThresholds = [
    { value: 0, label: 'Tất cả' },
    { value: 0.2, label: '≥ 20%' },
    { value: 0.3, label: '≥ 30%' },
    { value: 0.4, label: '≥ 40%' },
    { value: 0.5, label: '≥ 50%' },
    { value: 0.6, label: '≥ 60%' },
    { value: 0.7, label: '≥ 70%' }
  ];

  // Max results options
  maxResultsOptions = [5, 10, 20, 50];

  // Show advanced weights
  showAdvancedWeights = signal<boolean>(false);

  // Feedback state
  feedbackGiven = signal<Map<string, boolean>>(new Map()); // resultId -> isRelevant
  showLearningPanel = signal<boolean>(false);
  currentQueryId = signal<string>('');

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

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (validFiles.length === 0) {
      this.error.set('Vui lòng chọn file hình ảnh hợp lệ');
      input.value = '';
      return;
    }

    // Prepare file items with previews
    await this.prepareUploadFiles(validFiles);
    this.showUploadDialog.set(true);

    input.value = '';
  }

  private async prepareUploadFiles(files: File[]): Promise<void> {
    const items: UploadFileItem[] = [];

    for (const file of files) {
      const preview = await this.createPreview(file);
      items.push({
        file,
        name: file.name,
        size: file.size,
        preview,
        status: 'pending',
        progress: 0
      });
    }

    this.uploadFiles.set(items);
  }

  private createPreview(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  async startUpload() {
    if (this.isUploading()) return;

    this.isUploading.set(true);
    const files = this.uploadFiles();

    for (let i = 0; i < files.length; i++) {
      const item = files[i];

      // Update status to processing
      this.updateFileStatus(i, 'processing', 0);

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          const current = this.uploadFiles()[i];
          if (current.status === 'processing' && current.progress < 90) {
            this.updateFileProgress(i, current.progress + 10);
          }
        }, 100);

        await this.imageSearchService.addImage(item.file);

        clearInterval(progressInterval);
        this.updateFileStatus(i, 'completed', 100);
      } catch (err: any) {
        this.updateFileStatus(i, 'error', 0, err.message || 'Lỗi xử lý');
      }
    }

    this.isUploading.set(false);
  }

  private updateFileStatus(index: number, status: UploadFileItem['status'], progress: number, error?: string) {
    this.uploadFiles.update(files => {
      const updated = [...files];
      updated[index] = { ...updated[index], status, progress, error };
      return updated;
    });
  }

  private updateFileProgress(index: number, progress: number) {
    this.uploadFiles.update(files => {
      const updated = [...files];
      updated[index] = { ...updated[index], progress };
      return updated;
    });
  }

  removeUploadFile(index: number) {
    if (this.isUploading()) return;
    this.uploadFiles.update(files => files.filter((_, i) => i !== index));

    if (this.uploadFiles().length === 0) {
      this.closeUploadDialog();
    }
  }

  closeUploadDialog() {
    if (this.isUploading()) return;
    this.showUploadDialog.set(false);
    this.uploadFiles.set([]);

    // Go to gallery if files were uploaded
    const hasCompleted = this.uploadFiles().some(f => f.status === 'completed');
    if (hasCompleted) {
      this.setTab('gallery');
    }
  }

  finishUpload() {
    this.showUploadDialog.set(false);
    this.uploadFiles.set([]);
    this.setTab('gallery');
  }

  getCompletedCount(): number {
    return this.uploadFiles().filter(f => f.status === 'completed').length;
  }

  getErrorCount(): number {
    return this.uploadFiles().filter(f => f.status === 'error').length;
  }

  getPendingCount(): number {
    return this.uploadFiles().filter(f => f.status === 'pending' || f.status === 'processing').length;
  }

  getOverallProgress(): number {
    const files = this.uploadFiles();
    if (files.length === 0) return 0;

    const totalProgress = files.reduce((sum, f) => {
      if (f.status === 'completed') return sum + 100;
      if (f.status === 'error') return sum + 100; // Count errors as "done"
      return sum + f.progress;
    }, 0);

    return Math.round(totalProgress / files.length);
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
      const reader = new FileReader();
      reader.onload = async (e) => {
        this.searchQueryImage.set(e.target?.result as string);

        // Use learned weights if available
        this.currentQueryId.set(`query_${Date.now()}`);
        this.feedbackGiven.set(new Map());

        const optimalWeights = this.imageSearchService.getOptimalWeights();
        const results = await this.imageSearchService.searchByImage(file, optimalWeights);
        this.searchResults.set(this.filterResults(results));
        this.viewMode.set('results');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      this.error.set(`Lỗi: ${err.message || 'Không thể tìm kiếm'}`);
    }

    input.value = '';
  }

  // Filter results based on settings
  private filterResults(results: SearchResult[]): SearchResult[] {
    let filtered = [...results]; // Copy to avoid mutating original

    // 0. Filter out NaN or invalid similarity scores
    filtered = filtered.filter(r => 
      r.similarity != null && 
      !isNaN(r.similarity) && 
      isFinite(r.similarity)
    );

    // 1. Filter by minimum similarity threshold
    if (this.minSimilarity() > 0) {
      filtered = filtered.filter(r => r.similarity >= this.minSimilarity());
    }

    // 2. SORT by similarity (descending - highest first)
    filtered.sort((a, b) => b.similarity - a.similarity);

    // 3. Apply limit AFTER sorting - chỉ lấy top N kết quả giống nhất
    return filtered.slice(0, this.maxResults());
  }

  // Update settings
  setMaxResults(value: number) {
    this.maxResults.set(value);
    // Re-filter current results if any
    if (this.searchResults().length > 0) {
      this.reapplyFilters();
    }
  }

  setMinSimilarity(value: number) {
    this.minSimilarity.set(value);
    // Re-filter current results if any
    if (this.searchResults().length > 0) {
      this.reapplyFilters();
    }
  }

  private allResults: SearchResult[] = []; // Store all results before filtering

  private async reapplyFilters() {
    // Re-run search with current filters
    const queryImage = this.searchQueryImage();
    if (queryImage) {
      const optimalWeights = this.imageSearchService.getOptimalWeights();
      const results = await this.imageSearchService.searchByImageUrl(queryImage, optimalWeights);
      this.searchResults.set(this.filterResults(results));
    }
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

    if (mode === 'upload') {
      await this.prepareUploadFiles(imageFiles);
      this.showUploadDialog.set(true);
    } else if (mode === 'search') {
      const file = imageFiles[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        this.searchQueryImage.set(e.target?.result as string);
        const results = await this.imageSearchService.searchByImage(file, this.weights());
        // Sort và filter kết quả - đảm bảo giống nhất ở đầu
        this.searchResults.set(this.filterResults(results));
        this.viewMode.set('results');
      };
      reader.readAsDataURL(file);
    }
  }

  // Image actions
  viewImage(image: ImageRecord) {
    this.selectedImage.set(image);
    this.viewMode.set('detail');
  }

  viewResultDetail(result: SearchResult) {
    this.selectedResult.set(result);
    this.viewMode.set('result-detail');
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
      // Use learned weights if available
      this.currentQueryId.set(`query_${Date.now()}`);
      this.feedbackGiven.set(new Map());

      const optimalWeights = this.imageSearchService.getOptimalWeights();
      const results = await this.imageSearchService.searchByImageUrl(image.dataUrl, optimalWeights);
      // Exclude self and apply filters
      const filtered = this.filterResults(results.filter(r => r.image.id !== image.id));
      this.searchResults.set(filtered);
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
    this.weights.set(this.imageSearchService.defaultWeights);
  }

  toggleAdvancedWeights() {
    this.showAdvancedWeights.update(v => !v);
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

  backToResults() {
    this.viewMode.set('results');
    this.selectedResult.set(null);
  }

  // Utilities
  getSimilarityClass(similarity: number): string {
    if (similarity >= 0.75) return 'excellent';
    if (similarity >= 0.55) return 'good';
    if (similarity >= 0.35) return 'moderate';
    return 'low';
  }

  getSimilarityLabel(similarity: number): string {
    if (similarity >= 0.75) return 'Rất giống';
    if (similarity >= 0.55) return 'Tương tự';
    if (similarity >= 0.35) return 'Hơi giống';
    return 'Khác biệt';
  }

  getReasonClass(reason: MatchReason): string {
    return reason.level;
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
    return this.imageSearchService.getWeightKeys();
  }

  getAlgorithmMeta(key: string) {
    return this.imageSearchService.algorithmMeta[key];
  }

  getTopReasons(reasons: MatchReason[], limit: number = 3): MatchReason[] {
    return reasons.slice(0, limit);
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      structure: '🏗️',
      color: '🎨',
      shape: '📐',
      texture: '🧩'
    };
    return icons[category] || '📊';
  }

  groupReasonsByCategory(reasons: MatchReason[]): Map<string, MatchReason[]> {
    const groups = new Map<string, MatchReason[]>();

    for (const reason of reasons) {
      const meta = this.imageSearchService.algorithmMeta[
        Object.keys(this.imageSearchService.algorithmMeta).find(
          k => this.imageSearchService.algorithmMeta[k].name === reason.algorithm
        ) || ''
      ];
      const category = meta?.category || 'other';

      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(reason);
    }

    return groups;
  }

  getCategoryName(category: string): string {
    const names: Record<string, string> = {
      structure: 'Cấu trúc',
      color: 'Màu sắc',
      shape: 'Hình dạng',
      texture: 'Kết cấu'
    };
    return names[category] || category;
  }

  // ==================== FEEDBACK METHODS ====================

  async giveFeedback(result: SearchResult, isRelevant: boolean) {
    const queryId = this.currentQueryId() || `query_${Date.now()}`;

    await this.imageSearchService.submitFeedback(queryId, result, isRelevant);

    // Track which results have been given feedback
    this.feedbackGiven.update(map => {
      const newMap = new Map(map);
      newMap.set(result.image.id, isRelevant);
      return newMap;
    });
  }

  hasFeedback(resultId: string): boolean {
    return this.feedbackGiven().has(resultId);
  }

  getFeedbackValue(resultId: string): boolean | undefined {
    return this.feedbackGiven().get(resultId);
  }

  toggleLearningPanel() {
    this.showLearningPanel.update(v => !v);
  }

  async resetLearning() {
    if (!confirm('Xóa tất cả dữ liệu học? Hệ thống sẽ quay về trọng số mặc định.')) return;

    await this.imageSearchService.resetLearning();
    this.feedbackGiven.set(new Map());
  }

  useLearnedWeights() {
    const learned = this.imageSearchService.learnedWeights();
    if (learned) {
      this.weights.set(learned.weights);
    }
  }

  useDefaultWeights() {
    this.weights.set(this.imageSearchService.defaultWeights);
  }

  getLearnedWeights(): LearnedWeights | null {
    return this.imageSearchService.learnedWeights();
  }

  getFeedbackStats() {
    return this.imageSearchService.getFeedbackStats();
  }

  // Update search to use optimal weights and set query ID
  async performSearchWithLearning(file: File) {
    this.currentQueryId.set(`query_${Date.now()}`);
    this.feedbackGiven.set(new Map()); // Reset feedback for new search

    // Use learned weights if available and learning is enabled
    const optimalWeights = this.imageSearchService.isLearningEnabled()
      ? this.imageSearchService.getOptimalWeights()
      : this.weights();

    const results = await this.imageSearchService.searchByImage(file, optimalWeights);
    // Sort và filter kết quả - đảm bảo giống nhất ở đầu
    this.searchResults.set(this.filterResults(results));
    this.viewMode.set('results');
  }
}
