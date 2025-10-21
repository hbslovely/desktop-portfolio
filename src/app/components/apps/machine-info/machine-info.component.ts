import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-machine-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './machine-info.component.html',
  styleUrl: './machine-info.component.scss',
})
export class MachineInfoComponent implements OnInit {
  // System information
  systemInfo = signal({
    os: '',
    browser: '',
    language: '',
    platform: '',
    userAgent: '',
    screenResolution: '',
    colorDepth: 0,
    timezone: '',
    cookieEnabled: false,
    onlineStatus: false
  });

  // Performance metrics
  performanceInfo = signal({
    memoryUsage: '',
    connectionType: '',
    hardwareConcurrency: 0,
    devicePixelRatio: 0,
    timestamp: ''
  });

  // Network information
  networkInfo = signal({
    connectionSpeed: '',
    effectiveType: '',
    downlink: 0,
    rtt: 0
  });

  constructor() {}

  ngOnInit() {
    this.gatherSystemInfo();
    this.gatherPerformanceInfo();
    this.gatherNetworkInfo();
  }

  gatherSystemInfo() {
    const info = {
      os: this.getOperatingSystem(),
      browser: this.getBrowserInfo(),
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine
    };
    this.systemInfo.set(info);
  }

  gatherPerformanceInfo() {
    const memory = (performance as any).memory;
    const info = {
      memoryUsage: memory ? `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB` : 'Not available',
      connectionType: (navigator as any).connection?.effectiveType || 'Unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      timestamp: new Date().toLocaleString()
    };
    this.performanceInfo.set(info);
  }

  gatherNetworkInfo() {
    const connection = (navigator as any).connection;
    const info = {
      connectionSpeed: connection ? `${connection.downlink}Mbps` : 'Unknown',
      effectiveType: connection?.effectiveType || 'Unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0
    };
    this.networkInfo.set(info);
  }

  private getOperatingSystem(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  refreshInfo() {
    this.gatherSystemInfo();
    this.gatherPerformanceInfo();
    this.gatherNetworkInfo();
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here

    });
  }
}
