import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  date: Date;
  category: string;
  type: 'income' | 'expense';
  familyMember: string;
  notes?: string;
  recurring?: boolean;
  tags?: string[];
}

export interface TransactionFilter {
  type: 'all' | 'income' | 'expense';
  category: string;
  familyMember: string;
  dateRange: { start: Date; end: Date } | null;
  searchTerm: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
  avgDailyExpense: number;
  savingsRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private readonly STORAGE_KEY = 'family-finance-tracker-v2';
  
  // State management with BehaviorSubject
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  private filterSubject = new BehaviorSubject<TransactionFilter>({
    type: 'all',
    category: 'All',
    familyMember: 'All',
    dateRange: this.getCurrentMonthRange(),
    searchTerm: ''
  });
  
  // Public observables
  public transactions$ = this.transactionsSubject.asObservable();
  public filter$ = this.filterSubject.asObservable();
  
  // Filtered transactions based on current filter
  public filteredTransactions$: Observable<Transaction[]> = combineLatest([
    this.transactions$,
    this.filter$
  ]).pipe(
    map(([transactions, filter]) => this.applyFilters(transactions, filter))
  );
  
  // Financial summary
  public summary$: Observable<FinancialSummary> = this.filteredTransactions$.pipe(
    map(transactions => this.calculateSummary(transactions))
  );
  
  // Category breakdowns
  public incomeByCategory$: Observable<Map<string, number>> = this.filteredTransactions$.pipe(
    map(transactions => this.groupByCategory(transactions.filter(t => t.type === 'income')))
  );
  
  public expensesByCategory$: Observable<Map<string, number>> = this.filteredTransactions$.pipe(
    map(transactions => this.groupByCategory(transactions.filter(t => t.type === 'expense')))
  );
  
  // Family member breakdowns
  public memberSummary$: Observable<Map<string, { income: number; expenses: number; net: number }>> = 
    this.filteredTransactions$.pipe(
      map(transactions => this.groupByMember(transactions))
    );
  
  // Category definitions
  public readonly incomeCategories = [
    'Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Bonus', 'Rental Income', 
    'Dividends', 'Interest', 'Refund', 'Other Income'
  ];
  
  public readonly expenseCategories = [
    'Groceries', 'Utilities', 'Rent/Mortgage', 'Transportation', 'Healthcare', 
    'Education', 'Entertainment', 'Shopping', 'Dining', 'Insurance', 'Debt Payment',
    'Savings', 'Investment', 'Travel', 'Subscriptions', 'Gifts', 'Personal Care',
    'Home Maintenance', 'Taxes', 'Other Expense'
  ];
  
  public readonly familyMembers = [
    'Self', 'Spouse', 'Child 1', 'Child 2', 'Child 3', 'Parent', 'Other'
  ];

  constructor() {
    this.loadFromStorage();
  }

