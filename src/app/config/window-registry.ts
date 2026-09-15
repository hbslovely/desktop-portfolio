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
    statusText: 'Ready',
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
    statusText: 'Ready',
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
    statusText: 'Ready',
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
    statusText: 'Ready',
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
    statusText: 'Ready',
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
    statusText: 'Ready',
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
    statusText: 'Configure your desktop',
  },
  expense: {
    id: 'expense',
    title: 'Quản lý Chi tiêu',
    icon: 'pi pi-wallet',
    component: 'expense',
    defaultWidth: 1000,
    defaultHeight: 750,
    defaultX: 200,
    defaultY: 80,
    maximizable: true,
    statusText: 'Quản lý chi tiêu gia đình',
  },
  business: {
    id: 'business',
    title: 'Quản lý Bán hàng',
    icon: 'pi pi-shopping-cart',
    component: 'business',
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultX: 150,
    defaultY: 60,
    maximizable: true,
    statusText: 'Quản lý bán hàng và chi phí',
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
    statusText: 'Cờ Tướng & Cờ Úp',
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
    statusText: 'Tìm Facebook ID từ số điện thoại',
  },
};

export function getWindowDefinition(id: string): WindowDefinition | undefined {
  return WINDOW_REGISTRY[id];
}
