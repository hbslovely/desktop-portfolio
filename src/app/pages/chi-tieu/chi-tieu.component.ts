import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseAppComponent } from '../../components/apps/expense-app/expense-app.component';

@Component({
  selector: 'app-chi-tieu-page',
  standalone: true,
  imports: [CommonModule, ExpenseAppComponent],
  template: `
    <div class="chi-tieu-page">
      <app-expense-app [bypassAuth]="true"></app-expense-app>
    </div>
  `,
  styles: [`
    .chi-tieu-page {
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #f5f7fa;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    ::ng-deep .expense-app {
      width: 100%;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
    }

    ::ng-deep .main-screen {
      height: 100vh;
      max-height: 100vh;
    }
  `]
})
export class ChiTieuPageComponent {}
