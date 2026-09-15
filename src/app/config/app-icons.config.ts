import { DesktopIconData } from '../components/desktop-icon/desktop-icon.component';

export const APP_ICONS: DesktopIconData[] = [
  {
    id: 'my-info',
    name: 'About Me',
    icon: 'assets/images/icons/profile.png',
    type: 'application',
    position: { x: 20, y: 20 },
  },
  {
    id: 'explorer',
    name: 'Explorer',
    icon: 'assets/images/icons/explorer.png',
    type: 'application',
    position: { x: 20, y: 120 },
  },
  {
    id: 'chinese-chess',
    name: 'Cờ Tướng',
    icon: 'assets/images/icons/chess.png',
    type: 'application',
    position: { x: 120, y: 20 },
  },
  {
    id: 'love',
    name: 'Love',
    icon: 'assets/images/icons/love.png',
    type: 'application',
    position: { x: 120, y: 120 },
  },
  {
    id: 'expense',
    name: 'Quản lý Chi tiêu',
    icon: 'pi pi-wallet',
    type: 'application',
    position: { x: 220, y: 20 },
  },
  {
    id: 'business',
    name: 'Quản lý Bán hàng',
    icon: 'pi pi-shopping-cart',
    type: 'application',
    position: { x: 220, y: 120 },
  },
  {
    id: 'fb-id-finder',
    name: 'Facebook Scanner',
    icon: 'pi pi-facebook',
    type: 'application',
    position: { x: 220, y: 220 },
  },
];

export const APP_SEARCH_CONFIG = {
  apps: APP_ICONS.map((icon) => ({
    id: icon.id,
    name: icon.name,
    type: 'application',
    category: 'Applications',
    description: getAppDescription(icon.id),
    keywords: getAppKeywords(icon.id),
  })),
};

function getAppDescription(appId: string): string {
  const descriptions: { [key: string]: string } = {
    'my-info': 'View personal information and portfolio details',
    love: 'Explore love and relationship content',
    explorer: 'Browse and manage files and folders',
    expense:
      'Manage family expenses with Google Sheets integration, view spending history, and add new expenses',
    business:
      'Manage sales, materials, and costs with Google Sheets integration across multiple tabs (Menu, Materials, Costs)',
    'chinese-chess': 'Chơi cờ tướng và cờ úp với AI, phá thế cờ, nhiều giao diện đẹp mắt',
    'fb-id-finder': 'Tìm Facebook ID từ số điện thoại, tra cứu thông tin Facebook',
  };
  return descriptions[appId] || 'Application';
}

function getAppKeywords(appId: string): string[] {
  const keywords: { [key: string]: string[] } = {
    'my-info': ['profile', 'personal', 'information', 'about', 'portfolio'],
    love: ['relationship', 'romance', 'heart', 'dating'],
    explorer: ['files', 'folders', 'browse', 'manage', 'directory'],
    expense: [
      'expense',
      'chi tiêu',
      'quản lý',
      'tài chính',
      'spending',
      'budget',
      'money',
      'finance',
      'google sheets',
      'gia đình',
      'family',
      'tiền',
      'giao dịch',
      'transaction',
    ],
    business: [
      'business',
      'bán hàng',
      'quản lý',
      'sales',
      'materials',
      'costs',
      'menu',
      'nguyên liệu',
      'vật liệu',
      'chi phí',
      'google sheets',
      'inventory',
      'kho',
      'sản phẩm',
    ],
    'chinese-chess': [
      'cờ tướng',
      'co tuong',
      'xiangqi',
      'cờ úp',
      'co up',
      'ky vuong',
      'kỳ vương',
      'chess',
      'game',
      'board game',
      'trò chơi',
      'puzzle',
      'thế cờ',
      'the co',
      'chinese chess',
      'vietnam chess',
    ],
    'fb-id-finder': [
      'facebook',
      'fb',
      'id',
      'tìm facebook id',
      'tim facebook id',
      'số điện thoại',
      'so dien thoai',
      'phone',
      'find facebook id',
      'facebook id finder',
      'lookup',
      'search facebook',
    ],
  };
  return keywords[appId] || [];
}
