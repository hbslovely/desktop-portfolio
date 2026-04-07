import { Injectable, signal } from '@angular/core';

/**
 * Image Search Service using Content-Based Image Retrieval (CBIR) algorithms
 * No AI/API required - runs entirely in browser using classical Computer Vision
 * 
 * ========== BASIC ALGORITHMS ==========
 * 1. Perceptual Hash (pHash) - DCT-based, good for similar images
 * 2. Difference Hash (dHash) - Gradient-based, fast
 * 3. Average Hash (aHash) - Simple but effective
 * 4. Color Histogram RGB - RGB distribution comparison
 * 5. Color Histogram HSV - Better for perceptual color matching
 * 6. Color Moments - Statistical color features
 * 7. Edge Detection - Sobel operator for shape matching
 * 8. LBP (Local Binary Pattern) - Texture analysis
 * 9. Hu Moments - Shape descriptors (rotation/scale invariant)
 * 
 * ========== CBIR ADVANCED ALGORITHMS ==========
 * 10. Color Layout Descriptor (MPEG-7 like) - Spatial color distribution
 * 11. HOG (Histogram of Oriented Gradients) - Object/shape recognition
 * 12. Gabor Filters - Multi-scale, multi-orientation texture analysis
 * 13. GLCM (Gray Level Co-occurrence Matrix) - Texture properties
 * 14. Spatial Histogram - Region-based color distribution
 */

export interface ImageRecord {
  id: string;
  name: string;
  dataUrl: string;
  thumbnail: string;
  width: number;
  height: number;
  size: number;
  addedAt: Date;
  // Feature vectors - Basic
  pHash: string;
  dHash: string;
  aHash: string;
  colorHistogramRGB: number[];
  colorHistogramHSV: number[];
  colorMoments: ColorMoments;
  edgeHistogram: number[];
  lbpHistogram: number[];
  huMoments: number[];
  dominantColors: string[];
  aspectRatio: number;
  brightness: number;
  contrast: number;
  // CBIR Advanced Features
  colorLayout: number[];        // Spatial color distribution (block-based)
  hogDescriptor: number[];      // Histogram of Oriented Gradients
  gaborFeatures: number[];      // Gabor filter responses
  glcmFeatures: GLCMFeatures;   // Gray Level Co-occurrence Matrix
  spatialHistogram: number[];   // Grid-based color histogram
}

export interface GLCMFeatures {
  contrast: number;
  dissimilarity: number;
  homogeneity: number;
  energy: number;
  correlation: number;
  entropy: number;
}

export interface ColorMoments {
  // For each channel (R, G, B) or (H, S, V)
  mean: [number, number, number];
  std: [number, number, number];
  skewness: [number, number, number];
}

export interface MatchReason {
  algorithm: string;
  score: number;
  weight: number;
  contribution: number;
  description: string;
  icon: string;
  level: 'excellent' | 'good' | 'moderate' | 'low';
}

export interface SearchResult {
  image: ImageRecord;
  similarity: number;
  scores: {
    pHash: number;
    dHash: number;
    aHash: number;
    colorHistogramRGB: number;
    colorHistogramHSV: number;
    colorMoments: number;
    edgeHistogram: number;
    lbpHistogram: number;
    huMoments: number;
    // CBIR Advanced
    colorLayout: number;
    hogDescriptor: number;
    gaborFeatures: number;
    glcmFeatures: number;
    spatialHistogram: number;
  };
  matchReasons: MatchReason[];
  primaryReason: string;
}

export interface SearchWeights {
  pHash: number;
  dHash: number;
  aHash: number;
  colorHistogramRGB: number;
  colorHistogramHSV: number;
  colorMoments: number;
  edgeHistogram: number;
  lbpHistogram: number;
  huMoments: number;
  // CBIR Advanced
  colorLayout: number;
  hogDescriptor: number;
  gaborFeatures: number;
  glcmFeatures: number;
  spatialHistogram: number;
}

const DB_NAME = 'ImageSearchDB';
const DB_VERSION = 4; // Updated for CBIR features
const STORE_NAME = 'images';
const FEEDBACK_STORE = 'feedback';
const SETTINGS_STORE = 'settings';

export interface FeedbackRecord {
  id: string;
  queryImageId: string; // ID or hash of query image
  resultImageId: string;
  isRelevant: boolean; // true = correct match, false = incorrect
  similarity: number;
  scores: SearchResult['scores'];
  timestamp: Date;
}

export interface LearnedWeights {
  weights: SearchWeights;
  feedbackCount: number;
  lastUpdated: Date;
  accuracy: number; // Estimated accuracy based on feedback
}

@Injectable({
  providedIn: 'root'
})
export class ImageSearchService {
  // State
  images = signal<ImageRecord[]>([]);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingStatus = signal<string>('');
  
  // Feedback & Learning state
  feedbackHistory = signal<FeedbackRecord[]>([]);
  learnedWeights = signal<LearnedWeights | null>(null);
  isLearningEnabled = signal<boolean>(true);

  // Default search weights - optimized for better results with CBIR
  defaultWeights: SearchWeights = {
    pHash: 0.12,
    dHash: 0.10,
    aHash: 0.03,
    colorHistogramRGB: 0.08,
    colorHistogramHSV: 0.10,
    colorMoments: 0.07,
    edgeHistogram: 0.07,
    lbpHistogram: 0.06,
    huMoments: 0.05,
    // CBIR Advanced - more emphasis
    colorLayout: 0.10,      // Spatial color distribution
    hogDescriptor: 0.08,    // Shape/Object features
    gaborFeatures: 0.06,    // Multi-scale texture
    glcmFeatures: 0.05,     // Texture properties
    spatialHistogram: 0.03  // Grid-based color
  };

  // Algorithm metadata for UI
  algorithmMeta: Record<string, { name: string; icon: string; description: string; category: string }> = {
    pHash: {
      name: 'Perceptual Hash',
      icon: '🔍',
      description: 'So sánh cấu trúc tổng thể bằng DCT',
      category: 'structure'
    },
    dHash: {
      name: 'Difference Hash',
      icon: '📊',
      description: 'So sánh gradient giữa các pixel liền kề',
      category: 'structure'
    },
    aHash: {
      name: 'Average Hash',
      icon: '📈',
      description: 'So sánh độ sáng trung bình',
      category: 'structure'
    },
    colorHistogramRGB: {
      name: 'RGB Histogram',
      icon: '🎨',
      description: 'Phân bố màu RGB',
      category: 'color'
    },
    colorHistogramHSV: {
      name: 'HSV Histogram',
      icon: '🌈',
      description: 'Phân bố màu HSV (gần với nhận thức con người)',
      category: 'color'
    },
    colorMoments: {
      name: 'Color Moments',
      icon: '📉',
      description: 'Thống kê màu: Mean, Std, Skewness',
      category: 'color'
    },
    edgeHistogram: {
      name: 'Edge Detection',
      icon: '📐',
      description: 'Phân bố hướng cạnh (Sobel)',
      category: 'shape'
    },
    lbpHistogram: {
      name: 'LBP Texture',
      icon: '🧩',
      description: 'Phân tích kết cấu bề mặt',
      category: 'texture'
    },
    huMoments: {
      name: 'Hu Moments',
      icon: '🔷',
      description: 'Đặc trưng hình dạng (bất biến với xoay/scale)',
      category: 'shape'
    },
    // CBIR Advanced Algorithms
    colorLayout: {
      name: 'Color Layout (CBIR)',
      icon: '🗺️',
      description: 'Phân bố màu theo không gian (chia ô lưới 8x8)',
      category: 'spatial'
    },
    hogDescriptor: {
      name: 'HOG Descriptor',
      icon: '🎯',
      description: 'Histogram hướng gradient - nhận diện đối tượng',
      category: 'shape'
    },
    gaborFeatures: {
      name: 'Gabor Filters',
      icon: '🌀',
      description: 'Lọc đa tỷ lệ, đa hướng - kết cấu phức tạp',
      category: 'texture'
    },
    glcmFeatures: {
      name: 'GLCM Texture',
      icon: '🔬',
      description: 'Ma trận đồng xuất hiện mức xám - phân tích kết cấu',
      category: 'texture'
    },
    spatialHistogram: {
      name: 'Spatial Histogram',
      icon: '📍',
      description: 'Histogram màu theo vùng (4 góc + trung tâm)',
      category: 'spatial'
    }
  };

  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  // ==================== DATABASE ====================

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        this.loadImages();
        this.loadFeedback();
        this.loadLearnedWeights();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Images store
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const imageStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        imageStore.createIndex('addedAt', 'addedAt', { unique: false });
        imageStore.createIndex('name', 'name', { unique: false });

