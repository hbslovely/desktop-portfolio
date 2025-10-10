import { DesktopIconData } from '../components/desktop-icon/desktop-icon.component';

export const APP_ICONS: DesktopIconData[] = [
  {
    id: 'calculator',
    name: 'Calculator',
    icon: 'assets/images/icons/calculator.png',
    type: 'application',
    position: { x: 50, y: 50 }
  },
  {
    id: 'my-info',
    name: 'My Information',
    icon: 'assets/images/icons/profile.png',
    type: 'application',
    position: { x: 50, y: 150 }
  },
  {
    id: 'love',
    name: 'Love',
    icon: 'assets/images/icons/love.png',
    type: 'application',
    position: { x: 50, y: 350 }
  },
  {
    id: 'explorer',
    name: 'Explorer',
    icon: 'assets/images/icons/explorer.png',
    type: 'application',
    position: { x: 150, y: 50 }
  },
  {
    id: 'machine-info',
    name: 'System Info',
    icon: 'assets/images/icons/info.png',
    type: 'application',
    position: { x: 150, y: 150 }
  },
  {
    id: 'credit',
    name: 'Credit Tracker',
    icon: 'assets/images/icons/calculator.png',
    type: 'application',
    position: { x: 150, y: 250 }
  },
  {
    id: 'paint',
    name: 'Paint',
    icon: 'assets/images/icons/paint.png',
    type: 'application',
    position: { x: 150, y: 350 }
  },
  {
    id: 'credits',
    name: 'Credits',
    icon: 'assets/images/icons/star.png',
    type: 'application',
    position: { x: 250, y: 50 }
  },
  {
    id: 'hcmc',
    name: 'Ho Chi Minh City',
    icon: 'assets/images/icons/globe.png',
    type: 'application',
    position: { x: 250, y: 150 }
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
    'credit': 'Track and manage financial credits and expenses',
    'paint': 'Create drawings and artwork with various tools',
    'credits': 'View project credits and acknowledgments',
    'hcmc': 'Explore Ho Chi Minh City attractions and culture'
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
    'credit': ['finance', 'money', 'expenses', 'budget', 'tracking'],
    'paint': ['draw', 'art', 'design', 'canvas', 'creative'],
    'credits': ['acknowledgments', 'thanks', 'contributors', 'team'],
    'hcmc': ['vietnam', 'saigon', 'city', 'travel', 'culture', 'attractions']
  };
  return keywords[appId] || [];
}
