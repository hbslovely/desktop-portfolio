import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AppLink {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-about-me',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-me.component.html',
  styleUrl: './about-me.component.scss',
})
export class AboutMeComponent {
  @Output() onOpenApp = new EventEmitter<string>();

  profileInfo = {
    name: 'Phat HP',
    title: 'Software Engineer',
    email: 'phat@backbase.com',
    location: 'Ho Chi Minh City, Vietnam',
    bio: 'Passionate software engineer with expertise in building modern web applications. Experienced in Angular, TypeScript, and creating intuitive user interfaces.',
    avatar: 'assets/images/icons/profile.png'
  };

  skills = [
    'Angular',
    'TypeScript',
    'JavaScript',
    'HTML/CSS',
    'Node.js',
    'REST APIs',
    'Git',
    'Responsive Design'
  ];

  apps: AppLink[] = [
    {
      id: 'calculator',
      name: 'Calculator',
      icon: 'pi pi-calculator',
      description: 'Perform basic calculations',
      color: '#0078d4'
    },
    {
      id: 'explorer',
      name: 'File Explorer',
      icon: 'pi pi-folder',
      description: 'Browse files and folders',
      color: '#ffc107'
    },
    {
      id: 'text-editor',
      name: 'Text Editor',
      icon: 'pi pi-file-edit',
      description: 'Create and edit documents',
      color: '#007bff'
    },
    {
      id: 'paint',
      name: 'Paint',
      icon: 'pi pi-palette',
      description: 'Draw and create art',
      color: '#e91e63'
    },
    {
      id: 'weather',
      name: 'Weather',
      icon: 'pi pi-cloud',
      description: 'Check weather forecast',
      color: '#00bcd4'
    },
    {
      id: 'news',
      name: 'News',
      icon: 'pi pi-globe',
      description: 'Read latest news',
      color: '#f44336'
    },
    {
      id: 'countries',
      name: 'Countries',
      icon: 'pi pi-flag',
      description: 'Explore world countries',
      color: '#4caf50'
    },
    {
      id: 'dictionary',
      name: 'Dictionary',
      icon: 'pi pi-book',
      description: 'Look up word definitions',
      color: '#9c27b0'
    }
  ];

  openApp(appId: string) {
    this.onOpenApp.emit(appId);
  }
}
