export interface WindowDefinition {
  id: string;
  title: string;
  icon: string;
  component: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultX: number;
  defaultY: number;
  maximizable: boolean;
  statusText?: string;
}

export const WINDOW_REGISTRY: Record<string, WindowDefinition> = {
  calculator: {
    id: 'calculator',
    title: 'Calculator',
    icon: 'pi pi-calculator',
    component: 'calculator',
    defaultWidth: 350,
    defaultHeight: 600,
    defaultX: 100,
    defaultY: 100,
    maximizable: false,
    statusText: 'Ready'
  },
  'my-info': {
    id: 'my-info',
    title: 'About Me',
    icon: 'pi pi-user',
    component: 'my-info',
    defaultWidth: 700,
    defaultHeight: 600,
    defaultX: 150,
    defaultY: 80,
    maximizable: true,
    statusText: 'Ready'
  },
  love: {
    id: 'love',
    title: 'For My Love',
    icon: 'pi pi-heart',
    component: 'love',
    defaultWidth: 800,
    defaultHeight: 700,
    defaultX: 200,
    defaultY: 60,
    maximizable: true,
    statusText: 'Ready'
  },
  explorer: {
    id: 'explorer',
    title: 'File Explorer',
    icon: 'pi pi-folder-open',
    component: 'explorer',
    defaultWidth: 900,
    defaultHeight: 650,
    defaultX: 200,
    defaultY: 100,
    maximizable: true,
    statusText: 'Ready'
  },
  'text-viewer': {
    id: 'text-viewer',
    title: 'Text Viewer',
    icon: 'pi pi-file',
    component: 'text-viewer',
    defaultWidth: 800,
    defaultHeight: 650,
    defaultX: 300,
    defaultY: 80,
    maximizable: true,
    statusText: 'Ready'
  },
  'image-viewer': {
    id: 'image-viewer',
    title: 'Image Viewer',
    icon: 'pi pi-image',
    component: 'image-viewer',
    defaultWidth: 900,
    defaultHeight: 700,
    defaultX: 400,
    defaultY: 80,
    maximizable: true,
    statusText: 'Ready'
  },
  'pdf-viewer': {
    id: 'pdf-viewer',
    title: 'PDF Viewer',
    icon: 'pi pi-file-pdf',
    component: 'pdf-viewer',
    defaultWidth: 1000,
    defaultHeight: 800,
    defaultX: 350,
    defaultY: 60,
    maximizable: true,
    statusText: 'Ready'
  },
  'machine-info': {
    id: 'machine-info',
    title: 'System Information',
    icon: 'pi pi-desktop',
    component: 'machine-info',
    defaultWidth: 700,
    defaultHeight: 600,
    defaultX: 250,
    defaultY: 100,
    maximizable: true,
    statusText: 'Ready'
  },
  paint: {
    id: 'paint',
    title: 'Paint',
    icon: 'pi pi-palette',
    component: 'paint',
    defaultWidth: 1100,
    defaultHeight: 750,
    defaultX: 150,
    defaultY: 50,
    maximizable: true,
    statusText: 'Ready'
  },
  credits: {
    id: 'credits',
    title: 'Credits',
    icon: 'pi pi-star',
    component: 'credits',
    defaultWidth: 800,
    defaultHeight: 700,
    defaultX: 300,
    defaultY: 80,
    maximizable: true,
    statusText: 'Ready'
  },
  hcmc: {
    id: 'hcmc',
    title: 'Ho Chi Minh City',
    icon: 'pi pi-map-marker',
    component: 'hcmc',
    defaultWidth: 1000,
    defaultHeight: 750,
    defaultX: 200,
    defaultY: 60,
    maximizable: true,
    statusText: 'Ready'
  },
  news: {
    id: 'news',
    title: 'News Headlines',
    icon: 'pi pi-globe',
    component: 'news',
    defaultWidth: 1000,
    defaultHeight: 700,
    defaultX: 250,
    defaultY: 100,
    maximizable: true,
    statusText: 'Latest News'
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    icon: 'pi pi-cog',
    component: 'settings',
    defaultWidth: 1000,
    defaultHeight: 700,
    defaultX: 250,
    defaultY: 80,
    maximizable: true,
    statusText: 'Configure your desktop'
  },
  'task-manager': {
    id: 'task-manager',
    title: 'Task Manager',
    icon: 'pi pi-th-large',
    component: 'task-manager',
    defaultWidth: 1100,
    defaultHeight: 750,
    defaultX: 200,
    defaultY: 60,
    maximizable: true,
    statusText: 'Managing processes'
  },
  'weather': {
    id: 'weather',
    title: 'Weather Forecast',
    icon: 'pi pi-cloud',
    component: 'weather',
    defaultWidth: 900,
    defaultHeight: 700,
    defaultX: 250,
    defaultY: 80,
    maximizable: true,
    statusText: 'Current weather and forecast'
  },
  'dictionary': {
    id: 'dictionary',
    title: 'Dictionary',
    icon: 'pi pi-book',
    component: 'dictionary',
    defaultWidth: 900,
    defaultHeight: 750,
    defaultX: 250,
    defaultY: 60,
    maximizable: true,
    statusText: 'Look up word definitions'
  },
  'countries': {
    id: 'countries',
    title: 'Countries Explorer',
    icon: 'pi pi-globe',
    component: 'countries',
    defaultWidth: 1100,
    defaultHeight: 800,
    defaultX: 150,
    defaultY: 60,
    maximizable: true,
    statusText: 'Explore countries around the world'
  },
  'yugioh': {
    id: 'yugioh',
    title: 'Yu-Gi-Oh! Cards',
    icon: 'pi pi-images',
    component: 'yugioh',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 100,
    defaultY: 50,
    maximizable: true,
    statusText: 'Browse Yu-Gi-Oh! card database'
  },
  'yugioh-card-detail': {
    id: 'yugioh-card-detail',
    title: 'Card Details',
    icon: 'pi pi-id-card',
    component: 'yugioh-card-detail',
    defaultWidth: 1000,
    defaultHeight: 700,
    defaultX: 150,
    defaultY: 100,
    maximizable: true,
    statusText: 'View detailed card information'
  },
  'calendar': {
    id: 'calendar',
    title: 'Lịch Việt Nam',
    icon: 'pi pi-calendar',
    component: 'calendar',
    defaultWidth: 750,
    defaultHeight: 650,
    defaultX: 200,
    defaultY: 80,
    maximizable: true,
    statusText: 'Vietnamese Calendar'
  },
  'angular-love': {
    id: 'angular-love',
    title: 'Angular.love',
    icon: 'pi pi-heart-fill',
    component: 'angular-love',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 100,
    defaultY: 50,
    maximizable: true,
    statusText: 'Angular InDepth Articles'
  },
  'music': {
    id: 'music',
    title: 'Music Player',
    icon: 'pi pi-youtube',
    component: 'music',
    defaultWidth: 1100,
    defaultHeight: 800,
    defaultX: 150,
    defaultY: 60,
    maximizable: true,
    statusText: 'YouTube Music Player'
  },
  'fireant': {
    id: 'fireant',
    title: 'FireAnt Stock Market',
    icon: 'pi pi-chart-line',
    component: 'fireant',
    defaultWidth: 1000,
    defaultHeight: 750,
    defaultX: 200,
    defaultY: 80,
    maximizable: true,
    statusText: 'Vietnamese Stock Market Data'
  },
  'angular-guidelines': {
    id: 'angular-guidelines',
    title: 'Angular Guidelines',
    icon: 'pi pi-book',
    component: 'angular-guidelines',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 100,
    defaultY: 50,
    maximizable: true,
    statusText: 'Official Angular Documentation'
  },
  'booking': {
    id: 'booking',
    title: 'Travel Search',
    icon: 'pi pi-map',
    component: 'booking',
    defaultWidth: 1000,
    defaultHeight: 750,
    defaultX: 150,
    defaultY: 80,
    maximizable: true,
    statusText: 'Search destinations with Booking.com'
  },
  'tuoitre-news': {
    id: 'tuoitre-news',
    title: 'Tin tức hôm nay',
    icon: 'pi pi-newspaper',
    component: 'tuoitre-news',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 100,
    defaultY: 50,
    maximizable: true,
    statusText: 'Tin tức từ Tuổi Trẻ Online'
  },
  'expense': {
    id: 'expense',
    title: 'Quản lý Chi tiêu',
    icon: 'pi pi-wallet',
    component: 'expense',
    defaultWidth: 1000,
    defaultHeight: 750,
    defaultX: 200,
    defaultY: 80,
    maximizable: true,
    statusText: 'Quản lý chi tiêu gia đình'
  }
};

export function getWindowDefinition(id: string): WindowDefinition | undefined {
  return WINDOW_REGISTRY[id];
}

