import { Component, OnInit, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { WeatherService, WeatherData, HourlyData, DailyData } from '../../../services/weather.service';

@Component({
  selector: 'app-weather-app',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './weather-app.component.html',
  styleUrls: ['./weather-app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeatherAppComponent implements OnInit, OnDestroy {
  weatherData = signal<WeatherData | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedView = signal<'current' | 'hourly' | 'daily'>('current');
  units = signal<'metric' | 'us'>('metric');
  locationName = signal<string>('Current Location');

  private readonly destroy$ = new Subject<void>();

  // For temperature bar calculation
  private minTempRange = 0;
  private maxTempRange = 40;

  constructor(private weatherService: WeatherService) {}

  async ngOnInit(): Promise<void> {
    await this.loadWeather();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadWeather(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const weatherObservable = await this.weatherService.getWeatherForCurrentLocation(
        ['current', 'hourly', 'daily'],
        this.units()
      );

      weatherObservable.pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data) => {
          this.weatherData.set(data);
          this.loading.set(false);
          this.updateLocationName(data.lat, data.lon);
          this.calculateTempRange(data);
        },
        error: () => {
          this.error.set('Failed to load weather data. Please try again.');
          this.loading.set(false);
        }
      });
    } catch {
      this.error.set('Failed to get location. Please enable location services.');
      this.loading.set(false);
    }
  }

  private calculateTempRange(data: WeatherData): void {
    if (data.daily?.data) {
      const temps = data.daily.data.flatMap(d => [
        d.all_day?.temperature_min || 0,
        d.all_day?.temperature_max || 0
      ]);
      this.minTempRange = Math.min(...temps) - 5;
      this.maxTempRange = Math.max(...temps) + 5;
    }
  }

  async updateLocationName(lat: number, lon: number) {
    try {
      const cleanLat = parseFloat(String(lat).replace(/[NSEW]/gi, ''));
      const cleanLon = parseFloat(String(lon).replace(/[NSEW]/gi, ''));
      
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${cleanLat}&lon=${cleanLon}&zoom=10`, {
        headers: {
          'User-Agent': 'DesktopPortfolioApp/1.0'
        }
      });
      const data = await response.json();
      
      if (data.error) {
        this.locationName.set(`${cleanLat.toFixed(2)}°, ${cleanLon.toFixed(2)}°`);
        return;
      }
      
      if (data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.state;
        const country = data.address.country;
        this.locationName.set(city ? `${city}, ${country}` : country || `${cleanLat.toFixed(2)}°, ${cleanLon.toFixed(2)}°`);
      } else {
        this.locationName.set(`${cleanLat.toFixed(2)}°, ${cleanLon.toFixed(2)}°`);
      }
    } catch (error) {
      const cleanLat = parseFloat(String(lat).replace(/[NSEW]/gi, ''));
      const cleanLon = parseFloat(String(lon).replace(/[NSEW]/gi, ''));
      this.locationName.set(`${cleanLat.toFixed(2)}°, ${cleanLon.toFixed(2)}°`);
    }
  }

  setView(view: 'current' | 'hourly' | 'daily') {
    this.selectedView.set(view);
  }

  toggleUnits() {
    this.units.set(this.units() === 'metric' ? 'us' : 'metric');
    this.loadWeather();
  }

  refresh() {
    this.loadWeather();
  }

  getWeatherIcon(iconNum: number): string {
    return this.weatherService.getWeatherIcon(iconNum);
  }

  formatTemperature(temp: number): string {
    return this.weatherService.formatTemperature(temp, this.units());
  }

  getWindDirection(direction: string): string {
    return this.weatherService.getWindDirectionText(direction);
  }

  getHourlyForecast(): HourlyData[] {
    return this.weatherData()?.hourly?.data.slice(0, 24) || [];
  }

  getDailyForecast(): DailyData[] {
    return this.weatherData()?.daily?.data.slice(0, 7) || [];
  }

  formatHour(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }

  formatDay(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  getPrecipitationChance(hourly: HourlyData): number {
    return hourly.probability?.precipitation || 0;
  }

  getUVIndexLevel(uvIndex: number): string {
    if (uvIndex < 3) return 'Low';
    if (uvIndex < 6) return 'Moderate';
    if (uvIndex < 8) return 'High';
    if (uvIndex < 11) return 'Very High';
    return 'Extreme';
  }

  getUVIndexColor(uvIndex: number): string {
    if (uvIndex < 3) return '#4ade80';
    if (uvIndex < 6) return '#fbbf24';
    if (uvIndex < 8) return '#fb923c';
    if (uvIndex < 11) return '#ef4444';
    return '#991b1b';
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  // Get weather condition for dynamic background
  getWeatherCondition(): string {
    const data = this.weatherData();
    if (!data) return 'default';

    const iconNum = data.current.icon_num;
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 20;

    if (isNight && iconNum <= 3) return 'night';
    if (iconNum <= 2) return 'sunny';
    if (iconNum <= 5) return 'cloudy';
    if (iconNum >= 9 && iconNum <= 12) return 'rainy';
    if (iconNum >= 13 && iconNum <= 14) return 'stormy';
    if (iconNum >= 15 && iconNum <= 17) return 'snowy';
    
    return 'cloudy';
  }

  // Get tab indicator position
  getTabPosition(): number {
    switch (this.selectedView()) {
      case 'current': return 0;
      case 'hourly': return 100;
      case 'daily': return 200;
      default: return 0;
    }
  }

  // Temperature bar calculations for daily view
  getTempBarPosition(minTemp: number): number {
    const range = this.maxTempRange - this.minTempRange;
    return ((minTemp - this.minTempRange) / range) * 100;
  }

  getTempBarWidth(minTemp: number, maxTemp: number): number {
    const range = this.maxTempRange - this.minTempRange;
    return ((maxTemp - minTemp) / range) * 100;
  }
}
