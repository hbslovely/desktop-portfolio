import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowManagerService } from '../../../services/window-manager.service';

interface ProcessStats {
  windowId: string;
  title: string;
  icon: string;
  status: 'running' | 'minimized' | 'maximized';
  memory: string;
  cpu: string;
  zIndex: number;
  isFocused: boolean;
  startTime: Date;
}

interface HistoryPoint {
  timestamp: number;
  value: number;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-manager.component.html',
  styleUrls: ['./task-manager.component.scss']
})
export class TaskManagerComponent implements OnInit, OnDestroy {
  windowManager = inject(WindowManagerService);
  
  // Expose Math for template
  Math = Math;
  
  activeTab = signal<'processes' | 'performance' | 'details' | 'startup'>('processes');
  sortBy = signal<'name' | 'status' | 'memory' | 'cpu'>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');
  selectedProcess = signal<string | null>(null);
  searchQuery = signal<string>('');
  viewMode = signal<'detailed' | 'simple'>('detailed');
  autoRefresh = signal<boolean>(true);
  refreshInterval = signal<number>(2000);
  
  // Performance history
  cpuHistory: HistoryPoint[] = [];
  memoryHistory: HistoryPoint[] = [];
  maxHistoryPoints = 60;
  
  private refreshTimer: any;
  private processStartTimes = new Map<string, Date>();

