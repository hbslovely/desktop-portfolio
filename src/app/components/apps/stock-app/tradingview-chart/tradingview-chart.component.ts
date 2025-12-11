import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  OnChanges, 
  SimpleChanges, 
  ElementRef, 
  ViewChild,
  HostListener,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  HistogramData,
  Time,
  CrosshairMode,
  ColorType,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineData
} from 'lightweight-charts';

export interface OHLCData {
  t: number[];  // timestamps
  o: number[];  // open
  h: number[];  // high
  l: number[];  // low
  c: number[];  // close
  v: number[];  // volume
}

export interface ChartMarker {
  time: number;      // Unix timestamp
  type: 'buy' | 'sell';
  price: number;
  quantity?: number;
  label?: string;
  profitLoss?: number;        // Profit/loss amount (for this transaction)
  profitLossPercent?: number; // Profit/loss percentage (for this transaction)
  originalBuyPrice?: number;  // Original buy price for calculating total profit
  totalValue?: number;        // Total value of this transaction
}

interface MarkerTooltipData {
  time: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  profitLoss?: number;
  profitLossPercent?: number;
  originalBuyPrice?: number;
  totalValue?: number;
}

interface ChartTooltipData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface IndicatorSettings {
  ma: { enabled: boolean; period: number; color: string };
  ema: { enabled: boolean; period: number; color: string };
  bb: { enabled: boolean; period: number; stdDev: number; color: string };
  sma2: { enabled: boolean; period: number; color: string };
}

interface ChartThemeSettings {
  preset: 'dark' | 'light' | 'tradingview' | 'custom';
  background: string;
  upColor: string;
  downColor: string;
  gridColor: string;
  textColor: string;
}

