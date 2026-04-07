import { Injectable, signal } from '@angular/core';

/**
 * Image Search Service using traditional Computer Vision algorithms
 * No AI/API required - runs entirely in browser
 * 
 * Algorithms implemented:
 * 1. Perceptual Hash (pHash) - DCT-based, good for similar images
 * 2. Difference Hash (dHash) - Gradient-based, fast
 * 3. Average Hash (aHash) - Simple but effective
 * 4. Color Histogram - RGB distribution comparison
 * 5. Color Moments - Statistical color features
 * 6. Edge Detection - Sobel operator for shape matching
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
  // Feature vectors
  pHash: string;
  dHash: string;
  aHash: string;
  colorHistogram: number[];
  colorMoments: ColorMoments;
  edgeHistogram: number[];
  dominantColors: string[];
}

export interface ColorMoments {
  // For each channel (R, G, B)
  mean: [number, number, number];
  std: [number, number, number];
  skewness: [number, number, number];
}

export interface SearchResult {
  image: ImageRecord;
  similarity: number;
  scores: {
    pHash: number;
    dHash: number;
    aHash: number;
    colorHistogram: number;
    colorMoments: number;
    edgeHistogram: number;
  };
}

export interface SearchWeights {
  pHash: number;
  dHash: number;
  aHash: number;
  colorHistogram: number;
  colorMoments: number;
  edgeHistogram: number;
}

const DB_NAME = 'ImageSearchDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

@Injectable({
  providedIn: 'root'
})
export class ImageSearchService {
  // State
  images = signal<ImageRecord[]>([]);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingStatus = signal<string>('');

  // Default search weights
  defaultWeights: SearchWeights = {
    pHash: 0.25,
    dHash: 0.20,
    aHash: 0.10,
    colorHistogram: 0.20,
    colorMoments: 0.15,
    edgeHistogram: 0.10
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
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
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

  async addImage(file: File): Promise<ImageRecord> {
    this.isProcessing.set(true);
    this.processingProgress.set(0);
    this.processingStatus.set('Đang đọc hình ảnh...');

    try {
      // Read file as data URL
      const dataUrl = await this.fileToDataUrl(file);
      this.processingProgress.set(10);

      // Create image element
      const img = await this.loadImage(dataUrl);
      this.processingProgress.set(20);

      // Generate thumbnail
      this.processingStatus.set('Đang tạo thumbnail...');
      const thumbnail = this.createThumbnail(img, 200);
      this.processingProgress.set(30);

      // Extract features
      this.processingStatus.set('Đang tính pHash...');
      const pHash = this.computePHash(img);
      this.processingProgress.set(40);

      this.processingStatus.set('Đang tính dHash...');
      const dHash = this.computeDHash(img);
      this.processingProgress.set(50);

      this.processingStatus.set('Đang tính aHash...');
      const aHash = this.computeAHash(img);
      this.processingProgress.set(60);

      this.processingStatus.set('Đang phân tích màu sắc...');
      const colorHistogram = this.computeColorHistogram(img);
      const colorMoments = this.computeColorMoments(img);
      const dominantColors = this.extractDominantColors(img, 5);
      this.processingProgress.set(80);

      this.processingStatus.set('Đang phát hiện cạnh...');
      const edgeHistogram = this.computeEdgeHistogram(img);
      this.processingProgress.set(90);

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
        colorHistogram,
        colorMoments,
        edgeHistogram,
        dominantColors
      };

      // Save to DB
      this.processingStatus.set('Đang lưu...');
      await this.saveImage(record);
      this.processingProgress.set(100);

      // Update state
      this.images.update(images => [record, ...images]);

      this.processingStatus.set('Hoàn thành!');
      return record;
    } finally {
      setTimeout(() => {
        this.isProcessing.set(false);
        this.processingProgress.set(0);
        this.processingStatus.set('');
      }, 1000);
    }
  }

  async addMultipleImages(files: File[]): Promise<ImageRecord[]> {
    const results: ImageRecord[] = [];
    for (let i = 0; i < files.length; i++) {
      this.processingStatus.set(`Đang xử lý ${i + 1}/${files.length}...`);
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
    this.processingStatus.set('Đang phân tích hình ảnh tìm kiếm...');

    try {
      const dataUrl = await this.fileToDataUrl(file);
      const img = await this.loadImage(dataUrl);

      // Extract features from query image
      const queryFeatures = {
        pHash: this.computePHash(img),
        dHash: this.computeDHash(img),
        aHash: this.computeAHash(img),
        colorHistogram: this.computeColorHistogram(img),
        colorMoments: this.computeColorMoments(img),
        edgeHistogram: this.computeEdgeHistogram(img)
      };

      this.processingStatus.set('Đang so sánh với kho ảnh...');

      // Compare with all images in database
      const w = weights || this.defaultWeights;
      const results: SearchResult[] = this.images().map(image => {
        const scores = {
          pHash: this.compareHashes(queryFeatures.pHash, image.pHash),
          dHash: this.compareHashes(queryFeatures.dHash, image.dHash),
          aHash: this.compareHashes(queryFeatures.aHash, image.aHash),
          colorHistogram: this.compareHistograms(queryFeatures.colorHistogram, image.colorHistogram),
          colorMoments: this.compareColorMoments(queryFeatures.colorMoments, image.colorMoments),
          edgeHistogram: this.compareHistograms(queryFeatures.edgeHistogram, image.edgeHistogram)
        };

        // Weighted average
        const similarity = 
          scores.pHash * w.pHash +
          scores.dHash * w.dHash +
          scores.aHash * w.aHash +
          scores.colorHistogram * w.colorHistogram +
          scores.colorMoments * w.colorMoments +
          scores.edgeHistogram * w.edgeHistogram;

        return { image, similarity, scores };
      });

      // Sort by similarity (descending)
      results.sort((a, b) => b.similarity - a.similarity);

      this.processingStatus.set('Hoàn thành!');
      return results;
    } finally {
      setTimeout(() => {
        this.isProcessing.set(false);
        this.processingStatus.set('');
      }, 500);
    }
  }

  async searchByImageUrl(dataUrl: string, weights?: SearchWeights): Promise<SearchResult[]> {
    this.isProcessing.set(true);
    this.processingStatus.set('Đang phân tích hình ảnh tìm kiếm...');

    try {
      const img = await this.loadImage(dataUrl);

      // Extract features from query image
      const queryFeatures = {
        pHash: this.computePHash(img),
        dHash: this.computeDHash(img),
        aHash: this.computeAHash(img),
        colorHistogram: this.computeColorHistogram(img),
        colorMoments: this.computeColorMoments(img),
        edgeHistogram: this.computeEdgeHistogram(img)
      };

      this.processingStatus.set('Đang so sánh với kho ảnh...');

      // Compare with all images in database
      const w = weights || this.defaultWeights;
      const results: SearchResult[] = this.images().map(image => {
        const scores = {
          pHash: this.compareHashes(queryFeatures.pHash, image.pHash),
          dHash: this.compareHashes(queryFeatures.dHash, image.dHash),
          aHash: this.compareHashes(queryFeatures.aHash, image.aHash),
          colorHistogram: this.compareHistograms(queryFeatures.colorHistogram, image.colorHistogram),
          colorMoments: this.compareColorMoments(queryFeatures.colorMoments, image.colorMoments),
          edgeHistogram: this.compareHistograms(queryFeatures.edgeHistogram, image.edgeHistogram)
        };

        // Weighted average
        const similarity = 
          scores.pHash * w.pHash +
          scores.dHash * w.dHash +
          scores.aHash * w.aHash +
          scores.colorHistogram * w.colorHistogram +
          scores.colorMoments * w.colorMoments +
          scores.edgeHistogram * w.edgeHistogram;

        return { image, similarity, scores };
      });

      // Sort by similarity (descending)
      results.sort((a, b) => b.similarity - a.similarity);

      this.processingStatus.set('Hoàn thành!');
      return results;
    } finally {
      setTimeout(() => {
        this.isProcessing.set(false);
        this.processingStatus.set('');
      }, 500);
    }
  }

  // ==================== PERCEPTUAL HASH (pHash) ====================
  /**
   * Perceptual Hash using DCT (Discrete Cosine Transform)
   * - Resize to 32x32
   * - Convert to grayscale
   * - Apply DCT
   * - Use top-left 8x8 DCT coefficients
   * - Generate 64-bit hash
   */
  private computePHash(img: HTMLImageElement): string {
    const size = 32;
    const smallSize = 8;

    // Get grayscale pixel data
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
        if (x === 0 && y === 0) continue; // Skip DC
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

  /**
   * 2D Discrete Cosine Transform
   */
  private dct2d(matrix: number[][], size: number): number[][] {
    const result: number[][] = [];
    
    // Pre-compute cosine values
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
  /**
   * Difference Hash - compares adjacent pixels
   * - Resize to 9x8 (need 9 columns for 8 differences)
   * - Convert to grayscale
   * - Compare each pixel with neighbor to right
   * - Generate 64-bit hash
   */
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

    // Convert to grayscale and compute differences
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
  /**
   * Average Hash - simple but effective
   * - Resize to 8x8
   * - Convert to grayscale
   * - Calculate mean
   * - Compare each pixel to mean
   */
  private computeAHash(img: HTMLImageElement): string {
    const size = 8;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to grayscale
    const grayValues: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      grayValues.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    // Calculate mean
    const mean = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;

    // Generate hash
    let hash = '';
    for (const val of grayValues) {
      hash += val >= mean ? '1' : '0';
    }

    return hash;
  }

  // ==================== COLOR HISTOGRAM ====================
  /**
   * RGB Color Histogram
   * - Quantize colors to bins
   * - Count frequency of each bin
   * - Normalize
   */
  private computeColorHistogram(img: HTMLImageElement, bins: number = 16): number[] {
    const size = 64; // Sample size for performance
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Initialize histogram bins for each channel
    const binSize = 256 / bins;
    const histogram = new Array(bins * 3).fill(0);

    // Count pixels in each bin
    for (let i = 0; i < pixels.length; i += 4) {
      const rBin = Math.floor(pixels[i] / binSize);
      const gBin = Math.floor(pixels[i + 1] / binSize);
      const bBin = Math.floor(pixels[i + 2] / binSize);

      histogram[rBin]++;
      histogram[bins + gBin]++;
      histogram[bins * 2 + bBin]++;
    }

    // Normalize
    const total = pixels.length / 4;
    return histogram.map(h => h / total);
  }

  // ==================== COLOR MOMENTS ====================
  /**
   * Statistical moments of color distribution
   * Mean, Standard Deviation, Skewness for each channel
   */
  private computeColorMoments(img: HTMLImageElement): ColorMoments {
    const size = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Collect channel values
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
      
      return [mean / 255, std / 255, skewness / 255]; // Normalize to 0-1
    };

    return {
      mean: [calcMoments(r)[0], calcMoments(g)[0], calcMoments(b)[0]],
      std: [calcMoments(r)[1], calcMoments(g)[1], calcMoments(b)[1]],
      skewness: [calcMoments(r)[2], calcMoments(g)[2], calcMoments(b)[2]]
    };
  }

  // ==================== EDGE HISTOGRAM ====================
  /**
   * Edge detection using Sobel operator
   * - Detect edges in multiple directions
   * - Create histogram of edge orientations
   */
  private computeEdgeHistogram(img: HTMLImageElement): number[] {
    const size = 64;
    const bins = 8; // 8 directions (0°, 45°, 90°, 135°, ...)
    
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

    // Sobel kernels
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    // Compute gradients and histogram
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
        if (magnitude > 30) { // Threshold to ignore noise
          let angle = Math.atan2(gy, gx) * 180 / Math.PI;
          if (angle < 0) angle += 360;
          
          const bin = Math.floor(angle / (360 / bins)) % bins;
          histogram[bin] += magnitude;
          totalMagnitude += magnitude;
        }
      }
    }

    // Normalize
    return totalMagnitude > 0 
      ? histogram.map(h => h / totalMagnitude)
      : histogram;
  }

  // ==================== DOMINANT COLORS (K-Means) ====================
  /**
   * Extract dominant colors using simplified K-Means
   */
  private extractDominantColors(img: HTMLImageElement, k: number): string[] {
    const size = 32;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Collect pixels as RGB points
    const points: [number, number, number][] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      // Skip very light or very dark pixels
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const brightness = (r + g + b) / 3;
      if (brightness > 20 && brightness < 235) {
        points.push([r, g, b]);
      }
    }

    if (points.length === 0) {
      return ['#808080']; // Default gray if no valid pixels
    }

    // Simple K-Means
    const centroids = this.kMeans(points, k, 10);
    
    // Convert to hex
    return centroids.map(([r, g, b]) => 
      '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
    );
  }

  private kMeans(
    points: [number, number, number][],
    k: number,
    iterations: number
  ): [number, number, number][] {
    // Initialize centroids randomly
    let centroids: [number, number, number][] = [];
    const shuffled = [...points].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(k, shuffled.length); i++) {
      centroids.push([...shuffled[i]]);
    }

    for (let iter = 0; iter < iterations; iter++) {
      // Assign points to nearest centroid
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

      // Update centroids
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

    // Sort by cluster size (most common colors first)
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

  /**
   * Compare two binary hashes using Hamming distance
   * Returns similarity score 0-1
   */
  private compareHashes(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 0;
    
    let diff = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) diff++;
    }
    
    return 1 - (diff / hash1.length);
  }

  /**
   * Compare histograms using various metrics
   * Using Bhattacharyya coefficient
   */
  private compareHistograms(h1: number[], h2: number[]): number {
    if (h1.length !== h2.length) return 0;
    
    // Bhattacharyya coefficient
    let sum = 0;
    for (let i = 0; i < h1.length; i++) {
      sum += Math.sqrt(h1[i] * h2[i]);
    }
    
    return sum;
  }

  /**
   * Compare color moments using Euclidean distance
   */
  private compareColorMoments(m1: ColorMoments, m2: ColorMoments): number {
    let dist = 0;
    
    for (let i = 0; i < 3; i++) {
      dist += Math.pow(m1.mean[i] - m2.mean[i], 2);
      dist += Math.pow(m1.std[i] - m2.std[i], 2);
      dist += Math.pow(m1.skewness[i] - m2.skewness[i], 2);
    }
    
    // Convert distance to similarity (0-1)
    // Max possible distance ≈ 3 (sqrt(9))
    return Math.max(0, 1 - Math.sqrt(dist) / 3);
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

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  private generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== EXPORT/IMPORT ====================

  async exportDatabase(): Promise<string> {
    const images = this.images();
    // Export without full dataUrl to reduce size
    const exportData = images.map(img => ({
      ...img,
      dataUrl: img.thumbnail, // Use thumbnail instead of full image
    }));
    return JSON.stringify(exportData);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