  ngOnInit() {
    // Initialize performance history
    this.updatePerformanceHistory();
    
    // Start auto-refresh
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    }
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => {
      this.updatePerformanceHistory();
    }, this.refreshInterval());
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  setRefreshInterval(interval: number) {
    this.refreshInterval.set(interval);
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    }
  }

  updatePerformanceHistory() {
    const windows = this.windowManager.windowList();
    const now = Date.now();
    const cpu = Math.min(windows.length * 8 + Math.random() * 5, 100);
    const memory = windows.length * 45 + Math.random() * 20;

    this.cpuHistory.push({ timestamp: now, value: cpu });
    this.memoryHistory.push({ timestamp: now, value: memory });

    // Keep only last maxHistoryPoints
    if (this.cpuHistory.length > this.maxHistoryPoints) {
      this.cpuHistory.shift();
    }
    if (this.memoryHistory.length > this.maxHistoryPoints) {
      this.memoryHistory.shift();
    }
  }

  // Compute process stats from window list
  processes = computed(() => {
    const windows = this.windowManager.windowList();
    return windows.map(window => {
      // Track start time for each process
      if (!this.processStartTimes.has(window.id)) {
        this.processStartTimes.set(window.id, new Date());
      }
      
      return {
        windowId: window.id,
        title: window.title,
        icon: window.icon,
        status: window.isMaximized ? 'maximized' as const : 
                window.isMinimized ? 'minimized' as const : 
                'running' as const,
        memory: this.getRandomMemory(),
        cpu: this.getRandomCpu(),
        zIndex: window.zIndex,
        isFocused: window.isFocused,
        startTime: this.processStartTimes.get(window.id) || new Date()
      };
    });
  });

  // Sorted and filtered processes
  sortedProcesses = computed(() => {
    let procs = [...this.processes()];
    const sortBy = this.sortBy();
    const direction = this.sortDirection();
    const search = this.searchQuery().toLowerCase().trim();

    // Filter by search query
    if (search) {
      procs = procs.filter(p => 
        p.title.toLowerCase().includes(search) ||
        p.windowId.toLowerCase().includes(search) ||
        p.status.toLowerCase().includes(search)
      );
    }

    // Sort
    procs.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'memory':
          comparison = parseFloat(a.memory) - parseFloat(b.memory);
          break;
        case 'cpu':
          comparison = parseFloat(a.cpu) - parseFloat(b.cpu);
          break;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return procs;
  });

  // Performance stats
  performanceStats = computed(() => {
    const windows = this.windowManager.windowList();
    const totalMemory = windows.length * 45; // Mock memory per window
    const cpuUsage = Math.min(windows.length * 8, 100);
    
    return {
      totalWindows: windows.length,
      activeWindows: windows.filter(w => !w.isMinimized).length,
      minimizedWindows: windows.filter(w => w.isMinimized).length,
      maximizedWindows: windows.filter(w => w.isMaximized).length,
      totalMemory: `${totalMemory} MB`,
      cpuUsage: `${cpuUsage}%`,
      uptime: this.getUptime()
    };
  });

  setActiveTab(tab: 'processes' | 'performance' | 'details' | 'startup') {
    this.activeTab.set(tab);
  }

  setViewMode(mode: 'detailed' | 'simple') {
    this.viewMode.set(mode);
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  setSortBy(column: 'name' | 'status' | 'memory' | 'cpu') {
    if (this.sortBy() === column) {
      // Toggle direction if same column
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set('asc');
    }
  }

  selectProcess(windowId: string) {
    this.selectedProcess.set(
      this.selectedProcess() === windowId ? null : windowId
    );
  }

  focusWindow(windowId: string) {
    this.windowManager.focusWindow(windowId);
    this.windowManager.restoreWindow(windowId);
  }

  minimizeWindow(windowId: string) {
    this.windowManager.minimizeWindow(windowId);
  }

  maximizeWindow(windowId: string) {
    this.windowManager.maximizeWindow(windowId);
  }

  closeWindow(windowId: string) {
    this.windowManager.closeWindow(windowId);
    if (this.selectedProcess() === windowId) {
      this.selectedProcess.set(null);
    }
  }

  closeAllWindows() {
    const windows = this.windowManager.windowList();
    windows.forEach(window => {
      if (window.id !== 'task-manager') { // Don't close task manager itself
        this.windowManager.closeWindow(window.id);
      }
    });
  }

  minimizeAllWindows() {
    const windows = this.windowManager.windowList();
    windows.forEach(window => {
      if (window.id !== 'task-manager') {
        this.windowManager.minimizeWindow(window.id);
      }
    });
  }

  refreshData() {
    this.updatePerformanceHistory();
  }

  getProcessUptime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getTotalCpu(): number {
    if (this.cpuHistory.length === 0) return 0;
    return this.cpuHistory[this.cpuHistory.length - 1].value;
  }

  getTotalMemory(): number {
    if (this.memoryHistory.length === 0) return 0;
    return this.memoryHistory[this.memoryHistory.length - 1].value;
  }

  getCpuGraphPath(): string {
    if (this.cpuHistory.length < 2) return '';
    
    const width = 300;
    const height = 60;
    const points = this.cpuHistory.slice(-30); // Last 30 points
    const maxValue = 100;
    
    let path = `M 0 ${height}`;
    points.forEach((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (point.value / maxValue) * height;
      path += ` L ${x} ${y}`;
    });
    path += ` L ${width} ${height} Z`;
    
    return path;
  }

  getMemoryGraphPath(): string {
    if (this.memoryHistory.length < 2) return '';
    
    const width = 300;
    const height = 60;
    const points = this.memoryHistory.slice(-30); // Last 30 points
    const maxValue = Math.max(...points.map(p => p.value), 500);
    
    let path = `M 0 ${height}`;
    points.forEach((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (point.value / maxValue) * height;
      path += ` L ${x} ${y}`;
    });
    path += ` L ${width} ${height} Z`;
    
    return path;
  }

  endTask(windowId: string) {
    if (confirm('Are you sure you want to end this task? Unsaved data will be lost.')) {
      this.closeWindow(windowId);
    }
  }

  restartTask(windowId: string) {
    const process = this.processes().find(p => p.windowId === windowId);
    if (process) {
      this.closeWindow(windowId);
      setTimeout(() => {
        // Would need to reopen the window - placeholder for now
        console.log('Restart task:', process.title);
      }, 500);
    }
  }

  exportProcessList() {
    const processes = this.processes();
    const data = processes.map(p => ({
      name: p.title,
      status: p.status,
      cpu: p.cpu,
      memory: p.memory,
      uptime: this.getProcessUptime(p.startTime)
    }));
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-manager-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Mock data generators
  private getRandomMemory(): string {
    return (Math.random() * 50 + 20).toFixed(1);
  }

  private getRandomCpu(): string {
    return (Math.random() * 15 + 1).toFixed(1);
  }

  private getUptime(): string {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return `${hours}h ${minutes}m`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'running': return '#4ade80';
      case 'minimized': return '#fbbf24';
      case 'maximized': return '#60a5fa';
      default: return '#94a3b8';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return 'pi pi-play-circle';
      case 'minimized': return 'pi pi-minus-circle';
      case 'maximized': return 'pi pi-window-maximize';
      default: return 'pi pi-circle';
    }
  }
}

