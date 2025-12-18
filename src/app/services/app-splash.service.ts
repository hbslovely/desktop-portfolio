import { Injectable, signal } from '@angular/core';

export interface AppSplashConfig {
  appId: string;
  appName: string;
  appIcon: string;
  loadingText?: string;
  loadingSteps?: string[];
  duration?: number; // ms
}

@Injectable({
  providedIn: 'root'
})
export class AppSplashService {
  // Current splash state
  isVisible = signal(false);
  currentApp = signal<AppSplashConfig | null>(null);
  loadingProgress = signal(0);
  currentStep = signal('');
  
  // Callback to execute after splash completes
  private onCompleteCallback: (() => void) | null = null;
  private progressInterval: any = null;

  // App-specific configurations
  private appConfigs: Record<string, Partial<AppSplashConfig>> = {
    'stock': {
      appName: 'Chứng khoán',
      loadingSteps: [
        'Đang kết nối máy chủ...',
        'Đang tải dữ liệu thị trường...',
        'Đang phân tích xu hướng...',
        'Chuẩn bị giao diện...'
      ],
      duration: 1800
    },
    'expense': {
      appName: 'Quản lý chi tiêu',
      loadingSteps: [
        'Đang đồng bộ dữ liệu...',
        'Đang tải giao dịch...',
        'Đang tính toán thống kê...',
        'Sẵn sàng!'
      ],
      duration: 1500
    },
    'weather': {
      appName: 'Thời tiết',
      loadingSteps: [
        'Đang lấy vị trí...',
        'Đang tải dữ liệu thời tiết...',
        'Đang xử lý dự báo...'
      ],
      duration: 1200
    },
    'news': {
      appName: 'Tin tức',
      loadingSteps: [
        'Đang kết nối nguồn tin...',
        'Đang tải tin mới nhất...',
        'Đang phân loại...'
      ],
      duration: 1200
    },
    'tuoitre-news': {
      appName: 'Tuổi Trẻ News',
      loadingSteps: [
        'Đang kết nối Tuổi Trẻ...',
        'Đang tải bài viết...',
        'Chuẩn bị hiển thị...'
      ],
      duration: 1200
    },
    'yugioh': {
      appName: 'Yu-Gi-Oh! Cards',
      loadingSteps: [
        'Đang tải database thẻ bài...',
        'Đang tải hình ảnh...',
        'It\'s time to duel!'
      ],
      duration: 1400
    },
    'countries': {
      appName: 'Countries',
      loadingSteps: [
        'Đang tải dữ liệu quốc gia...',
        'Đang xử lý bản đồ...',
        'Sẵn sàng khám phá!'
      ],
      duration: 1200
    },
    'dictionary': {
      appName: 'Từ điển',
      loadingSteps: [
        'Đang tải từ vựng...',
        'Đang khởi tạo tra cứu...'
      ],
      duration: 1000
    },
    'music': {
      appName: 'Âm nhạc',
      loadingSteps: [
        'Đang tải playlist...',
        'Đang chuẩn bị audio...',
        'Sẵn sàng phát nhạc!'
      ],
      duration: 1200
    },
    'business': {
      appName: 'Kinh doanh',
      loadingSteps: [
        'Đang tải dữ liệu...',
        'Đang phân tích báo cáo...',
        'Sẵn sàng!'
      ],
      duration: 1300
    },
    'graph-visualizer': {
      appName: 'Graph Visualizer',
      loadingSteps: [
        'Đang khởi tạo canvas...',
        'Đang tải thuật toán...',
        'Sẵn sàng!'
      ],
      duration: 1100
    }
  };

  /**
   * Show splash screen for an app
   */
  showSplash(config: AppSplashConfig, onComplete: () => void): void {
    // Get app-specific config or use defaults
    const appConfig = this.appConfigs[config.appId] || {};
    
    const finalConfig: AppSplashConfig = {
      ...config,
      loadingText: config.loadingText || appConfig.loadingSteps?.[0] || 'Đang tải...',
      loadingSteps: config.loadingSteps || appConfig.loadingSteps || ['Đang tải...', 'Sẵn sàng!'],
      duration: config.duration || appConfig.duration || 1500
    };

    this.currentApp.set(finalConfig);
    this.loadingProgress.set(0);
    this.currentStep.set(finalConfig.loadingSteps![0]);
    this.isVisible.set(true);
    this.onCompleteCallback = onComplete;

    // Start progress animation
    this.animateProgress(finalConfig);
  }

  /**
   * Animate the loading progress
   */
  private animateProgress(config: AppSplashConfig): void {
    const duration = config.duration!;
    const steps = config.loadingSteps!;
    const stepDuration = duration / steps.length;
    const progressIncrement = 100 / (duration / 30); // Update every 30ms
    
    let currentProgress = 0;
    let currentStepIndex = 0;

    this.progressInterval = setInterval(() => {
      currentProgress += progressIncrement;
      
      // Update step based on progress
      const newStepIndex = Math.min(
        Math.floor((currentProgress / 100) * steps.length),
        steps.length - 1
      );
      
      if (newStepIndex !== currentStepIndex) {
        currentStepIndex = newStepIndex;
        this.currentStep.set(steps[currentStepIndex]);
      }

      this.loadingProgress.set(Math.min(currentProgress, 100));

      // Complete
      if (currentProgress >= 100) {
        this.completeSplash();
      }
    }, 30);
  }

  /**
   * Complete and hide splash screen
   */
  private completeSplash(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // Small delay before hiding for smooth transition
    setTimeout(() => {
      this.isVisible.set(false);
      
      // Execute callback
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
        this.onCompleteCallback = null;
      }

      // Reset state after animation
      setTimeout(() => {
        this.currentApp.set(null);
        this.loadingProgress.set(0);
        this.currentStep.set('');
      }, 300);
    }, 200);
  }

  /**
   * Force hide splash (for edge cases)
   */
  hideSplash(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.isVisible.set(false);
    this.currentApp.set(null);
    this.onCompleteCallback = null;
  }

  /**
   * Check if app should show splash
   */
  shouldShowSplash(appId: string): boolean {
    // Apps that should show splash screen
    const appsWithSplash = [
      'stock',
      'expense', 
      'weather',
      'news',
      'tuoitre-news',
      'yugioh',
      'countries',
      'dictionary',
      'music',
      'business',
      'graph-visualizer'
    ];
    return appsWithSplash.includes(appId);
  }
}
