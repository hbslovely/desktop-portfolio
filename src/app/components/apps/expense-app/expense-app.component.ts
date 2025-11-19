import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService, Expense } from '../../../services/expense.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-expense-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-app.component.html',
  styleUrl: './expense-app.component.scss'
})
export class ExpenseAppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('categoryChart') categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('dailyChart') dailyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryBarChart') categoryBarChartRef!: ElementRef<HTMLCanvasElement>;

  // Authentication
  isAuthenticated = signal<boolean>(false);
  password = signal<string>('');
  passwordError = signal<string>('');

  // Expenses list
  expenses = signal<Expense[]>([]);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Charts
  private categoryChart: Chart | null = null;
  private dailyChart: Chart | null = null;
  private categoryDetailChart: Chart | null = null;
  private categoryBarChart: Chart | null = null;

  // Add expense form
  showAddForm = signal<boolean>(false);
  createAnother = signal<boolean>(false);
  showSuccessMessage = signal<boolean>(false);
  inputMode = signal<'single' | 'multiple'>('single'); // Single or multiple input mode
  
  // Multiple expenses input
  multipleExpenses = signal<Expense[]>([]);
  savingProgress = signal<{ current: number; total: number; saving: boolean }>({ current: 0, total: 0, saving: false });

  // Category detail dialog
  showCategoryDetail = signal<boolean>(false);
  selectedCategory = signal<string>('');
  showCustomDateDialog = signal<boolean>(false); // For custom date range filter

  // Day detail dialog
  showDayDetail = signal<boolean>(false);
  selectedDay = signal<string>('');
  selectedDayExpenses = signal<Expense[]>([]);

  // Computed total for selected day expenses
  selectedDayTotal = computed(() => {
    const expenses = this.selectedDayExpenses();
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  });

  // Day of week detail dialog
  showDayOfWeekDetail = signal<boolean>(false);
  selectedDayOfWeek = signal<string>('');
  selectedDayOfWeekExpenses = signal<Expense[]>([]);

  // Computed total for selected day of week expenses
  selectedDayOfWeekTotal = computed(() => {
    const expenses = this.selectedDayOfWeekExpenses();
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  });

  newExpense: Expense = {
    date: '',
    content: '',
    amount: 0,
    category: '',
    note: ''
  };

  // Edit expense
  showEditForm = signal<boolean>(false);
  editingExpense = signal<Expense | null>(null);
  editingExpenseIndex = signal<number>(-1);
  editExpense: Expense = {
    date: '',
    content: '',
    amount: 0,
    category: '',
    note: ''
  };

  // Notification dialog
  showNotification = signal<boolean>(false);
  notificationMessage = signal<string>('');
  notificationType = signal<'success' | 'error'>('success');

  // Categories (from the sheet data)
  categories = signal<string[]>([
    'Kinh doanh',
    'Đi chợ',
    'Siêu thị',
    'Ăn uống ngoài',
    'Nhà hàng',
    'Đi lại - xăng xe',
    'Gia đình/Bạn bè',
    'Điện - nước',
    'Pet/Thú cưng/Vật nuôi khác'
  ]);

  // Filter
  filterCategory = signal<string>('');
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');
  searchText = signal<string>('');
  filterAmountMin = signal<number | null>(null);
  filterAmountMax = signal<number | null>(null);

  // Check if filter is single day
  isSingleDayFilter = computed(() => {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();
    return dateFrom && dateTo && dateFrom === dateTo;
  });

  // Tabs
  activeTab = signal<'list' | 'summary'>('list');

  // Sorting for expenses list
  sortField = signal<'date' | 'amount' | 'category' | 'content'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Computed signals for optimized performance
  filteredExpenses = computed(() => {
    const allExpenses = this.expenses();
    const category = this.filterCategory();
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();
    const search = this.searchText().toLowerCase().trim();
    const amountMin = this.filterAmountMin();
    const amountMax = this.filterAmountMax();
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();

    let filtered = [...allExpenses];

    // Filter by category
    if (category) {
      filtered = filtered.filter(expense => expense.category === category);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(expense => expense.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(expense => expense.date <= dateTo);
    }

    // Filter by search text
    if (search) {
      filtered = filtered.filter(expense =>
        expense.content.toLowerCase().includes(search) ||
        expense.category.toLowerCase().includes(search)
      );
    }

    // Filter by amount range
    if (amountMin !== null) {
      filtered = filtered.filter(expense => expense.amount >= amountMin);
    }
    if (amountMax !== null) {
      filtered = filtered.filter(expense => expense.amount <= amountMax);
    }

    // Sort expenses
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          const dateA = this.parseDate(a.date);
          const dateB = this.parseDate(b.date);
          if (!dateA || !dateB) return 0;
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category, 'vi');
          break;
        case 'content':
          comparison = a.content.localeCompare(b.content, 'vi');
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  });

  totalAmount = computed(() => {
    return this.filteredExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  });

  totalByCategory = computed(() => {
    const totals: { [key: string]: number } = {};

    this.filteredExpenses().forEach(expense => {
      if (expense.category) {
        totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
      }
    });

    return Object.keys(totals).map(category => ({
      category,
      total: totals[category]
    })).sort((a, b) => b.total - a.total);
  });

  dailyExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    const dailyMap: { [key: string]: number } = {};

    expenses.forEach(expense => {
      const date = expense.date;
      if (dailyMap[date]) {
        dailyMap[date] += expense.amount;
      } else {
        dailyMap[date] = expense.amount;
      }
    });

    return Object.keys(dailyMap)
      .sort()
      .map(date => ({
        date: date, // Keep original date string (YYYY-MM-DD)
        total: dailyMap[date]
      }));
  });


  averageDailyExpense = computed(() => {
    const dailyTotals = this.dailyExpenses();
    if (dailyTotals.length === 0) return 0;

    const total = dailyTotals.reduce((sum, item) => sum + item.total, 0);
    return Math.round(total / dailyTotals.length);
  });

  averageExpense = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return 0;

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    return Math.round(total / expenses.length);
  });

  // Advanced Statistics
  medianExpense = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return 0;
    const sorted = [...expenses].sort((a, b) => a.amount - b.amount);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1].amount + sorted[mid].amount) / 2)
      : sorted[mid].amount;
  });

  expenseTrend = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length < 2) return 'stable';

    const sorted = [...expenses].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recent = sorted.slice(-7);
    const previous = sorted.slice(-14, -7);

    if (previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, e) => sum + e.amount, 0) / recent.length;
    const previousAvg = previous.reduce((sum, e) => sum + e.amount, 0) / previous.length;

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  });

  // Period comparison for filtered dates
  periodComparison = computed(() => {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    if (!dateFrom || !dateTo) return null;

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check if it's 7 days or 30 days filter
    if (daysDiff === 7 || daysDiff === 6) {
      // Compare with previous 7 days
      const prevFrom = new Date(fromDate);
      prevFrom.setDate(prevFrom.getDate() - 7);
      const prevTo = new Date(fromDate);
      prevTo.setDate(prevTo.getDate() - 1);

      const currentTotal = this.filteredExpenses().reduce((sum, e) => sum + e.amount, 0);
      const previousExpenses = this.expenses().filter(e => {
        const eDate = new Date(e.date);
        return eDate >= prevFrom && eDate <= prevTo;
      });
      const previousTotal = previousExpenses.reduce((sum, e) => sum + e.amount, 0);

      if (previousTotal === 0) return null;

      const change = ((currentTotal - previousTotal) / previousTotal) * 100;
      return {
        period: '7 ngày',
        change: Math.round(change),
        current: currentTotal,
        previous: previousTotal
      };
    } else if (daysDiff === 30 || daysDiff === 29) {
      // Compare with previous 30 days
      const prevFrom = new Date(fromDate);
      prevFrom.setDate(prevFrom.getDate() - 30);
      const prevTo = new Date(fromDate);
      prevTo.setDate(prevTo.getDate() - 1);

      const currentTotal = this.filteredExpenses().reduce((sum, e) => sum + e.amount, 0);
      const previousExpenses = this.expenses().filter(e => {
        const eDate = new Date(e.date);
        return eDate >= prevFrom && eDate <= prevTo;
      });
      const previousTotal = previousExpenses.reduce((sum, e) => sum + e.amount, 0);

      if (previousTotal === 0) return null;

      const change = ((currentTotal - previousTotal) / previousTotal) * 100;
      return {
        period: '30 ngày',
        change: Math.round(change),
        current: currentTotal,
        previous: previousTotal
      };
    }

    return null;
  });

  topSpendingDays = computed(() => {
    const dailyData = this.dailyExpenses();
    return dailyData
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  });

  bottomSpendingDays = computed(() => {
    const dailyData = this.dailyExpenses();
    return dailyData
      .sort((a, b) => a.total - b.total)
      .slice(0, 5);
  });

  topExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    return [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  });

  bottomExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    return [...expenses]
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5);
  });

  spendingByDayOfWeek = computed(() => {
    const expenses = this.filteredExpenses();
    const dayMap: { [key: string]: { total: number; count: number } } = {};

    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek];

      if (!dayMap[dayName]) {
        dayMap[dayName] = { total: 0, count: 0 };
      }
      dayMap[dayName].total += expense.amount;
      dayMap[dayName].count += 1;
    });

    // Return in order: CN, T2, T3, T4, T5, T6, T7
    return dayNames.map(dayName => {
      const data = dayMap[dayName] || { total: 0, count: 0 };
      return {
        day: dayName,
        total: data.total,
        count: data.count,
        average: data.count > 0 ? Math.round(data.total / data.count) : 0
      };
    }).filter(item => item.count > 0);
  });

  categoryTrends = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return [];

    const categoryMap: { [key: string]: { current: number; previous: number } } = {};
    const sorted = [...expenses].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const mid = Math.floor(sorted.length / 2);
    const current = sorted.slice(mid);
    const previous = sorted.slice(0, mid);

    current.forEach(e => {
      if (!categoryMap[e.category]) {
        categoryMap[e.category] = { current: 0, previous: 0 };
      }
      categoryMap[e.category].current += e.amount;
    });

    previous.forEach(e => {
      if (!categoryMap[e.category]) {
        categoryMap[e.category] = { current: 0, previous: 0 };
      }
      categoryMap[e.category].previous += e.amount;
    });

    return Object.keys(categoryMap).map(category => {
      const data = categoryMap[category];
      const change = data.previous > 0
        ? ((data.current - data.previous) / data.previous) * 100
        : 0;
      return {
        category,
        current: data.current,
        previous: data.previous,
        change: Math.round(change)
      };
    }).sort((a, b) => b.current - a.current);
  });

  maxExpense = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return null;

    return expenses.reduce((max, expense) =>
      expense.amount > max.amount ? expense : max
    );
  });

  minExpense = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return null;

    return expenses.reduce((min, expense) =>
      expense.amount < min.amount ? expense : min
    );
  });

  expenseSuggestions = computed(() => {
    const suggestions: string[] = [];
    const expenses = this.filteredExpenses();

    if (expenses.length === 0) {
      suggestions.push('Bắt đầu ghi chép chi tiêu để nhận gợi ý!');
      return suggestions;
    }

    const total = this.totalAmount();
    const avgDaily = this.averageDailyExpense();
    const categoryData = this.totalByCategory();

    // Find top spending category
    if (categoryData.length > 0) {
      const topCategory = categoryData[0];
      const topPercentage = (topCategory.total / total) * 100;

      if (topPercentage > 40) {
        suggestions.push(`⚠️ Bạn đang chi ${topPercentage.toFixed(1)}% tổng chi tiêu cho "${topCategory.category}". Hãy xem xét giảm chi tiêu ở mục này.`);
      }
    }

    // Check daily average
    if (avgDaily > 500000) {
      suggestions.push(`💰 Trung bình mỗi ngày bạn chi ${this.formatAmount(avgDaily)}. Hãy cân nhắc lập ngân sách hàng ngày.`);
    }

    // Check if there are many small expenses
    const smallExpenses = expenses.filter(e => e.amount < 50000).length;
    if (smallExpenses > expenses.length * 0.5) {
      suggestions.push(`📝 Bạn có nhiều chi tiêu nhỏ (${smallExpenses} giao dịch). Tổng hợp các chi tiêu nhỏ có thể giúp tiết kiệm.`);
    }

    // Check category diversity
    if (categoryData.length < 3) {
      suggestions.push(`📊 Bạn chỉ chi tiêu ở ${categoryData.length} phân loại. Hãy đa dạng hóa để quản lý tốt hơn.`);
    }

    // Positive feedback
    if (avgDaily < 200000 && expenses.length > 10) {
      suggestions.push(`✅ Bạn đang quản lý chi tiêu tốt với mức trung bình ${this.formatAmount(avgDaily)}/ngày. Tiếp tục phát huy!`);
    }

    if (suggestions.length === 0) {
      suggestions.push('💡 Tiếp tục theo dõi chi tiêu để nhận thêm gợi ý!');
    }

    return suggestions;
  });

  // Category detail data
  categoryDetailExpenses = computed(() => {
    const category = this.selectedCategory();
    if (!category) return [];

    return this.filteredExpenses()
      .filter(expense => expense.category === category)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  categoryDetailByDate = computed(() => {
    const expenses = this.categoryDetailExpenses();
    const dailyMap: { [key: string]: { total: number; items: Expense[] } } = {};

    expenses.forEach(expense => {
      const date = expense.date;
      if (dailyMap[date]) {
        dailyMap[date].total += expense.amount;
        dailyMap[date].items.push(expense);
      } else {
        dailyMap[date] = {
          total: expense.amount,
          items: [expense]
        };
      }
    });

    return Object.keys(dailyMap)
      .sort()
      .map(date => ({
        date: date,
        displayDate: this.formatDate(date),
        shortDate: this.formatDateShort(date),
        total: dailyMap[date].total,
        items: dailyMap[date].items
      }));
  });

  categoryDetailTotal = computed(() => {
    return this.categoryDetailExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  });

  // Category statistics
  categoryAveragePerTransaction = computed(() => {
    const expenses = this.categoryDetailExpenses();
    if (expenses.length === 0) return 0;
    return Math.round(this.categoryDetailTotal() / expenses.length);
  });

  categoryAveragePerDay = computed(() => {
    const byDate = this.categoryDetailByDate();
    if (byDate.length === 0) return 0;
    const total = byDate.reduce((sum, item) => sum + item.total, 0);
    return Math.round(total / byDate.length);
  });

  categoryAveragePerMonth = computed(() => {
    const expenses = this.categoryDetailExpenses();
    if (expenses.length === 0) return 0;

    // Group by month
    const monthlyMap: { [key: string]: number } = {};
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey] += expense.amount;
      } else {
        monthlyMap[monthKey] = expense.amount;
      }
    });

    const months = Object.keys(monthlyMap);
    if (months.length === 0) return 0;

    const total = months.reduce((sum, month) => sum + monthlyMap[month], 0);
    return Math.round(total / months.length);
  });

  categoryTotalTransactions = computed(() => {
    return this.categoryDetailExpenses().length;
  });

  categoryTotalDays = computed(() => {
    return this.categoryDetailByDate().length;
  });

  categoryTotalMonths = computed(() => {
    const expenses = this.categoryDetailExpenses();
    if (expenses.length === 0) return 0;

    const monthlySet = new Set<string>();
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlySet.add(monthKey);
    });

    return monthlySet.size;
  });

  constructor(private expenseService: ExpenseService) {
    // Effect to update charts when filtered expenses or filters change
    effect(() => {
      // Track filtered expenses and active tab to trigger chart updates
      const filtered = this.filteredExpenses();
      const tab = this.activeTab();

      // Only update charts if we're on summary tab and have data
      if (tab === 'summary' && filtered.length > 0 && this.categoryChartRef?.nativeElement) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          this.initCharts();
        }, 100);
      }
    });
  }

  ngOnInit(): void {
    // Set default date to today
    this.newExpense.date = this.expenseService.getTodayDate();

    // Check if already authenticated and still valid (same day)
    if (this.expenseService.isAuthenticationValid()) {
      this.isAuthenticated.set(true);
      this.loadExpenses();
    } else {
      // Clear invalid authentication
      sessionStorage.removeItem('expense_app_auth_hash');
    }
  }

  ngAfterViewInit(): void {
    // Charts will be initialized when data is loaded
  }

  ngOnDestroy(): void {
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
    if (this.dailyChart) {
      this.dailyChart.destroy();
    }
    if (this.categoryDetailChart) {
      this.categoryDetailChart.destroy();
    }
    if (this.categoryBarChart) {
      this.categoryBarChart.destroy();
    }
  }

  /**
   * Handle ESC key to close dialogs (except create dialog)
   */
  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    // Don't close if create dialog is open
    if (this.showAddForm()) {
      return;
    }

    // Close other dialogs
    if (this.showCategoryDetail()) {
      this.hideCategoryDetailDialog();
    } else if (this.showEditForm()) {
      this.hideEditExpenseForm();
    } else if (this.showDayDetail()) {
      this.hideDayDetailDialog();
    } else if (this.showDayOfWeekDetail()) {
      this.hideDayOfWeekDetailDialog();
    } else if (this.showCustomDateDialog()) {
      this.hideCustomDateRangeDialog();
    } else if (this.showNotification()) {
      this.hideNotificationDialog();
    }
  }

  /**
   * Authenticate with reversed date password
   */
  authenticate(): void {
    const inputPassword = this.password().trim();

    if (!inputPassword) {
      this.passwordError.set('Vui lòng nhập mật khẩu');
      return;
    }

    if (this.expenseService.verifyPassword(inputPassword)) {
      this.isAuthenticated.set(true);
      this.passwordError.set('');
      this.password.set('');

      // Store hashed password in sessionStorage (expires next day)
      const hashedPassword = this.expenseService.getTodayHashedPassword();
      sessionStorage.setItem('expense_app_auth_hash', hashedPassword);

      // Load expenses
      this.loadExpenses();
    } else {
      this.passwordError.set('Mật khẩu không đúng');
    }
  }

  /**
   * Logout
   */
  logout(): void {
    this.isAuthenticated.set(false);
    this.password.set('');
    this.passwordError.set('');
    this.expenses.set([]);
    this.showAddForm.set(false);
    sessionStorage.removeItem('expense_app_auth_hash');

    // Destroy charts
    if (this.categoryChart) {
      this.categoryChart.destroy();
      this.categoryChart = null;
    }
    if (this.dailyChart) {
      this.dailyChart.destroy();
      this.dailyChart = null;
    }
  }

  /**
   * Handle password input keydown
   */
  onPasswordKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.authenticate();
    }
  }

  /**
   * Load expenses from Google Sheets
   * Uses caching to prevent multiple API calls
   */
  loadExpenses(forceRefresh: boolean = false): void {
    // Prevent multiple simultaneous calls
    if (this.isLoading() && !forceRefresh) {
      console.log('⏳ Already loading expenses, skipping...');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.expenseService.getExpenses(forceRefresh).subscribe({
      next: (data) => {
        data.forEach((expense, index) => {
          expense.rowIndex = index;
        });
        // Sort by date descending (newest first)
        const sorted = data.sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        this.expenses.set(sorted);
        this.isLoading.set(false);

        // Initialize charts after data is loaded
        setTimeout(() => {
          if (this.activeTab() === 'summary') {
            this.initCharts();
          }
        }, 100);
      },
      error: (err) => {
        console.error('Error loading expenses:', err);
        this.error.set('Không thể tải danh sách chi tiêu. Vui lòng kiểm tra quyền truy cập Google Sheets.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Show add expense dialog
   */
  showAddExpenseForm(): void {
    this.newExpense = {
      date: this.expenseService.getTodayDate(),
      content: '',
      amount: 0,
      category: '',
      note: ''
    };
    this.inputMode.set('single');
    this.multipleExpenses.set([this.createEmptyExpense()]);
    this.savingProgress.set({ current: 0, total: 0, saving: false });
    this.showAddForm.set(true);
  }

  /**
   * Create empty expense for multiple input
   */
  createEmptyExpense(): Expense {
    return {
      date: this.expenseService.getTodayDate(),
      content: '',
      amount: 0,
      category: '',
      note: ''
    };
  }

  /**
   * Hide add expense dialog
   */
  hideAddExpenseForm(): void {
    this.showAddForm.set(false);
    this.createAnother.set(false);
    this.showSuccessMessage.set(false);
    this.inputMode.set('single');
    this.multipleExpenses.set([]);
    this.savingProgress.set({ current: 0, total: 0, saving: false });
    this.newExpense = {
      date: this.expenseService.getTodayDate(),
      content: '',
      amount: 0,
      category: ''
    };
  }

  /**
   * Reset form for next expense (keep date and category)
   */
  resetFormForNext(): void {
    this.newExpense.content = '';
    this.newExpense.amount = 0;
    this.newExpense.note = '';
  }

  /**
   * Show edit expense dialog
   */
  showEditExpenseForm(expense: Expense, index: number): void {
    this.editExpense = {
      date: expense.date,
      content: expense.content,
      amount: expense.amount,
      category: expense.category,
      note: expense.note || ''
    };
    this.editingExpense.set(expense);
    this.editingExpenseIndex.set(index);
    this.showEditForm.set(true);
  }

  /**
   * Hide edit expense dialog
   */
  hideEditExpenseForm(): void {
    this.showEditForm.set(false);
    this.editingExpense.set(null);
    this.editingExpenseIndex.set(-1);
    this.editExpense = {
      date: '',
      content: '',
      amount: 0,
      category: '',
      note: ''
    };
  }

  /**
   * Show notification dialog
   */
  showNotificationDialog(message: string, type: 'success' | 'error' = 'success'): void {
    this.notificationMessage.set(message);
    this.notificationType.set(type);
    this.showNotification.set(true);

    // Auto close after 3 seconds for success, 5 seconds for error
    setTimeout(() => {
      this.hideNotificationDialog();
    }, type === 'success' ? 3000 : 5000);
  }

  /**
   * Hide notification dialog
   */
  hideNotificationDialog(): void {
    this.showNotification.set(false);
    this.notificationMessage.set('');
    this.notificationType.set('success');
  }

  /**
   * Update expense
   */
  updateExpense(): void {
    // Validate
    if (!this.editExpense.content.trim()) {
      this.showNotificationDialog('Vui lòng nhập nội dung chi tiêu', 'error');
      return;
    }

    if (!this.editExpense.amount || this.editExpense.amount <= 0) {
      this.showNotificationDialog('Vui lòng nhập số tiền hợp lệ', 'error');
      return;
    }

    if (!this.editExpense.category) {
      this.showNotificationDialog('Vui lòng chọn phân loại', 'error');
      return;
    }

    if (!this.editExpense.date) {
      this.showNotificationDialog('Vui lòng chọn ngày', 'error');
      return;
    }

    const expense = this.editingExpense();
    if (!expense) return;

    // Find the row index in the original expenses list
    // Row index = index in expenses array + 2 (row 1 is header, row 2 is first data)
    const expenses = this.expenses();
    const originalExpense = expenses.find(e =>
      e.date === expense.date &&
      e.content === expense.content &&
      e.amount === expense.amount &&
      e.category === expense.category
    );

    if (!originalExpense) {
      this.showNotificationDialog('Không tìm thấy giao dịch cần cập nhật', 'error');
      return;
    }

    const rowIndex = originalExpense!.rowIndex! + 2; // +2 because row 1 is header

    this.isLoading.set(true);
    this.error.set(null);

    this.expenseService.updateExpense(this.editExpense, rowIndex).subscribe({
      next: () => {
        // Reload expenses with force refresh to get latest data
        this.loadExpenses(true);
        this.hideEditExpenseForm();
        this.isLoading.set(false);
        this.showNotificationDialog('Cập nhật chi tiêu thành công!', 'success');
      },
      error: (err) => {
        console.error('Error updating expense:', err);
        this.error.set('Không thể cập nhật chi tiêu. Vui lòng thử lại sau.');
        this.isLoading.set(false);
        this.showNotificationDialog('Lỗi: Không thể cập nhật chi tiêu. Vui lòng kiểm tra kết nối hoặc quyền truy cập Google Sheets.', 'error');
      }
    });
  }

  /**
   * Switch tab
   */
  switchTab(tab: 'list' | 'summary'): void {
    this.activeTab.set(tab);
    if (tab === 'summary') {
      // Initialize charts when switching to summary tab
      setTimeout(() => {
        this.initCharts();
      }, 100);
    }
  }

  /**
   * Initialize charts
   */
  initCharts(): void {
    if (this.expenses().length === 0) return;

    this.initCategoryChart();
    this.initDailyChart();
    this.initCategoryBarChart();
  }

  /**
   * Initialize category pie chart
   */
  initCategoryChart(): void {
    if (!this.categoryChartRef?.nativeElement) return;

    const categoryData = this.totalByCategory();
    if (categoryData.length === 0) return;

    // Destroy existing chart
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
      '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5'
    ];

    const config: ChartConfiguration = {
      type: 'pie',
      data: {
        labels: categoryData.map(item => item.category),
        datasets: [{
          data: categoryData.map(item => item.total),
          backgroundColor: colors.slice(0, categoryData.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 15,
              font: {
                size: 13
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = categoryData.reduce((sum, item) => sum + item.total, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${this.formatAmount(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    this.categoryChart = new Chart(this.categoryChartRef.nativeElement, config);
  }

  /**
   * Initialize daily line chart
   */
  initDailyChart(): void {
    if (!this.dailyChartRef?.nativeElement) return;

    // Don't show chart if filter is single day
    if (this.isSingleDayFilter()) {
      if (this.dailyChart) {
        this.dailyChart.destroy();
        this.dailyChart = null;
      }
      return;
    }

    const dailyData = this.dailyExpenses();
    if (dailyData.length === 0) return;

    // Ensure data is sorted by date (chronological order)
    const sortedData = [...dailyData].sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    // Destroy existing chart
    if (this.dailyChart) {
      this.dailyChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: sortedData.map(item => this.formatDateDDMMYYYY(item.date)),
        datasets: [{
          label: 'Chi tiêu theo ngày',
          data: sortedData.map(item => item.total),
          borderColor: '#FF6B6B',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#FF6B6B',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                return `Chi tiêu: ${this.formatAmount(typeof value === 'number' ? value : 0)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                return this.formatAmount(Number(value));
              }
            }
          }
        }
      }
    };

    this.dailyChart = new Chart(this.dailyChartRef.nativeElement, config);
  }

  /**
   * Initialize category bar chart
   */
  initCategoryBarChart(): void {
    if (!this.categoryBarChartRef?.nativeElement) return;

    const categoryData = this.totalByCategory();
    if (categoryData.length === 0) return;

    // Don't show chart if filter is single day
    if (this.isSingleDayFilter()) {
      if (this.categoryBarChart) {
        this.categoryBarChart.destroy();
        this.categoryBarChart = null;
      }
      return;
    }

    // Destroy existing chart
    if (this.categoryBarChart) {
      this.categoryBarChart.destroy();
    }

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
      '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5'
    ];

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: categoryData.map(item => item.category),
        datasets: [{
          label: 'Chi tiêu theo phân loại',
          data: categoryData.map(item => item.total),
          backgroundColor: colors.slice(0, categoryData.length).map((color, index) =>
            index % 2 === 0 ? color : color + '80'
          ),
          borderColor: colors.slice(0, categoryData.length),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                if (value === null || value === undefined) return '';
                const total = categoryData.reduce((sum, item) => sum + item.total, 0);
                const numValue = typeof value === 'number' ? value : 0;
                const percentage = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0';
                return `${this.formatAmount(numValue)} (${percentage}%)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                return this.formatAmount(Number(value));
              }
            }
          }
        }
      }
    };

    this.categoryBarChart = new Chart(this.categoryBarChartRef.nativeElement, config);
  }


  /**
   * Format date short (DD/MM)
   */
  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    const date = this.parseDate(dateStr);
    if (!date) return dateStr;

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }

  /**
   * Format date as DD/MM/YYYY
   */
  formatDateDDMMYYYY(dateStr: string): string {
    if (!dateStr) return '';
    const date = this.parseDate(dateStr);
    if (!date) return dateStr;

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format date as Thứ X, DD/MM/YYYY (for top days display)
   */
  formatDateWithDayOfWeek(dateStr: string): string {
    if (!dateStr) return '';
    const date = this.parseDate(dateStr);
    if (!date) return dateStr;

    const dayOfWeek = date.getDay();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[dayOfWeek];

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${dayName}, ${day}/${month}/${year}`;
  }

  /**
   * Parse date string correctly handling YYYY-MM-DD format
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Handle YYYY-MM-DD format (from Google Sheets)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }

    // Try to parse as Date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  /**
   * Add new expense (single mode)
   */
  addExpense(): void {
    // Validate
    if (!this.newExpense.content.trim()) {
      alert('Vui lòng nhập nội dung chi tiêu');
      return;
    }

    if (!this.newExpense.amount || this.newExpense.amount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    if (!this.newExpense.category) {
      alert('Vui lòng chọn phân loại');
      return;
    }

    if (!this.newExpense.date) {
      alert('Vui lòng chọn ngày');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.expenseService.addExpense(this.newExpense).subscribe({
      next: () => {
        // Reload expenses with force refresh to get latest data
        this.loadExpenses(true);

        // Show success message
        this.showSuccessMessage.set(true);

        // If "create another" is checked, reset form and keep dialog open
        if (this.createAnother()) {
          setTimeout(() => {
            this.showSuccessMessage.set(false);
            this.resetFormForNext();
          }, 1500);
        } else {
          // Close dialog after showing success message
          setTimeout(() => {
            this.hideAddExpenseForm();
          }, 1500);
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error adding expense:', err);
        this.error.set('Không thể thêm chi tiêu. Vui lòng thử lại sau.');
        this.isLoading.set(false);
        alert('Lỗi: Không thể thêm chi tiêu. Vui lòng kiểm tra kết nối hoặc quyền truy cập Google Sheets.');
      }
    });
  }

  /**
   * Add multiple expenses
   */
  addMultipleExpenses(): void {
    const expenses = this.multipleExpenses();
    
    // Filter out empty rows
    const validExpenses = expenses.filter(expense => 
      expense.content.trim() && 
      expense.amount > 0 && 
      expense.category && 
      expense.date
    );

    if (validExpenses.length === 0) {
      alert('Vui lòng nhập ít nhất một chi tiêu hợp lệ');
      return;
    }

    // Validate all expenses
    for (let i = 0; i < validExpenses.length; i++) {
      const expense = validExpenses[i];
      if (!expense.content.trim()) {
        alert(`Hàng ${i + 1}: Vui lòng nhập nội dung chi tiêu`);
        return;
      }
      if (!expense.amount || expense.amount <= 0) {
        alert(`Hàng ${i + 1}: Vui lòng nhập số tiền hợp lệ`);
        return;
      }
      if (!expense.category) {
        alert(`Hàng ${i + 1}: Vui lòng chọn phân loại`);
        return;
      }
      if (!expense.date) {
        alert(`Hàng ${i + 1}: Vui lòng chọn ngày`);
        return;
      }
    }

    this.savingProgress.set({ current: 0, total: validExpenses.length, saving: true });
    this.isLoading.set(true);
    this.error.set(null);

    // Save expenses sequentially
    this.saveExpensesSequentially(validExpenses, 0);
  }

  /**
   * Save expenses sequentially (one by one)
   */
  private saveExpensesSequentially(expenses: Expense[], index: number): void {
    if (index >= expenses.length) {
      // All expenses saved
      this.savingProgress.set({ current: expenses.length, total: expenses.length, saving: false });
      this.isLoading.set(false);
      
      // Reload expenses
      this.loadExpenses(true);
      
      // Show success message
      this.showSuccessMessage.set(true);
      
      // Close dialog after showing success message
      setTimeout(() => {
        this.hideAddExpenseForm();
      }, 1500);
      return;
    }

    const expense = expenses[index];
    this.savingProgress.set({ current: index + 1, total: expenses.length, saving: true });

    this.expenseService.addExpense(expense).subscribe({
      next: () => {
        // Save next expense
        this.saveExpensesSequentially(expenses, index + 1);
      },
      error: (err) => {
        console.error(`Error adding expense ${index + 1}:`, err);
        this.savingProgress.set({ current: index, total: expenses.length, saving: false });
        this.isLoading.set(false);
        alert(`Lỗi khi lưu chi tiêu thứ ${index + 1}: ${expense.content}. Đã lưu được ${index}/${expenses.length} chi tiêu.`);
        // Reload to get what was saved
        this.loadExpenses(true);
      }
    });
  }

  /**
   * Add new row to multiple expenses table
   */
  addExpenseRow(): void {
    const expenses = this.multipleExpenses();
    expenses.push(this.createEmptyExpense());
    this.multipleExpenses.set([...expenses]);
  }

  /**
   * Remove row from multiple expenses table
   */
  removeExpenseRow(index: number): void {
    const expenses = this.multipleExpenses();
    if (expenses.length > 1) {
      expenses.splice(index, 1);
      this.multipleExpenses.set([...expenses]);
    } else {
      alert('Phải có ít nhất một hàng');
    }
  }

  /**
   * Switch input mode
   */
  switchInputMode(mode: 'single' | 'multiple'): void {
    this.inputMode.set(mode);
    if (mode === 'multiple' && this.multipleExpenses().length === 0) {
      this.multipleExpenses.set([this.createEmptyExpense()]);
    }
  }

  /**
   * Get total amount of multiple expenses
   */
  getMultipleExpensesTotal(): number {
    return this.multipleExpenses().reduce((sum, expense) => {
      return sum + (expense.amount || 0);
    }, 0);
  }

  /**
   * Format date for display
   */
  formatDate(dateStr: string): string {
    if (!dateStr) return '';

    const date = this.parseDate(dateStr);
    if (!date) {
      console.warn('Invalid date:', dateStr);
      return dateStr;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    const dayOfWeek = date.getDay();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[dayOfWeek];

    return `${dayName}, ${day}/${month}/${year}`;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number): string {
    return `${amount.toLocaleString('vi-VN')} đ`;
  }

  // Expose Math and Number for template
  Math = Math;
  Number = Number;


  /**
   * Clear filters
   */
  clearFilters(): void {
    this.filterCategory.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.searchText.set('');
    this.filterAmountMin.set(null);
    this.filterAmountMax.set(null);
  }

  /**
   * Sort expenses by field
   */
  sortBy(field: 'date' | 'amount' | 'category' | 'content'): void {
    if (this.sortField() === field) {
      // Toggle direction if same field
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default direction
      this.sortField.set(field);
      this.sortDirection.set(field === 'date' ? 'desc' : 'asc');
    }
  }

  /**
   * Get sort icon for field
   */
  getSortIcon(field: 'date' | 'amount' | 'category' | 'content'): string {
    if (this.sortField() !== field) {
      return 'pi-sort';
    }
    return this.sortDirection() === 'asc' ? 'pi-sort-up' : 'pi-sort-down';
  }

  /**
   * Check if expense is above average
   */
  isAboveAverage(amount: number): boolean {
    return amount > this.averageExpense();
  }

  /**
   * Get percentage above average
   */
  getPercentageAboveAverage(amount: number): number {
    const avg = this.averageExpense();
    if (avg === 0) return 0;
    return Math.round(((amount - avg) / avg) * 100);
  }

  /**
   * Quick filter: Today
   */
  filterToday(): void {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    this.filterDateFrom.set(todayStr);
    this.filterDateTo.set(todayStr);
  }

  /**
   * Quick filter: Yesterday
   */
  filterYesterday(): void {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    this.filterDateFrom.set(yesterdayStr);
    this.filterDateTo.set(yesterdayStr);
  }

  /**
   * Quick filter: Last 7 days
   */
  filterLast7Days(): void {
    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    this.filterDateFrom.set(last7Days.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Quick filter: Last 30 days
   */
  filterLast30Days(): void {
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    this.filterDateFrom.set(last30Days.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Quick filter: Current month (from day 1 to today)
   */
  filterCurrentMonth(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.filterDateFrom.set(firstDay.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Show custom date range dialog
   */
  showCustomDateRangeDialog(): void {
    this.showCustomDateDialog.set(true);
  }

  /**
   * Hide custom date range dialog
   */
  hideCustomDateRangeDialog(): void {
    this.showCustomDateDialog.set(false);
  }

  /**
   * Apply custom date range
   */
  applyCustomDateRange(): void {
    this.hideCustomDateRangeDialog();
  }

  /**
   * Set date range preset: Last 3 days
   */
  setDateRangeLast3Days(): void {
    const today = new Date();
    const last3Days = new Date(today);
    last3Days.setDate(today.getDate() - 3);
    this.filterDateFrom.set(last3Days.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last 10 days
   */
  setDateRangeLast10Days(): void {
    const today = new Date();
    const last10Days = new Date(today);
    last10Days.setDate(today.getDate() - 10);
    this.filterDateFrom.set(last10Days.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last 7 days
   */
  setDateRangeLast7Days(): void {
    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    this.filterDateFrom.set(last7Days.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last 30 days
   */
  setDateRangeLast30Days(): void {
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    this.filterDateFrom.set(last30Days.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: This month
   */
  setDateRangeThisMonth(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.filterDateFrom.set(firstDay.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last month
   */
  setDateRangeLastMonth(): void {
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    this.filterDateFrom.set(firstDayLastMonth.toISOString().split('T')[0]);
    this.filterDateTo.set(lastDayLastMonth.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last 3 months
   */
  setDateRangeLast3Months(): void {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    this.filterDateFrom.set(threeMonthsAgo.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last 6 months
   */
  setDateRangeLast6Months(): void {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    this.filterDateFrom.set(sixMonthsAgo.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: This year
   */
  setDateRangeThisYear(): void {
    const today = new Date();
    const firstDayYear = new Date(today.getFullYear(), 0, 1);
    this.filterDateFrom.set(firstDayYear.toISOString().split('T')[0]);
    this.filterDateTo.set(today.toISOString().split('T')[0]);
  }

  /**
   * Set date range preset: Last year
   */
  setDateRangeLastYear(): void {
    const today = new Date();
    const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
    this.filterDateFrom.set(firstDayLastYear.toISOString().split('T')[0]);
    this.filterDateTo.set(lastDayLastYear.toISOString().split('T')[0]);
  }

  /**
   * Clear date range
   */
  clearDateRange(): void {
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
  }

  /**
   * Check if today filter is active
   */
  isTodayActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return this.filterDateFrom() === todayStr && this.filterDateTo() === todayStr;
  }

  /**
   * Check if yesterday filter is active
   */
  isYesterdayActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    return this.filterDateFrom() === yesterdayStr && this.filterDateTo() === yesterdayStr;
  }

  /**
   * Check if last 7 days filter is active
   */
  isLast7DaysActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    return this.filterDateFrom() === last7Days.toISOString().split('T')[0] &&
           this.filterDateTo() === today.toISOString().split('T')[0];
  }

  /**
   * Check if last 30 days filter is active
   */
  isLast30DaysActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    return this.filterDateFrom() === last30Days.toISOString().split('T')[0] &&
           this.filterDateTo() === today.toISOString().split('T')[0];
  }

  /**
   * Check if current month filter is active
   */
  isCurrentMonthActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return this.filterDateFrom() === firstDay.toISOString().split('T')[0] &&
           this.filterDateTo() === today.toISOString().split('T')[0];
  }

  /**
   * Show category detail dialog
   */
  showCategoryDetailDialog(category: string): void {
    this.selectedCategory.set(category);
    this.showCategoryDetail.set(true);

    // Initialize chart after dialog is shown
    setTimeout(() => {
      this.initCategoryDetailChart();
    }, 100);
  }

  /**
   * Hide category detail dialog
   */
  hideCategoryDetailDialog(): void {
    this.showCategoryDetail.set(false);
    this.selectedCategory.set('');

    // Destroy chart
    if (this.categoryDetailChart) {
      this.categoryDetailChart.destroy();
      this.categoryDetailChart = null;
    }
  }

  /**
   * Show day detail dialog
   */
  showDayDetailDialog(date: string): void {
    const expenses = this.filteredExpenses().filter(e => e.date === date);
    this.selectedDay.set(date);
    this.selectedDayExpenses.set(expenses);
    this.showDayDetail.set(true);
  }

  /**
   * Hide day detail dialog
   */
  hideDayDetailDialog(): void {
    this.showDayDetail.set(false);
    this.selectedDay.set('');
    this.selectedDayExpenses.set([]);
  }

  /**
   * Show day of week detail dialog
   */
  showDayOfWeekDetailDialog(dayOfWeek: string): void {
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayIndex = dayNames.indexOf(dayOfWeek);

    const expenses = this.filteredExpenses().filter(e => {
      const date = new Date(e.date);
      return date.getDay() === dayIndex;
    });

    this.selectedDayOfWeek.set(dayOfWeek);
    this.selectedDayOfWeekExpenses.set(expenses);
    this.showDayOfWeekDetail.set(true);
  }

  /**
   * Hide day of week detail dialog
   */
  hideDayOfWeekDetailDialog(): void {
    this.showDayOfWeekDetail.set(false);
    this.selectedDayOfWeek.set('');
    this.selectedDayOfWeekExpenses.set([]);
  }

  /**
   * Initialize category detail chart
   */
  initCategoryDetailChart(): void {
    const detailByDate = this.categoryDetailByDate();
    if (detailByDate.length === 0) return;

    // Destroy existing chart
    if (this.categoryDetailChart) {
      this.categoryDetailChart.destroy();
    }

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ];

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: detailByDate.map(item => item.shortDate),
        datasets: [{
          label: 'Chi tiêu theo ngày',
          data: detailByDate.map(item => item.total),
          backgroundColor: colors.slice(0, detailByDate.length).map((color, index) =>
            index % 2 === 0 ? color : color + '80'
          ),
          borderColor: colors.slice(0, detailByDate.length),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                return `Chi tiêu: ${this.formatAmount(typeof value === 'number' ? value : 0)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                return this.formatAmount(Number(value));
              }
            }
          }
        }
      }
    };

    const chartElement = document.getElementById('categoryDetailChart') as HTMLCanvasElement;
    if (chartElement) {
      this.categoryDetailChart = new Chart(chartElement, config);
    }
  }
}

