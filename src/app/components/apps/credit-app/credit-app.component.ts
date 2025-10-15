/**
 * About Project Component
 * 
 * A comprehensive overview of the Desktop Portfolio project with statistics and technical details.
 * Built with Angular 17, PrimeNG, and modern design principles.
 * 
 * @author Phat Hong
 * @version 3.0.0
 * @created 2025
 */

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { ChipModule } from 'primeng/chip';
import { AvatarModule } from 'primeng/avatar';
import { TimelineModule } from 'primeng/timeline';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

interface Skill {
  name: string;
  icon: string;
  level: number;
  color: string;
  category: string;
}

interface Project {
  title: string;
  description: string;
  technologies: string[];
  icon: string;
  date: string;
}

interface SocialLink {
  platform: string;
  icon: string;
  url: string;
  color: string;
}

@Component({
  selector: 'app-credit-app',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    DividerModule,
    ChipModule,
    AvatarModule,
    TimelineModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './credit-app.component.html',
  styleUrl: './credit-app.component.scss'
})
export class CreditAppComponent implements OnInit {
  
  @Output() onOpenMyInfo = new EventEmitter<void>();
  
  // Project Information
  projectInfo = {
    name: 'Desktop Portfolio',
    version: '3.0.0',
    description: 'An interactive Windows-like desktop environment built entirely in the browser. Features a complete window management system, file explorer, rich text editor, and multiple productivity applications.',
    author: 'hpphat1992',
    created: '2025',
    icon: '💻'
  };
  
  // Project Statistics (real data from project scan)
  projectStats = {
    linesOfCode: '32,825',
    totalFiles: 137,
    typeScriptFiles: 46,
    htmlFiles: 29,
    scssFiles: 29,
    components: 24,
    services: 9,
    apps: 20
  };

  // Core Technologies
  coreSkills: Skill[] = [
    { name: 'Angular', icon: 'pi pi-code', level: 95, color: '#dd0031', category: 'Frontend' },
    { name: 'TypeScript', icon: 'pi pi-file-edit', level: 90, color: '#3178c6', category: 'Language' },
    { name: 'PrimeNG', icon: 'pi pi-prime', level: 92, color: '#00a6a6', category: 'UI Library' },
    { name: 'RxJS', icon: 'pi pi-bolt', level: 88, color: '#b7178c', category: 'Library' },
    { name: 'HTML5', icon: 'pi pi-file', level: 95, color: '#e34c26', category: 'Markup' },
    { name: 'SCSS', icon: 'pi pi-palette', level: 90, color: '#cc6699', category: 'Styling' }
  ];

  // Additional Skills
  additionalSkills: Skill[] = [
    { name: 'JavaScript', icon: 'pi pi-code', level: 92, color: '#f7df1e', category: 'Language' },
    { name: 'Node.js', icon: 'pi pi-server', level: 85, color: '#68a063', category: 'Backend' },
    { name: 'Git', icon: 'pi pi-github', level: 90, color: '#f05033', category: 'Tools' },
    { name: 'Docker', icon: 'pi pi-box', level: 80, color: '#2496ed', category: 'DevOps' },
    { name: 'REST APIs', icon: 'pi pi-cloud', level: 88, color: '#61dafb', category: 'Backend' },
    { name: 'Responsive Design', icon: 'pi pi-mobile', level: 93, color: '#563d7c', category: 'Frontend' }
  ];

  // Featured Projects
  projects: Project[] = [
    {
      title: 'Desktop Portfolio',
      description: 'An interactive desktop-like portfolio showcasing skills and projects with a unique user experience',
      technologies: ['Angular', 'PrimeNG', 'TypeScript', 'SCSS'],
      icon: 'pi pi-desktop',
      date: '2025'
    },
    {
      title: 'Finance Tracker',
      description: 'Comprehensive family finance management application with analytics and data visualization',
      technologies: ['Angular', 'PrimeNG', 'RxJS', 'Chart.js'],
      icon: 'pi pi-wallet',
      date: '2025'
    },
    {
      title: 'Weather Dashboard',
      description: 'Real-time weather information with beautiful UI and location-based forecasting',
      technologies: ['Angular', 'API Integration', 'TypeScript'],
      icon: 'pi pi-cloud',
      date: '2025'
    }
  ];

  // Social Links
  socialLinks: SocialLink[] = [
    { platform: 'GitHub', icon: 'pi pi-github', url: 'https://github.com/hpphat1992', color: '#333' },
    { platform: 'LinkedIn', icon: 'pi pi-linkedin', url: '#', color: '#0077b5' },
    { platform: 'Email', icon: 'pi pi-envelope', url: 'mailto:hpphat1992@example.com', color: '#ea4335' },
    { platform: 'Portfolio', icon: 'pi pi-globe', url: '#', color: '#6366f1' }
  ];

  // Dependencies from package.json
  dependencies = {
    angular: { name: '@angular/core', version: '^17.3.0', category: 'Framework' },
    primeng: { name: 'primeng', version: '^17.18.11', category: 'UI Library' },
    chartjs: { name: 'chart.js', version: '^4.5.1', category: 'Visualization' },
    rxjs: { name: 'rxjs', version: '~7.8.0', category: 'Reactive' },
    typescript: { name: 'typescript', version: '~5.4.2', category: 'Language' },
    primeicons: { name: 'primeicons', version: '^7.0.0', category: 'Icons' }
  };
  
  // Runtime Environment
  environment = {
    nodejs: 'v23.6.0',
    angularCli: '^17.3.17',
    typescript: '~5.4.2',
    packageManager: 'npm'
  };
  
  // Tech Stack Details
  techStack = {
    frontend: ['Angular 17.3', 'PrimeNG 17.18', 'TypeScript 5.4', 'SCSS', 'HTML5', 'RxJS 7.8'],
    features: ['Window Manager', 'File Explorer', 'Rich Text Editor', 'Multiple Apps'],
    tools: ['Git', 'VS Code', 'Cursor IDE', 'npm', 'Angular CLI'],
    deployment: ['Vercel', 'Docker', 'GitHub']
  };

  // Featured Applications in this project
  featuredApps = [
    { name: 'File Explorer', icon: 'pi pi-folder', description: 'Navigate and manage virtual files' },
    { name: 'Text Editor', icon: 'pi pi-file-edit', description: 'Rich text editing with formatting' },
    { name: 'Finance Tracker', icon: 'pi pi-wallet', description: 'Family budget management' },
    { name: 'Countries Explorer', icon: 'pi pi-globe', description: 'Explore world countries data' },
    { name: 'Weather App', icon: 'pi pi-cloud', description: 'Real-time weather information' },
    { name: 'News Headlines', icon: 'pi pi-globe', description: 'Latest news updates' },
    { name: 'Calculator', icon: 'pi pi-calculator', description: 'Scientific calculator' },
    { name: 'Paint App', icon: 'pi pi-palette', description: 'Drawing and design tool' }
  ];

  ngOnInit(): void {
    // Component initialization
  }

  getSkillColor(level: number): string {
    if (level >= 90) return '#10b981';
    if (level >= 75) return '#3b82f6';
    if (level >= 60) return '#f59e0b';
    return '#ef4444';
  }

  getSkillWidth(level: number): string {
    return `${level}%`;
  }

  openLink(url: string): void {
    if (url.startsWith('http') || url.startsWith('mailto:')) {
      window.open(url, '_blank');
    }
  }
  
  openMyInformation(): void {
    this.onOpenMyInfo.emit();
  }
  
  formatNumber(num: number): string {
    return num.toLocaleString();
  }
}
