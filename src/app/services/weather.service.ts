import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WeatherData {
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  current: CurrentWeather;
  hourly?: HourlyForecast;
  daily?: DailyForecast;
}

export interface CurrentWeather {
  icon: string;
  icon_num: number;
  summary: string;
  temperature: number;
  feels_like: number;
  wind_chill: number;
  dew_point: number;
  wind: Wind;
  precipitation: Precipitation;
  cloud_cover: number;
  ozone: number;
  pressure: number;
  uv_index: number;
  humidity: number;
  visibility: number;
}

export interface Wind {
  speed: number;
  gusts: number;
  dir: string;
  angle: number;
}

export interface Precipitation {
  total: number;
  type: string;
}

export interface HourlyForecast {
  data: HourlyData[];
}

export interface HourlyData {
  date: string;
  weather: string;
  icon: number;
  summary: string;
  temperature: number;
  feels_like: number;
  wind: Wind;
  precipitation: Precipitation;
  cloud_cover: number;
  humidity: number;
  probability: {
    precipitation: number;
    storm: number;
    freeze: number;
  };
}

export interface DailyForecast {
  data: DailyData[];
}

export interface DailyData {
  day: string;
  weather: string;
  icon: number;
  summary: string;
  all_day: {
    weather: string;
    icon: number;
    temperature: number;
    temperature_min: number;
    temperature_max: number;
    wind: Wind;
    cloud_cover: number;
    precipitation: Precipitation;
  };
  morning?: PeriodData;
  afternoon?: PeriodData;
  evening?: PeriodData;
}

export interface PeriodData {
  weather: string;
  icon: number;
  temperature: number;
  wind: Wind;
  cloud_cover: number;
  precipitation: Precipitation;
}

export interface LocationCoordinates {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl = environment.weatherApiUrl;
  private apiKey = environment.weatherApiKey;

  constructor(private http: HttpClient) {}

  /**
   * Get current location coordinates using browser's Geolocation API
   */
  getCurrentLocation(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          // Fallback to a default location (Ho Chi Minh City)
          console.warn('Geolocation error, using default location:', error);
          resolve({
            lat: 10.8231,
            lon: 106.6297,
            city: 'Ho Chi Minh City',
            country: 'Vietnam'
          });
        },
        {
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    });
  }

  /**
   * Get weather data for specific coordinates
   * Based on Meteosource API: https://www.meteosource.com/client/interactive-documentation#/Point%20weather/point_point_get
   */
  getWeather(
    lat: number,
    lon: number,
    sections: string[] = ['current', 'hourly', 'daily'],
    units: 'metric' | 'us' | 'uk' | 'ca' = 'metric'
  ): Observable<WeatherData> {
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lon', lon.toString())
      .set('sections', sections.join(','))
      .set('units', units)
      .set('key', this.apiKey);

    return this.http.get<WeatherData>(`${this.apiUrl}/point`, { params }).pipe(
      catchError(error => {
        console.error('Weather API error:', error);
        return throwError(() => new Error('Failed to fetch weather data'));
      })
    );
  }

  /**
   * Get weather for current location
   */
  async getWeatherForCurrentLocation(
    sections: string[] = ['current', 'hourly', 'daily'],
    units: 'metric' | 'us' | 'uk' | 'ca' = 'metric'
  ): Promise<Observable<WeatherData>> {
    const location = await this.getCurrentLocation();
    return this.getWeather(location.lat, location.lon, sections, units);
  }

  /**
   * Get weather icon URL
   */
  getWeatherIcon(iconNum: number): string {
    return `https://www.meteosource.com/static/img/ico/weather/${iconNum}.svg`;
  }

  /**
   * Get weather icon class for custom icons
   */
  getWeatherIconClass(iconNum: number): string {
    // Icon mapping based on Meteosource icon numbers
    const iconMap: { [key: number]: string } = {
      1: 'pi pi-sun',           // Clear sky
      2: 'pi pi-sun',           // Mostly clear
      3: 'pi pi-cloud',         // Partly cloudy
      4: 'pi pi-cloud',         // Mostly cloudy
      5: 'pi pi-cloud',         // Overcast
      6: 'pi pi-cloud',         // Partly cloudy and light rain
      7: 'pi pi-cloud',         // Mostly cloudy and light rain
      8: 'pi pi-cloud',         // Overcast and light rain
      9: 'pi pi-cloud',         // Overcast and rain
      10: 'pi pi-cloud',        // Light rain
      11: 'pi pi-cloud',        // Rain
      12: 'pi pi-cloud',        // Possible rain
      13: 'pi pi-bolt',         // Rain and thunderstorm
      14: 'pi pi-bolt',         // Thunderstorm
      15: 'pi pi-cloud',        // Light snow
      16: 'pi pi-cloud',        // Snow
      17: 'pi pi-cloud',        // Rain and snow
      18: 'pi pi-cloud',        // Fog
      19: 'pi pi-cloud',        // Light fog
    };
    return iconMap[iconNum] || 'pi pi-cloud';
  }

  /**
   * Format temperature
   */
  formatTemperature(temp: number, units: 'metric' | 'us' | 'uk' | 'ca' = 'metric'): string {
    const unit = units === 'metric' ? '°C' : '°F';
    return `${Math.round(temp)}${unit}`;
  }

  /**
   * Get wind direction text
   */
  getWindDirectionText(direction: string): string {
    const directions: { [key: string]: string } = {
      'N': 'North',
      'NE': 'Northeast',
      'E': 'East',
      'SE': 'Southeast',
      'S': 'South',
      'SW': 'Southwest',
      'W': 'West',
      'NW': 'Northwest'
    };
    return directions[direction] || direction;
  }
}

