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
    defaultHeight: 500,
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
  credit: {
    id: 'credit',
    title: 'Credit Tracker',
    icon: 'pi pi-chart-line',
    component: 'credit',
    defaultWidth: 900,
    defaultHeight: 700,
    defaultX: 200,
    defaultY: 80,
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
  }
};

export function getWindowDefinition(id: string): WindowDefinition | undefined {
  return WINDOW_REGISTRY[id];
}

export function getAllWindowDefinitions(): WindowDefinition[] {
  return Object.values(WINDOW_REGISTRY);
}

