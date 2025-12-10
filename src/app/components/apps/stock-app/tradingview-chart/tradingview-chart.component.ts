import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  OnChanges, 
  SimpleChanges, 
  ElementRef, 
  ViewChild,
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
  HistogramSeries
} from 'lightweight-charts';

export interface OHLCData {
  t: number[];  // timestamps
  o: number[];  // open
  h: number[];  // high
  l: number[];  // low
  c: number[];  // close
  v: number[];  // volume
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

@Component({
  selector: 'app-tradingview-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tv-chart-wrapper">
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
        </div>
      </div>
      
      <div class="chart-container" #chartContainer></div>
      
      <div class="chart-tooltip" *ngIf="tooltipData()">
        <div class="tooltip-header">
          <span class="tooltip-time">{{ tooltipData()!.time }}</span>
          <span class="tooltip-change" [class.positive]="tooltipData()!.change >= 0" [class.negative]="tooltipData()!.change < 0">
            {{ tooltipData()!.change >= 0 ? '+' : '' }}{{ (tooltipData()!.change * 1000).toFixed(0) }}đ
            ({{ tooltipData()!.changePercent >= 0 ? '+' : '' }}{{ tooltipData()!.changePercent.toFixed(2) }}%)
          </span>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row">
            <span class="label">Mở:</span>
            <span class="value">{{ (tooltipData()!.open * 1000) | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Cao:</span>
            <span class="value ceiling">{{ (tooltipData()!.high * 1000) | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Thấp:</span>
            <span class="value floor">{{ (tooltipData()!.low * 1000) | number:'1.0-0' }}đ</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Đóng:</span>
            <span class="value" [class.positive]="tooltipData()!.change >= 0" [class.negative]="tooltipData()!.change < 0">
              {{ (tooltipData()!.close * 1000) | number:'1.0-0' }}đ
            </span>
          </div>
          <div class="tooltip-row">
            <span class="label">KL:</span>
            <span class="value">{{ tooltipData()!.volume | number:'1.0-0' }}</span>
          </div>
        </div>
      </div>

      <div class="chart-legend" *ngIf="symbol">
        <span class="legend-symbol">{{ symbol }}</span>
        <span class="legend-price" *ngIf="currentPrice()">
          {{ (currentPrice()! * 1000) | number:'1.0-0' }}đ
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
    }
  `]
})
export class TradingviewChartComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  
  @Input() data: OHLCData | null = null;
  @Input() symbol: string = '';
  @Input() theme: 'light' | 'dark' = 'dark';

  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Re-export series types for template use
  protected CandlestickSeries = CandlestickSeries;
  protected HistogramSeries = HistogramSeries;

  // Signals
  selectedTimeframe = signal<string>('all');
  chartType = signal<'candlestick' | 'line' | 'area'>('candlestick');
  showVolume = signal(true);
  tooltipData = signal<ChartTooltipData | null>(null);
  currentPrice = signal<number | null>(null);

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
  }

  ngOnDestroy() {
    this.destroyChart();
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
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    for (let i = 0; i < t.length; i++) {
      const time = t[i] as Time;
      
      candleData.push({
        time,
        open: o[i],
        high: h[i],
        low: l[i],
        close: c[i],
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

    // Update current price
    if (c.length > 0) {
      this.currentPrice.set(c[c.length - 1]);
    }

    // Fit content
    this.chart?.timeScale().fitContent();

    // Apply timeframe filter
    this.applyTimeframe();
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
  }
}
