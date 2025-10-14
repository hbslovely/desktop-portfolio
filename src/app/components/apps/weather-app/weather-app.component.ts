import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeatherService, WeatherData, HourlyData, DailyData } from '../../../services/weather.service';

@Component({
  selector: 'app-weather-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-app.component.html',
  styleUrls: ['./weather-app.component.scss']
})
export class WeatherAppComponent implements OnInit {
  weatherData = signal<WeatherData | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedView = signal<'current' | 'hourly' | 'daily'>('current');
  units = signal<'metric' | 'us'>('metric');
  locationName = signal<string>('Current Location');

  constructor(private weatherService: WeatherService) {}

  async ngOnInit() {
    await this.loadWeather();
  }

  async loadWeather() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const weatherObservable = await this.weatherService.getWeatherForCurrentLocation(
        ['current', 'hourly', 'daily'],
        this.units()
      );

      weatherObservable.subscribe({
        next: (data) => {
          this.weatherData.set(data);
          this.loading.set(false);
          this.updateLocationName(data.lat, data.lon);
        },
        error: (err) => {
          this.error.set('Failed to load weather data. Please try again.');
          this.loading.set(false);
          console.error('Weather error:', err);
        }
      });
    } catch (err) {
      this.error.set('Failed to get location. Please enable location services.');
      this.loading.set(false);
      console.error('Location error:', err);
    }
  }

  async updateLocationName(lat: number, lon: number) {
    // Use OpenStreetMap Nominatim for reverse geocoding
    try {
      // Ensure lat and lon are proper numbers without any suffixes
      const cleanLat = parseFloat(String(lat).replace(/[NSEW]/gi, ''));
      const cleanLon = parseFloat(String(lon).replace(/[NSEW]/gi, ''));
      
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${cleanLat}&lon=${cleanLon}&zoom=10`, {
        headers: {
          'User-Agent': 'DesktopPortfolioApp/1.0'
        }
      });
      const data = await response.json();
      
      if (data.error) {
        console.error('Geocoding API error:', data.error);
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
      console.error('Reverse geocoding error:', error);
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
    return new Date().toLocaleTimeString();
  }
}

