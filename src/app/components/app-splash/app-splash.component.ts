import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppSplashService } from '../../services/app-splash.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div class="splash-backdrop" *ngIf="splashService.isVisible()"></div>
    
    <!-- Splash Window -->
    <div class="splash-window" *ngIf="splashService.isVisible()">
      <!-- Left side - App branding -->
      <div class="splash-branding">
        <div class="splash-icon">
          <img 
            *ngIf="!isIconClass()" 
            [src]="splashService.currentApp()?.appIcon" 
            [alt]="splashService.currentApp()?.appName">
          <i 
            *ngIf="isIconClass()" 
            [class]="splashService.currentApp()?.appIcon">
          </i>
        </div>
        <div class="splash-app-info">
          <div class="splash-title">{{ splashService.currentApp()?.appName }}</div>
          <div class="splash-subtitle">Desktop Portfolio</div>
        </div>
      </div>

      <!-- Right side - Loading info -->
      <div class="splash-loading">
        <!-- Loading spinner -->
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
        </div>

        <!-- Loading Step Text -->
        <div class="splash-step">{{ splashService.currentStep() }}</div>

        <!-- Loading Progress -->
        <div class="splash-progress">
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="splashService.loadingProgress()"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .splash-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 9998;
      animation: backdropFadeIn 0.2s ease;
    }

    @keyframes backdropFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .splash-window {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 420px;
      background: #1a1a1a;
      border: 1px solid #333;
      box-shadow: 
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: windowSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes windowSlideIn {
      from { 
        opacity: 0; 
        transform: translate(-50%, -50%) scale(0.95);
      }
      to { 
        opacity: 1; 
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .splash-branding {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px;
      background: linear-gradient(135deg, #252525 0%, #1a1a1a 100%);
      border-bottom: 1px solid #333;
    }

    .splash-icon {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      flex-shrink: 0;

      img {
        width: 40px;
        height: 40px;
        object-fit: contain;
        filter: brightness(0) invert(1);
      }

      i {
        font-size: 28px;
        color: white;
      }
    }

    .splash-app-info {
      flex: 1;
      min-width: 0;
    }

    .splash-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    .splash-subtitle {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.5px;
    }

    .splash-loading {
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      flex-shrink: 0;

      .spinner-ring {
        width: 100%;
        height: 100%;
        border: 2px solid rgba(59, 130, 246, 0.2);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spinnerRotate 0.8s linear infinite;
      }
    }

    @keyframes spinnerRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .splash-step {
      flex: 1;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .splash-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;

      .progress-track {
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.05);

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #6366f1);
          transition: width 0.1s linear;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
        }
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .splash-window {
        width: calc(100% - 32px);
        max-width: 420px;
      }

      .splash-branding {
        padding: 20px;
      }

      .splash-icon {
        width: 48px;
        height: 48px;

        img { width: 32px; height: 32px; }
        i { font-size: 24px; }
      }

      .splash-title {
        font-size: 1.1rem;
      }
    }
  `]
})
export class AppSplashComponent {
  splashService = inject(AppSplashService);

  isIconClass(): boolean {
    const icon = this.splashService.currentApp()?.appIcon;
    return icon?.startsWith('pi ') || icon?.startsWith('fa ') || false;
  }
}
