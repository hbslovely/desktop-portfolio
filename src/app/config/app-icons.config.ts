import { DesktopIconData } from '../components/desktop-icon/desktop-icon.component';

export const APP_ICONS: DesktopIconData[] = [
  // Column 1 (x: 20) - Personal & Core Apps
  {
    id: 'my-info',
    name: 'About Me',
    icon: 'assets/images/icons/profile.png',
    type: 'application',
    position: { x: 20, y: 20 }
  },
  {
    id: 'explorer',
    name: 'Explorer',
    icon: 'assets/images/icons/explorer.png',
    type: 'application',
    position: { x: 20, y: 120 }
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: 'pi pi-calculator',
    type: 'application',
    position: { x: 20, y: 220 }
  },
  {
    id: 'paint',
    name: 'Paint',
    icon: 'pi pi-palette',
    type: 'application',
    position: { x: 20, y: 320 }
  },
  {
    id: 'task-manager',
    name: 'Task Manager',
    icon: 'assets/images/icons/system.png',
    type: 'application',
    position: { x: 20, y: 420 }
  },
  {
    id: 'machine-info',
    name: 'System Info',
    icon: 'assets/images/icons/info.png',
    type: 'application',
    position: { x: 20, y: 520 }
  },
  // Column 2 (x: 120) - Information & Reference
  {
    id: 'news',
    name: 'News',
    icon: 'assets/images/icons/news.png',
    type: 'application',
    position: { x: 120, y: 20 }
  },
  {
    id: 'weather',
    name: 'Weather',
    icon: 'assets/images/icons/weather.png',
    type: 'application',
    position: { x: 120, y: 120 }
  },
  {
    id: 'dictionary',
    name: 'Dictionary',
    icon: 'assets/images/icons/book.png',
    type: 'application',
    position: { x: 120, y: 220 }
  },
  {
    id: 'countries',
    name: 'Countries',
    icon: 'assets/images/icons/world.png',
    type: 'application',
    position: { x: 120, y: 320 }
  },
  {
    id: 'hcmc',
    name: 'Ho Chi Minh City',
    icon: 'assets/images/icons/globe.png',
    type: 'application',
    position: { x: 120, y: 420 }
  },
  // Column 3 (x: 220) - Special Apps
  {
    id: 'calendar',
    name: 'Lịch Việt Nam',
    icon: 'assets/images/icons/calendar.png',
    type: 'application',
    position: { x: 220, y: 20 }
  },
  {
    id: 'vnstock',
    name: 'VNStock',
    icon: 'assets/images/icons/stock.png',
    type: 'application',
    position: { x: 220, y: 120 }
  },
  {
    id: 'yugioh',
    name: 'Yu-Gi-Oh! Cards',
    icon: 'assets/images/icons/yugi.png',
    type: 'application',
    position: { x: 220, y: 220 }
  },
  {
    id: 'love',
    name: 'Love',
    icon: 'assets/images/icons/love.png',
    type: 'application',
    position: { x: 220, y: 320 }
  },
  {
    id: 'angular-love',
    name: 'Angular news',
    icon: 'assets/images/icons/angular.png',
    type: 'application',
    position: { x: 220, y: 420 }
  },
  {
    id: 'music',
    name: 'Music Player',
    icon: 'pi pi-youtube',
    type: 'application',
    position: { x: 220, y: 520 }
  }
];

// Search configuration for apps
export const APP_SEARCH_CONFIG = {
  apps: APP_ICONS.map(icon => ({
    id: icon.id,
    name: icon.name,
    type: 'application',
    category: 'Applications',
    description: getAppDescription(icon.id),
    keywords: getAppKeywords(icon.id)
  }))
};

function getAppDescription(appId: string): string {
  const descriptions: { [key: string]: string } = {
    'calculator': 'Perform mathematical calculations and computations',
    'my-info': 'View personal information and portfolio details',
    'love': 'Explore love and relationship content',
    'explorer': 'Browse and manage files and folders',
    'machine-info': 'View system information and device details',
    'paint': 'Create drawings and artwork with various tools',
    'hcmc': 'Explore Ho Chi Minh City attractions and culture',
    'news': 'Read latest news headlines from around the world',
    'task-manager': 'View and manage all open windows and processes',
    'weather': 'View current weather and forecast for your location',
    'dictionary': 'Look up word definitions, pronunciations, and synonyms',
    'countries': 'Explore detailed information about countries around the world',
    'yugioh': 'Browse and search the complete Yu-Gi-Oh! card database with filters',
    'vnstock': 'View real-time Vietnam stock market prices and data from FireAnt',
    'calendar': 'Lịch Việt Nam với âm lịch, ngày lễ tết, con giáp, ngày đẹp, tính ngày',
    'angular-love': 'Browse and read Angular InDepth articles, tutorials, and RxJS guides',
    'music': 'Listen to music videos from YouTube with a curated playlist'
  };
  return descriptions[appId] || 'Application';
}

function getAppKeywords(appId: string): string[] {
  const keywords: { [key: string]: string[] } = {
    'calculator': ['math', 'calculate', 'compute', 'arithmetic', 'numbers'],
    'my-info': ['profile', 'personal', 'information', 'about', 'portfolio'],
    'love': ['relationship', 'romance', 'heart', 'dating'],
    'explorer': ['files', 'folders', 'browse', 'manage', 'directory'],
    'machine-info': ['system', 'device', 'hardware', 'specs', 'info'],
    'paint': ['draw', 'art', 'design', 'canvas', 'creative'],
    'hcmc': ['vietnam', 'saigon', 'city', 'travel', 'culture', 'attractions'],
    'news': ['headlines', 'articles', 'media', 'journalism', 'current', 'events'],
    'task-manager': ['processes', 'windows', 'performance', 'monitor', 'manager', 'tasks'],
    'weather': ['forecast', 'temperature', 'rain', 'cloud', 'wind', 'climate', 'meteorology'],
    'dictionary': ['words', 'definitions', 'meaning', 'vocabulary', 'thesaurus', 'synonyms', 'antonyms', 'pronunciation'],
    'countries': ['world', 'nations', 'flags', 'capitals', 'geography', 'borders', 'population', 'currencies', 'languages', 'maps', 'continents', 'regions'],
    'yugioh': ['cards', 'trading', 'game', 'deck', 'monster', 'spell', 'trap', 'duel', 'ygoprodeck', 'database', 'search', 'filter', 'archetype'],
    'vnstock': ['stock', 'market', 'vietnam', 'fireant', 'trading', 'shares', 'prices', 'hose', 'hnx', 'vn30', 'stocks', 'finance', 'investment'],
    'calendar': ['lich', 'lịch', 'am lich', 'âm lịch', 'ngay le', 'ngày lễ', 'tet', 'tết', 'con giap', 'con giáp', 'ngay dep', 'ngày đẹp', 'tinh ngay', 'tính ngày', 'dem ngay', 'đếm ngày', 'vietnam', 'lunar', 'holiday'],
    'angular-love': ['angular', 'rxjs', 'tutorials', 'articles', 'blog', 'indepth', 'in-depth', 'web', 'development', 'typescript', 'frontend', 'framework', 'programming', 'coding', 'education', 'learning'],
    'music': ['youtube', 'video', 'songs', 'audio', 'player', 'playlist', 'stream', 'listen', 'pop', 'rock', 'jazz', 'classical', 'electronic', 'artist', 'album', 'track']
  };
  return keywords[appId] || [];
}
