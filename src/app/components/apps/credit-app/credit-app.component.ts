import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CreditEntry {
  id: number;
  description: string;
  amount: number;
  date: Date;
  category: string;
}

@Component({
  selector: 'app-credit-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './credit-app.component.html',
  styleUrl: './credit-app.component.scss'
})
export class CreditAppComponent {
  // Credit entries
  creditEntries = signal<CreditEntry[]>([]);
  
  // Form data
  newEntry = signal({
    description: '',
    amount: 0,
    category: 'General'
  });
  
  // Categories
  categories = ['General', 'Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Other'];
  
  // Filter
  selectedCategory = signal<string>('All');
  
  // Computed values
  totalCredits = computed(() => {
    return this.creditEntries().reduce((sum, entry) => sum + entry.amount, 0);
  });
  
  filteredEntries = computed(() => {
    const category = this.selectedCategory();
    if (category === 'All') {
      return this.creditEntries();
    }
    return this.creditEntries().filter(entry => entry.category === category);
  });
  
  categoryTotals = computed(() => {
    const totals: { [key: string]: number } = {};
    this.creditEntries().forEach(entry => {
      totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
    });
    return totals;
  });

  constructor() {
    // Add some sample data
    this.addSampleData();
  }

  addSampleData() {
    const sampleEntries: CreditEntry[] = [
      {
        id: 1,
        description: 'Salary Deposit',
        amount: 5000,
        date: new Date('2024-01-01'),
        category: 'General'
      },
      {
        id: 2,
        description: 'Freelance Project',
        amount: 1200,
        date: new Date('2024-01-15'),
        category: 'General'
      },
      {
        id: 3,
        description: 'Investment Return',
        amount: 300,
        date: new Date('2024-01-20'),
        category: 'General'
      },
      {
        id: 4,
        description: 'Gift Money',
        amount: 200,
        date: new Date('2024-01-25'),
        category: 'Other'
      }
    ];
    
    this.creditEntries.set(sampleEntries);
  }

  addEntry() {
    const entry = this.newEntry();
    if (entry.description.trim() && entry.amount > 0) {
      const newCreditEntry: CreditEntry = {
        id: Date.now(),
        description: entry.description.trim(),
        amount: entry.amount,
        date: new Date(),
        category: entry.category
      };
      
      this.creditEntries.update(entries => [...entries, newCreditEntry]);
      
      // Reset form
      this.newEntry.set({
        description: '',
        amount: 0,
        category: 'General'
      });
    }
  }

  deleteEntry(id: number) {
    this.creditEntries.update(entries => entries.filter(entry => entry.id !== id));
  }

  setCategory(category: string) {
    this.selectedCategory.set(category);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  trackByEntryId(index: number, entry: CreditEntry): number {
    return entry.id;
  }

  getAllCategories(): string[] {
    return ['All', ...this.categories];
  }
}
