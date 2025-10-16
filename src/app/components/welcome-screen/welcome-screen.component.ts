import { Component, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './welcome-screen.component.html',
  styleUrl: './welcome-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomeScreenComponent implements OnInit, OnDestroy {
  // Password input
  password = signal('');
  showPassword = signal(false);
  showHint = signal(false);
  isAuthenticated = signal(false);
  errorMessage = signal('');
  isLoading = signal(false);
  isLocked = signal(false);

  // Current time and date
  currentTime = signal('');
  currentDate = signal('');

  // Greeting
  greeting = signal<string>('');

  private greetings = [
    'Welcome Back!', 'Hello There!', 'Good to See You!', 
    'Ready to Create?', 'Let\'s Get Started!', 'Nice to See You Again!'
  ];
  
  private timeInterval?: number;

  constructor() {
    this.updateTime();
    this.timeInterval = window.setInterval(() => this.updateTime(), 1000);
    this.greeting.set(this.greetings[Math.floor(Math.random() * this.greetings.length)]);
  }

  ngOnInit() {
    this.checkAuthenticationStatus();
  }

  checkAuthenticationStatus() {
    const storedAuth = localStorage.getItem('desktop-portfolio-auth');
    const storedPassword = localStorage.getItem('desktop-portfolio-password');
    const currentPassword = this.formatDate(new Date());
    
    if (storedAuth === 'true' && storedPassword === currentPassword) {
      // User was previously authenticated and password is still valid
      this.isAuthenticated.set(true);
    } else if (storedAuth === 'true' && storedPassword !== currentPassword) {
      // Password has changed (new day), clear storage and show lock screen
      this.clearAuthenticationStorage();
      this.isLocked.set(true);
    }
  }

  clearAuthenticationStorage() {
    localStorage.removeItem('desktop-portfolio-auth');
    localStorage.removeItem('desktop-portfolio-password');
  }

  saveAuthenticationStatus() {
    const currentPassword = this.formatDate(new Date());
    localStorage.setItem('desktop-portfolio-auth', 'true');
    localStorage.setItem('desktop-portfolio-password', currentPassword);
  }

  lockScreen() {
    this.isLocked.set(true);
    this.isAuthenticated.set(false);
    this.password.set('');
    this.errorMessage.set('');
    // Clear storage when manually locking
    this.clearAuthenticationStorage();
  }

  updateTime() {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }));
    this.currentDate.set(now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }

  onPasswordInput(event: any) {
    this.password.set(event.target.value);
    this.errorMessage.set(''); // Clear error when user types
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  toggleHint() {
    this.showHint.set(!this.showHint());
  }

  onSubmit() {
    const enteredPassword = this.password();
    const currentDate = new Date();
    const expectedPassword = this.formatDate(currentDate);
    
    if (enteredPassword === expectedPassword) {
      this.isLoading.set(true);
      // Simulate authentication delay
      setTimeout(() => {
        this.isAuthenticated.set(true);
        this.isLocked.set(false);
        this.saveAuthenticationStatus();
        this.isLoading.set(false);
      }, 1000);
    } else {
      this.errorMessage.set('Incorrect password. Hint: Use today\'s date in ddmmyyyy format');
      this.password.set('');
      // Shake animation trigger
      const input = document.querySelector('.password-input');
      if (input) {
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
      }
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.onSubmit();
    }
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return day + month + year;
  }

  // Get hint for the password
  getPasswordHint(): string {
    const currentDate = new Date();
    return `Today's date: ${currentDate.toLocaleDateString('en-GB')} (ddmmyyyy format)`;
  }

  // Method to be called from parent component to lock the screen
  public lockScreenFromParent() {
    this.lockScreen();
  }

  // Method to emit restart request to parent
  onRestartRequest() {
    // Emit custom event that parent can listen to
    window.dispatchEvent(new CustomEvent('system-restart-requested'));
  }
  
  ngOnDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }
}
