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
    defaultWidth: 480,
    defaultHeight: 720,
    defaultX: 100,
    defaultY: 100,
    maximizable: true,
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
  'angular-learning': {
    id: 'angular-learning',
    title: 'Học Angular',
    icon: 'pi pi-graduation-cap',
    component: 'angular-learning',
    defaultWidth: 1400,
    defaultHeight: 900,
    defaultX: 100,
    defaultY: 50,
    maximizable: true,
    statusText: 'Học Angular từ đầu với ví dụ thực hành'
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
  },
  'business': {
    id: 'business',
    title: 'Quản lý Bán hàng',
    icon: 'pi pi-shopping-cart',
    component: 'business',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 150,
    defaultY: 60,
    maximizable: true,
    statusText: 'Quản lý bán hàng và chi phí'
  },
  'chinese-chess': {
    id: 'chinese-chess',
    title: 'Kỳ Vương - Cờ Tướng',
    icon: 'pi pi-th-large',
    component: 'chinese-chess',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 150,
    defaultY: 60,
    maximizable: true,
    statusText: 'Cờ Tướng & Cờ Úp'
  },
  'ocr': {
    id: 'ocr',
    title: 'Đọc hình ảnh (OCR)',
    icon: 'pi pi-image',
    component: 'ocr',
    defaultWidth: 1000,
    defaultHeight: 800,
    defaultX: 200,
    defaultY: 80,
    maximizable: true,
    statusText: 'Đọc nội dung từ hình ảnh'
  },
  'fb-id-finder': {
    id: 'fb-id-finder',
    title: 'Tìm Facebook ID',
    icon: 'pi pi-facebook',
    component: 'fb-id-finder',
    defaultWidth: 600,
    defaultHeight: 700,
    defaultX: 300,
    defaultY: 100,
    maximizable: true,
    statusText: 'Tìm Facebook ID từ số điện thoại'
  }
};

export function getWindowDefinition(id: string): WindowDefinition | undefined {
  return WINDOW_REGISTRY[id];
}

