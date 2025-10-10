import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CreditItem {
  type: 'title' | 'person' | 'library' | 'section';
  text: string;
  subtitle?: string;
}

@Component({
  selector: 'app-credits-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credits-app.component.html',
  styleUrl: './credits-app.component.scss'
})
export class CreditsAppComponent implements OnInit, OnDestroy {
  // Animation settings
  scrollSpeed = signal<number>(50); // pixels per second
  isPlaying = signal<boolean>(false);
  isPaused = signal<boolean>(false);
  
  // Credits data
  credits = signal<CreditItem[]>([
    // Opening
    { type: 'title', text: 'DESKTOP PORTFOLIO' },
    { type: 'section', text: 'A Modern Web Application' },
    
    // Development Team
    { type: 'section', text: 'DEVELOPMENT TEAM' },
    { type: 'person', text: 'Lead Developer', subtitle: 'Portfolio Creator' },
    { type: 'person', text: 'UI/UX Designer', subtitle: 'Interface Design' },
    { type: 'person', text: 'Frontend Engineer', subtitle: 'Angular Implementation' },
    
    // Technologies Used
    { type: 'section', text: 'TECHNOLOGIES & FRAMEWORKS' },
    { type: 'library', text: 'Angular 17', subtitle: 'Frontend Framework' },
    { type: 'library', text: 'TypeScript', subtitle: 'Programming Language' },
    { type: 'library', text: 'SCSS', subtitle: 'Styling & Design' },
    { type: 'library', text: 'HTML5 Canvas', subtitle: 'Drawing & Graphics' },
    { type: 'library', text: 'CSS Grid & Flexbox', subtitle: 'Layout System' },
    
    // Libraries & Tools
    { type: 'section', text: 'LIBRARIES & TOOLS' },
    { type: 'library', text: 'PrimeNG', subtitle: 'UI Component Library' },
    { type: 'library', text: 'PrimeIcons', subtitle: 'Icon Set' },
    { type: 'library', text: 'Angular Signals', subtitle: 'Reactive State Management' },
    { type: 'library', text: 'Angular Standalone Components', subtitle: 'Modern Architecture' },
    { type: 'library', text: 'Canvas API', subtitle: 'Drawing & Animation' },
    
    // Design & Assets
    { type: 'section', text: 'DESIGN & ASSETS' },
    { type: 'library', text: 'Custom CSS Animations', subtitle: 'Smooth Transitions' },
    { type: 'library', text: 'Responsive Design', subtitle: 'Multi-Device Support' },
    { type: 'library', text: 'Modern UI Patterns', subtitle: 'User Experience' },
    { type: 'library', text: 'Color Palette', subtitle: 'Visual Consistency' },
    
    // Features
    { type: 'section', text: 'APPLICATION FEATURES' },
    { type: 'library', text: 'Window Management', subtitle: 'Multi-Window Support' },
    { type: 'library', text: 'Desktop Environment', subtitle: 'OS-like Interface' },
    { type: 'library', text: 'File Explorer', subtitle: 'File Management' },
    { type: 'library', text: 'Drawing Application', subtitle: 'Canvas-based Paint Tool' },
    { type: 'library', text: 'Credit Tracker', subtitle: 'Financial Management' },
    { type: 'library', text: 'Calculator', subtitle: 'Mathematical Operations' },
    { type: 'library', text: 'System Information', subtitle: 'Device Details' },
    
    // Special Thanks
    { type: 'section', text: 'SPECIAL THANKS' },
    { type: 'person', text: 'Angular Team', subtitle: 'Amazing Framework' },
    { type: 'person', text: 'PrimeNG Community', subtitle: 'Excellent Components' },
    { type: 'person', text: 'Web Standards Community', subtitle: 'Open Web Technologies' },
    { type: 'person', text: 'Open Source Contributors', subtitle: 'Making Development Better' },
    
    // Closing
    { type: 'section', text: 'PRODUCTION' },
    { type: 'title', text: 'THANK YOU FOR VIEWING' },
    { type: 'section', text: 'Made with ❤️ and Angular' },
    { type: 'section', text: '© 2024 Desktop Portfolio' }
  ]);
  
  // Animation properties
  private animationId: number | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private scrollPosition = signal<number>(0);
  
  // Computed properties
  creditsHeight = computed(() => this.credits().length * 60 + 200); // Approximate height
  containerHeight = computed(() => window.innerHeight);
  
  ngOnInit() {
    this.startCredits();
  }
  
  ngOnDestroy() {
    this.stopAnimation();
  }
  
  startCredits() {
    this.isPlaying.set(true);
    this.isPaused.set(false);
    this.startTime = performance.now() - this.pausedTime;
    this.animate();
  }
  
  pauseCredits() {
    this.isPaused.set(true);
    this.isPlaying.set(false);
    this.pausedTime = performance.now() - this.startTime;
    this.stopAnimation();
  }
  
  resumeCredits() {
    this.isPaused.set(false);
    this.isPlaying.set(true);
    this.startTime = performance.now() - this.pausedTime;
    this.animate();
  }
  
  restartCredits() {
    this.stopAnimation();
    this.scrollPosition.set(0);
    this.pausedTime = 0;
    this.startCredits();
  }
  
  setSpeed(speed: number) {
    this.scrollSpeed.set(speed);
  }

  onSpeedChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.setSpeed(+target.value);
  }
  
  private animate() {
    const animate = (currentTime: number) => {
      if (!this.isPlaying()) return;
      
      const elapsed = (currentTime - this.startTime) / 1000; // Convert to seconds
      const newPosition = elapsed * this.scrollSpeed();
      
      this.scrollPosition.set(-newPosition);
      
      // Check if credits have finished scrolling
      if (newPosition > this.creditsHeight() + this.containerHeight()) {
        this.restartCredits();
        return;
      }
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
  
  private stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  getCreditClass(credit: CreditItem): string {
    return `credit-${credit.type}`;
  }
  
  getTransform(): string {
    return `translateY(${this.scrollPosition()}px)`;
  }

  trackByIndex(index: number, item: CreditItem): number {
    return index;
  }
}
