import { Component, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { createWorker } from 'tesseract.js';

interface OCRResult {
  text: string;
  confidence: number;
  imageUrl: string;
  timestamp: Date;
  language?: string;
}

@Component({
  selector: 'app-ocr-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ocr-app.component.html',
  styleUrl: './ocr-app.component.scss',
})
export class OcrAppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imagePreview') imagePreview!: ElementRef<HTMLImageElement>;
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  // State signals
  selectedImage = signal<string | null>(null);
  ocrResult = signal<OCRResult | null>(null);
  isProcessing = signal<boolean>(false);
  progress = signal<number>(0);
  progressStatus = signal<string>('');
  error = signal<string | null>(null);
  history = signal<OCRResult[]>([]);
  selectedLanguage = signal<string>('eng+vie'); // English + Vietnamese
  showHistory = signal<boolean>(false);

  // Available languages
  languages = [
    { code: 'eng', name: 'English' },
    { code: 'vie', name: 'Vietnamese' },
    { code: 'eng+vie', name: 'English + Vietnamese' },
    { code: 'chi_sim', name: 'Chinese Simplified' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'kor', name: 'Korean' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'spa', name: 'Spanish' },
  ];

  private worker: any = null;

  ngAfterViewInit() {
    // Initialize Tesseract worker
    this.initializeWorker();
    // Load history
    this.loadHistory();
  }

  triggerFileInput() {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.click();
    }
  }

  async initializeWorker() {
    try {
      this.progressStatus.set('Đang khởi tạo OCR engine...');
      this.worker = await createWorker();
      await this.worker.loadLanguage(this.selectedLanguage());
      await this.worker.initialize(this.selectedLanguage());
      this.progressStatus.set('Sẵn sàng');
    } catch (err) {
      console.error('Failed to initialize OCR worker:', err);
      this.error.set('Không thể khởi tạo OCR engine. Vui lòng thử lại.');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    this.processFile(file);
  }

  handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    
    this.processFile(file);
  }

  private processFile(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.error.set('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, GIF, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB');
      return;
    }

    this.error.set(null);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      this.selectedImage.set(imageUrl);
      this.ocrResult.set(null);
    };

    reader.readAsDataURL(file);
  }

  async processImage() {
    const imageUrl = this.selectedImage();
    if (!imageUrl) {
      this.error.set('Vui lòng chọn hình ảnh trước');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);
    this.progress.set(0);
    this.progressStatus.set('Đang xử lý hình ảnh...');

    try {
      // Reload worker with selected language if changed
      const currentLang = this.selectedLanguage();
      await this.worker.loadLanguage(currentLang);
      await this.worker.initialize(currentLang);

      // Perform OCR
      const { data } = await this.worker.recognize(imageUrl, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.progress.set(Math.round(m.progress * 100));
            this.progressStatus.set(`Đang nhận dạng: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        imageUrl: imageUrl,
        timestamp: new Date(),
        language: currentLang
      };

      this.ocrResult.set(result);
      
      // Add to history
      const currentHistory = this.history();
      this.history.set([result, ...currentHistory].slice(0, 20)); // Keep last 20 results
      this.saveHistory();

      this.progress.set(100);
      this.progressStatus.set('Hoàn thành');
    } catch (err: any) {
      console.error('OCR Error:', err);
      this.error.set(`Lỗi khi xử lý: ${err.message || 'Vui lòng thử lại'}`);
    } finally {
      this.isProcessing.set(false);
      setTimeout(() => {
        this.progress.set(0);
        this.progressStatus.set('Sẵn sàng');
      }, 2000);
    }
  }

  clearImage() {
    this.selectedImage.set(null);
    this.ocrResult.set(null);
    this.error.set(null);
    this.progress.set(0);
    this.progressStatus.set('Sẵn sàng');
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  copyText() {
    const result = this.ocrResult();
    if (!result || !result.text) return;

    navigator.clipboard.writeText(result.text).then(() => {
      // Show notification
      const notification = document.createElement('div');
      notification.textContent = 'Đã sao chép vào clipboard!';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  downloadText() {
    const result = this.ocrResult();
    if (!result || !result.text) return;

    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async onLanguageChange() {
    if (this.worker) {
      try {
        this.progressStatus.set('Đang thay đổi ngôn ngữ...');
        await this.worker.loadLanguage(this.selectedLanguage());
        await this.worker.initialize(this.selectedLanguage());
        this.progressStatus.set('Sẵn sàng');
      } catch (err) {
        console.error('Failed to change language:', err);
        this.error.set('Không thể thay đổi ngôn ngữ');
      }
    }
  }

  loadFromHistory(result: OCRResult) {
    this.selectedImage.set(result.imageUrl);
    this.ocrResult.set(result);
    this.showHistory.set(false);
  }

  deleteFromHistory(index: number) {
    const history = this.history();
    const updated = history.filter((_, i) => i !== index);
    this.history.set(updated);
    this.saveHistory();
  }

  clearHistory() {
    this.history.set([]);
    this.saveHistory();
  }

  private saveHistory() {
    const history = this.history();
    // Save only essential data (exclude imageUrl to save space)
    const historyToSave = history.map(r => ({
      text: r.text,
      confidence: r.confidence,
      timestamp: r.timestamp.toISOString(),
      language: r.language
    }));
    localStorage.setItem('ocr-history', JSON.stringify(historyToSave));
  }

  loadHistory() {
    const stored = localStorage.getItem('ocr-history');
    if (stored) {
      try {
        const history = JSON.parse(stored);
        // Note: imageUrl won't be available from localStorage, but that's okay for history view
        this.history.set(history.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
          imageUrl: '' // Images not stored in history
        })));
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    }
  }

  getLanguageName(code: string | undefined): string {
    if (!code) return '';
    const lang = this.languages.find(l => l.code === code);
    return lang?.name || code;
  }

  ngOnDestroy() {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}