@Component({
  selector: 'app-tradingview-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tv-chart-wrapper" [class.fullscreen]="isFullscreen()" #chartWrapper>
      <div class="chart-toolbar">
        <div class="timeframe-buttons">
          <button 
            *ngFor="let tf of timeframes" 
            [class.active]="selectedTimeframe() === tf.value"
            (click)="changeTimeframe(tf.value)">
            {{ tf.label }}
          </button>
        </div>
        <div class="chart-type-buttons">
          <button 
            [class.active]="chartType() === 'candlestick'"
            (click)="setChartType('candlestick')"
            title="Biểu đồ nến">
            <i class="pi pi-chart-bar"></i>
          </button>
          <button 
            [class.active]="chartType() === 'line'"
            (click)="setChartType('line')"
            title="Biểu đồ đường">
            <i class="pi pi-chart-line"></i>
          </button>
          <button 
            [class.active]="chartType() === 'area'"
            (click)="setChartType('area')"
            title="Biểu đồ vùng">
            <i class="pi pi-stop"></i>
          </button>
        </div>
        <div class="chart-actions">
          <button (click)="resetChart()" title="Reset zoom">
            <i class="pi pi-refresh"></i>
          </button>
          <button (click)="toggleVolume()" [class.active]="showVolume()" title="Hiển thị khối lượng">
            <i class="pi pi-chart-bar"></i> Vol
          </button>
          <button (click)="toggleIndicatorPanel()" [class.active]="showIndicatorPanel()" title="Chỉ báo kỹ thuật">
            <i class="pi pi-sliders-h"></i> Chỉ báo
          </button>
          <button (click)="toggleFullscreen()" [class.active]="isFullscreen()" title="Toàn màn hình">
            <i class="pi" [class.pi-window-maximize]="!isFullscreen()" [class.pi-window-minimize]="isFullscreen()"></i>
          </button>
        </div>
      </div>

      <!-- Indicator Settings Panel -->
      <div class="indicator-panel" *ngIf="showIndicatorPanel()">
        <div class="indicator-panel-header">
          <span>Cài đặt chỉ báo kỹ thuật</span>
          <button class="close-btn" (click)="showIndicatorPanel.set(false)">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="indicator-panel-body">
          <!-- MA Settings -->
          <div class="indicator-group">
            <div class="indicator-header">
              <label class="indicator-toggle">
                <input type="checkbox" [checked]="indicators().ma.enabled" 
                       (change)="toggleIndicator('ma')">
                <span class="toggle-label">MA (Moving Average)</span>
              </label>
              <div class="indicator-color" [style.background]="indicators().ma.color"></div>
            </div>
            <div class="indicator-settings" *ngIf="indicators().ma.enabled">
              <div class="setting-row">
                <label>Chu kỳ:</label>
                <input type="number" [value]="indicators().ma.period" 
                       (input)="updateIndicator('ma', 'period', +$any($event.target).value)"
                       min="5" max="200" step="1">
              </div>
              <div class="setting-row">
                <label>Màu:</label>
                <input type="color" [value]="indicators().ma.color"
                       (input)="updateIndicator('ma', 'color', $any($event.target).value)">
              </div>
              <div class="period-presets">
                <button (click)="updateIndicator('ma', 'period', 10)" [class.active]="indicators().ma.period === 10">MA10</button>
                <button (click)="updateIndicator('ma', 'period', 20)" [class.active]="indicators().ma.period === 20">MA20</button>
                <button (click)="updateIndicator('ma', 'period', 50)" [class.active]="indicators().ma.period === 50">MA50</button>
                <button (click)="updateIndicator('ma', 'period', 100)" [class.active]="indicators().ma.period === 100">MA100</button>
                <button (click)="updateIndicator('ma', 'period', 200)" [class.active]="indicators().ma.period === 200">MA200</button>
              </div>
            </div>
          </div>

          <!-- EMA Settings -->
          <div class="indicator-group">
            <div class="indicator-header">
              <label class="indicator-toggle">
                <input type="checkbox" [checked]="indicators().ema.enabled"
                       (change)="toggleIndicator('ema')">
                <span class="toggle-label">EMA (Exponential MA)</span>
              </label>
              <div class="indicator-color" [style.background]="indicators().ema.color"></div>
            </div>
            <div class="indicator-settings" *ngIf="indicators().ema.enabled">
              <div class="setting-row">
                <label>Chu kỳ:</label>
                <input type="number" [value]="indicators().ema.period"
                       (input)="updateIndicator('ema', 'period', +$any($event.target).value)"
                       min="5" max="200" step="1">
              </div>
              <div class="setting-row">
                <label>Màu:</label>
                <input type="color" [value]="indicators().ema.color"
                       (input)="updateIndicator('ema', 'color', $any($event.target).value)">
              </div>
              <div class="period-presets">
                <button (click)="updateIndicator('ema', 'period', 12)" [class.active]="indicators().ema.period === 12">EMA12</button>
                <button (click)="updateIndicator('ema', 'period', 26)" [class.active]="indicators().ema.period === 26">EMA26</button>
                <button (click)="updateIndicator('ema', 'period', 50)" [class.active]="indicators().ema.period === 50">EMA50</button>
                <button (click)="updateIndicator('ema', 'period', 200)" [class.active]="indicators().ema.period === 200">EMA200</button>
              </div>
            </div>
          </div>

          <!-- Bollinger Bands Settings -->
          <div class="indicator-group">
            <div class="indicator-header">
              <label class="indicator-toggle">
                <input type="checkbox" [checked]="indicators().bb.enabled"
                       (change)="toggleIndicator('bb')">
                <span class="toggle-label">Bollinger Bands</span>
              </label>
              <div class="indicator-color" [style.background]="indicators().bb.color"></div>
            </div>
            <div class="indicator-settings" *ngIf="indicators().bb.enabled">
              <div class="setting-row">
                <label>Chu kỳ:</label>
                <input type="number" [value]="indicators().bb.period"
                       (input)="updateIndicator('bb', 'period', +$any($event.target).value)"
                       min="10" max="50" step="1">
              </div>
              <div class="setting-row">
                <label>Độ lệch chuẩn:</label>
                <input type="number" [value]="indicators().bb.stdDev"
                       (input)="updateIndicator('bb', 'stdDev', +$any($event.target).value)"
                       min="1" max="4" step="0.5">
              </div>
              <div class="setting-row">
                <label>Màu:</label>
                <input type="color" [value]="indicators().bb.color"
                       (input)="updateIndicator('bb', 'color', $any($event.target).value)">
              </div>
            </div>
          </div>

          <!-- SMA 2 Settings -->
          <div class="indicator-group">
            <div class="indicator-header">
              <label class="indicator-toggle">
                <input type="checkbox" [checked]="indicators().sma2.enabled"
                       (change)="toggleIndicator('sma2')">
                <span class="toggle-label">MA thứ 2</span>
              </label>
              <div class="indicator-color" [style.background]="indicators().sma2.color"></div>
            </div>
            <div class="indicator-settings" *ngIf="indicators().sma2.enabled">
              <div class="setting-row">
                <label>Chu kỳ:</label>
                <input type="number" [value]="indicators().sma2.period"
                       (input)="updateIndicator('sma2', 'period', +$any($event.target).value)"
                       min="5" max="200" step="1">
              </div>
              <div class="setting-row">
                <label>Màu:</label>
                <input type="color" [value]="indicators().sma2.color"
                       (input)="updateIndicator('sma2', 'color', $any($event.target).value)">
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="panel-divider">
            <span>Giao diện biểu đồ</span>
          </div>

          <!-- Theme Settings -->
          <div class="indicator-group theme-group">
            <div class="indicator-header">
              <span class="toggle-label">🎨 Chủ đề</span>
            </div>
            <div class="indicator-settings">
              <div class="theme-presets">
                <button class="theme-btn" [class.active]="chartTheme().preset === 'dark'" 
                        (click)="setThemePreset('dark')">
                  <span class="theme-preview dark-preview"></span>
                  <span>Tối</span>
                </button>
                <button class="theme-btn" [class.active]="chartTheme().preset === 'light'"
                        (click)="setThemePreset('light')">
                  <span class="theme-preview light-preview"></span>
                  <span>Sáng</span>
                </button>
                <button class="theme-btn" [class.active]="chartTheme().preset === 'tradingview'"
                        (click)="setThemePreset('tradingview')">
                  <span class="theme-preview tv-preview"></span>
                  <span>TradingView</span>
                </button>
                <button class="theme-btn" [class.active]="chartTheme().preset === 'custom'"
                        (click)="setThemePreset('custom')">
                  <span class="theme-preview custom-preview"></span>
                  <span>Tùy chỉnh</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Custom Theme Settings -->
          <div class="indicator-group" *ngIf="chartTheme().preset === 'custom'">
            <div class="indicator-header">
              <span class="toggle-label">Tùy chỉnh màu sắc</span>
            </div>
            <div class="indicator-settings">
              <div class="setting-row">
                <label>Nền:</label>
                <input type="color" [value]="chartTheme().background"
                       (input)="updateTheme('background', $any($event.target).value)">
              </div>
              <div class="setting-row">
                <label>Nến tăng:</label>
                <input type="color" [value]="chartTheme().upColor"
                       (input)="updateTheme('upColor', $any($event.target).value)">
              </div>
              <div class="setting-row">
                <label>Nến giảm:</label>
                <input type="color" [value]="chartTheme().downColor"
                       (input)="updateTheme('downColor', $any($event.target).value)">
              </div>
              <div class="setting-row">
                <label>Đường lưới:</label>
                <input type="color" [value]="chartTheme().gridColor"
                       (input)="updateTheme('gridColor', $any($event.target).value)">
              </div>
              <div class="setting-row">
                <label>Chữ:</label>
                <input type="color" [value]="chartTheme().textColor"
                       (input)="updateTheme('textColor', $any($event.target).value)">
              </div>
            </div>
          </div>

          <!-- Candle Style -->
          <div class="indicator-group">
            <div class="indicator-header">
              <span class="toggle-label">🕯️ Kiểu nến</span>
            </div>
            <div class="indicator-settings">
              <div class="candle-style-presets">
                <button class="style-btn" [class.active]="candleStyle() === 'filled'"
                        (click)="setCandleStyle('filled')">
                  <span class="candle-icon filled"></span>
                  <span>Đặc</span>
                </button>
                <button class="style-btn" [class.active]="candleStyle() === 'hollow'"
                        (click)="setCandleStyle('hollow')">
                  <span class="candle-icon hollow"></span>
                  <span>Rỗng</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="indicator-panel-footer">
          <button class="btn-reset" (click)="resetIndicators()">
            <i class="pi pi-refresh"></i> Reset mặc định
          </button>
          <button class="btn-apply" (click)="applyIndicators()">
            <i class="pi pi-check"></i> Áp dụng
          </button>
        </div>
      </div>
      
      <div class="chart-container" #chartContainer></div>
      
      <div class="chart-tooltip" *ngIf="tooltipData()">
        <div class="tooltip-header">
          <span class="tooltip-time">{{ tooltipData()!.time }}</span>
          <span class="tooltip-change" [class.positive]="tooltipData()!.change >= 0" [class.negative]="tooltipData()!.change < 0">
            {{ tooltipData()!.change >= 0 ? '+' : '' }}{{ tooltipData()!.change | number:'1.0-0' }}đ
            ({{ tooltipData()!.changePercent >= 0 ? '+' : '' }}{{ tooltipData()!.changePercent.toFixed(2) }}%)
          </span>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row">
            <span class="label">Mở:</span>
            <span class="value">{{ tooltipData()!.open | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Cao:</span>
            <span class="value ceiling">{{ tooltipData()!.high | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Thấp:</span>
            <span class="value floor">{{ tooltipData()!.low | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Đóng:</span>
            <span class="value" [class.positive]="tooltipData()!.change >= 0" [class.negative]="tooltipData()!.change < 0">
              {{ tooltipData()!.close | number:'1.0-0' }}đ
            </span>
          </div>
          <div class="tooltip-row">
            <span class="label">KL:</span>
            <span class="value">{{ tooltipData()!.volume | number:'1.0-0' }}</span>
          </div>
        </div>
      </div>

      <!-- Marker Tooltip -->
      <div class="marker-tooltip" *ngIf="markerTooltipData()" 
           [class.buy]="markerTooltipData()!.type === 'buy'"
           [class.sell]="markerTooltipData()!.type === 'sell'"
           [class.profit]="markerTooltipData()!.profitLoss !== undefined && markerTooltipData()!.profitLoss! >= 0"
           [class.loss]="markerTooltipData()!.profitLoss !== undefined && markerTooltipData()!.profitLoss! < 0">
        <div class="marker-tooltip-header">
          <span class="marker-type">{{ markerTooltipData()!.type === 'buy' ? '▲ MUA' : '▼ BÁN' }}</span>
          <span class="marker-time">{{ markerTooltipData()!.time }}</span>
        </div>
        <div class="marker-tooltip-body">
          <div class="tooltip-row">
            <span class="label">Giá {{ markerTooltipData()!.type === 'buy' ? 'mua' : 'bán' }}:</span>
            <span class="value">{{ markerTooltipData()!.price | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row" *ngIf="markerTooltipData()!.originalBuyPrice && markerTooltipData()!.type === 'sell'">
            <span class="label">Giá mua gốc:</span>
            <span class="value muted">{{ markerTooltipData()!.originalBuyPrice | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Khối lượng:</span>
            <span class="value">{{ markerTooltipData()!.quantity | number:'1.0-0' }} CP</span>
          </div>
          <div class="tooltip-row" *ngIf="markerTooltipData()!.totalValue">
            <span class="label">Giá trị:</span>
            <span class="value">{{ markerTooltipData()!.totalValue | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row profit-row" *ngIf="markerTooltipData()!.profitLoss !== undefined && markerTooltipData()!.type === 'sell'">
            <span class="label">{{ markerTooltipData()!.profitLoss! >= 0 ? '💰 Lãi:' : '📉 Lỗ:' }}</span>
            <span class="value profit-value" [class.positive]="markerTooltipData()!.profitLoss! >= 0" [class.negative]="markerTooltipData()!.profitLoss! < 0">
              {{ markerTooltipData()!.profitLoss! >= 0 ? '+' : '' }}{{ markerTooltipData()!.profitLoss! | number:'1.0-0' }}đ
              <span class="percent" *ngIf="markerTooltipData()!.profitLossPercent !== undefined">
                ({{ markerTooltipData()!.profitLossPercent! >= 0 ? '+' : '' }}{{ markerTooltipData()!.profitLossPercent!.toFixed(2) }}%)
              </span>
            </span>
          </div>
        </div>
      </div>

      <div class="chart-legend" *ngIf="symbol">
        <span class="legend-symbol">{{ symbol }}</span>
        <span class="legend-price" *ngIf="currentPrice()">
          {{ currentPrice()! | number:'1.0-0' }}đ
        </span>
      </div>
    </div>
  `,
  styles: [`
    .tv-chart-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 400px;
      background: #131722;
      border-radius: 8px;
      overflow: hidden;
    }

    .tv-chart-wrapper.fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      z-index: 9999;
      border-radius: 0;
    }

    .tv-chart-wrapper.fullscreen .chart-container {
      height: calc(100vh - 48px);
      min-height: calc(100vh - 48px);
    }

    .chart-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #1e222d;
      border-bottom: 1px solid #2a2e39;
      gap: 12px;
    }

    .timeframe-buttons, .chart-type-buttons, .chart-actions {
      display: flex;
      gap: 4px;
    }

    .chart-toolbar button {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: #787b86;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .chart-toolbar button:hover {
      background: #2a2e39;
      color: #d1d4dc;
    }

    .chart-toolbar button.active {
      background: #2962ff;
      color: white;
    }

    .chart-container {
      width: 100%;
      height: calc(100% - 48px);
      min-height: 350px;
    }

    .chart-tooltip {
      position: absolute;
      top: 60px;
      left: 12px;
      background: rgba(30, 34, 45, 0.95);
      border: 1px solid #2a2e39;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      color: #d1d4dc;
      pointer-events: none;
      z-index: 10;
      min-width: 160px;
    }

    .tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #2a2e39;
    }

    .tooltip-time {
      color: #787b86;
      font-weight: 500;
    }

    .tooltip-change {
      font-weight: 600;
    }

    .tooltip-change.positive { color: #26a69a; }
    .tooltip-change.negative { color: #ef5350; }

    .tooltip-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .tooltip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tooltip-row .label {
      color: #787b86;
    }

    .tooltip-row .value {
      font-weight: 500;
      font-family: monospace;
    }

    .tooltip-row .value.positive { color: #26a69a; }
    .tooltip-row .value.negative { color: #ef5350; }
    .tooltip-row .value.ceiling { color: #ce93d8; }
    .tooltip-row .value.floor { color: #4fc3f7; }

    .chart-legend {
      position: absolute;
      top: 60px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px;
      background: rgba(30, 34, 45, 0.8);
      border-radius: 6px;
      z-index: 5;
    }

    .legend-symbol {
      font-size: 16px;
      font-weight: 700;
      color: white;
    }

    .legend-price {
      font-size: 14px;
      font-weight: 600;
      color: #26a69a;
      font-family: monospace;
    }

    /* Marker Tooltip */
    .marker-tooltip {
      position: absolute;
      top: 60px;
      right: 200px;
      background: rgba(30, 34, 45, 0.98);
      border: 2px solid #2a2e39;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #d1d4dc;
      pointer-events: none;
      z-index: 15;
      min-width: 180px;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }

    .marker-tooltip.buy {
      border-color: #26a69a;
    }

    .marker-tooltip.sell {
      border-color: #ef5350;
    }

    .marker-tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2a2e39;
    }

    .marker-type {
      font-weight: 700;
      font-size: 14px;
    }

    .marker-tooltip.buy .marker-type {
      color: #26a69a;
    }

    .marker-tooltip.sell .marker-type {
      color: #ef5350;
    }

    .marker-time {
      color: #787b86;
      font-size: 11px;
    }

    .marker-tooltip-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .marker-tooltip-body .tooltip-row .value {
      font-size: 13px;
    }

    /* Indicator Panel */
    .indicator-panel {
      position: absolute;
      top: 48px;
      right: 0;
      width: 320px;
      max-height: calc(100% - 60px);
      background: #1e222d;
      border: 1px solid #2a2e39;
      border-radius: 8px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden;
    }

    .indicator-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #2a2e39;
      border-bottom: 1px solid #363a45;

      span {
        font-size: 13px;
        font-weight: 600;
        color: #d1d4dc;
      }

      .close-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: #787b86;
        cursor: pointer;
        border-radius: 4px;

        &:hover {
          background: #363a45;
          color: #d1d4dc;
        }
      }
    }

    .indicator-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .indicator-group {
      background: #252932;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }

    .indicator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #2a2e39;
    }

    .indicator-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;

      input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .toggle-label {
        font-size: 13px;
        font-weight: 500;
        color: #d1d4dc;
      }
    }

    .indicator-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid #363a45;
    }

    .indicator-settings {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      gap: 10px;

      label {
        font-size: 12px;
        color: #787b86;
        min-width: 80px;
      }

      input[type="number"] {
        flex: 1;
        padding: 6px 10px;
        background: #1e222d;
        border: 1px solid #363a45;
        border-radius: 4px;
        color: #d1d4dc;
        font-size: 12px;

        &:focus {
          outline: none;
          border-color: #2962ff;
        }
      }

      input[type="color"] {
        width: 32px;
        height: 24px;
        padding: 0;
        border: 1px solid #363a45;
        border-radius: 4px;
        cursor: pointer;
        background: transparent;
      }
    }

    .period-presets {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      button {
        padding: 4px 10px;
        background: #1e222d;
        border: 1px solid #363a45;
        border-radius: 4px;
        color: #787b86;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #2a2e39;
          color: #d1d4dc;
        }

        &.active {
          background: #2962ff;
          border-color: #2962ff;
          color: white;
        }
      }
    }

    /* Panel Divider */
    .panel-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0 12px;
      color: #787b86;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      &::before, &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #363a45;
      }
    }

    /* Theme Settings */
    .theme-group .indicator-header {
      padding: 8px 12px;
    }

    .theme-presets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .theme-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px;
      background: #1e222d;
      border: 2px solid #363a45;
      border-radius: 8px;
      color: #787b86;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #2962ff;
        color: #d1d4dc;
      }

      &.active {
        border-color: #2962ff;
        background: rgba(41, 98, 255, 0.1);
        color: #2962ff;
      }
    }

    .theme-preview {
      width: 40px;
      height: 24px;
      border-radius: 4px;
      border: 1px solid #363a45;

      &.dark-preview {
        background: linear-gradient(135deg, #131722 50%, #1e222d 50%);
      }

      &.light-preview {
        background: linear-gradient(135deg, #ffffff 50%, #e1e3eb 50%);
      }

      &.tv-preview {
        background: linear-gradient(135deg, #1e222d 50%, #2a2e39 50%);
      }

      &.custom-preview {
        background: linear-gradient(135deg, 
          #26a69a 0%, #26a69a 25%, 
          #ef5350 25%, #ef5350 50%,
          #131722 50%, #131722 75%,
          #2962ff 75%, #2962ff 100%);
      }
    }

    /* Candle Style */
    .candle-style-presets {
      display: flex;
      gap: 10px;
    }

    .style-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #1e222d;
      border: 2px solid #363a45;
      border-radius: 8px;
      color: #787b86;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #2962ff;
        color: #d1d4dc;
      }

      &.active {
        border-color: #2962ff;
        background: rgba(41, 98, 255, 0.1);
        color: #2962ff;
      }
    }

    .candle-icon {
      width: 20px;
      height: 32px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        height: 100%;
        background: #26a69a;
      }

      &::after {
        content: '';
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        width: 12px;
        height: 16px;
        border-radius: 2px;
      }

      &.filled::after {
        background: #26a69a;
      }

      &.hollow::after {
        background: transparent;
        border: 2px solid #26a69a;
      }
    }

    .indicator-panel-footer {
      display: flex;
      gap: 10px;
      padding: 12px;
      background: #2a2e39;
      border-top: 1px solid #363a45;

      button {
        flex: 1;
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;

        i {
          font-size: 12px;
        }
      }

      .btn-reset {
        background: #363a45;
        color: #d1d4dc;

        &:hover {
          background: #454a57;
        }
      }

      .btn-apply {
        background: #2962ff;
        color: white;

        &:hover {
          background: #1e4bd8;
        }
      }
    }

    /* Responsive */
    @media (max-width: 600px) {
      .chart-toolbar {
        flex-wrap: wrap;
        padding: 6px 8px;
      }

      .timeframe-buttons {
        order: 1;
        width: 100%;
        justify-content: center;
        margin-bottom: 6px;
      }

      .chart-type-buttons, .chart-actions {
        order: 2;
      }

      .chart-toolbar button {
        padding: 4px 8px;
        font-size: 11px;
      }

      .chart-tooltip {
        display: none;
      }

      .indicator-panel {
        width: 100%;
        right: 0;
        left: 0;
        border-radius: 0;
      }
    }
  `]
})
export class TradingviewChartComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chartWrapper', { static: true }) chartWrapper!: ElementRef<HTMLDivElement>;
  
  @Input() data: OHLCData | null = null;
  @Input() symbol: string = '';
  @Input() theme: 'light' | 'dark' = 'dark';
  @Input() markers: ChartMarker[] = [];

  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  // Indicator series
  private maSeries: ISeriesApi<'Line'> | null = null;
  private emaSeries: ISeriesApi<'Line'> | null = null;
  private sma2Series: ISeriesApi<'Line'> | null = null;
  private bbUpperSeries: ISeriesApi<'Line'> | null = null;
  private bbMiddleSeries: ISeriesApi<'Line'> | null = null;
  private bbLowerSeries: ISeriesApi<'Line'> | null = null;
  
  // Marker series for buy/sell points
  private buyMarkerSeries: ISeriesApi<'Line'> | null = null;
  private buyMarkerStemSeries: ISeriesApi<'Line'> | null = null;
  private sellMarkerSeries: ISeriesApi<'Line'> | null = null;
  private sellMarkerStemSeries: ISeriesApi<'Line'> | null = null;

  // Re-export series types for template use
  protected CandlestickSeries = CandlestickSeries;
  protected HistogramSeries = HistogramSeries;

  // Signals
  selectedTimeframe = signal<string>('all');
  chartType = signal<'candlestick' | 'line' | 'area'>('candlestick');
  showVolume = signal(true);
  tooltipData = signal<ChartTooltipData | null>(null);
  markerTooltipData = signal<MarkerTooltipData | null>(null);
  currentPrice = signal<number | null>(null);
  showIndicatorPanel = signal(false);
  isFullscreen = signal(false);
  
  // Indicator settings
  indicators = signal<IndicatorSettings>({
    ma: { enabled: false, period: 20, color: '#ff9800' },
    ema: { enabled: false, period: 12, color: '#2196f3' },
    bb: { enabled: false, period: 20, stdDev: 2, color: '#9c27b0' },
    sma2: { enabled: false, period: 50, color: '#4caf50' }
  });

  // Chart theme settings
  chartTheme = signal<ChartThemeSettings>({
    preset: 'dark',
    background: '#131722',
    upColor: '#26a69a',
    downColor: '#ef5350',
    gridColor: '#1e222d',
    textColor: '#d1d4dc'
  });

  candleStyle = signal<'filled' | 'hollow'>('filled');

  // Theme presets
  private themePresets: Record<string, Omit<ChartThemeSettings, 'preset'>> = {
    dark: {
      background: '#131722',
      upColor: '#26a69a',
      downColor: '#ef5350',
      gridColor: '#1e222d',
      textColor: '#d1d4dc'
    },
    light: {
      background: '#ffffff',
      upColor: '#26a69a',
      downColor: '#ef5350',
      gridColor: '#e1e3eb',
      textColor: '#191919'
    },
    tradingview: {
      background: '#1e222d',
      upColor: '#089981',
      downColor: '#f23645',
      gridColor: '#2a2e39',
      textColor: '#b2b5be'
    },
    custom: {
      background: '#131722',
      upColor: '#26a69a',
      downColor: '#ef5350',
      gridColor: '#1e222d',
      textColor: '#d1d4dc'
    }
  };

  timeframes = [
    { label: '1T', value: '1m' },
    { label: '3T', value: '3m' },
    { label: '6T', value: '6m' },
    { label: '1N', value: '1y' },
    { label: '3N', value: '3y' },
    { label: 'Tất cả', value: 'all' }
  ];

  ngOnInit() {
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.chart) {
      this.updateChartData();
    }
    if (changes['theme'] && this.chart) {
      this.applyTheme();
    }
    if (changes['markers'] && this.chart) {
      this.updateMarkers();
    }
  }

  ngOnDestroy() {
    this.destroyChart();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isFullscreen()) {
      this.toggleFullscreen();
    }
  }

  private initChart() {
    if (!this.chartContainer?.nativeElement) return;

    const container = this.chartContainer.nativeElement;
    
    this.chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#2962ff',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2962ff',
        },
        horzLine: {
          width: 1,
          color: '#2962ff',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2962ff',
        },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale: 'vi-VN',
        dateFormat: 'dd/MM/yyyy',
      },
    });

    // Create candlestick series (v5 API)
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    // Create volume series (v5 API)
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    this.chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Subscribe to crosshair move for tooltip
    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        this.tooltipData.set(null);
        this.markerTooltipData.set(null);
        return;
      }

      const candleData = param.seriesData.get(this.candlestickSeries!) as CandlestickData;
      const volumeData = param.seriesData.get(this.volumeSeries!) as HistogramData;

      if (candleData) {
        const change = candleData.close - candleData.open;
        const changePercent = (change / candleData.open) * 100;
        
        // Format time
        const timestamp = typeof param.time === 'number' 
          ? param.time * 1000 
          : new Date(param.time as string).getTime();
        const date = new Date(timestamp);
        const timeStr = date.toLocaleDateString('vi-VN', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });

        this.tooltipData.set({
          time: timeStr,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData?.value || 0,
          change,
          changePercent,
        });
      }

      // Check if hovering over a marker
      this.updateMarkerTooltip(param.time as number);
    });

    // Setup resize observer
    this.resizeObserver = new ResizeObserver(entries => {
      if (this.chart && entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        this.chart.applyOptions({ width, height });
      }
    });
    this.resizeObserver.observe(container);

    // Load initial data
    if (this.data) {
      this.updateChartData();
    }
  }

  private updateChartData() {
    if (!this.data || !this.candlestickSeries || !this.volumeSeries) return;

    const { t, o, h, l, c, v } = this.data;
    
    // Convert to candlestick format
    // Note: Prices are stored in thousands (15 = 15,000đ), multiply by 1000
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    for (let i = 0; i < t.length; i++) {
      const time = t[i] as Time;
      
      candleData.push({
        time,
        open: o[i] * 1000,
        high: h[i] * 1000,
        low: l[i] * 1000,
        close: c[i] * 1000,
      });

      // Color volume based on price movement
      const color = c[i] >= o[i] ? '#26a69a80' : '#ef535080';
      volumeData.push({
        time,
        value: v[i],
        color,
      });
    }

    // Set data
    this.candlestickSeries.setData(candleData);
    this.volumeSeries.setData(volumeData);

    // Update current price (multiply by 1000)
    if (c.length > 0) {
      this.currentPrice.set(c[c.length - 1] * 1000);
    }

    // Update markers if any
    if (this.markers.length > 0) {
      this.updateMarkers();
    }

    // Fit content
    this.chart?.timeScale().fitContent();

    // Apply timeframe filter
    this.applyTimeframe();
  }

  /**
   * Update markers (buy/sell points) on the chart using line series
   * In lightweight-charts v5, setMarkers was removed, so we use line series with point markers
   * Buy markers: Green arrow pointing up (▲)
   * Sell markers: Red arrow pointing down (▼)
   */
  private updateMarkers() {
    if (!this.chart || !this.markers.length) {
      this.clearMarkerSeries();
      return;
    }

    // Clear existing marker series
    this.clearMarkerSeries();

    // Separate buy and sell markers
    const buyMarkers = this.markers.filter(m => m.type === 'buy');
    const sellMarkers = this.markers.filter(m => m.type === 'sell');

    // Calculate price range for offset
    const allPrices = this.markers.map(m => m.price);
    const priceRange = Math.max(...allPrices) - Math.min(...allPrices);
    const offset = priceRange * 0.02; // 2% offset for arrow effect

    // Create buy markers series (green - arrow pointing up)
    if (buyMarkers.length > 0) {
      // Main point (arrow tip)
      this.buyMarkerSeries = this.chart.addSeries(LineSeries, {
        color: '#00c853', // Bright green
        lineWidth: 3,
        lineVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 10,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });

      const buyData: LineData[] = this.deduplicateAndSortMarkerData(
        buyMarkers.map(m => ({
          time: m.time as Time,
          value: m.price, // Position at exact buy price
        }))
      );

      this.buyMarkerSeries.setData(buyData);

      // Arrow stem (below the point)
      this.buyMarkerStemSeries = this.chart.addSeries(LineSeries, {
        color: '#00c853',
        lineWidth: 4,
        lineVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 5,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      const buyDataStem: LineData[] = this.deduplicateAndSortMarkerData(
        buyMarkers.map(m => ({
          time: m.time as Time,
          value: m.price - offset, // Below the main point
        }))
      );

      this.buyMarkerStemSeries.setData(buyDataStem);
    }

    // Create sell markers series (red - arrow pointing down)
    if (sellMarkers.length > 0) {
      // Main point (arrow tip)
      this.sellMarkerSeries = this.chart.addSeries(LineSeries, {
        color: '#ff1744', // Bright red
        lineWidth: 3,
        lineVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 10,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });

      const sellData: LineData[] = this.deduplicateAndSortMarkerData(
        sellMarkers.map(m => ({
          time: m.time as Time,
          value: m.price, // Position at exact sell price
        }))
      );

      this.sellMarkerSeries.setData(sellData);

      // Arrow stem (above the point)
      this.sellMarkerStemSeries = this.chart.addSeries(LineSeries, {
        color: '#ff1744',
        lineWidth: 4,
        lineVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 5,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      const sellDataStem: LineData[] = this.deduplicateAndSortMarkerData(
        sellMarkers.map(m => ({
          time: m.time as Time,
          value: m.price + offset, // Above the main point
        }))
      );

      this.sellMarkerStemSeries.setData(sellDataStem);
    }
  }

  /**
   * Clear marker series from chart
   */
  private clearMarkerSeries() {
    if (this.chart) {
      if (this.buyMarkerSeries) {
        this.chart.removeSeries(this.buyMarkerSeries);
        this.buyMarkerSeries = null;
      }
      if (this.buyMarkerStemSeries) {
        this.chart.removeSeries(this.buyMarkerStemSeries);
        this.buyMarkerStemSeries = null;
      }
      if (this.sellMarkerSeries) {
        this.chart.removeSeries(this.sellMarkerSeries);
        this.sellMarkerSeries = null;
      }
      if (this.sellMarkerStemSeries) {
        this.chart.removeSeries(this.sellMarkerStemSeries);
        this.sellMarkerStemSeries = null;
      }
    }
  }

  /**
   * Deduplicate and sort marker data by time
   * TradingView requires unique timestamps in ascending order
   */
  private deduplicateAndSortMarkerData(data: LineData[]): LineData[] {
    // Sort by time first
    const sorted = data.sort((a, b) => (a.time as number) - (b.time as number));

    // Deduplicate by keeping the average value for duplicate timestamps
    const timeMap = new Map<number, { sum: number; count: number }>();
    for (const item of sorted) {
      const time = item.time as number;
      const existing = timeMap.get(time);
      if (existing) {
        existing.sum += item.value;
        existing.count += 1;
      } else {
        timeMap.set(time, { sum: item.value, count: 1 });
      }
    }

    // Convert back to array with averaged values
    return Array.from(timeMap.entries())
      .map(([time, { sum, count }]) => ({
        time: time as Time,
        value: sum / count,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
  }

  /**
   * Update marker tooltip when hovering near a marker
   */
  private updateMarkerTooltip(hoverTime: number) {
    if (!this.markers.length) {
      this.markerTooltipData.set(null);
      return;
    }

    // Find marker at or near the current hover time
    const marker = this.markers.find(m => m.time === hoverTime);
    
    if (marker) {
      const timestamp = marker.time * 1000;
      const date = new Date(timestamp);
      const timeStr = date.toLocaleDateString('vi-VN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Calculate profit/loss if we have original buy price
      let profitLoss = marker.profitLoss;
      let profitLossPercent = marker.profitLossPercent;
      
      if (marker.type === 'sell' && marker.originalBuyPrice && !profitLoss) {
        profitLoss = marker.price - marker.originalBuyPrice;
        profitLossPercent = ((marker.price - marker.originalBuyPrice) / marker.originalBuyPrice) * 100;
      }

      this.markerTooltipData.set({
        time: timeStr,
        type: marker.type,
        price: marker.price, // Already in VND
        quantity: marker.quantity || 0,
        profitLoss: profitLoss,
        profitLossPercent: profitLossPercent,
        originalBuyPrice: marker.originalBuyPrice,
        totalValue: marker.totalValue,
      });
    } else {
      this.markerTooltipData.set(null);
    }
  }

  changeTimeframe(timeframe: string) {
    this.selectedTimeframe.set(timeframe);
    this.applyTimeframe();
  }

  private applyTimeframe() {
    if (!this.chart || !this.data?.t.length) return;

    const now = Date.now() / 1000;
    const lastTimestamp = this.data.t[this.data.t.length - 1];
    let fromTimestamp: number;

    switch (this.selectedTimeframe()) {
      case '1m':
        fromTimestamp = lastTimestamp - 30 * 24 * 60 * 60;
        break;
      case '3m':
        fromTimestamp = lastTimestamp - 90 * 24 * 60 * 60;
        break;
      case '6m':
        fromTimestamp = lastTimestamp - 180 * 24 * 60 * 60;
        break;
      case '1y':
        fromTimestamp = lastTimestamp - 365 * 24 * 60 * 60;
        break;
      case '3y':
        fromTimestamp = lastTimestamp - 3 * 365 * 24 * 60 * 60;
        break;
      default:
        this.chart.timeScale().fitContent();
        return;
    }

    this.chart.timeScale().setVisibleRange({
      from: fromTimestamp as Time,
      to: lastTimestamp as Time,
    });
  }

  setChartType(type: 'candlestick' | 'line' | 'area') {
    this.chartType.set(type);
    
    // For now, candlestick is the main type
    // Line and area can be added later with proper series management
    if (this.candlestickSeries) {
      this.candlestickSeries.applyOptions({
        visible: type === 'candlestick',
      });
    }
  }

  toggleVolume() {
    this.showVolume.update(v => !v);
    if (this.volumeSeries) {
      this.volumeSeries.applyOptions({
        visible: this.showVolume(),
      });
    }
  }

  resetChart() {
    this.chart?.timeScale().fitContent();
  }

  toggleFullscreen() {
    this.isFullscreen.update(v => !v);
    // Need to resize chart after fullscreen toggle
    setTimeout(() => {
      if (this.chart && this.chartContainer?.nativeElement) {
        const container = this.chartContainer.nativeElement;
        this.chart.resize(container.clientWidth, container.clientHeight);
        this.chart.timeScale().fitContent();
      }
    }, 100);
  }

  private applyTheme() {
    if (!this.chart) return;

    const isDark = this.theme === 'dark';
    this.chart.applyOptions({
      layout: {
        background: { 
          type: ColorType.Solid, 
          color: isDark ? '#131722' : '#ffffff' 
        },
        textColor: isDark ? '#d1d4dc' : '#191919',
      },
      grid: {
        vertLines: { color: isDark ? '#1e222d' : '#e1e3eb' },
        horzLines: { color: isDark ? '#1e222d' : '#e1e3eb' },
      },
    });
  }

  private destroyChart() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
    this.candlestickSeries = null;
    this.volumeSeries = null;
    this.lineSeries = null;
    this.areaSeries = null;
    this.maSeries = null;
    this.emaSeries = null;
    this.sma2Series = null;
    this.bbUpperSeries = null;
    this.bbMiddleSeries = null;
    this.bbLowerSeries = null;
    this.buyMarkerSeries = null;
    this.sellMarkerSeries = null;
  }

  // ============ INDICATOR METHODS ============

  toggleIndicatorPanel() {
    this.showIndicatorPanel.update(v => !v);
  }

  toggleIndicator(type: keyof IndicatorSettings) {
    this.indicators.update(current => ({
      ...current,
      [type]: { ...current[type], enabled: !current[type].enabled }
    }));
  }

  updateIndicator(type: keyof IndicatorSettings, field: string, value: number | string) {
    this.indicators.update(current => ({
      ...current,
      [type]: { ...current[type], [field]: value }
    }));
  }

  resetIndicators() {
    this.indicators.set({
      ma: { enabled: false, period: 20, color: '#ff9800' },
      ema: { enabled: false, period: 12, color: '#2196f3' },
      bb: { enabled: false, period: 20, stdDev: 2, color: '#9c27b0' },
      sma2: { enabled: false, period: 50, color: '#4caf50' }
    });
    this.clearIndicatorSeries();
  }

  applyIndicators() {
    this.updateIndicatorSeries();
    this.applyChartTheme();
    this.showIndicatorPanel.set(false);
  }

  // ============ THEME METHODS ============

  setThemePreset(preset: 'dark' | 'light' | 'tradingview' | 'custom') {
    const presetColors = this.themePresets[preset];
    this.chartTheme.set({
      preset,
      ...presetColors
    });
  }

  updateTheme(field: keyof Omit<ChartThemeSettings, 'preset'>, value: string) {
    this.chartTheme.update(current => ({
      ...current,
      preset: 'custom',
      [field]: value
    }));
  }

  setCandleStyle(style: 'filled' | 'hollow') {
    this.candleStyle.set(style);
  }

  private applyChartTheme() {
    if (!this.chart || !this.candlestickSeries) return;

    const theme = this.chartTheme();
    const style = this.candleStyle();

    // Apply chart layout
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.textColor,
      },
      grid: {
        vertLines: { color: theme.gridColor },
        horzLines: { color: theme.gridColor },
      },
    });

    // Apply candlestick colors
    if (style === 'filled') {
      this.candlestickSeries.applyOptions({
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderUpColor: theme.upColor,
        borderDownColor: theme.downColor,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
      });
    } else {
      // Hollow style: up candles are hollow (border only)
      this.candlestickSeries.applyOptions({
        upColor: 'transparent',
        downColor: theme.downColor,
        borderUpColor: theme.upColor,
        borderDownColor: theme.downColor,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
      });
    }

    // Update volume colors
    if (this.volumeSeries && this.data) {
      const { t, o, c, v } = this.data;
      const volumeData: HistogramData[] = [];
      
      for (let i = 0; i < t.length; i++) {
        const color = c[i] >= o[i] 
          ? theme.upColor + '80'  // 50% opacity
          : theme.downColor + '80';
        volumeData.push({
          time: t[i] as Time,
          value: v[i],
          color,
        });
      }
      
      this.volumeSeries.setData(volumeData);
    }
  }

  private clearIndicatorSeries() {
    if (this.chart) {
      if (this.maSeries) { this.chart.removeSeries(this.maSeries); this.maSeries = null; }
      if (this.emaSeries) { this.chart.removeSeries(this.emaSeries); this.emaSeries = null; }
      if (this.sma2Series) { this.chart.removeSeries(this.sma2Series); this.sma2Series = null; }
      if (this.bbUpperSeries) { this.chart.removeSeries(this.bbUpperSeries); this.bbUpperSeries = null; }
      if (this.bbMiddleSeries) { this.chart.removeSeries(this.bbMiddleSeries); this.bbMiddleSeries = null; }
      if (this.bbLowerSeries) { this.chart.removeSeries(this.bbLowerSeries); this.bbLowerSeries = null; }
    }
  }

  private updateIndicatorSeries() {
    if (!this.chart || !this.data) return;

    const { t, c } = this.data;
    const ind = this.indicators();

    // Clear existing indicator series
    this.clearIndicatorSeries();

    // MA
    if (ind.ma.enabled) {
      const maData = this.calculateSMA(c, ind.ma.period);
      this.maSeries = this.chart.addSeries(LineSeries, {
        color: ind.ma.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      const lineData: LineData[] = [];
      for (let i = 0; i < maData.length; i++) {
        if (maData[i] !== null) {
          lineData.push({ time: t[i] as Time, value: maData[i]! });
        }
      }
      this.maSeries.setData(lineData);
    }

    // EMA
    if (ind.ema.enabled) {
      const emaData = this.calculateEMA(c, ind.ema.period);
      this.emaSeries = this.chart.addSeries(LineSeries, {
        color: ind.ema.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      const lineData: LineData[] = [];
      for (let i = 0; i < emaData.length; i++) {
        if (emaData[i] !== null) {
          lineData.push({ time: t[i] as Time, value: emaData[i]! });
        }
      }
      this.emaSeries.setData(lineData);
    }

    // SMA 2
    if (ind.sma2.enabled) {
      const sma2Data = this.calculateSMA(c, ind.sma2.period);
      this.sma2Series = this.chart.addSeries(LineSeries, {
        color: ind.sma2.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      const lineData: LineData[] = [];
      for (let i = 0; i < sma2Data.length; i++) {
        if (sma2Data[i] !== null) {
          lineData.push({ time: t[i] as Time, value: sma2Data[i]! });
        }
      }
      this.sma2Series.setData(lineData);
    }

    // Bollinger Bands
    if (ind.bb.enabled) {
      const bbData = this.calculateBollingerBands(c, ind.bb.period, ind.bb.stdDev);
      
      // Upper band
      this.bbUpperSeries = this.chart.addSeries(LineSeries, {
        color: ind.bb.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      // Middle band (SMA)
      this.bbMiddleSeries = this.chart.addSeries(LineSeries, {
        color: ind.bb.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      // Lower band
      this.bbLowerSeries = this.chart.addSeries(LineSeries, {
        color: ind.bb.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      const upperData: LineData[] = [];
      const middleData: LineData[] = [];
      const lowerData: LineData[] = [];
      
      for (let i = 0; i < bbData.upper.length; i++) {
        if (bbData.upper[i] !== null) {
          upperData.push({ time: t[i] as Time, value: bbData.upper[i]! });
        }
        if (bbData.middle[i] !== null) {
          middleData.push({ time: t[i] as Time, value: bbData.middle[i]! });
        }
        if (bbData.lower[i] !== null) {
          lowerData.push({ time: t[i] as Time, value: bbData.lower[i]! });
        }
      }
      
      this.bbUpperSeries.setData(upperData);
      this.bbMiddleSeries.setData(middleData);
      this.bbLowerSeries.setData(lowerData);
    }
  }

  // Calculate Simple Moving Average
  private calculateSMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j];
        }
        result.push(sum / period);
      }
    }
    
    return result;
  }

  // Calculate Exponential Moving Average
  private calculateEMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA value is SMA
    let ema = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      ema += data[i];
    }
    ema = ema / Math.min(period, data.length);
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        result.push(ema);
      } else {
        ema = (data[i] - ema) * multiplier + ema;
        result.push(ema);
      }
    }
    
    return result;
  }

  // Calculate Bollinger Bands
  private calculateBollingerBands(data: number[], period: number, stdDev: number): {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  } {
    const middle = this.calculateSMA(data, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (middle[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        // Calculate standard deviation
        let sumSquares = 0;
        for (let j = 0; j < period; j++) {
          const diff = data[i - j] - middle[i]!;
          sumSquares += diff * diff;
        }
        const std = Math.sqrt(sumSquares / period);
        
        upper.push(middle[i]! + stdDev * std);
        lower.push(middle[i]! - stdDev * std);
      }
    }
    
    return { upper, middle, lower };
  }
}
