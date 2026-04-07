import { Component, OnInit, OnDestroy, signal, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval } from 'rxjs';
import { WeatherService, WeatherData, HourlyData } from '../../../services/weather.service';

@Component({
  selector: 'app-weather-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-widget.component.html',
  styleUrls: ['./weather-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeatherWidgetComponent implements OnInit, OnDestroy {
  @Output() openWeatherApp = new EventEmitter<void>();

  weatherData = signal<WeatherData | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  locationName = signal<string>('Loading...');
  currentTime = signal<string>('');
  units = signal<'metric' | 'us'>('metric');

  private readonly destroy$ = new Subject<void>();

  constructor(private weatherService: WeatherService) {}

  async ngOnInit(): Promise<void> {
    await this.loadWeather();
    this.startClock();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startClock(): void {
    this.updateTime();
    interval(60000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.updateTime());
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }));
  }

  async loadWeather(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const weatherObservable = await this.weatherService.getWeatherForCurrentLocation(
        ['current', 'hourly'],
        this.units()
      );

      weatherObservable.pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data) => {
          this.weatherData.set(data);
          this.loading.set(false);
          this.updateLocationName(data.lat, data.lon);
        },
        error: () => {
          this.error.set('Unable to load weather');
          this.loading.set(false);
        }
      });
    } catch {
      this.error.set('Location unavailable');
      this.loading.set(false);
    }
  }

  private async updateLocationName(lat: number, lon: number): Promise<void> {
    try {
      const cleanLat = parseFloat(String(lat).replace(/[NSEW]/gi, ''));
      const cleanLon = parseFloat(String(lon).replace(/[NSEW]/gi, ''));
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${cleanLat}&lon=${cleanLon}&zoom=10`,
        { headers: { 'User-Agent': 'DesktopPortfolioApp/1.0' } }
      );
      const data = await response.json();
      
      if (data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.state;
        this.locationName.set(city || 'Unknown');
      } else {
        this.locationName.set('Unknown');
      }
    } catch {
      this.locationName.set('Unknown');
    }
  }

  refresh(): void {
    this.loadWeather();
  }

  getWeatherIcon(iconNum: number): string {
    return this.weatherService.getWeatherIcon(iconNum);
  }

  formatTemperature(temp: number): string {
    return `${Math.round(temp)}°`;
  }

  getHourlyForecast(): HourlyData[] {
    return this.weatherData()?.hourly?.data.slice(0, 5) || [];
  }

  formatHour(dateString: string, index: number): string {
    if (index === 0) return 'Now';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }

  getWeatherCondition(): string {
    const data = this.weatherData();
    if (!data) return 'default';

    const iconNum = data.current.icon_num;
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 20;

    if (isNight) return 'night';
    if (iconNum <= 2) return 'sunny';
    if (iconNum <= 5) return 'cloudy';
    if (iconNum >= 9 && iconNum <= 14) return 'rainy';
    
    return 'cloudy';
  }

  onOpenApp(): void {
    this.openWeatherApp.emit();
  }
}