  // CRUD Operations
  addTransaction(transaction: Omit<Transaction, 'id'>): void {
    const transactions = this.transactionsSubject.value;
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now()
    };
    this.transactionsSubject.next([...transactions, newTransaction]);
    this.saveToStorage();
  }

  updateTransaction(id: number, updates: Partial<Transaction>): void {
    const transactions = this.transactionsSubject.value;
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updates };
      this.transactionsSubject.next([...transactions]);
      this.saveToStorage();
    }
  }

  deleteTransaction(id: number): void {
    const transactions = this.transactionsSubject.value;
    this.transactionsSubject.next(transactions.filter(t => t.id !== id));
    this.saveToStorage();
  }

  bulkDeleteTransactions(ids: number[]): void {
    const transactions = this.transactionsSubject.value;
    this.transactionsSubject.next(transactions.filter(t => !ids.includes(t.id)));
    this.saveToStorage();
  }

  // Filter operations
  updateFilter(filter: Partial<TransactionFilter>): void {
    this.filterSubject.next({ ...this.filterSubject.value, ...filter });
  }

  resetFilter(): void {
    this.filterSubject.next({
      type: 'all',
      category: 'All',
      familyMember: 'All',
      dateRange: this.getCurrentMonthRange(),
      searchTerm: ''
    });
  }

  // Data operations
  exportToJSON(): string {
    return JSON.stringify(this.transactionsSubject.value, null, 2);
  }

  importFromJSON(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      const transactions = data.map((t: any) => ({
        ...t,
        date: new Date(t.date)
      }));
      this.transactionsSubject.next(transactions);
      this.saveToStorage();
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  clearAllData(): void {
    this.transactionsSubject.next([]);
    this.saveToStorage();
  }

  // Helper methods
  private applyFilters(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
    let filtered = [...transactions];

    // Filter by type
    if (filter.type !== 'all') {
      filtered = filtered.filter(t => t.type === filter.type);
    }

    // Filter by category
    if (filter.category !== 'All') {
      filtered = filtered.filter(t => t.category === filter.category);
    }

    // Filter by family member
    if (filter.familyMember !== 'All') {
      filtered = filtered.filter(t => t.familyMember === filter.familyMember);
    }

    // Filter by date range
    if (filter.dateRange) {
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= filter.dateRange!.start && 
               transactionDate <= filter.dateRange!.end;
      });
    }

    // Filter by search term
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term) ||
        t.notes?.toLowerCase().includes(term)
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private calculateSummary(transactions: Transaction[]): FinancialSummary {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const filter = this.filterSubject.value;
    const days = filter.dateRange 
      ? Math.ceil((filter.dateRange.end.getTime() - filter.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses,
      transactionCount: transactions.length,
      avgDailyExpense: expenses / days,
      savingsRate: income > 0 ? ((income - expenses) / income * 100) : 0
    };
  }

  private groupByCategory(transactions: Transaction[]): Map<string, number> {
    const groups = new Map<string, number>();
    transactions.forEach(t => {
      groups.set(t.category, (groups.get(t.category) || 0) + t.amount);
    });
    return groups;
  }

  private groupByMember(transactions: Transaction[]): Map<string, { income: number; expenses: number; net: number }> {
    const groups = new Map<string, { income: number; expenses: number; net: number }>();
    
    transactions.forEach(t => {
      if (!groups.has(t.familyMember)) {
        groups.set(t.familyMember, { income: 0, expenses: 0, net: 0 });
      }
      
      const memberData = groups.get(t.familyMember)!;
      if (t.type === 'income') {
        memberData.income += t.amount;
      } else {
        memberData.expenses += t.amount;
      }
      memberData.net = memberData.income - memberData.expenses;
    });
    
    return groups;
  }

  private getCurrentMonthRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const transactions = data.map((t: any) => ({
          ...t,
          date: new Date(t.date)
        }));
        this.transactionsSubject.next(transactions);
      } catch (error) {

        this.loadSampleData();
      }
    } else {
      this.loadSampleData();
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.transactionsSubject.value));
  }

  private loadSampleData(): void {
    const now = new Date();
    const sampleTransactions: Transaction[] = [
      {
        id: 1,
        description: 'Monthly Salary',
        amount: 5000,
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        category: 'Salary',
        type: 'income',
        familyMember: 'Self',
        notes: 'Monthly paycheck',
        recurring: true
      },
      {
        id: 2,
        description: 'Spouse Salary',
        amount: 4500,
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        category: 'Salary',
        type: 'income',
        familyMember: 'Spouse',
        recurring: true
      },
      {
        id: 3,
        description: 'Grocery Shopping - Whole Foods',
        amount: 450,
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        category: 'Groceries',
        type: 'expense',
        familyMember: 'Self',
        tags: ['food', 'weekly']
      },
      {
        id: 4,
        description: 'Electricity Bill',
        amount: 120,
        date: new Date(now.getFullYear(), now.getMonth(), 10),
        category: 'Utilities',
        type: 'expense',
        familyMember: 'Self',
        recurring: true
      },
      {
        id: 5,
        description: 'Monthly Rent Payment',
        amount: 1500,
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        category: 'Rent/Mortgage',
        type: 'expense',
        familyMember: 'Self',
        recurring: true
      },
      {
        id: 6,
        description: 'Freelance Web Development Project',
        amount: 1200,
        date: new Date(now.getFullYear(), now.getMonth(), 15),
        category: 'Freelance',
        type: 'income',
        familyMember: 'Self',
        notes: 'Client: ABC Corp'
      },
      {
        id: 7,
        description: 'Family Dinner at Restaurant',
        amount: 85,
        date: new Date(now.getFullYear(), now.getMonth(), 12),
        category: 'Dining',
        type: 'expense',
        familyMember: 'Self',
        tags: ['family', 'weekend']
      },
      {
        id: 8,
        description: 'Car Insurance Premium',
        amount: 200,
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        category: 'Insurance',
        type: 'expense',
        familyMember: 'Self',
        recurring: true
      },
      {
        id: 9,
        description: 'Netflix & Spotify',
        amount: 25,
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        category: 'Subscriptions',
        type: 'expense',
        familyMember: 'Self',
        recurring: true,
        tags: ['entertainment']
      },
      {
        id: 10,
        description: 'Bonus Payment',
        amount: 800,
        date: new Date(now.getFullYear(), now.getMonth(), 20),
        category: 'Bonus',
        type: 'income',
        familyMember: 'Self'
      }
    ];
    
    this.transactionsSubject.next(sampleTransactions);
    this.saveToStorage();
  }
}