        // Feedback store
        if (db.objectStoreNames.contains(FEEDBACK_STORE)) {
          db.deleteObjectStore(FEEDBACK_STORE);
        }
        const feedbackStore = db.createObjectStore(FEEDBACK_STORE, { keyPath: 'id' });
        feedbackStore.createIndex('queryImageId', 'queryImageId', { unique: false });
        feedbackStore.createIndex('timestamp', 'timestamp', { unique: false });

        // Settings store
        if (db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.deleteObjectStore(SETTINGS_STORE);
        }
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      };
    });
  }

  private async loadImages(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const images = request.result.map((img: any) => ({
        ...img,
        addedAt: new Date(img.addedAt)
      }));
      this.images.set(images.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
    };
  }

  async addImage(file: File, silent: boolean = true): Promise<ImageRecord> {
    if (!silent) {
      this.isProcessing.set(true);
      this.processingProgress.set(0);
      this.processingStatus.set('Đang đọc hình ảnh...');
    }

    try {
      // Read file as data URL
      const dataUrl = await this.fileToDataUrl(file);

      // Create image element
      const img = await this.loadImage(dataUrl);

      // Generate thumbnail
      const thumbnail = this.createThumbnail(img, 200);

      // Extract all features - Basic
      const pHash = this.computePHash(img);
      const dHash = this.computeDHash(img);
      const aHash = this.computeAHash(img);
      const colorHistogramRGB = this.computeColorHistogramRGB(img);
      const colorHistogramHSV = this.computeColorHistogramHSV(img);
      const colorMoments = this.computeColorMoments(img);
      const edgeHistogram = this.computeEdgeHistogram(img);
      const lbpHistogram = this.computeLBPHistogram(img);
      const huMoments = this.computeHuMoments(img);
      const dominantColors = this.extractDominantColors(img, 5);

      // Extract CBIR Advanced features
      const colorLayout = this.computeColorLayout(img);
      const hogDescriptor = this.computeHOGDescriptor(img);
      const gaborFeatures = this.computeGaborFeatures(img);
      const glcmFeatures = this.computeGLCMFeatures(img);
      const spatialHistogram = this.computeSpatialHistogram(img);

      // Calculate image properties
      const { brightness, contrast } = this.computeBrightnessContrast(img);

      // Create record
      const record: ImageRecord = {
        id: this.generateId(),
        name: file.name,
        dataUrl,
        thumbnail,
        width: img.width,
        height: img.height,
        size: file.size,
        addedAt: new Date(),
        pHash,
        dHash,
        aHash,
        colorHistogramRGB,
        colorHistogramHSV,
        colorMoments,
        edgeHistogram,
        lbpHistogram,
        huMoments,
        dominantColors,
        aspectRatio: img.width / img.height,
        brightness,
        contrast,
        // CBIR Advanced
        colorLayout,
        hogDescriptor,
        gaborFeatures,
        glcmFeatures,
        spatialHistogram
      };

      // Save to DB
      await this.saveImage(record);

      // Update state
      this.images.update(images => [record, ...images]);

      return record;
    } finally {
      if (!silent) {
        this.isProcessing.set(false);
        this.processingProgress.set(0);
        this.processingStatus.set('');
      }
    }
  }

  async addMultipleImages(files: File[]): Promise<ImageRecord[]> {
    const results: ImageRecord[] = [];
    for (let i = 0; i < files.length; i++) {
      this.processingStatus.set(`Đang xử lý ${i + 1}/${files.length}: ${files[i].name}`);
      try {
        const record = await this.addImage(files[i]);
        results.push(record);
      } catch (err) {
        console.error(`Failed to process ${files[i].name}:`, err);
      }
    }
    return results;
  }

  private async saveImage(record: ImageRecord): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        ...record,
        addedAt: record.addedAt.toISOString()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImage(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.images.update(images => images.filter(img => img.id !== id));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllImages(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.images.set([]);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SEARCH ====================

  async searchByImage(file: File, weights?: SearchWeights): Promise<SearchResult[]> {
    this.isProcessing.set(true);
    this.processingStatus.set('Đang trích xuất đặc trưng từ ảnh tìm kiếm...');

    try {
      const dataUrl = await this.fileToDataUrl(file);
      const img = await this.loadImage(dataUrl);

      return this.performSearch(img, weights);
    } finally {
      setTimeout(() => {
        this.isProcessing.set(false);
        this.processingStatus.set('');
      }, 300);
    }
  }

  async searchByImageUrl(dataUrl: string, weights?: SearchWeights): Promise<SearchResult[]> {
    this.isProcessing.set(true);
    this.processingStatus.set('Đang phân tích hình ảnh...');

    try {
      const img = await this.loadImage(dataUrl);
      return this.performSearch(img, weights);
    } finally {
      setTimeout(() => {
        this.isProcessing.set(false);
        this.processingStatus.set('');
      }, 300);
    }
  }

  private performSearch(img: HTMLImageElement, weights?: SearchWeights): SearchResult[] {
    // Extract features from query image - Basic
    const queryFeatures = {
      pHash: this.computePHash(img),
      dHash: this.computeDHash(img),
      aHash: this.computeAHash(img),
      colorHistogramRGB: this.computeColorHistogramRGB(img),
      colorHistogramHSV: this.computeColorHistogramHSV(img),
      colorMoments: this.computeColorMoments(img),
      edgeHistogram: this.computeEdgeHistogram(img),
      lbpHistogram: this.computeLBPHistogram(img),
      huMoments: this.computeHuMoments(img),
      // CBIR Advanced
      colorLayout: this.computeColorLayout(img),
      hogDescriptor: this.computeHOGDescriptor(img),
      gaborFeatures: this.computeGaborFeatures(img),
      glcmFeatures: this.computeGLCMFeatures(img),
      spatialHistogram: this.computeSpatialHistogram(img)
    };

    this.processingStatus.set('Đang so sánh với kho ảnh...');

    // Compare with all images in database
    const w = weights || this.defaultWeights;
    const results: SearchResult[] = this.images().map(image => {
      const scores = {
        pHash: this.compareHashes(queryFeatures.pHash, image.pHash),
        dHash: this.compareHashes(queryFeatures.dHash, image.dHash),
        aHash: this.compareHashes(queryFeatures.aHash, image.aHash),
        colorHistogramRGB: this.compareHistograms(queryFeatures.colorHistogramRGB, image.colorHistogramRGB),
        colorHistogramHSV: this.compareHistograms(queryFeatures.colorHistogramHSV, image.colorHistogramHSV),
        colorMoments: this.compareColorMoments(queryFeatures.colorMoments, image.colorMoments),
        edgeHistogram: this.compareHistograms(queryFeatures.edgeHistogram, image.edgeHistogram),
        lbpHistogram: this.compareHistograms(queryFeatures.lbpHistogram, image.lbpHistogram),
        huMoments: this.compareHuMoments(queryFeatures.huMoments, image.huMoments),
        // CBIR Advanced
        colorLayout: this.compareHistograms(queryFeatures.colorLayout, image.colorLayout || []),
        hogDescriptor: this.compareHistograms(queryFeatures.hogDescriptor, image.hogDescriptor || []),
        gaborFeatures: this.compareHistograms(queryFeatures.gaborFeatures, image.gaborFeatures || []),
        glcmFeatures: this.compareGLCMFeatures(queryFeatures.glcmFeatures, image.glcmFeatures),
        spatialHistogram: this.compareHistograms(queryFeatures.spatialHistogram, image.spatialHistogram || [])
      };

      // Helper function to safely get score (default to 0 if NaN)
      const safeScore = (score: number): number => 
        isNaN(score) || !isFinite(score) ? 0 : score;

      // Weighted average with NaN protection
      const similarity = 
        safeScore(scores.pHash) * w.pHash +
        safeScore(scores.dHash) * w.dHash +
        safeScore(scores.aHash) * w.aHash +
        safeScore(scores.colorHistogramRGB) * w.colorHistogramRGB +
        safeScore(scores.colorHistogramHSV) * w.colorHistogramHSV +
        safeScore(scores.colorMoments) * w.colorMoments +
        safeScore(scores.edgeHistogram) * w.edgeHistogram +
        safeScore(scores.lbpHistogram) * w.lbpHistogram +
        safeScore(scores.huMoments) * w.huMoments +
        // CBIR Advanced
        safeScore(scores.colorLayout) * w.colorLayout +
        safeScore(scores.hogDescriptor) * w.hogDescriptor +
        safeScore(scores.gaborFeatures) * w.gaborFeatures +
        safeScore(scores.glcmFeatures) * w.glcmFeatures +
        safeScore(scores.spatialHistogram) * w.spatialHistogram;

      // Generate match reasons
      const matchReasons = this.generateMatchReasons(scores, w);
      const primaryReason = this.determinePrimaryReason(scores, w);

      return { image, similarity, scores, matchReasons, primaryReason };
    });

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    this.processingStatus.set('Hoàn thành!');
    return results;
  }

  private generateMatchReasons(scores: SearchResult['scores'], weights: SearchWeights): MatchReason[] {
    const reasons: MatchReason[] = [];
    const scoreKeys = Object.keys(scores) as (keyof typeof scores)[];

    for (const key of scoreKeys) {
      const score = scores[key];
      const weight = weights[key];
      const contribution = score * weight;
      const meta = this.algorithmMeta[key];

      let level: MatchReason['level'];
      let description: string;

      if (score >= 0.85) {
        level = 'excellent';
        description = this.getExcellentDescription(key, score);
      } else if (score >= 0.65) {
        level = 'good';
        description = this.getGoodDescription(key, score);
      } else if (score >= 0.45) {
        level = 'moderate';
        description = this.getModerateDescription(key, score);
      } else {
        level = 'low';
        description = this.getLowDescription(key, score);
      }

      reasons.push({
        algorithm: meta.name,
        score,
        weight,
        contribution,
        description,
        icon: meta.icon,
        level
      });
    }

    // Sort by contribution (highest first)
    reasons.sort((a, b) => b.contribution - a.contribution);
    return reasons;
  }

  private getExcellentDescription(key: string, score: number): string {
    const descriptions: Record<string, string> = {
      pHash: `Cấu trúc ảnh gần như giống hệt (${(score * 100).toFixed(0)}%)`,
      dHash: `Gradient rất tương đồng (${(score * 100).toFixed(0)}%)`,
      aHash: `Độ sáng phân bố giống nhau (${(score * 100).toFixed(0)}%)`,
      colorHistogramRGB: `Phân bố màu RGB rất giống (${(score * 100).toFixed(0)}%)`,
      colorHistogramHSV: `Màu sắc nhận thức giống nhau (${(score * 100).toFixed(0)}%)`,
      colorMoments: `Đặc trưng màu thống kê trùng khớp (${(score * 100).toFixed(0)}%)`,
      edgeHistogram: `Hình dạng/cạnh rất tương đồng (${(score * 100).toFixed(0)}%)`,
      lbpHistogram: `Kết cấu bề mặt giống nhau (${(score * 100).toFixed(0)}%)`,
      huMoments: `Hình dạng tổng thể trùng khớp (${(score * 100).toFixed(0)}%)`,
      colorLayout: `Phân bố màu không gian gần giống hệt (${(score * 100).toFixed(0)}%)`,
      hogDescriptor: `Đặc trưng đối tượng rất tương đồng (${(score * 100).toFixed(0)}%)`,
      gaborFeatures: `Kết cấu đa tỷ lệ trùng khớp (${(score * 100).toFixed(0)}%)`,
      glcmFeatures: `Thuộc tính kết cấu GLCM giống nhau (${(score * 100).toFixed(0)}%)`,
      spatialHistogram: `Màu theo vùng rất tương đồng (${(score * 100).toFixed(0)}%)`
    };
    return descriptions[key] || `Điểm cao (${(score * 100).toFixed(0)}%)`;
  }

  private getGoodDescription(key: string, score: number): string {
    const descriptions: Record<string, string> = {
      pHash: `Cấu trúc tương tự (${(score * 100).toFixed(0)}%)`,
      dHash: `Gradient có nhiều điểm chung (${(score * 100).toFixed(0)}%)`,
      aHash: `Độ sáng tương đương (${(score * 100).toFixed(0)}%)`,
      colorHistogramRGB: `Tông màu RGB tương tự (${(score * 100).toFixed(0)}%)`,
      colorHistogramHSV: `Màu sắc tương đồng (${(score * 100).toFixed(0)}%)`,
      colorMoments: `Đặc trưng màu gần giống (${(score * 100).toFixed(0)}%)`,
      edgeHistogram: `Hình dạng có nét tương đồng (${(score * 100).toFixed(0)}%)`,
      lbpHistogram: `Texture có điểm giống (${(score * 100).toFixed(0)}%)`,
      huMoments: `Hình dạng có nét chung (${(score * 100).toFixed(0)}%)`,
      colorLayout: `Phân bố màu không gian tương tự (${(score * 100).toFixed(0)}%)`,
      hogDescriptor: `Đặc trưng đối tượng có điểm chung (${(score * 100).toFixed(0)}%)`,
      gaborFeatures: `Kết cấu đa tỷ lệ tương đồng (${(score * 100).toFixed(0)}%)`,
      glcmFeatures: `Thuộc tính kết cấu GLCM gần giống (${(score * 100).toFixed(0)}%)`,
      spatialHistogram: `Màu theo vùng có điểm tương đồng (${(score * 100).toFixed(0)}%)`
    };
    return descriptions[key] || `Điểm khá (${(score * 100).toFixed(0)}%)`;
  }

  private getModerateDescription(key: string, score: number): string {
    const descriptions: Record<string, string> = {
      pHash: `Cấu trúc hơi khác biệt (${(score * 100).toFixed(0)}%)`,
      dHash: `Gradient có sự khác biệt (${(score * 100).toFixed(0)}%)`,
      aHash: `Độ sáng có chênh lệch (${(score * 100).toFixed(0)}%)`,
      colorHistogramRGB: `Màu RGB khác một phần (${(score * 100).toFixed(0)}%)`,
      colorHistogramHSV: `Màu sắc có khác biệt (${(score * 100).toFixed(0)}%)`,
      colorMoments: `Đặc trưng màu khác biệt nhẹ (${(score * 100).toFixed(0)}%)`,
      edgeHistogram: `Hình dạng/cạnh khác một phần (${(score * 100).toFixed(0)}%)`,
      lbpHistogram: `Texture khác biệt (${(score * 100).toFixed(0)}%)`,
      huMoments: `Hình dạng có sự khác biệt (${(score * 100).toFixed(0)}%)`,
      colorLayout: `Phân bố màu không gian khác một phần (${(score * 100).toFixed(0)}%)`,
      hogDescriptor: `Đặc trưng đối tượng có khác biệt (${(score * 100).toFixed(0)}%)`,
      gaborFeatures: `Kết cấu đa tỷ lệ khác biệt nhẹ (${(score * 100).toFixed(0)}%)`,
      glcmFeatures: `Thuộc tính GLCM có sự khác biệt (${(score * 100).toFixed(0)}%)`,
      spatialHistogram: `Màu theo vùng hơi khác (${(score * 100).toFixed(0)}%)`
    };
    return descriptions[key] || `Điểm trung bình (${(score * 100).toFixed(0)}%)`;
  }

  private getLowDescription(key: string, score: number): string {
    const descriptions: Record<string, string> = {
      pHash: `Cấu trúc khác biệt nhiều (${(score * 100).toFixed(0)}%)`,
      dHash: `Gradient rất khác (${(score * 100).toFixed(0)}%)`,
      aHash: `Độ sáng khác biệt (${(score * 100).toFixed(0)}%)`,
      colorHistogramRGB: `Màu RGB khác biệt rõ (${(score * 100).toFixed(0)}%)`,
      colorHistogramHSV: `Màu sắc khác nhau nhiều (${(score * 100).toFixed(0)}%)`,
      colorMoments: `Đặc trưng màu khác biệt (${(score * 100).toFixed(0)}%)`,
      edgeHistogram: `Hình dạng khác biệt nhiều (${(score * 100).toFixed(0)}%)`,
      lbpHistogram: `Texture hoàn toàn khác (${(score * 100).toFixed(0)}%)`,
      huMoments: `Hình dạng không tương đồng (${(score * 100).toFixed(0)}%)`,
      colorLayout: `Phân bố màu không gian khác biệt nhiều (${(score * 100).toFixed(0)}%)`,
      hogDescriptor: `Đặc trưng đối tượng rất khác (${(score * 100).toFixed(0)}%)`,
      gaborFeatures: `Kết cấu đa tỷ lệ khác biệt lớn (${(score * 100).toFixed(0)}%)`,
      glcmFeatures: `Thuộc tính GLCM hoàn toàn khác (${(score * 100).toFixed(0)}%)`,
      spatialHistogram: `Màu theo vùng không tương đồng (${(score * 100).toFixed(0)}%)`
    };
    return descriptions[key] || `Điểm thấp (${(score * 100).toFixed(0)}%)`;
  }

  private determinePrimaryReason(scores: SearchResult['scores'], weights: SearchWeights): string {
    // Find the algorithm with highest contribution
    let maxContribution = 0;
    let primaryKey = 'pHash';

    const scoreKeys = Object.keys(scores) as (keyof typeof scores)[];
    for (const key of scoreKeys) {
      const contribution = scores[key] * weights[key];
      if (contribution > maxContribution && scores[key] >= 0.5) {
        maxContribution = contribution;
        primaryKey = key;
      }
    }

    const score = scores[primaryKey as keyof typeof scores];
    const meta = this.algorithmMeta[primaryKey];

    if (score >= 0.8) {
      return `${meta.icon} Rất giống về ${meta.name.toLowerCase()}`;
    } else if (score >= 0.6) {
      return `${meta.icon} Tương tự về ${meta.name.toLowerCase()}`;
    } else if (score >= 0.4) {
      return `${meta.icon} Hơi giống về ${meta.name.toLowerCase()}`;
    } else {
      return `Không tìm thấy điểm tương đồng rõ ràng`;
    }
  }

  // ==================== PERCEPTUAL HASH (pHash) ====================
  private computePHash(img: HTMLImageElement): string {
    const size = 32;
    const smallSize = 8;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to grayscale matrix
    const gray: number[][] = [];
    for (let y = 0; y < size; y++) {
      gray[y] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        gray[y][x] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      }
    }

    // Apply 2D DCT
    const dct = this.dct2d(gray, size);

    // Extract top-left 8x8 (excluding DC component)
    const dctLowFreq: number[] = [];
    for (let y = 0; y < smallSize; y++) {
      for (let x = 0; x < smallSize; x++) {
        if (x === 0 && y === 0) continue;
        dctLowFreq.push(dct[y][x]);
      }
    }

    // Calculate median
    const sorted = [...dctLowFreq].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Generate hash
    let hash = '';
    for (const val of dctLowFreq) {
      hash += val > median ? '1' : '0';
    }

    return hash;
  }

  private dct2d(matrix: number[][], size: number): number[][] {
    const result: number[][] = [];
    
    const cosines: number[][] = [];
    for (let i = 0; i < size; i++) {
      cosines[i] = [];
      for (let j = 0; j < size; j++) {
        cosines[i][j] = Math.cos((Math.PI / size) * (j + 0.5) * i);
      }
    }

    for (let u = 0; u < size; u++) {
      result[u] = [];
      for (let v = 0; v < size; v++) {
        let sum = 0;
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            sum += matrix[i][j] * cosines[u][i] * cosines[v][j];
          }
        }
        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        result[u][v] = (2 / size) * cu * cv * sum;
      }
    }

    return result;
  }

  // ==================== DIFFERENCE HASH (dHash) ====================
  private computeDHash(img: HTMLImageElement): string {
    const width = 9;
    const height = 8;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    let hash = '';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width - 1; x++) {
        const i1 = (y * width + x) * 4;
        const i2 = (y * width + x + 1) * 4;
        
        const gray1 = 0.299 * pixels[i1] + 0.587 * pixels[i1 + 1] + 0.114 * pixels[i1 + 2];
        const gray2 = 0.299 * pixels[i2] + 0.587 * pixels[i2 + 1] + 0.114 * pixels[i2 + 2];
        
        hash += gray1 < gray2 ? '1' : '0';
      }
    }

    return hash;
  }

  // ==================== AVERAGE HASH (aHash) ====================
  private computeAHash(img: HTMLImageElement): string {
    const size = 8;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const grayValues: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      grayValues.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    const mean = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;

    let hash = '';
    for (const val of grayValues) {
      hash += val >= mean ? '1' : '0';
    }

    return hash;
  }

  // ==================== COLOR HISTOGRAM RGB ====================
  private computeColorHistogramRGB(img: HTMLImageElement, bins: number = 16): number[] {
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const binSize = 256 / bins;
    const histogram = new Array(bins * 3).fill(0);

    for (let i = 0; i < pixels.length; i += 4) {
      const rBin = Math.min(Math.floor(pixels[i] / binSize), bins - 1);
      const gBin = Math.min(Math.floor(pixels[i + 1] / binSize), bins - 1);
      const bBin = Math.min(Math.floor(pixels[i + 2] / binSize), bins - 1);

      histogram[rBin]++;
      histogram[bins + gBin]++;
      histogram[bins * 2 + bBin]++;
    }

    const total = pixels.length / 4;
    return histogram.map(h => h / total);
  }

  // ==================== COLOR HISTOGRAM HSV ====================
  private computeColorHistogramHSV(img: HTMLImageElement): number[] {
    const size = 64;
    const hBins = 18; // 20° per bin
    const sBins = 8;
    const vBins = 8;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const histogram = new Array(hBins + sBins + vBins).fill(0);

    for (let i = 0; i < pixels.length; i += 4) {
      const [h, s, v] = this.rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
      
      const hBin = Math.min(Math.floor(h / (360 / hBins)), hBins - 1);
      const sBin = Math.min(Math.floor(s * sBins), sBins - 1);
      const vBin = Math.min(Math.floor(v * vBins), vBins - 1);

      histogram[hBin]++;
      histogram[hBins + sBin]++;
      histogram[hBins + sBins + vBin]++;
    }

    const total = pixels.length / 4;
    return histogram.map(h => h / total);
  }

  private rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [h * 360, s, v];
  }

  // ==================== COLOR MOMENTS ====================
  private computeColorMoments(img: HTMLImageElement): ColorMoments {
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const r: number[] = [], g: number[] = [], b: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      r.push(pixels[i]);
      g.push(pixels[i + 1]);
      b.push(pixels[i + 2]);
    }

    const calcMoments = (values: number[]): [number, number, number] => {
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const std = Math.sqrt(variance);
      
      const skewness = std === 0 ? 0 : 
        Math.cbrt(values.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / n);
      
      return [mean / 255, std / 255, skewness / 255];
    };

    return {
      mean: [calcMoments(r)[0], calcMoments(g)[0], calcMoments(b)[0]],
      std: [calcMoments(r)[1], calcMoments(g)[1], calcMoments(b)[1]],
      skewness: [calcMoments(r)[2], calcMoments(g)[2], calcMoments(b)[2]]
    };
  }

  // ==================== EDGE HISTOGRAM ====================
  private computeEdgeHistogram(img: HTMLImageElement): number[] {
    const size = 64;
    const bins = 8;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const gray: number[][] = [];
    for (let y = 0; y < size; y++) {
      gray[y] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        gray[y][x] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      }
    }

    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    const histogram = new Array(bins).fill(0);
    let totalMagnitude = 0;

    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[y + ky][x + kx];
            gx += pixel * sobelX[ky + 1][kx + 1];
            gy += pixel * sobelY[ky + 1][kx + 1];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude > 25) {
          let angle = Math.atan2(gy, gx) * 180 / Math.PI;
          if (angle < 0) angle += 360;
          
          const bin = Math.floor(angle / (360 / bins)) % bins;
          histogram[bin] += magnitude;
          totalMagnitude += magnitude;
        }
      }
    }

    return totalMagnitude > 0 
      ? histogram.map(h => h / totalMagnitude)
      : histogram;
  }

  // ==================== LBP (Local Binary Pattern) ====================
  private computeLBPHistogram(img: HTMLImageElement): number[] {
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to grayscale
    const gray: number[][] = [];
    for (let y = 0; y < size; y++) {
      gray[y] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        gray[y][x] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      }
    }

    // Compute LBP for each pixel
    // Using uniform LBP with 8 neighbors -> 59 uniform patterns + 1 non-uniform
    const histogram = new Array(60).fill(0);
    const uniformPatterns = this.getUniformPatterns();

    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const center = gray[y][x];
        let pattern = 0;
        
        // 8 neighbors: clockwise from top-left
        const neighbors = [
          gray[y-1][x-1], gray[y-1][x], gray[y-1][x+1],
          gray[y][x+1], gray[y+1][x+1], gray[y+1][x],
          gray[y+1][x-1], gray[y][x-1]
        ];

        for (let i = 0; i < 8; i++) {
          if (neighbors[i] >= center) {
            pattern |= (1 << i);
          }
        }

        // Map to uniform pattern bin
        const bin = uniformPatterns.get(pattern) ?? 59; // 59 = non-uniform
        histogram[bin]++;
      }
    }

    // Normalize
    const total = (size - 2) * (size - 2);
    return histogram.map(h => h / total);
  }

  private getUniformPatterns(): Map<number, number> {
    const map = new Map<number, number>();
    let binIndex = 0;

    for (let i = 0; i < 256; i++) {
      if (this.isUniformPattern(i)) {
        map.set(i, binIndex++);
      }
    }

    return map;
  }

  private isUniformPattern(pattern: number): boolean {
    // Count transitions (0->1 or 1->0) in circular pattern
    let transitions = 0;
    for (let i = 0; i < 8; i++) {
      const bit1 = (pattern >> i) & 1;
      const bit2 = (pattern >> ((i + 1) % 8)) & 1;
      if (bit1 !== bit2) transitions++;
    }
    return transitions <= 2;
  }

  // ==================== HU MOMENTS ====================
  private computeHuMoments(img: HTMLImageElement): number[] {
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to binary image (simple thresholding)
    const binary: number[][] = [];
    let sumX = 0, sumY = 0, total = 0;

    for (let y = 0; y < size; y++) {
      binary[y] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        binary[y][x] = gray > 128 ? 1 : 0;
        
        if (binary[y][x]) {
          sumX += x;
          sumY += y;
          total++;
        }
      }
    }

    if (total === 0) return new Array(7).fill(0);

    // Centroid
    const cx = sumX / total;
    const cy = sumY / total;

    // Central moments
    const mu = (p: number, q: number): number => {
      let sum = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (binary[y][x]) {
            sum += Math.pow(x - cx, p) * Math.pow(y - cy, q);
          }
        }
      }
      return sum;
    };

    const mu00 = total;
    const mu20 = mu(2, 0);
    const mu02 = mu(0, 2);
    const mu11 = mu(1, 1);
    const mu30 = mu(3, 0);
    const mu03 = mu(0, 3);
    const mu21 = mu(2, 1);
    const mu12 = mu(1, 2);

    // Normalized central moments
    const eta = (p: number, q: number, muPQ: number): number => {
      const gamma = (p + q) / 2 + 1;
      return muPQ / Math.pow(mu00, gamma);
    };

    const n20 = eta(2, 0, mu20);
    const n02 = eta(0, 2, mu02);
    const n11 = eta(1, 1, mu11);
    const n30 = eta(3, 0, mu30);
    const n03 = eta(0, 3, mu03);
    const n21 = eta(2, 1, mu21);
    const n12 = eta(1, 2, mu12);

    // Hu moments (7 invariant moments)
    const hu = [
      n20 + n02,
      Math.pow(n20 - n02, 2) + 4 * Math.pow(n11, 2),
      Math.pow(n30 - 3 * n12, 2) + Math.pow(3 * n21 - n03, 2),
      Math.pow(n30 + n12, 2) + Math.pow(n21 + n03, 2),
      (n30 - 3 * n12) * (n30 + n12) * (Math.pow(n30 + n12, 2) - 3 * Math.pow(n21 + n03, 2)) +
        (3 * n21 - n03) * (n21 + n03) * (3 * Math.pow(n30 + n12, 2) - Math.pow(n21 + n03, 2)),
      (n20 - n02) * (Math.pow(n30 + n12, 2) - Math.pow(n21 + n03, 2)) +
        4 * n11 * (n30 + n12) * (n21 + n03),
      (3 * n21 - n03) * (n30 + n12) * (Math.pow(n30 + n12, 2) - 3 * Math.pow(n21 + n03, 2)) -
        (n30 - 3 * n12) * (n21 + n03) * (3 * Math.pow(n30 + n12, 2) - Math.pow(n21 + n03, 2))
    ];

    // Log transform for better comparison
    return hu.map(h => h === 0 ? 0 : -Math.sign(h) * Math.log10(Math.abs(h) + 1e-10));
  }

  // ==================== COLOR LAYOUT (CBIR - MPEG-7 like) ====================
  /**
   * Color Layout Descriptor - Mô tả phân bố màu theo không gian
   * Chia ảnh thành lưới 8x8, tính màu đại diện cho mỗi ô
   * Áp dụng DCT để nén thông tin
   */
  private computeColorLayout(img: HTMLImageElement): number[] {
    const gridSize = 8;
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const cellSize = size / gridSize;
    const yCoeffs: number[] = [];
    const cbCoeffs: number[] = [];
    const crCoeffs: number[] = [];

    // Tính màu trung bình cho mỗi ô trong lưới
    const yGrid: number[][] = [];
    const cbGrid: number[][] = [];
    const crGrid: number[][] = [];

    for (let gy = 0; gy < gridSize; gy++) {
      yGrid[gy] = [];
      cbGrid[gy] = [];
      crGrid[gy] = [];
      
      for (let gx = 0; gx < gridSize; gx++) {
        let sumY = 0, sumCb = 0, sumCr = 0;
        let count = 0;

        for (let y = gy * cellSize; y < (gy + 1) * cellSize; y++) {
          for (let x = gx * cellSize; x < (gx + 1) * cellSize; x++) {
            const i = (y * size + x) * 4;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            
            // RGB to YCbCr
            const Y = 0.299 * r + 0.587 * g + 0.114 * b;
            const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            
            sumY += Y;
            sumCb += Cb;
            sumCr += Cr;
            count++;
          }
        }

        yGrid[gy][gx] = sumY / count;
        cbGrid[gy][gx] = sumCb / count;
        crGrid[gy][gx] = sumCr / count;
      }
    }

    // Áp dụng DCT và lấy các hệ số low-frequency (zigzag scan)
    const yDCT = this.dct2d(yGrid, gridSize);
    const cbDCT = this.dct2d(cbGrid, gridSize);
    const crDCT = this.dct2d(crGrid, gridSize);

    // Lấy 6 hệ số DC và AC đầu tiên cho mỗi kênh (zigzag)
    const zigzagIndices = [[0,0], [0,1], [1,0], [2,0], [1,1], [0,2]];
    
    for (const [row, col] of zigzagIndices) {
      yCoeffs.push(yDCT[row][col] / 255);
      cbCoeffs.push(cbDCT[row][col] / 255);
      crCoeffs.push(crDCT[row][col] / 255);
    }

    return [...yCoeffs, ...cbCoeffs, ...crCoeffs];
  }

  // ==================== HOG (Histogram of Oriented Gradients) ====================
  /**
   * HOG Descriptor - Đặc trưng hình dạng dựa trên gradient
   * Chia ảnh thành cells, tính histogram hướng gradient cho mỗi cell
   * Rất hiệu quả cho nhận diện đối tượng
   */
  private computeHOGDescriptor(img: HTMLImageElement): number[] {
    const size = 64;
    const cellSize = 8;
    const numBins = 9; // 0-180 độ, mỗi bin 20 độ
    const numCells = size / cellSize;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to grayscale
    const gray: number[][] = [];
    for (let y = 0; y < size; y++) {
      gray[y] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        gray[y][x] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      }
    }

    // Tính gradient
    const gradMag: number[][] = [];
    const gradDir: number[][] = [];
    
    for (let y = 1; y < size - 1; y++) {
      gradMag[y] = [];
      gradDir[y] = [];
      for (let x = 1; x < size - 1; x++) {
        const gx = gray[y][x + 1] - gray[y][x - 1];
        const gy = gray[y + 1][x] - gray[y - 1][x];
        
        gradMag[y][x] = Math.sqrt(gx * gx + gy * gy);
        let angle = Math.atan2(gy, gx) * 180 / Math.PI;
        if (angle < 0) angle += 180; // 0-180 độ (unsigned gradient)
        gradDir[y][x] = angle;
      }
    }

    // Tính histogram cho mỗi cell
    const descriptor: number[] = [];
    
    for (let cy = 0; cy < numCells; cy++) {
      for (let cx = 0; cx < numCells; cx++) {
        const histogram = new Array(numBins).fill(0);
        
        for (let y = cy * cellSize + 1; y < (cy + 1) * cellSize - 1 && y < size - 1; y++) {
          for (let x = cx * cellSize + 1; x < (cx + 1) * cellSize - 1 && x < size - 1; x++) {
            const mag = gradMag[y]?.[x] || 0;
            const dir = gradDir[y]?.[x] || 0;
            
            // Bilinear interpolation giữa 2 bins
            const binIdx = (dir / 180) * numBins;
            const bin1 = Math.floor(binIdx) % numBins;
            const bin2 = (bin1 + 1) % numBins;
            const ratio = binIdx - Math.floor(binIdx);
            
            histogram[bin1] += mag * (1 - ratio);
            histogram[bin2] += mag * ratio;
          }
        }
        
        // L2 normalize histogram
        const norm = Math.sqrt(histogram.reduce((a, b) => a + b * b, 0) + 1e-6);
        descriptor.push(...histogram.map(h => h / norm));
      }
    }

    return descriptor;
  }

  // ==================== GABOR FILTERS ====================
  /**
   * Gabor Features - Lọc đa tỷ lệ, đa hướng
   * Bắt chước cách hệ thống thị giác của con người hoạt động
   * Rất tốt cho phân tích kết cấu phức tạp
   */
  private computeGaborFeatures(img: HTMLImageElement): number[] {
    const size = 64;
    const scales = [4, 8, 16]; // Kích thước kernel
    const orientations = [0, 45, 90, 135]; // Hướng (độ)
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to grayscale
    const gray: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      gray.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    const features: number[] = [];

    for (const scale of scales) {
      for (const theta of orientations) {
        // Tạo Gabor kernel
        const kernel = this.createGaborKernel(scale, theta * Math.PI / 180);
        
        // Convolution với ảnh
        const response = this.convolve2D(gray, size, size, kernel);
        
        // Tính mean và std của response (energy features)
        const mean = response.reduce((a, b) => a + b, 0) / response.length;
        const variance = response.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / response.length;
        const std = Math.sqrt(variance);
        
        features.push(mean / 255, std / 255);
      }
    }

    return features;
  }

  private createGaborKernel(size: number, theta: number): number[][] {
    const kernel: number[][] = [];
    const sigma = size / 4;
    const lambda = size / 2;
    const gamma = 0.5;
    const psi = 0;
    
    const halfSize = Math.floor(size / 2);
    
    for (let y = -halfSize; y <= halfSize; y++) {
      const row: number[] = [];
      for (let x = -halfSize; x <= halfSize; x++) {
        const xTheta = x * Math.cos(theta) + y * Math.sin(theta);
        const yTheta = -x * Math.sin(theta) + y * Math.cos(theta);
        
        const gaussian = Math.exp(-(xTheta * xTheta + gamma * gamma * yTheta * yTheta) / (2 * sigma * sigma));
        const sinusoid = Math.cos(2 * Math.PI * xTheta / lambda + psi);
        
        row.push(gaussian * sinusoid);
      }
      kernel.push(row);
    }
    
    return kernel;
  }

  private convolve2D(image: number[], width: number, height: number, kernel: number[][]): number[] {
    const result: number[] = new Array(width * height).fill(0);
    const kSize = kernel.length;
    const halfK = Math.floor(kSize / 2);
    
    for (let y = halfK; y < height - halfK; y++) {
      for (let x = halfK; x < width - halfK; x++) {
        let sum = 0;
        
        for (let ky = 0; ky < kSize; ky++) {
          for (let kx = 0; kx < kSize; kx++) {
            const imgY = y + ky - halfK;
            const imgX = x + kx - halfK;
            sum += image[imgY * width + imgX] * kernel[ky][kx];
          }
        }
        
        result[y * width + x] = Math.abs(sum);
      }
    }
    
    return result;
  }

  // ==================== GLCM (Gray Level Co-occurrence Matrix) ====================
  /**
   * GLCM Features - Ma trận đồng xuất hiện mức xám
   * Phân tích kết cấu dựa trên quan hệ không gian giữa các pixel
   * Trả về các thuộc tính: contrast, dissimilarity, homogeneity, energy, correlation, entropy
   */
  private computeGLCMFeatures(img: HTMLImageElement): GLCMFeatures {
    const size = 64;
    const levels = 16; // Số mức xám (giảm từ 256 để tăng tốc)
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to quantized grayscale
    const gray: number[][] = [];
    for (let y = 0; y < size; y++) {
      gray[y] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const g = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        gray[y][x] = Math.min(Math.floor(g / 256 * levels), levels - 1);
      }
    }

    // Tạo GLCM (offset = [1, 0] - horizontal)
    const glcm: number[][] = [];
    for (let i = 0; i < levels; i++) {
      glcm[i] = new Array(levels).fill(0);
    }

    // Tính GLCM với 4 hướng và lấy trung bình
    const offsets = [[0, 1], [1, 0], [1, 1], [1, -1]]; // 0°, 90°, 45°, 135°
    
    for (const [dy, dx] of offsets) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
            const i = gray[y][x];
            const j = gray[ny][nx];
            glcm[i][j]++;
            glcm[j][i]++; // Symmetric
          }
        }
      }
    }

    // Normalize GLCM
    let total = 0;
    for (let i = 0; i < levels; i++) {
      for (let j = 0; j < levels; j++) {
        total += glcm[i][j];
      }
    }
    
    if (total > 0) {
      for (let i = 0; i < levels; i++) {
        for (let j = 0; j < levels; j++) {
          glcm[i][j] /= total;
        }
      }
    }

    // Tính các features từ GLCM
    let contrast = 0, dissimilarity = 0, homogeneity = 0, energy = 0, entropy = 0;
    let meanI = 0, meanJ = 0, varI = 0, varJ = 0, correlation = 0;

    // Tính mean
    for (let i = 0; i < levels; i++) {
      for (let j = 0; j < levels; j++) {
        meanI += i * glcm[i][j];
        meanJ += j * glcm[i][j];
      }
    }

    // Tính variance
    for (let i = 0; i < levels; i++) {
      for (let j = 0; j < levels; j++) {
        varI += Math.pow(i - meanI, 2) * glcm[i][j];
        varJ += Math.pow(j - meanJ, 2) * glcm[i][j];
      }
    }

    const stdI = Math.sqrt(varI);
    const stdJ = Math.sqrt(varJ);

    // Tính features
    for (let i = 0; i < levels; i++) {
      for (let j = 0; j < levels; j++) {
        const p = glcm[i][j];
        
        contrast += Math.pow(i - j, 2) * p;
        dissimilarity += Math.abs(i - j) * p;
        homogeneity += p / (1 + Math.pow(i - j, 2));
        energy += p * p;
        
        if (p > 0) {
          entropy -= p * Math.log2(p);
        }
        
        if (stdI > 0 && stdJ > 0) {
          correlation += ((i - meanI) * (j - meanJ) * p) / (stdI * stdJ);
        }
      }
    }

    return {
      contrast: contrast / (levels * levels), // Normalize
      dissimilarity: dissimilarity / levels,
      homogeneity,
      energy,
      correlation: (correlation + 1) / 2, // Map [-1, 1] to [0, 1]
      entropy: entropy / Math.log2(levels * levels) // Normalize
    };
  }

  // ==================== SPATIAL HISTOGRAM ====================
  /**
   * Spatial Color Histogram - Histogram màu theo vùng
   * Chia ảnh thành 5 vùng: 4 góc + 1 trung tâm
   * Giữ được thông tin không gian của màu sắc
   */
  private computeSpatialHistogram(img: HTMLImageElement): number[] {
    const size = 64;
    const bins = 8;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // 5 regions: top-left, top-right, bottom-left, bottom-right, center
    const regions = [
      { x1: 0, y1: 0, x2: size/2, y2: size/2 },           // Top-left
      { x1: size/2, y1: 0, x2: size, y2: size/2 },        // Top-right
      { x1: 0, y1: size/2, x2: size/2, y2: size },        // Bottom-left
      { x1: size/2, y1: size/2, x2: size, y2: size },     // Bottom-right
      { x1: size/4, y1: size/4, x2: 3*size/4, y2: 3*size/4 } // Center
    ];

    const allHistograms: number[] = [];
    const binSize = 256 / bins;

    for (const region of regions) {
      const histogram = new Array(bins * 3).fill(0);
      let count = 0;

      for (let y = region.y1; y < region.y2; y++) {
        for (let x = region.x1; x < region.x2; x++) {
          const i = (y * size + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          
          const rBin = Math.min(Math.floor(r / binSize), bins - 1);
          const gBin = Math.min(Math.floor(g / binSize), bins - 1);
          const bBin = Math.min(Math.floor(b / binSize), bins - 1);
          
          histogram[rBin]++;
          histogram[bins + gBin]++;
          histogram[bins * 2 + bBin]++;
          count++;
        }
      }

      // Normalize
      if (count > 0) {
        for (let i = 0; i < histogram.length; i++) {
          histogram[i] /= count;
        }
      }

      allHistograms.push(...histogram);
    }

    return allHistograms;
  }

  // ==================== BRIGHTNESS & CONTRAST ====================
  private computeBrightnessContrast(img: HTMLImageElement): { brightness: number; contrast: number } {
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const grayValues: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      grayValues.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    const mean = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;
    const variance = grayValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / grayValues.length;
    const std = Math.sqrt(variance);

    return {
      brightness: mean / 255, // 0-1
      contrast: std / 128     // Normalized
    };
  }

  // ==================== DOMINANT COLORS (K-Means) ====================
  private extractDominantColors(img: HTMLImageElement, k: number): string[] {
    const size = 32;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const points: [number, number, number][] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const brightness = (r + g + b) / 3;
      if (brightness > 15 && brightness < 240) {
        points.push([r, g, b]);
      }
    }

    if (points.length === 0) {
      return ['#808080'];
    }

    const centroids = this.kMeans(points, k, 15);
    
    return centroids.map(([r, g, b]) => 
      '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
    );
  }

  private kMeans(
    points: [number, number, number][],
    k: number,
    iterations: number
  ): [number, number, number][] {
    let centroids: [number, number, number][] = [];
    const shuffled = [...points].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(k, shuffled.length); i++) {
      centroids.push([...shuffled[i]]);
    }

    for (let iter = 0; iter < iterations; iter++) {
      const clusters: [number, number, number][][] = centroids.map(() => []);
      
      for (const point of points) {
        let minDist = Infinity;
        let closestIdx = 0;
        
        for (let i = 0; i < centroids.length; i++) {
          const dist = this.colorDistance(point, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        
        clusters[closestIdx].push(point);
      }

      for (let i = 0; i < centroids.length; i++) {
        if (clusters[i].length > 0) {
          centroids[i] = [
            clusters[i].reduce((a, p) => a + p[0], 0) / clusters[i].length,
            clusters[i].reduce((a, p) => a + p[1], 0) / clusters[i].length,
            clusters[i].reduce((a, p) => a + p[2], 0) / clusters[i].length
          ];
        }
      }
    }

    return centroids;
  }

  private colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
    return Math.sqrt(
      Math.pow(c1[0] - c2[0], 2) +
      Math.pow(c1[1] - c2[1], 2) +
      Math.pow(c1[2] - c2[2], 2)
    );
  }

  // ==================== COMPARISON FUNCTIONS ====================

  private compareHashes(hash1: string, hash2: string): number {
    if (!hash1 || !hash2 || hash1.length === 0 || hash2.length === 0 || hash1.length !== hash2.length) return 0;
    
    let diff = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) diff++;
    }
    
    const result = 1 - (diff / hash1.length);
    return isNaN(result) ? 0 : result;
  }

  private compareHistograms(h1: number[], h2: number[]): number {
    if (!h1 || !h2 || h1.length === 0 || h2.length === 0 || h1.length !== h2.length) return 0;
    
    // Bhattacharyya coefficient
    let sum = 0;
    for (let i = 0; i < h1.length; i++) {
      const val1 = h1[i] || 0;
      const val2 = h2[i] || 0;
      if (val1 >= 0 && val2 >= 0) {
        sum += Math.sqrt(val1 * val2);
      }
    }
    
    const result = Math.min(sum, 1);
    return isNaN(result) ? 0 : result;
  }

  private compareColorMoments(m1: ColorMoments, m2: ColorMoments): number {
    if (!m1 || !m2 || !m1.mean || !m2.mean || !m1.std || !m2.std) return 0;
    
    let dist = 0;
    
    for (let i = 0; i < 3; i++) {
      const mean1 = m1.mean[i] || 0;
      const mean2 = m2.mean[i] || 0;
      const std1 = m1.std[i] || 0;
      const std2 = m2.std[i] || 0;
      const skew1 = m1.skewness?.[i] || 0;
      const skew2 = m2.skewness?.[i] || 0;
      
      dist += Math.pow(mean1 - mean2, 2) * 1.5; // Weight mean more
      dist += Math.pow(std1 - std2, 2);
      dist += Math.pow(skew1 - skew2, 2) * 0.5;
    }
    
    const result = Math.max(0, 1 - Math.sqrt(dist) / 2.5);
    return isNaN(result) ? 0 : result;
  }

  private compareHuMoments(h1: number[], h2: number[]): number {
    if (!h1 || !h2 || h1.length === 0 || h2.length === 0 || h1.length !== h2.length) return 0;
    
    let dist = 0;
    for (let i = 0; i < h1.length; i++) {
      const val1 = isNaN(h1[i]) ? 0 : h1[i];
      const val2 = isNaN(h2[i]) ? 0 : h2[i];
      dist += Math.pow(val1 - val2, 2);
    }
    
    // Normalize - Hu moments can have large values
    const result = Math.max(0, 1 - Math.sqrt(dist) / 10);
    return isNaN(result) ? 0 : result;
  }

  private compareGLCMFeatures(g1: GLCMFeatures, g2: GLCMFeatures | undefined): number {
    if (!g1 || !g2) return 0;
    
    // Helper to safely get value (default to 0 if NaN/undefined)
    const safe = (val: number | undefined): number => 
      val == null || isNaN(val) ? 0 : val;
    
    // So sánh các thuộc tính GLCM với trọng số khác nhau
    const weights = {
      contrast: 0.2,
      dissimilarity: 0.15,
      homogeneity: 0.2,
      energy: 0.15,
      correlation: 0.15,
      entropy: 0.15
    };

    let similarity = 0;
    
    // Contrast (0 to ~1 normalized)
    similarity += weights.contrast * (1 - Math.abs(safe(g1.contrast) - safe(g2.contrast)));
    
    // Dissimilarity (0 to ~1 normalized)
    similarity += weights.dissimilarity * (1 - Math.abs(safe(g1.dissimilarity) - safe(g2.dissimilarity)));
    
    // Homogeneity (0 to 1)
    similarity += weights.homogeneity * (1 - Math.abs(safe(g1.homogeneity) - safe(g2.homogeneity)));
    
    // Energy (0 to 1)
    similarity += weights.energy * (1 - Math.abs(safe(g1.energy) - safe(g2.energy)));
    
    // Correlation (0 to 1 normalized)
    similarity += weights.correlation * (1 - Math.abs(safe(g1.correlation) - safe(g2.correlation)));
    
    // Entropy (0 to 1 normalized)
    similarity += weights.entropy * (1 - Math.abs(safe(g1.entropy) - safe(g2.entropy)));

    const result = Math.max(0, Math.min(1, similarity));
    return isNaN(result) ? 0 : result;
  }

  // ==================== FEEDBACK & LEARNING ====================

  private async loadFeedback(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(FEEDBACK_STORE, 'readonly');
      const store = transaction.objectStore(FEEDBACK_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const feedback = request.result.map((f: any) => ({
          ...f,
          timestamp: new Date(f.timestamp)
        }));
        this.feedbackHistory.set(feedback);
      };
    } catch (err) {
      console.warn('Failed to load feedback:', err);
    }
  }

  private async loadLearnedWeights(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(SETTINGS_STORE, 'readonly');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get('learnedWeights');

      request.onsuccess = () => {
        if (request.result) {
          this.learnedWeights.set({
            ...request.result.value,
            lastUpdated: new Date(request.result.value.lastUpdated)
          });
        }
      };
    } catch (err) {
      console.warn('Failed to load learned weights:', err);
    }
  }

  /**
   * Submit feedback for a search result
   * @param queryImageId - ID or identifier of the query image
   * @param result - The search result to provide feedback on
   * @param isRelevant - Whether the result is a correct match
   */
  async submitFeedback(
    queryImageId: string,
    result: SearchResult,
    isRelevant: boolean
  ): Promise<void> {
    const feedback: FeedbackRecord = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queryImageId,
      resultImageId: result.image.id,
      isRelevant,
      similarity: result.similarity,
      scores: result.scores,
      timestamp: new Date()
    };

    // Save to DB
    if (this.db) {
      try {
        const transaction = this.db.transaction(FEEDBACK_STORE, 'readwrite');
        const store = transaction.objectStore(FEEDBACK_STORE);
        await new Promise<void>((resolve, reject) => {
          const request = store.put({
            ...feedback,
            timestamp: feedback.timestamp.toISOString()
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (err) {
        console.error('Failed to save feedback:', err);
      }
    }

    // Update local state
    this.feedbackHistory.update(history => [...history, feedback]);

    // Trigger learning if enabled
    if (this.isLearningEnabled()) {
      await this.learnFromFeedback();
    }
  }

  /**
   * Learn from accumulated feedback and adjust weights
   * Uses gradient descent-like approach
   */
  async learnFromFeedback(): Promise<void> {
    const feedback = this.feedbackHistory();
    if (feedback.length < 3) return; // Need minimum feedback

    const keys = this.getWeightKeys();
    const currentWeights = this.learnedWeights()?.weights || { ...this.defaultWeights };
    const learningRate = 0.05; // How much to adjust each iteration

    // Calculate gradient for each weight
    const gradients: Partial<SearchWeights> = {};
    
    for (const key of keys) {
      let gradient = 0;
      
      for (const fb of feedback) {
        const score = fb.scores[key];
        const error = fb.isRelevant ? (1 - score) : score; // Error based on relevance
        
        // Positive gradient if relevant (increase weight for good scores)
        // Negative gradient if not relevant (decrease weight for bad scores)
        if (fb.isRelevant) {
          gradient += score * learningRate; // Reward algorithms that scored high for relevant
        } else {
          gradient -= score * learningRate; // Penalize algorithms that scored high for irrelevant
        }
      }
      
      gradients[key] = gradient / feedback.length;
    }

    // Update weights
    const newWeights: SearchWeights = { ...currentWeights };
    let totalWeight = 0;

    for (const key of keys) {
      newWeights[key] = Math.max(0.01, Math.min(0.5, currentWeights[key] + (gradients[key] || 0)));
      totalWeight += newWeights[key];
    }

    // Normalize weights to sum to 1
    for (const key of keys) {
      newWeights[key] = newWeights[key] / totalWeight;
    }

    // Calculate accuracy estimate
    const correctPredictions = feedback.filter(fb => {
      const predicted = fb.similarity >= 0.5;
      return predicted === fb.isRelevant;
    }).length;
    const accuracy = correctPredictions / feedback.length;

    // Save learned weights
    const learned: LearnedWeights = {
      weights: newWeights,
      feedbackCount: feedback.length,
      lastUpdated: new Date(),
      accuracy
    };

    this.learnedWeights.set(learned);

    // Persist to DB
    if (this.db) {
      try {
        const transaction = this.db.transaction(SETTINGS_STORE, 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE);
        await new Promise<void>((resolve, reject) => {
          const request = store.put({
            key: 'learnedWeights',
            value: {
              ...learned,
              lastUpdated: learned.lastUpdated.toISOString()
            }
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (err) {
        console.error('Failed to save learned weights:', err);
      }
    }
  }

  /**
   * Get the best weights to use (learned or default)
   */
  getOptimalWeights(): SearchWeights {
    const learned = this.learnedWeights();
    if (learned && learned.feedbackCount >= 5) {
      return learned.weights;
    }
    return this.defaultWeights;
  }

  /**
   * Reset learned weights back to defaults
   */
  async resetLearning(): Promise<void> {
    this.learnedWeights.set(null);
    this.feedbackHistory.set([]);

    if (this.db) {
      try {
        // Clear feedback
        const fbTransaction = this.db.transaction(FEEDBACK_STORE, 'readwrite');
        const fbStore = fbTransaction.objectStore(FEEDBACK_STORE);
        fbStore.clear();

        // Clear learned weights
        const settingsTransaction = this.db.transaction(SETTINGS_STORE, 'readwrite');
        const settingsStore = settingsTransaction.objectStore(SETTINGS_STORE);
        settingsStore.delete('learnedWeights');
      } catch (err) {
        console.error('Failed to reset learning:', err);
      }
    }
  }

  /**
   * Get feedback statistics
   */
  getFeedbackStats(): { total: number; positive: number; negative: number; accuracy: number } {
    const feedback = this.feedbackHistory();
    const positive = feedback.filter(f => f.isRelevant).length;
    const negative = feedback.length - positive;
    const accuracy = this.learnedWeights()?.accuracy || 0;

    return { total: feedback.length, positive, negative, accuracy };
  }

  // ==================== UTILITIES ====================

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  private createThumbnail(img: HTMLImageElement, maxSize: number): string {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  private generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getWeightKeys(): (keyof SearchWeights)[] {
    return [
      'pHash', 'dHash', 'aHash', 
      'colorHistogramRGB', 'colorHistogramHSV', 'colorMoments',
      'edgeHistogram', 'lbpHistogram', 'huMoments',
      // CBIR Advanced
      'colorLayout', 'hogDescriptor', 'gaborFeatures', 
      'glcmFeatures', 'spatialHistogram'
    ];
  }
}
