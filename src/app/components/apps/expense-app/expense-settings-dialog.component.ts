import { Component, signal, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseSettingsService, ExpenseTheme, ExpenseFontSize, ExpenseLayout, PredictionSettings } from '../../../services/expense-settings.service';

@Component({
  selector: 'app-expense-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dialog-overlay" *ngIf="isVisible" (click)="close()">
      <div class="dialog-container expense-settings-dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h3>
            <i class="pi pi-cog"></i>
            Cài đặt
          </h3>
          <button (click)="close()" class="close-btn">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="dialog-body">
          <!-- Layout Selection -->
          <div class="settings-section">
            <h4 class="section-title">
              <i class="pi pi-desktop"></i>
              Loại giao diện
            </h4>
            <p class="section-description">Chọn phiên bản giao diện</p>
            
            <div class="layout-options">
              <div 
                class="layout-option" 
                [class.active]="selectedLayout() === 'v1'"
                (click)="selectedLayout.set('v1')">
                <div class="layout-preview v1-preview">
                  <div class="preview-header-v1"></div>
                  <div class="preview-content-v1">
                    <div class="preview-sidebar"></div>
                    <div class="preview-main">
                      <div class="preview-row"></div>
                      <div class="preview-row"></div>
                    </div>
                  </div>
                </div>
                <div class="layout-label">
                  <i class="pi pi-list"></i>
                  <span>Giao diện V1</span>
                </div>
                <p class="layout-description">Bố trí truyền thống, header trên cùng</p>
              </div>

              <div 
                class="layout-option" 
                [class.active]="selectedLayout() === 'v2'"
                (click)="selectedLayout.set('v2')">
                <div class="layout-preview v2-preview">
                  <div class="preview-header-v2"></div>
                  <div class="preview-content-v2">
                    <div class="preview-list-item"></div>
                    <div class="preview-list-item"></div>
                    <div class="preview-list-item"></div>
                  </div>
                </div>
                <div class="layout-label">
                  <i class="pi pi-list"></i>
                  <span>Giao diện V2</span>
                </div>
                <p class="layout-description">List hiện đại với thiết kế đẹp hơn</p>
              </div>
            </div>
          </div>

          <!-- Font Size Selection -->
          <div class="settings-section">
            <h4 class="section-title">
              <i class="pi pi-text-width"></i>
              Cỡ chữ
            </h4>
            <p class="section-description">Chọn kích thước chữ phù hợp</p>
            
            <div class="font-size-options">
              <button
                class="font-size-option"
                [class.active]="selectedFontSize() === 'small'"
                (click)="selectedFontSize.set('small')">
                <div class="font-size-preview small">
                  <span>Aa</span>
                </div>
                <span class="font-size-label">Nhỏ</span>
              </button>

              <button
                class="font-size-option"
                [class.active]="selectedFontSize() === 'medium'"
                (click)="selectedFontSize.set('medium')">
                <div class="font-size-preview medium">
                  <span>Aa</span>
                </div>
                <span class="font-size-label">Vừa</span>
              </button>

              <button
                class="font-size-option"
                [class.active]="selectedFontSize() === 'large'"
                (click)="selectedFontSize.set('large')">
                <div class="font-size-preview large">
                  <span>Aa</span>
                </div>
                <span class="font-size-label">Lớn</span>
              </button>
            </div>
          </div>

          <!-- Category Exclusion -->
          <div class="settings-section">
            <h4 class="section-title">
              <i class="pi pi-ban"></i>
              Loại trừ Danh mục
            </h4>
            <p class="section-description">Chọn các danh mục sẽ bị ẩn khỏi danh sách và bộ lọc</p>
            
            <div class="exclude-categories-list">
              <label *ngFor="let cat of allCategories()" class="exclude-category-item">
                <input type="checkbox" 
                       [checked]="isCategoryExcluded(cat)"
                       (change)="toggleExcludeCategory(cat)">
                <span class="category-name">{{ cat }}</span>
              </label>
            </div>
            <div class="exclude-actions">
              <button (click)="selectAllCategories()" class="action-btn-small">Chọn tất cả</button>
              <button (click)="deselectAllCategories()" class="action-btn-small">Bỏ chọn tất cả</button>
            </div>
          </div>

          <!-- Prediction Settings -->
          <div class="settings-section">
            <h4 class="section-title">
              <i class="pi pi-chart-line"></i>
              Cấu hình Dự đoán
            </h4>
            <p class="section-description">Điều chỉnh các thông số để tối ưu độ chính xác dự đoán</p>
            
            <!-- Enable/Disable Methods -->
            <div class="prediction-methods-toggle">
              <h5>Phương pháp dự đoán:</h5>
              <div class="toggle-grid">
                <label class="toggle-item">
                  <input type="checkbox" [(ngModel)]="predictionSettings().enableLinearRegression">
                  <span>Dự đoán xu hướng</span>
                  <small>Phân tích xu hướng tăng/giảm theo thời gian</small>
                </label>
                <label class="toggle-item">
                  <input type="checkbox" [(ngModel)]="predictionSettings().enableMovingAverage">
                  <span>Trung bình động</span>
                  <small>Dựa trên mức chi tiêu trung bình gần đây</small>
                </label>
                <label class="toggle-item">
                  <input type="checkbox" [(ngModel)]="predictionSettings().enableExponentialSmoothing">
                  <span>Làm mịn theo hàm mũ</span>
                  <small>Ưu tiên dữ liệu gần đây hơn</small>
                </label>
                <label class="toggle-item">
                  <input type="checkbox" [(ngModel)]="predictionSettings().enableSeasonalPattern">
                  <span>Mẫu theo thứ trong tuần</span>
                  <small>Học từ thói quen chi tiêu theo ngày</small>
                </label>
              </div>
            </div>

            <!-- Simple Slider Parameters -->
            <div class="simple-params">
              <div class="slider-param">
                <div class="slider-header">
                  <label>
                    <i class="pi pi-calendar"></i>
                    Số ngày lịch sử để phân tích
                  </label>
                  <span class="slider-value">{{ predictionSettings().historicalDays }} ngày</span>
                </div>
                <input type="range" 
                       min="30" 
                       max="180" 
                       step="7"
                       [(ngModel)]="predictionSettings().historicalDays"
                       class="slider-input">
                <div class="slider-labels">
                  <span>30 ngày</span>
                  <span>180 ngày</span>
                </div>
                <div class="slider-description">
                  <i class="pi pi-info-circle"></i>
                  <span>Càng nhiều ngày, dự đoán càng ổn định nhưng phản ứng chậm hơn với thay đổi</span>
                </div>
              </div>

              <div class="slider-param">
                <div class="slider-header">
                  <label>
                    <i class="pi pi-chart-bar"></i>
                    Độ nhạy dự đoán
                  </label>
                  <span class="slider-value">{{ (predictionSettings().exponentialAlpha * 100).toFixed(0) }}%</span>
                </div>
                <input type="range" 
                       min="0" 
                       max="100" 
                       step="5"
                       [ngModel]="predictionSettings().exponentialAlpha * 100"
                       (ngModelChange)="predictionSettings().exponentialAlpha = $event / 100"
                       class="slider-input">
                <div class="slider-labels">
                  <span>Ổn định (0%)</span>
                  <span>Nhạy cảm (100%)</span>
                </div>
                <div class="slider-description">
                  <i class="pi pi-info-circle"></i>
                  <span>Giá trị cao = phản ứng nhanh với thay đổi gần đây, giá trị thấp = ổn định hơn</span>
                </div>
              </div>

              <div class="slider-param">
                <div class="slider-header">
                  <label>
                    <i class="pi pi-clock"></i>
                    Khoảng thời gian trung bình
                  </label>
                  <span class="slider-value">{{ predictionSettings().movingAveragePeriod }} ngày</span>
                </div>
                <input type="range" 
                       min="3" 
                       max="30" 
                       step="1"
                       [(ngModel)]="predictionSettings().movingAveragePeriod"
                       class="slider-input">
                <div class="slider-labels">
                  <span>3 ngày</span>
                  <span>30 ngày</span>
                </div>
                <div class="slider-description">
                  <i class="pi pi-info-circle"></i>
                  <span>Số ngày để tính trung bình: ít ngày = nhạy cảm, nhiều ngày = ổn định</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button (click)="reset()" class="reset-btn">
            <i class="pi pi-refresh"></i>
            Đặt lại mặc định
          </button>
          <button (click)="close()" class="cancel-btn">Hủy</button>
          <button (click)="save()" class="save-btn">
            <i class="pi pi-check"></i>
            Lưu
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
      backdrop-filter: blur(2px);
    }

    .expense-settings-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 90%;
      max-width: 700px;
      max-height: calc(100vh - 120px);
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease-out;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e8e8e8;

      h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #212121;
        display: flex;
        align-items: center;
        gap: 10px;

        i {
          color: #2196F3;
        }
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #757575;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;

        &:hover {
          background: #f5f5f5;
          color: #212121;
        }

        i {
          font-size: 20px;
        }
      }
    }

    .dialog-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .settings-section {
      margin-bottom: 32px;

      &:last-child {
        margin-bottom: 0;
      }

      .section-title {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: #212121;
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          color: #2196F3;
          font-size: 18px;
        }
      }

      .section-description {
        margin: 0 0 20px 0;
        font-size: 13px;
        color: #757575;
      }
    }

    .layout-options {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 0;
    }

    .layout-option {
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
      background: #ffffff;

      &:hover {
        border-color: #2196F3;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
      }

      &.active {
        border-color: #2196F3;
        background: #e3f2fd;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
      }

      .layout-preview {
        width: 100%;
        height: 120px;
        border-radius: 8px;
        margin-bottom: 12px;
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        overflow: hidden;

        .preview-header-v1,
        .preview-header-v2 {
          height: 25px;
          background: #2196F3;
        }

        .preview-content-v1 {
          height: calc(100% - 25px);
          display: flex;
          gap: 4px;
          padding: 4px;

          .preview-sidebar {
            width: 30%;
            background: #ffffff;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
          }

          .preview-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;

            .preview-row {
              flex: 1;
              background: #ffffff;
              border-radius: 4px;
              border: 1px solid #e0e0e0;
            }
          }
        }

        .preview-content-v2 {
          height: calc(100% - 25px);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;

          .preview-list-item {
            flex: 1;
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
            border-left: 3px solid #2196F3;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 6px;

            &::before {
              content: '';
              width: 20%;
              height: 60%;
              background: #e0e0e0;
              border-radius: 3px;
            }

            &::after {
              content: '';
              flex: 1;
              height: 40%;
              background: #f0f0f0;
              border-radius: 3px;
            }
          }
        }
      }

      .layout-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        color: #212121;
        margin-bottom: 6px;

        i {
          color: #2196F3;
          font-size: 16px;
        }
      }

      .layout-description {
        margin: 0;
        font-size: 12px;
        color: #757575;
        line-height: 1.4;
      }
    }

    .font-size-options {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .font-size-option {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #2196F3;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
      }

      &.active {
        border-color: #2196F3;
        background: #e3f2fd;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
      }

      .font-size-preview {
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border-radius: 8px;
        border: 1px solid #e0e0e0;

        span {
          font-weight: 600;
          color: #212121;
        }

        &.small span {
          font-size: 18px;
        }

        &.medium span {
          font-size: 24px;
        }

        &.large span {
          font-size: 32px;
        }
      }

      .font-size-label {
        font-size: 14px;
        font-weight: 500;
        color: #212121;
      }
    }

    .prediction-methods-toggle {
      margin-bottom: 32px;

      h5 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: #212121;
      }

      .toggle-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;

        .toggle-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;

          &:hover {
            background: #eeeeee;
            border-color: #e0e0e0;
          }

          input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
            margin-bottom: 4px;
          }

          span {
            font-size: 14px;
            font-weight: 600;
            color: #212121;
          }

          small {
            font-size: 12px;
            color: #757575;
            line-height: 1.4;
            display: block;
          }
        }
      }
    }

    .exclude-categories-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      margin-bottom: 12px;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }

      .exclude-category-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: white;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: #2196F3;
          background: #f0f9ff;
        }

        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #2196F3;
        }

        .category-name {
          font-size: 14px;
          color: #212121;
          user-select: none;
        }

        &:has(input:checked) {
          background: #e3f2fd;
          border-color: #2196F3;

          .category-name {
            font-weight: 600;
            color: #1976D2;
          }
        }
      }
    }

    .exclude-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;

      .action-btn-small {
        padding: 6px 12px;
        background: #f5f5f5;
        color: #212121;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #e0e0e0;
          border-color: #bdbdbd;
        }
      }
    }

    .simple-params {
      display: flex;
      flex-direction: column;
      gap: 24px;

      .slider-param {
        background: #f9f9f9;
        border-radius: 12px;
        padding: 20px;
        border: 1px solid #e0e0e0;

        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;

          label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #212121;

            i {
              color: #2196F3;
              font-size: 16px;
            }
          }

          .slider-value {
            font-size: 16px;
            font-weight: 700;
            color: #2196F3;
            background: #e3f2fd;
            padding: 6px 12px;
            border-radius: 20px;
          }
        }

        .slider-input {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #e0e0e0;
          outline: none;
          -webkit-appearance: none;
          margin-bottom: 8px;

          &::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #2196F3;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s;

            &:hover {
              background: #1976D2;
              transform: scale(1.1);
            }
          }

          &::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #2196F3;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s;

            &:hover {
              background: #1976D2;
              transform: scale(1.1);
            }
          }
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #757575;
          margin-bottom: 12px;
        }

        .slider-description {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          background: #e3f2fd;
          border-radius: 6px;
          font-size: 12px;
          color: #1976D2;
          line-height: 1.5;

          i {
            margin-top: 2px;
            font-size: 14px;
            flex-shrink: 0;
          }

          span {
            flex: 1;
          }
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #f9f9f9;
      border-top: 1px solid #e8e8e8;

      .reset-btn {
        padding: 8px 16px;
        background: #f5f5f5;
        color: #757575;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;

        &:hover {
          background: #eeeeee;
          color: #212121;
        }

        i {
          font-size: 14px;
        }
      }

      .cancel-btn,
      .save-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .cancel-btn {
        background: #f5f5f5;
        color: #212121;

        &:hover {
          background: #eeeeee;
        }
      }

      .save-btn {
        background: #2196F3;
        color: #ffffff;

        &:hover {
          background: #1976D2;
        }

        i {
          font-size: 14px;
        }
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class ExpenseSettingsDialogComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<{ layout: ExpenseLayout; fontSize: ExpenseFontSize }>();

  selectedLayout = signal<ExpenseLayout>('v1');
  selectedFontSize = signal<ExpenseFontSize>('medium');
  predictionSettings = signal<PredictionSettings>({
    weights: { linear: 0.3, moving: 0.3, exponential: 0.2, seasonal: 0.2 },
    exponentialAlpha: 0.3,
    movingAveragePeriod: 7,
    historicalDays: 60,
    enableLinearRegression: true,
    enableMovingAverage: true,
    enableExponentialSmoothing: true,
    enableSeasonalPattern: true
  });

  // Category exclusion
  excludeCategories = signal<string[]>([]);
  allCategoriesList = [
    'Kinh doanh', 'Đi chợ', 'Siêu thị', 'Ăn uống ngoài', 'Nhà hàng',
    'Đi lại - xăng xe', 'Gia đình/Bạn bè', 'Điện - nước', 'Pet/Thú cưng/Vật nuôi khác',
    'Sức khỏe', 'Thời trang / Mỹ Phẩm/ Làm đẹp', 'Mua sắm / Mua sắm online',
    'Sữa/vitamin/chất bổ/Thuốc khác', 'Từ thiện', 'Điện thoại', 'Sinh hoạt (Lee)',
    'Chi tiêu khác', 'Ăn vặt / Ăn uống ngoài bữa chính', 'Du lịch – Nghỉ dưỡng',
    'Thiết bị làm việc'
  ];

  allCategories(): string[] {
    return this.allCategoriesList;
  }

  isCategoryExcluded(category: string): boolean {
    return this.excludeCategories().includes(category);
  }

  toggleExcludeCategory(category: string): void {
    const current = this.excludeCategories();
    if (current.includes(category)) {
      this.excludeCategories.set(current.filter(c => c !== category));
    } else {
      this.excludeCategories.set([...current, category]);
    }
  }

  selectAllCategories(): void {
    this.excludeCategories.set([...this.allCategoriesList]);
  }

  deselectAllCategories(): void {
    this.excludeCategories.set([]);
  }

  constructor(private settingsService: ExpenseSettingsService) {}

  ngOnInit(): void {
    this.loadCurrentSettings();
  }

  ngOnChanges(): void {
    // Load settings when dialog becomes visible
    if (this.isVisible) {
      this.loadCurrentSettings();
    }
  }

  loadCurrentSettings(): void {
    const settings = this.settingsService.settings();
    this.selectedLayout.set(settings.layout || 'v1');
    this.selectedFontSize.set(settings.fontSize);
    if (settings.prediction) {
      this.predictionSettings.set({ ...settings.prediction });
    }
    if (settings.excludeCategories) {
      this.excludeCategories.set([...settings.excludeCategories]);
    } else {
      this.excludeCategories.set([]);
    }
  }

  close(): void {
    this.onClose.emit();
  }

  save(): void {
    const currentSettings = this.settingsService.settings();
    const settings = {
      layout: this.selectedLayout(),
      theme: 'compact' as ExpenseTheme, // Always use compact theme (like v1)
      fontSize: this.selectedFontSize(),
      prediction: this.predictionSettings(),
      excludeCategories: this.excludeCategories()
    };
    this.settingsService.saveSettings(settings);
    this.onSave.emit({
      layout: settings.layout,
      fontSize: settings.fontSize
    });
    this.close();
  }

  reset(): void {
    this.settingsService.resetSettings();
    this.loadCurrentSettings();
  }

}

