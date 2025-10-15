import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface BootMessage {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  delay?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SystemRestartService {
  private isRestartingSubject = new BehaviorSubject<boolean>(false);
  public isRestarting$ = this.isRestartingSubject.asObservable();

  private bootMessages: { text: string; type: 'info' | 'success' | 'warning' | 'error' }[] = [
    { text: 'Initiating system shutdown...', type: 'info' },
    { text: 'Closing all applications...', type: 'info' },
    { text: 'Saving system state...', type: 'success' },
    { text: 'Unmounting file systems...', type: 'info' },
    { text: 'Stopping system services...', type: 'info' },
    { text: 'System halted.', type: 'success' },
    { text: '', type: 'info' },
    { text: 'BIOS Version 2.0.1', type: 'info' },
    { text: 'Initializing hardware...', type: 'info' },
    { text: 'Memory test: 16384 MB OK', type: 'success' },
    { text: 'CPU: Intel Core i7-12700K @ 3.6GHz', type: 'info' },
    { text: 'Detecting drives...', type: 'info' },
    { text: 'SSD: 1TB NVMe Drive [OK]', type: 'success' },
    { text: 'Loading boot loader...', type: 'info' },
    { text: 'Starting Desktop Portfolio OS...', type: 'info' },
    { text: '', type: 'info' },
    { text: '[    0.000000] Linux version 5.15.0-portfolio', type: 'info' },
    { text: '[    0.001234] Command line: BOOT_IMAGE=/boot/vmlinuz', type: 'info' },
    { text: '[    0.002456] Kernel command line: quiet splash', type: 'info' },
    { text: '[    0.123456] PCI: Using configuration type 1', type: 'info' },
    { text: '[    0.234567] Memory: 16384MB', type: 'success' },
    { text: '[    0.345678] CPU0: Intel Core i7', type: 'info' },
    { text: '[    0.456789] NET: Registered protocol family', type: 'info' },
    { text: '[    0.567890] PCI: Probing PCI hardware', type: 'info' },
    { text: '[    0.678901] ACPI: Core revision 20210730', type: 'success' },
    { text: '[    1.234567] USB: registered new interface driver', type: 'info' },
    { text: '[    1.345678] Ethernet driver loaded', type: 'success' },
    { text: '[    1.456789] Graphics driver initialized', type: 'success' },
    { text: '[    2.123456] Starting system services...', type: 'info' },
    { text: '[    2.234567] [  OK  ] Started Network Manager', type: 'success' },
    { text: '[    2.345678] [  OK  ] Started User Manager', type: 'success' },
    { text: '[    2.456789] [  OK  ] Started Desktop Environment', type: 'success' },
    { text: '[    2.567890] [  OK  ] Reached target Graphical Interface', type: 'success' },
    { text: '', type: 'info' },
    { text: 'Desktop Portfolio OS booted successfully!', type: 'success' },
    { text: 'Initializing desktop environment...', type: 'info' }
  ];

  constructor() {}

  startRestart(): Observable<BootMessage> {
    this.isRestartingSubject.next(true);
    
    // Emit boot messages one by one with random delays
    return new Observable(observer => {
      let currentIndex = 0;
      
      const emitNext = () => {
        if (currentIndex < this.bootMessages.length) {
          const baseMessage = this.bootMessages[currentIndex];
          const message: BootMessage = {
            ...baseMessage,
            timestamp: baseMessage.text ? this.getTimestamp() : ''
          };
          
          observer.next(message);
          
          // Calculate delay for next message BEFORE incrementing
          let delay: number;
          
          // Second to last message gets a longer delay before showing the last message (2-3 seconds)
          if (currentIndex === this.bootMessages.length - 2) {
            delay = 2000 + Math.random() * 1000; // 2000-3000ms
          }
          // Current message is empty line, minimal delay
          else if (message.text === '') {
            delay = 100 + Math.random() * 100; // 100-200ms
          }
          // Regular messages get random short delays
          else {
            delay = 40 + Math.random() * 120; // 40-160ms
          }
          
          currentIndex++;
          
          if (currentIndex < this.bootMessages.length) {
            setTimeout(emitNext, delay);
          } else {
            observer.complete();
          }
        } else {
          observer.complete();
        }
      };
      
      // Start emitting messages
      emitNext();
      
      // Return cleanup function
      return () => {
        currentIndex = this.bootMessages.length;
      };
    });
  }

  completeRestart(): void {
    this.isRestartingSubject.next(false);
  }

  isRestarting(): boolean {
    return this.isRestartingSubject.value;
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  }
}

