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
  providedIn: 'root',
})
export class AppSplashService {
  // Current splash state
  isVisible = signal(false);
  currentApp = signal<AppSplashConfig | null>(null);
  loadingProgress = signal(0);
  currentStep = signal('');

  // Callback to execute after splash completes
  private onCompleteCallback: (() => void) | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  // App-specific configurations
  private appConfigs: Record<string, Partial<AppSplashConfig>> = {
    business: {
      appName: 'Kinh doanh',
      loadingSteps: ['Đang tải dữ liệu...', 'Đang phân tích báo cáo...', 'Sẵn sàng!'],
      duration: 1300,
    },
    'graph-visualizer': {
      appName: 'Graph Visualizer',
      loadingSteps: ['Đang khởi tạo canvas...', 'Đang tải thuật toán...', 'Sẵn sàng!'],
      duration: 1100,
    },
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
      duration: config.duration || appConfig.duration || 1500,
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
    const appsWithSplash = ['expense', 'business', 'graph-visualizer'];
    return appsWithSplash.includes(appId);
  }
}
