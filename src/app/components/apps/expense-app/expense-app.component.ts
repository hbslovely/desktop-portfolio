import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import ExpenseService, { Expense } from '../../../services/expense.service';
import { ExpenseSettingsService, ExpenseTheme, ExpenseFontSize, ExpenseLayout } from '../../../services/expense-settings.service';
import { ExpenseSettingsDialogComponent } from './expense-settings-dialog.component';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-expense-app',
  standalone: true,
  imports: [CommonModule, FormsModule, ExpenseSettingsDialogComponent, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './expense-app.component.html',
  styleUrl: './expense-app.component.scss'
})
export class ExpenseAppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('categoryChart') categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('dailyChart') dailyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryBarChart') categoryBarChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('todayComparisonChart') todayComparisonChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('todayTrendChart') todayTrendChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('outlierChart') outlierChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('boxPlotChart') boxPlotChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('zScoreChart') zScoreChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('predictionChart') predictionChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weeklyPredictionChart') weeklyPredictionChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyPredictionChart') monthlyPredictionChartRef!: ElementRef<HTMLCanvasElement>;

  // Authentication
  isAuthenticated = signal<boolean>(false);
  username = signal<string>('');
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
  private todayComparisonChart: Chart | null = null;
  private todayTrendChart: Chart | null = null;
  private outlierChart: Chart | null = null;
  private boxPlotChart: Chart | null = null;
  private zScoreChart: Chart | null = null;
  private predictionChart: Chart | null = null;
  private weeklyPredictionChart: Chart | null = null;
  private monthlyPredictionChart: Chart | null = null;

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

  // Matrix detail dialog
  showMatrixDetail = signal<boolean>(false);
  selectedMatrixDate = signal<string>('');
  selectedMatrixCategory = signal<string>('');
  selectedMatrixExpenses = signal<Expense[]>([]);

  // Computed total for selected matrix expenses
  selectedMatrixTotal = computed(() => {
    return this.selectedMatrixExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  });

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
  editExpenseAmountDisplay = signal<string>(''); // String value for ngx-mask display

  // Notification dialog
  showNotification = signal<boolean>(false);
  notificationMessage = signal<string>('');
  notificationType = signal<'success' | 'error'>('success');

  // Settings dialog
  showSettings = signal<boolean>(false);

  // Filter dialog (for v2)
  showFilterDialog = signal<boolean>(false);

  // Metric dialog (for v2)
  showMetricDialog = signal<boolean>(false);

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
    'Pet/Thú cưng/Vật nuôi khác',
    'Sức khỏe',
    'Thời trang / Mỹ Phẩm/ Làm đẹp',
    'Mua sắm / Mua sắm online',
    'Sữa/vitamin/chất bổ/Thuốc khác',
    'Từ thiện',
    'Điện thoại',
    'Sinh hoạt (Lee)',
    'Chi tiêu khác'
  ]);

  // Filter
  filterCategory = signal<string[]>([]);
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');
  searchText = signal<string>('');
  filterAmountMin = signal<number | null>(null);
  filterAmountMax = signal<number | null>(null);

  // Category filter dropdown state
  showCategoryDropdown = signal<boolean>(false);
  categorySearchText = signal<string>('');
  categoryDropdownPosition = signal<{ top: number; left: number } | null>(null);

  // Check if filter is single day
  isSingleDayFilter = computed(() => {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();
    return dateFrom && dateTo && dateFrom === dateTo;
  });

  // Tabs
  activeTab = signal<'list' | 'summary' | 'matrix'>('list');
  predictionTab = signal<'thisWeek' | 'nextWeek' | 'thisMonth'>('thisWeek');

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

    // Filter by category (multiple selection)
    if (category.length > 0) {
      filtered = filtered.filter(expense => category.includes(expense.category));
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

  // Get all unique categories from expenses
  uniqueCategories = computed(() => {
    const categorySet = new Set<string>();
    this.filteredExpenses().forEach(expense => {
      if (expense.category) {
        categorySet.add(expense.category);
      }
    });
    return Array.from(categorySet).sort();
  });

  // Filtered categories based on search text
  filteredCategories = computed(() => {
    const search = this.categorySearchText().toLowerCase().trim();
    const allCategories = this.categories();

    if (!search) {
      return allCategories;
    }

    return allCategories.filter(cat =>
      cat.toLowerCase().includes(search)
    );
  });

  // Check if all filtered categories are selected
  isAllFilteredCategoriesSelected = computed(() => {
    const filtered = this.filteredCategories();
    const selected = this.filterCategory();

    if (filtered.length === 0) return false;

    return filtered.every(cat => selected.includes(cat));
  });

  // Check if some (but not all) filtered categories are selected (for indeterminate state)
  isSomeFilteredCategoriesSelected = computed(() => {
    const filtered = this.filteredCategories();
    const selected = this.filterCategory();

    if (filtered.length === 0) return false;

    const selectedCount = filtered.filter(cat => selected.includes(cat)).length;
    return selectedCount > 0 && selectedCount < filtered.length;
  });

  // Get all unique dates
  uniqueDates = computed(() => {
    const dateSet = new Set<string>();
    this.filteredExpenses().forEach(expense => {
      dateSet.add(expense.date);
    });
    return Array.from(dateSet).sort();
  });

  // Calculate total amount per date for matrix
  dateTotals = computed(() => {
    const totals: { [date: string]: number } = {};
    this.filteredExpenses().forEach(expense => {
      totals[expense.date] = (totals[expense.date] || 0) + expense.amount;
    });
    return totals;
  });

  // Calculate average expense per day (for matrix comparison)
  dailyAverages = computed(() => {
    const dates = this.uniqueDates();
    const matrix = this.matrixData();
    const averages: { [date: string]: number } = {};

    dates.forEach(date => {
      const dayData = matrix[date];
      if (!dayData) {
        averages[date] = 0;
        return;
      }

      // Count categories with expenses and calculate average
      const categoriesWithExpenses = Object.values(dayData).filter(val => val > 0);
      if (categoriesWithExpenses.length === 0) {
        averages[date] = 0;
        return;
      }

      const total = categoriesWithExpenses.reduce((sum, val) => sum + val, 0);
      averages[date] = total / categoriesWithExpenses.length;
    });

    return averages;
  });

  // Calculate average amount per category
  categoryAverages = computed(() => {
    const averages: { [key: string]: number } = {};
    const categoryCounts: { [key: string]: number } = {};
    const categoryTotals: { [key: string]: number } = {};

    this.filteredExpenses().forEach(expense => {
      if (expense.category) {
        categoryCounts[expense.category] = (categoryCounts[expense.category] || 0) + 1;
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
      }
    });

    Object.keys(categoryTotals).forEach(category => {
      averages[category] = Math.round(categoryTotals[category] / categoryCounts[category]);
    });

    return averages;
  });

  // Matrix data: date x category
  matrixData = computed(() => {
    const dates = this.uniqueDates();
    const cats = this.uniqueCategories();
    const expenses = this.filteredExpenses();
    const matrix: { [date: string]: { [category: string]: number } } = {};

    // Initialize matrix
    dates.forEach(date => {
      matrix[date] = {};
      cats.forEach(category => {
        matrix[date][category] = 0;
      });
    });

    // Fill matrix with expense data
    expenses.forEach(expense => {
      if (expense.category && matrix[expense.date]) {
        matrix[expense.date][expense.category] = (matrix[expense.date][expense.category] || 0) + expense.amount;
      }
    });

    return matrix;
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

  // Cash Flow Statistics - Weekly
  weeklyExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return [];

    const weeklyMap: { [key: string]: { total: number; count: number; weekStart: string } } = {};

    expenses.forEach(expense => {
      const date = this.parseDate(expense.date);
      if (!date) return;

      // Get week start (Monday)
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      const weekStart = new Date(date.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;

      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          total: 0,
          count: 0,
          weekStart: weekStart.toISOString().split('T')[0]
        };
      }
      weeklyMap[weekKey].total += expense.amount;
      weeklyMap[weekKey].count += 1;
    });

    return Object.keys(weeklyMap)
      .sort()
      .map(key => ({
        weekKey: key,
        weekStart: weeklyMap[key].weekStart,
        total: weeklyMap[key].total,
        count: weeklyMap[key].count,
        average: Math.round(weeklyMap[key].total / weeklyMap[key].count)
      }));
  });

  averageWeeklyExpense = computed(() => {
    const weekly = this.weeklyExpenses();
    if (weekly.length === 0) return 0;
    const total = weekly.reduce((sum, week) => sum + week.total, 0);
    return Math.round(total / weekly.length);
  });

  // Cash Flow Statistics - Monthly
  monthlyExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return [];

    const monthlyMap: { [key: string]: { total: number; count: number; days: Set<string> } } = {};

    expenses.forEach(expense => {
      const date = this.parseDate(expense.date);
      if (!date) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          total: 0,
          count: 0,
          days: new Set()
        };
      }
      monthlyMap[monthKey].total += expense.amount;
      monthlyMap[monthKey].count += 1;
      monthlyMap[monthKey].days.add(expense.date);
    });

    return Object.keys(monthlyMap)
      .sort()
      .map(key => ({
        monthKey: key,
        total: monthlyMap[key].total,
        count: monthlyMap[key].count,
        daysWithExpenses: monthlyMap[key].days.size,
        averagePerDay: Math.round(monthlyMap[key].total / monthlyMap[key].days.size),
        averagePerTransaction: Math.round(monthlyMap[key].total / monthlyMap[key].count)
      }));
  });

  averageMonthlyExpense = computed(() => {
    const monthly = this.monthlyExpenses();
    if (monthly.length === 0) return 0;
    const total = monthly.reduce((sum, month) => sum + month.total, 0);
    return Math.round(total / monthly.length);
  });

  // Spending Frequency
  spendingFrequency = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return { daysWithExpenses: 0, totalDays: 0, frequency: 0 };

    const uniqueDates = new Set(expenses.map(e => e.date));
    const dates = this.uniqueDates();
    const totalDays = dates.length;

    return {
      daysWithExpenses: uniqueDates.size,
      totalDays: totalDays,
      frequency: totalDays > 0 ? Math.round((uniqueDates.size / totalDays) * 100) : 0
    };
  });

  // Transactions per day
  transactionsPerDay = computed(() => {
    const expenses = this.filteredExpenses();
    const dates = this.uniqueDates();
    if (dates.length === 0) return 0;
    return Math.round((expenses.length / dates.length) * 10) / 10;
  });

  // Weekday vs Weekend comparison
  weekdayWeekendComparison = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) {
      return {
        weekday: { total: 0, count: 0, average: 0 },
        weekend: { total: 0, count: 0, average: 0 }
      };
    }

    let weekdayTotal = 0;
    let weekdayCount = 0;
    let weekendTotal = 0;
    let weekendCount = 0;

    expenses.forEach(expense => {
      const date = this.parseDate(expense.date);
      if (!date) return;

      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend) {
        weekendTotal += expense.amount;
        weekendCount += 1;
      } else {
        weekdayTotal += expense.amount;
        weekdayCount += 1;
      }
    });

    return {
      weekday: {
        total: weekdayTotal,
        count: weekdayCount,
        average: weekdayCount > 0 ? Math.round(weekdayTotal / weekdayCount) : 0
      },
      weekend: {
        total: weekendTotal,
        count: weekendCount,
        average: weekendCount > 0 ? Math.round(weekendTotal / weekendCount) : 0
      }
    };
  });

  // Projected monthly spending
  projectedMonthlySpending = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return 0;

    const dates = this.uniqueDates();
    if (dates.length === 0) return 0;

    const total = this.totalAmount();
    const avgDaily = total / dates.length;
    return Math.round(avgDaily * 30);
  });

  // Largest spending streak (consecutive days with expenses)
  largestSpendingStreak = computed(() => {
    const dates = this.uniqueDates();
    if (dates.length === 0) return { streak: 0, startDate: '', endDate: '' };

    let maxStreak = 0;
    let currentStreak = 1;
    let streakStart = dates[0];
    let maxStreakStart = dates[0];
    let maxStreakEnd = dates[0];

    for (let i = 1; i < dates.length; i++) {
      const prevDate = this.parseDate(dates[i - 1]);
      const currDate = this.parseDate(dates[i]);
      if (!prevDate || !currDate) continue;

      const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakStart = streakStart;
          maxStreakEnd = dates[i];
        }
      } else {
        currentStreak = 1;
        streakStart = dates[i];
      }
    }

    return {
      streak: maxStreak,
      startDate: maxStreakStart,
      endDate: maxStreakEnd
    };
  });

  // Helper function to get week number
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Statistical Analysis - Outliers and Anomalies
  statisticalAnalysis = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) {
      return {
        mean: 0,
        median: 0,
        mode: 0,
        standardDeviation: 0,
        variance: 0,
        q1: 0,
        q2: 0,
        q3: 0,
        iqr: 0,
        outliers: [],
        zScores: [],
        coefficientOfVariation: 0,
        skewness: 0,
        kurtosis: 0
      };
    }

    const amounts = expenses.map(e => e.amount).sort((a, b) => a - b);
    const n = amounts.length;

    // Mean
    const mean = amounts.reduce((sum, val) => sum + val, 0) / n;

    // Median (Q2)
    const q2 = n % 2 === 0
      ? (amounts[n / 2 - 1] + amounts[n / 2]) / 2
      : amounts[Math.floor(n / 2)];

    // Q1 (25th percentile)
    const q1Index = Math.floor(n * 0.25);
    const q1 = n % 4 === 0
      ? (amounts[q1Index - 1] + amounts[q1Index]) / 2
      : amounts[q1Index];

    // Q3 (75th percentile)
    const q3Index = Math.floor(n * 0.75);
    const q3 = n % 4 === 0
      ? (amounts[q3Index - 1] + amounts[q3Index]) / 2
      : amounts[q3Index];

    // IQR
    const iqr = q3 - q1;

    // Variance and Standard Deviation
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Mode (most frequent value within ranges)
    const modeMap: { [key: number]: number } = {};
    amounts.forEach(amount => {
      const rounded = Math.round(amount / 10000) * 10000; // Round to nearest 10k
      modeMap[rounded] = (modeMap[rounded] || 0) + 1;
    });
    const mode = Object.keys(modeMap).reduce((a, b) =>
      modeMap[parseInt(a)] > modeMap[parseInt(b)] ? a : b
    );

    // Z-scores
    const zScores = amounts.map(amount => ({
      amount,
      zScore: standardDeviation > 0 ? (amount - mean) / standardDeviation : 0
    }));

    // Outliers using IQR method
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers: Array<Expense & { zScore: number; isOutlier: boolean; outlierType: 'low' | 'high' | 'normal' }> = expenses
      .map((expense, index) => ({
        ...expense,
        zScore: zScores[index]?.zScore || 0,
        isOutlier: expense.amount < lowerBound || expense.amount > upperBound,
        outlierType: (expense.amount < lowerBound ? 'low' : expense.amount > upperBound ? 'high' : 'normal') as 'low' | 'high' | 'normal'
      }))
      .filter(item => item.isOutlier)
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    // Coefficient of Variation
    const coefficientOfVariation = mean > 0 ? (standardDeviation / mean) * 100 : 0;

    // Skewness
    const skewness = n > 2 && standardDeviation > 0
      ? (n / ((n - 1) * (n - 2))) * amounts.reduce((sum, val) =>
          sum + Math.pow((val - mean) / standardDeviation, 3), 0)
      : 0;

    // Kurtosis
    const kurtosis = n > 3 && standardDeviation > 0
      ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
        amounts.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 4), 0) -
        (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
      : 0;

    return {
      mean: Math.round(mean),
      median: Math.round(q2),
      mode: parseInt(mode),
      standardDeviation: Math.round(standardDeviation),
      variance: Math.round(variance),
      q1: Math.round(q1),
      q2: Math.round(q2),
      q3: Math.round(q3),
      iqr: Math.round(iqr),
      outliers: outliers,
      outliersTotal: outliers.reduce((sum, o) => sum + o.amount, 0),
      zScores: zScores,
      coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
      skewness: Math.round(skewness * 100) / 100,
      kurtosis: Math.round(kurtosis * 100) / 100,
      lowerBound: Math.round(lowerBound),
      upperBound: Math.round(upperBound)
    };
  });

  // Outlier analysis by date
  outlierAnalysisByDate = computed(() => {
    const analysis = this.statisticalAnalysis();
    if (analysis.outliers.length === 0) return [];

    const dateMap: { [date: string]: Array<Expense & { zScore: number; isOutlier: boolean; outlierType: 'low' | 'high' | 'normal' }> } = {};

    analysis.outliers.forEach(outlier => {
      if (!dateMap[outlier.date]) {
        dateMap[outlier.date] = [];
      }
      dateMap[outlier.date].push(outlier);
    });

    return Object.keys(dateMap)
      .sort()
      .map(date => ({
        date,
        outliers: dateMap[date],
        total: dateMap[date].reduce((sum, o) => sum + o.amount, 0),
        count: dateMap[date].length,
        avgZScore: dateMap[date].reduce((sum, o) => sum + Math.abs(o.zScore), 0) / dateMap[date].length
      }));
  });

  // Future Prediction using Supervised Learning Algorithms
  futurePredictions = computed(() => {
    const allExpenses = this.expenses(); // Use all expenses for training
    if (allExpenses.length < 7) {
      return {
        tomorrow: 0,
        thisWeek: [],
        nextWeek: [],
        thisMonth: [],
        nextMonth: [],
        predictions: [],
        confidence: 0,
        method: 'insufficient_data'
      };
    }

    // Prepare historical data (last 60 days)
    const today = new Date();
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(today.getDate() - 60);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

    const historicalExpenses = allExpenses.filter(e => e.date >= sixtyDaysAgoStr);

    // Group by date
    const dailyData: { [date: string]: number } = {};
    historicalExpenses.forEach(expense => {
      dailyData[expense.date] = (dailyData[expense.date] || 0) + expense.amount;
    });

    // Create sorted array of dates
    const dates = Object.keys(dailyData).sort();
    const values = dates.map(date => dailyData[date]);

    if (values.length < 7) {
      return {
        tomorrow: 0,
        thisWeek: [],
        nextWeek: [],
        thisMonth: [],
        nextMonth: [],
        predictions: [],
        confidence: 0,
        method: 'insufficient_data'
      };
    }

    // Method 1: Linear Regression
    const linearPrediction = this.linearRegression(dates, values);

    // Method 2: Moving Average (7-day)
    const movingAvg7 = this.movingAverage(values, 7);

    // Method 3: Exponential Smoothing
    const expSmoothing = this.exponentialSmoothing(values, 0.3);

    // Method 4: Seasonal Pattern (day of week)
    const seasonalPattern = this.seasonalPattern(historicalExpenses);

    // Combine predictions with weights
    const weights = { linear: 0.3, moving: 0.3, exponential: 0.2, seasonal: 0.2 };

    // Predict tomorrow
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
    const dayOfWeek = tomorrowDate.getDay();

    const tomorrowLinear = linearPrediction.predict(dates.length);
    const tomorrowMoving = movingAvg7[movingAvg7.length - 1] || values[values.length - 1];
    const tomorrowExp = expSmoothing[expSmoothing.length - 1] || values[values.length - 1];
    const tomorrowSeasonal = seasonalPattern[dayOfWeek] || 0;

    const tomorrow = Math.round(
      tomorrowLinear * weights.linear +
      tomorrowMoving * weights.moving +
      tomorrowExp * weights.exponential +
      tomorrowSeasonal * weights.seasonal
    );

    // Predict this week (next 7 days)
    const thisWeek: Array<{ date: string; prediction: number; confidence: number }> = [];
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      const futureDayOfWeek = futureDate.getDay();
      const daysAhead = i;

      const linearPred = linearPrediction.predict(dates.length + daysAhead - 1);
      const movingPred = movingAvg7[movingAvg7.length - 1] || values[values.length - 1];
      const expPred = expSmoothing[expSmoothing.length - 1] || values[values.length - 1];
      const seasonalPred = seasonalPattern[futureDayOfWeek] || 0;

      const prediction = Math.round(
        linearPred * weights.linear +
        movingPred * weights.moving +
        expPred * weights.exponential +
        seasonalPred * weights.seasonal
      );

      // Confidence decreases with time
      const confidence = Math.max(0, 100 - (daysAhead * 5));

      thisWeek.push({
        date: futureDateStr,
        prediction: Math.max(0, prediction),
        confidence: confidence
      });
    }

    // Predict next week (days 8-14)
    const nextWeek: Array<{ date: string; prediction: number; confidence: number }> = [];
    for (let i = 8; i <= 14; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      const futureDayOfWeek = futureDate.getDay();
      const daysAhead = i;

      const linearPred = linearPrediction.predict(dates.length + daysAhead - 1);
      const movingPred = movingAvg7[movingAvg7.length - 1] || values[values.length - 1];
      const expPred = expSmoothing[expSmoothing.length - 1] || values[values.length - 1];
      const seasonalPred = seasonalPattern[futureDayOfWeek] || 0;

      const prediction = Math.round(
        linearPred * weights.linear +
        movingPred * weights.moving +
        expPred * weights.exponential +
        seasonalPred * weights.seasonal
      );

      const confidence = Math.max(0, 100 - (daysAhead * 5));

      nextWeek.push({
        date: futureDateStr,
        prediction: Math.max(0, prediction),
        confidence: confidence
      });
    }

    // Predict this month (next 30 days)
    const thisMonth: Array<{ date: string; prediction: number; confidence: number }> = [];
    for (let i = 1; i <= 30; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      const futureDayOfWeek = futureDate.getDay();
      const daysAhead = i;

      const linearPred = linearPrediction.predict(dates.length + daysAhead - 1);
      const movingPred = movingAvg7[movingAvg7.length - 1] || values[values.length - 1];
      const expPred = expSmoothing[expSmoothing.length - 1] || values[values.length - 1];
      const seasonalPred = seasonalPattern[futureDayOfWeek] || 0;

      const prediction = Math.round(
        linearPred * weights.linear +
        movingPred * weights.moving +
        expPred * weights.exponential +
        seasonalPred * weights.seasonal
      );

      const confidence = Math.max(0, 100 - (daysAhead * 3));

      thisMonth.push({
        date: futureDateStr,
        prediction: Math.max(0, prediction),
        confidence: confidence
      });
    }

    // Predict next month (days 31-60)
    const nextMonth: Array<{ date: string; prediction: number; confidence: number }> = [];
    for (let i = 31; i <= 60; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      const futureDayOfWeek = futureDate.getDay();
      const daysAhead = i;

      const linearPred = linearPrediction.predict(dates.length + daysAhead - 1);
      const movingPred = movingAvg7[movingAvg7.length - 1] || values[values.length - 1];
      const expPred = expSmoothing[expSmoothing.length - 1] || values[values.length - 1];
      const seasonalPred = seasonalPattern[futureDayOfWeek] || 0;

      const prediction = Math.round(
        linearPred * weights.linear +
        movingPred * weights.moving +
        expPred * weights.exponential +
        seasonalPred * weights.seasonal
      );

      const confidence = Math.max(0, 100 - (daysAhead * 2));

      nextMonth.push({
        date: futureDateStr,
        prediction: Math.max(0, prediction),
        confidence: confidence
      });
    }

    // Overall confidence based on data quality
    const dataQuality = Math.min(100, (values.length / 60) * 100);
    const overallConfidence = Math.round(dataQuality * 0.8);

    return {
      tomorrow: Math.max(0, tomorrow),
      thisWeek: thisWeek,
      nextWeek: nextWeek,
      thisMonth: thisMonth,
      nextMonth: nextMonth,
      predictions: [...thisWeek, ...nextWeek],
      confidence: overallConfidence,
      method: 'ensemble',
      weeklyTotal: thisWeek.reduce((sum, d) => sum + d.prediction, 0),
      monthlyTotal: thisMonth.reduce((sum, d) => sum + d.prediction, 0)
    };
  });

  // Linear Regression
  private linearRegression(dates: string[], values: number[]): { predict: (x: number) => number; slope: number; intercept: number } {
    const n = values.length;
    const x = dates.map((_, i) => i);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      predict: (x: number) => slope * x + intercept,
      slope,
      intercept
    };
  }

  // Moving Average
  private movingAverage(values: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        result.push(values[i]);
      } else {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  // Exponential Smoothing
  private exponentialSmoothing(values: number[], alpha: number): number[] {
    const result: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
      result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  }

  // Seasonal Pattern (by day of week)
  private seasonalPattern(expenses: Expense[]): { [dayOfWeek: number]: number } {
    const dayTotals: { [day: number]: { total: number; count: number } } = {};

    expenses.forEach(expense => {
      const date = this.parseDate(expense.date);
      if (!date) return;
      const dayOfWeek = date.getDay();

      if (!dayTotals[dayOfWeek]) {
        dayTotals[dayOfWeek] = { total: 0, count: 0 };
      }
      dayTotals[dayOfWeek].total += expense.amount;
      dayTotals[dayOfWeek].count += 1;
    });

    const pattern: { [dayOfWeek: number]: number } = {};
    for (let day = 0; day < 7; day++) {
      if (dayTotals[day]) {
        pattern[day] = Math.round(dayTotals[day].total / dayTotals[day].count);
      } else {
        // Use overall average if no data for this day
        const allAvg = expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length;
        pattern[day] = Math.round(allAvg);
      }
    }

    return pattern;
  }

  // Yesterday comparison
  yesterdayComparison = computed(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const allExpenses = this.expenses();

    const todayExpenses = allExpenses.filter(e => e.date === todayStr);
    const yesterdayExpenses = allExpenses.filter(e => e.date === yesterdayStr);

    const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const yesterdayTotal = yesterdayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const todayCount = todayExpenses.length;
    const yesterdayCount = yesterdayExpenses.length;

    let change = 0;
    let changePercent = 0;
    let status: 'higher' | 'lower' | 'equal' = 'equal';

    if (yesterdayTotal > 0) {
      change = todayTotal - yesterdayTotal;
      changePercent = Math.round((change / yesterdayTotal) * 100);
      if (change > 0) {
        status = 'higher';
      } else if (change < 0) {
        status = 'lower';
      } else {
        status = 'equal';
      }
    } else if (todayTotal > 0) {
      status = 'higher';
      changePercent = 100;
    }

    return {
      todayTotal,
      yesterdayTotal,
      todayCount,
      yesterdayCount,
      change,
      changePercent: Math.abs(changePercent),
      status,
      hasData: yesterdayTotal > 0 || todayTotal > 0
    };
  });

  // Today's expense evaluation
  todayExpenseEvaluation = computed(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const allExpenses = this.expenses(); // Use all expenses, not filtered

    // Get today's expenses
    const todayExpenses = allExpenses.filter(e => e.date === todayStr);
    const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const todayCount = todayExpenses.length;

    // Calculate average of last 30 days (excluding today)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const last30DaysExpenses = allExpenses.filter(e => {
      return e.date >= thirtyDaysAgoStr && e.date < todayStr;
    });

    const last30DaysDates = new Set(last30DaysExpenses.map(e => e.date));
    const last30DaysTotal = last30DaysExpenses.reduce((sum, e) => sum + e.amount, 0);
    const last30DaysAvg = last30DaysDates.size > 0 ? last30DaysTotal / last30DaysDates.size : 0;

    // Calculate average of last 7 days (excluding today)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const last7DaysExpenses = allExpenses.filter(e => {
      return e.date >= sevenDaysAgoStr && e.date < todayStr;
    });

    const last7DaysDates = new Set(last7DaysExpenses.map(e => e.date));
    const last7DaysTotal = last7DaysExpenses.reduce((sum, e) => sum + e.amount, 0);
    const last7DaysAvg = last7DaysDates.size > 0 ? last7DaysTotal / last7DaysDates.size : 0;

    // Calculate current week average (excluding today)
    const weekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const currentWeekExpenses = allExpenses.filter(e => {
      return e.date >= weekStartStr && e.date < todayStr;
    });

    const currentWeekDates = new Set(currentWeekExpenses.map(e => e.date));
    const currentWeekTotal = currentWeekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const currentWeekAvg = currentWeekDates.size > 0 ? currentWeekTotal / currentWeekDates.size : 0;

    // Calculate current month average (excluding today)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const currentMonthExpenses = allExpenses.filter(e => {
      return e.date >= monthStartStr && e.date < todayStr;
    });

    const currentMonthDates = new Set(currentMonthExpenses.map(e => e.date));
    const currentMonthTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const currentMonthAvg = currentMonthDates.size > 0 ? currentMonthTotal / currentMonthDates.size : 0;

    // Calculate comparisons
    const compare30Days = last30DaysAvg > 0
      ? Math.round(((todayTotal - last30DaysAvg) / last30DaysAvg) * 100)
      : 0;
    const compare7Days = last7DaysAvg > 0
      ? Math.round(((todayTotal - last7DaysAvg) / last7DaysAvg) * 100)
      : 0;
    const compareWeek = currentWeekAvg > 0
      ? Math.round(((todayTotal - currentWeekAvg) / currentWeekAvg) * 100)
      : 0;
    const compareMonth = currentMonthAvg > 0
      ? Math.round(((todayTotal - currentMonthAvg) / currentMonthAvg) * 100)
      : 0;

    // Determine overall status
    let overallStatus: 'high' | 'normal' | 'low' = 'normal';
    let overallMessage = '';

    if (last30DaysAvg > 0) {
      const diff = todayTotal - last30DaysAvg;
      const percentDiff = (diff / last30DaysAvg) * 100;

      if (percentDiff > 20) {
        overallStatus = 'high';
        overallMessage = `Cao hơn ${Math.round(percentDiff)}% so với TB 30 ngày`;
      } else if (percentDiff < -20) {
        overallStatus = 'low';
        overallMessage = `Thấp hơn ${Math.round(Math.abs(percentDiff))}% so với TB 30 ngày`;
      } else {
        overallStatus = 'normal';
        overallMessage = `Gần bằng trung bình 30 ngày`;
      }
    } else {
      overallMessage = 'Chưa có dữ liệu 30 ngày để so sánh';
    }

    return {
      todayTotal: todayTotal,
      todayCount: todayCount,
      last30DaysAvg: Math.round(last30DaysAvg),
      last7DaysAvg: Math.round(last7DaysAvg),
      currentWeekAvg: Math.round(currentWeekAvg),
      currentMonthAvg: Math.round(currentMonthAvg),
      compare30Days: compare30Days,
      compare7Days: compare7Days,
      compareWeek: compareWeek,
      compareMonth: compareMonth,
      overallStatus: overallStatus,
      overallMessage: overallMessage,
      hasData: last30DaysDates.size > 0
    };
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

  // Settings
  settingsService = signal<ExpenseSettingsService | null>(null);
  currentLayout = signal<ExpenseLayout>('v1');
  currentTheme = signal<ExpenseTheme>('compact');
  currentFontSize = signal<ExpenseFontSize>('medium');

  constructor(
    private expenseService: ExpenseService,
    private expenseSettingsService: ExpenseSettingsService
  ) {
    this.settingsService.set(expenseSettingsService);
    this.currentLayout.set(expenseSettingsService.layout());
    this.currentTheme.set(expenseSettingsService.theme());
    this.currentFontSize.set(expenseSettingsService.fontSize());

    // Listen to settings changes
    effect(() => {
      const settings = expenseSettingsService.settings();
      this.currentLayout.set(settings.layout);
      this.currentTheme.set('compact'); // Always use compact theme (like v1)
      this.currentFontSize.set(settings.fontSize);
      setTimeout(() => this.applySettings(), 0);
    });
    // Effect to update charts when filtered expenses or filters change
    effect(() => {
      // Track filtered expenses and active tab to trigger chart updates
      const filtered = this.filteredExpenses();
      const tab = this.activeTab();
      const evaluation = this.todayExpenseEvaluation();

      // Only update charts if we're on summary tab and have data
      if (tab === 'summary' && filtered.length > 0 && this.categoryChartRef?.nativeElement) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          this.initCharts();
          // Also init today evaluation charts if data is available
          if (evaluation.hasData) {
            setTimeout(() => {
              this.initTodayComparisonChart();
              this.initTodayTrendChart();
            }, 150);
          }
          // Init prediction charts
          const predictions = this.futurePredictions();
          if (predictions.method !== 'insufficient_data') {
            setTimeout(() => {
              this.initPredictionChart();
              this.initWeeklyPredictionChart();
              this.initMonthlyPredictionChart();
            }, 200);
          }
        }, 100);
      }
    });

    // Load saved column widths from localStorage
    const savedWidths = localStorage.getItem('expense-column-widths');
    if (savedWidths) {
      try {
        const widths = JSON.parse(savedWidths);
        this.columnWidths.set({
          date: widths.date || 150,
          content: widths.content || 0,
          actions: widths.actions || 160
        });
      } catch (e) {
        console.error('Error loading column widths:', e);
      }
    }

    // Calculate content width based on container
    this.updateContentWidth();
  }

  ngOnInit(): void {
    // Set default date to today
    this.newExpense.date = this.expenseService.getTodayDate();

    // Apply settings
    this.applySettings();

    // Check if already authenticated and still valid
    // Validates the stored hash by trying all valid usernames
    if (this.expenseService.isAuthenticationValid()) {
      // Auto-login if hash is valid
      this.isAuthenticated.set(true);
      this.loadExpenses();
    } else {
      // Clear invalid authentication and logout
      // Hash is invalid (wrong username:password or expired)
      sessionStorage.removeItem('expense_app_auth_hash');
      this.isAuthenticated.set(false);
      this.username.set('');
      this.password.set('');
      this.passwordError.set('');
      this.expenses.set([]);
    }
  }

  ngAfterViewInit(): void {
    // Charts will be initialized when data is loaded
    // Apply settings after view init to ensure DOM is ready
    setTimeout(() => {
      this.applySettings();
    }, 0);
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
    if (this.todayComparisonChart) {
      this.todayComparisonChart.destroy();
    }
    if (this.todayTrendChart) {
      this.todayTrendChart.destroy();
    }
    if (this.outlierChart) {
      this.outlierChart.destroy();
    }
    if (this.boxPlotChart) {
      this.boxPlotChart.destroy();
    }
    if (this.zScoreChart) {
      this.zScoreChart.destroy();
    }
    if (this.predictionChart) {
      this.predictionChart.destroy();
    }
    if (this.weeklyPredictionChart) {
      this.weeklyPredictionChart.destroy();
    }
    if (this.monthlyPredictionChart) {
      this.monthlyPredictionChart.destroy();
    }
  }

  /**
   * Handle ESC key to close dialogs (except create dialog)
   */
  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    // Close category dropdown
    if (this.showCategoryDropdown()) {
      this.showCategoryDropdown.set(false);
      this.categoryDropdownPosition.set(null);
      return;
    }

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
   * Close category dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-select-wrapper')) {
      this.showCategoryDropdown.set(false);
      this.categoryDropdownPosition.set(null);
    }
  }

  /**
   * Authenticate with username and reversed date password
   * Security: Password is read once, verified, and cleared immediately to prevent debugging
   * Security: Generic error message to prevent information disclosure
   */
  authenticate(): void {
    // Read username and password once and clear signals immediately to prevent DevTools inspection
    const inputUsername = this.username().trim().toLowerCase();
    const inputPassword = this.password().trim();
    this.username.set(''); // Clear immediately
    this.password.set(''); // Clear immediately - password no longer in signal

    // Generic error message for security (don't reveal which field is wrong)
    const genericError = 'Tên đăng nhập hoặc mật khẩu không đúng';

    if (!inputUsername || !inputPassword) {
      this.passwordError.set(genericError);
      return;
    }

    // Verify username first
    const isUsernameValid = this.expenseService.verifyUsername(inputUsername);

    // Verify password using local variable (minimize time in memory)
    // Password is only in local scope, not accessible via component signals
    const isPasswordValid = this.expenseService.verifyPassword(inputPassword);

    // Only authenticate if both are valid
    // Use generic error message to prevent information disclosure
    if (isUsernameValid && isPasswordValid) {
      this.isAuthenticated.set(true);
      this.passwordError.set('');

      // Get valid username (normalized) for generating hash
      const validUsername = this.expenseService.getValidUsername(inputUsername);

      if (validUsername) {
        // Store hash of username:password combination in sessionStorage
        // This hash includes date component, so it changes daily
        // Username is NOT stored - will be found by iterating through valid usernames
        const credentialsHash = this.expenseService.generateCredentialsHash(validUsername, inputPassword);
        sessionStorage.setItem('expense_app_auth_hash', credentialsHash);
      }

      // Load expenses
      this.loadExpenses();
    } else {
      // Generic error message - don't reveal which field is incorrect
      this.passwordError.set(genericError);
    }
    // inputPassword goes out of scope here - garbage collected
  }

  /**
   * Logout
   * Security: Clears all authentication data including password
   */
  logout(): void {
    this.isAuthenticated.set(false);
    this.username.set(''); // Clear username
    this.password.set(''); // Clear password
    this.passwordError.set('');
    this.expenses.set([]);
    this.showAddForm.set(false);
    sessionStorage.removeItem('expense_app_auth_hash');
    // Note: Username is not stored in sessionStorage, so no need to remove it

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
   * Handle input keydown (username or password)
   * Security: Password is only stored in signal temporarily, cleared immediately after use
   */
  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.authenticate();
    }
  }

  /**
   * Handle password input blur
   * Security: Optionally clear password on blur to prevent inspection
   * Note: This is optional - only clears if authentication failed
   */
  onPasswordBlur(event: FocusEvent): void {
    // Only clear if there's an error (failed authentication attempt)
    // This prevents accidental clearing while user is typing
    if (this.passwordError()) {
      const input = event.target as HTMLInputElement;
      if (input) {
        input.value = '';
        this.password.set('');
      }
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
            // Also init today evaluation charts if data is available
            const evaluation = this.todayExpenseEvaluation();
            if (evaluation.hasData) {
              setTimeout(() => {
                this.initTodayComparisonChart();
                this.initTodayTrendChart();
              }, 150);
            }
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
    // Set formatted amount for display - format immediately
    const formatted = this.formatNumberInput(expense.amount);
    this.editExpenseAmountDisplay.set(formatted);
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
    this.editExpenseAmountDisplay.set('');
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
  switchTab(tab: 'list' | 'summary' | 'matrix'): void {
    this.activeTab.set(tab);
    if (tab === 'summary') {
      // Initialize charts when switching to summary tab
      setTimeout(() => {
        this.initCharts();
        // Also init today evaluation charts if data is available
        const evaluation = this.todayExpenseEvaluation();
        if (evaluation.hasData) {
          setTimeout(() => {
            this.initTodayComparisonChart();
            this.initTodayTrendChart();
          }, 150);
        }
        // Init prediction charts
        const predictions = this.futurePredictions();
        if (predictions.method !== 'insufficient_data') {
          setTimeout(() => {
            this.initPredictionChart();
            this.initWeeklyPredictionChart();
            this.initMonthlyPredictionChart();
          }, 200);
        }
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
    this.initTodayComparisonChart();
    this.initTodayTrendChart();
    this.initOutlierChart();
    this.initBoxPlotChart();
    this.initZScoreChart();
    this.initPredictionChart();
    this.initWeeklyPredictionChart();
    this.initMonthlyPredictionChart();
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
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
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
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          }
        }
      }
    };

    this.categoryBarChart = new Chart(this.categoryBarChartRef.nativeElement, config);
  }

  /**
   * Initialize today comparison chart
   */
  initTodayComparisonChart(): void {
    if (!this.todayComparisonChartRef?.nativeElement) return;

    const evaluation = this.todayExpenseEvaluation();
    if (!evaluation.hasData) return;

    // Destroy existing chart
    if (this.todayComparisonChart) {
      this.todayComparisonChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['Hôm nay', 'TB 7 ngày', 'TB 30 ngày', 'TB tuần này', 'TB tháng này'],
        datasets: [{
          label: 'Chi tiêu',
          data: [
            evaluation.todayTotal,
            evaluation.last7DaysAvg,
            evaluation.last30DaysAvg,
            evaluation.currentWeekAvg,
            evaluation.currentMonthAvg
          ],
          backgroundColor: [
            evaluation.overallStatus === 'high' ? '#f44336' :
            evaluation.overallStatus === 'low' ? '#4caf50' : '#ff9800',
            'rgba(33, 150, 243, 0.6)',
            'rgba(33, 150, 243, 0.6)',
            'rgba(33, 150, 243, 0.6)',
            'rgba(33, 150, 243, 0.6)'
          ],
          borderColor: [
            evaluation.overallStatus === 'high' ? '#d32f2f' :
            evaluation.overallStatus === 'low' ? '#388e3c' : '#f57c00',
            '#2196F3',
            '#2196F3',
            '#2196F3',
            '#2196F3'
          ],
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
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          }
        }
      }
    };

    this.todayComparisonChart = new Chart(this.todayComparisonChartRef.nativeElement, config);
  }

  /**
   * Initialize today trend chart (last 30 days)
   */
  initTodayTrendChart(): void {
    if (!this.todayTrendChartRef?.nativeElement) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const allExpenses = this.expenses();
    const last30DaysExpenses = allExpenses.filter(e => {
      return e.date >= thirtyDaysAgoStr && e.date <= todayStr;
    });

    if (last30DaysExpenses.length === 0) return;

    // Group by date
    const dailyMap: { [key: string]: number } = {};
    last30DaysExpenses.forEach(expense => {
      dailyMap[expense.date] = (dailyMap[expense.date] || 0) + expense.amount;
    });

    // Create array of last 30 days
    const dates: string[] = [];
    const values: number[] = [];
    let todayIndex = -1;

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(this.formatDateShort(dateStr));
      values.push(dailyMap[dateStr] || 0);
      if (dateStr === todayStr) {
        todayIndex = 29 - i;
      }
    }

    // Destroy existing chart
    if (this.todayTrendChart) {
      this.todayTrendChart.destroy();
    }

    const evaluation = this.todayExpenseEvaluation();
    const avg30Days = evaluation.last30DaysAvg;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Chi tiêu hàng ngày',
            data: values,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: (context: any) => {
              return todayIndex >= 0 && context.dataIndex === todayIndex ? 6 : 3;
            },
            pointBackgroundColor: (context: any) => {
              return todayIndex >= 0 && context.dataIndex === todayIndex
                ? (evaluation.overallStatus === 'high' ? '#f44336' :
                   evaluation.overallStatus === 'low' ? '#4caf50' : '#ff9800')
                : '#2196F3';
            },
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 8
          },
          {
            label: 'Trung bình 30 ngày',
            data: Array(dates.length).fill(avg30Days),
            borderColor: '#757575',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${this.formatAmount(typeof value === 'number' ? value : 0)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          }
        }
      }
    };

    this.todayTrendChart = new Chart(this.todayTrendChartRef.nativeElement, config);
  }

  /**
   * Initialize outlier detection chart
   */
  initOutlierChart(): void {
    if (!this.outlierChartRef?.nativeElement) return;

    const analysis = this.statisticalAnalysis();
    const expenses = this.filteredExpenses();
    if (expenses.length === 0 || analysis.outliers.length === 0) return;

    // Destroy existing chart
    if (this.outlierChart) {
      this.outlierChart.destroy();
    }

    // Prepare data: show all expenses with outliers highlighted
    const sortedExpenses = [...expenses].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labels = sortedExpenses.map(e => this.formatDateShort(e.date));
    const amounts = sortedExpenses.map(e => e.amount);
    const isOutlier = sortedExpenses.map(e =>
      analysis.outliers.some(o => o.date === e.date && o.content === e.content && o.amount === e.amount)
    );

    const config: ChartConfiguration = {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Chi tiêu bình thường',
            data: sortedExpenses
              .map((e, i) => isOutlier[i] ? null : ({ x: i, y: e.amount }))
              .filter((point): point is { x: number; y: number } => {
                return point !== null && point.y !== undefined && typeof point.y === 'number';
              })
              .map(point => ({ x: point.x, y: point.y })),
            backgroundColor: 'rgba(33, 150, 243, 0.6)',
            borderColor: '#2196F3',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Chi tiêu đột biến (Cao)',
            data: sortedExpenses
              .map((e, i) => isOutlier[i] && e.amount > analysis.mean ? ({ x: i, y: e.amount }) : null)
              .filter((point): point is { x: number; y: number } => {
                return point !== null && point.y !== undefined && typeof point.y === 'number';
              })
              .map(point => ({ x: point.x, y: point.y })),
            backgroundColor: 'rgba(244, 67, 54, 0.8)',
            borderColor: '#f44336',
            pointRadius: 8,
            pointHoverRadius: 10
          },
          {
            label: 'Chi tiêu đột biến (Thấp)',
            data: sortedExpenses
              .map((e, i) => isOutlier[i] && e.amount < analysis.mean ? ({ x: i, y: e.amount }) : null)
              .filter((point): point is { x: number; y: number } => point !== null && typeof point.y === 'number'),
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            borderColor: '#4caf50',
            pointRadius: 8,
            pointHoverRadius: 10
          },
          {
            label: 'Trung bình',
            data: Array(sortedExpenses.length).fill(null).map((_, i) => ({ x: i, y: analysis.mean })),
            type: 'line',
            borderColor: '#757575',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Ngưỡng trên (Q3 + 1.5*IQR)',
            data: Array(sortedExpenses.length).fill(null).map((_, i) => ({ x: i, y: analysis.upperBound || 0 })),
            type: 'line',
            borderColor: '#ff9800',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Ngưỡng dưới (Q1 - 1.5*IQR)',
            data: Array(sortedExpenses.length).fill(null).map((_, i) => ({ x: i, y: analysis.lowerBound || 0 })),
            type: 'line',
            borderColor: '#ff9800',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.datasetIndex < 3) {
                  const raw = context.raw as { x: number; y: number };
                  const expense = sortedExpenses[raw.x];
                  if (expense) {
                    return `${context.dataset.label}: ${this.formatAmount(expense.amount)} - ${expense.content}`;
                  }
                }
                const y = context.parsed.y;
                return `${context.dataset.label}: ${this.formatAmount(y !== null && y !== undefined ? y : 0)}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            ticks: {
              callback: (value) => {
                const index = value as number;
                return index >= 0 && index < labels.length ? labels[index] : '';
              },
              maxRotation: 45,
              minRotation: 45
            },
            title: {
              display: true,
              text: 'Thời gian'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            },
            title: {
              display: true,
              text: 'Số tiền'
            }
          }
        }
      }
    };

    this.outlierChart = new Chart(this.outlierChartRef.nativeElement, config);
  }

  /**
   * Initialize box plot chart
   */
  initBoxPlotChart(): void {
    if (!this.boxPlotChartRef?.nativeElement) return;

    const analysis = this.statisticalAnalysis();
    if (analysis.iqr === 0) return;

    // Destroy existing chart
    if (this.boxPlotChart) {
      this.boxPlotChart.destroy();
    }

    const expenses = this.filteredExpenses();
    const amounts = expenses.map(e => e.amount).sort((a, b) => a - b);
    const min = amounts[0];
    const max = amounts[amounts.length - 1];

    // Create box plot data
    const boxPlotData = {
      min: min,
      q1: analysis.q1,
      median: analysis.q2,
      q3: analysis.q3,
      max: max,
      mean: analysis.mean,
      outliers: analysis.outliers.map(o => o.amount)
    };

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['Phân bố chi tiêu'],
        datasets: [
          {
            label: 'Min',
            data: [min],
            backgroundColor: 'rgba(76, 175, 80, 0.6)',
            borderColor: '#4caf50',
            borderWidth: 2
          },
          {
            label: 'Q1',
            data: [analysis.q1],
            backgroundColor: 'rgba(33, 150, 243, 0.6)',
            borderColor: '#2196F3',
            borderWidth: 2
          },
          {
            label: 'Median (Q2)',
            data: [analysis.q2],
            backgroundColor: 'rgba(255, 152, 0, 0.8)',
            borderColor: '#ff9800',
            borderWidth: 3
          },
          {
            label: 'Q3',
            data: [analysis.q3],
            backgroundColor: 'rgba(33, 150, 243, 0.6)',
            borderColor: '#2196F3',
            borderWidth: 2
          },
          {
            label: 'Max',
            data: [max],
            backgroundColor: 'rgba(244, 67, 54, 0.6)',
            borderColor: '#f44336',
            borderWidth: 2
          },
          {
            label: 'Mean',
            data: [analysis.mean],
            type: 'line',
            borderColor: '#9c27b0',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const y = context.parsed.y;
                const numValue = y !== null && y !== undefined ? y : 0;
                return `${context.dataset.label}: ${this.formatAmount(numValue)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          }
        }
      }
    };

    this.boxPlotChart = new Chart(this.boxPlotChartRef.nativeElement, config);
  }

  /**
   * Initialize Z-score distribution chart
   */
  initZScoreChart(): void {
    if (!this.zScoreChartRef?.nativeElement) return;

    const analysis = this.statisticalAnalysis();
    if (analysis.zScores.length === 0) return;

    // Destroy existing chart
    if (this.zScoreChart) {
      this.zScoreChart.destroy();
    }

    // Group Z-scores into bins
    const bins: { [key: string]: number } = {};
    analysis.zScores.forEach(z => {
      const bin = Math.floor(z.zScore);
      const binKey = `${bin} to ${bin + 1}`;
      bins[binKey] = (bins[binKey] || 0) + 1;
    });

    const labels = Object.keys(bins).sort((a, b) => {
      const aNum = parseInt(a.split(' ')[0]);
      const bNum = parseInt(b.split(' ')[0]);
      return aNum - bNum;
    });
    const data = labels.map(label => bins[label]);

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Số lượng giao dịch',
          data: data,
          backgroundColor: labels.map(label => {
            const num = Math.abs(parseInt(label.split(' ')[0]));
            if (num >= 2) return 'rgba(244, 67, 54, 0.8)'; // Red for outliers
            if (num >= 1) return 'rgba(255, 152, 0, 0.8)'; // Orange for moderate
            return 'rgba(33, 150, 243, 0.6)'; // Blue for normal
          }),
          borderColor: labels.map(label => {
            const num = Math.abs(parseInt(label.split(' ')[0]));
            if (num >= 2) return '#f44336';
            if (num >= 1) return '#ff9800';
            return '#2196F3';
          }),
          borderWidth: 2,
          borderRadius: 4
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
                return `Z-score ${context.label}: ${context.parsed.y} giao dịch`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Số lượng giao dịch'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Z-score Range'
            }
          }
        }
      }
    };

    this.zScoreChart = new Chart(this.zScoreChartRef.nativeElement, config);
  }

  /**
   * Initialize prediction chart (historical + future)
   */
  initPredictionChart(): void {
    if (!this.predictionChartRef?.nativeElement) return;

    const predictions = this.futurePredictions();
    if (predictions.method === 'insufficient_data') return;

    // Get historical data (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const allExpenses = this.expenses();
    const historicalExpenses = allExpenses.filter(e => e.date >= thirtyDaysAgoStr && e.date <= today.toISOString().split('T')[0]);

    const dailyData: { [date: string]: number } = {};
    historicalExpenses.forEach(expense => {
      dailyData[expense.date] = (dailyData[expense.date] || 0) + expense.amount;
    });

    const historicalDates = Object.keys(dailyData).sort();
    const historicalValues = historicalDates.map(date => dailyData[date]);

    // Future predictions (next 14 days)
    const futureDates = predictions.predictions.map(p => this.formatDateShort(p.date));
    const futureValues = predictions.predictions.map(p => p.prediction);
    const confidenceValues = predictions.predictions.map(p => p.confidence);

    // Destroy existing chart
    if (this.predictionChart) {
      this.predictionChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: [...historicalDates.map(d => this.formatDateShort(d)), ...futureDates],
        datasets: [
          {
            label: 'Chi tiêu thực tế',
            data: [...historicalValues.map(v => v !== undefined && v !== null ? v : null), ...Array(futureDates.length).fill(null)],
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3
          },
          {
            label: 'Dự đoán',
            data: [...Array(historicalDates.length).fill(null), ...futureValues.map(v => v !== undefined && v !== null ? v : null)],
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: futureValues.map((_, i) => {
              const conf = confidenceValues[i];
              if (conf >= 80) return '#4caf50';
              if (conf >= 60) return '#ff9800';
              return '#f44336';
            })
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                const numValue = value !== null && value !== undefined ? value : 0;
                if (context.datasetIndex === 1 && context.dataIndex >= historicalDates.length) {
                  const conf = confidenceValues[context.dataIndex - historicalDates.length];
                  return `${context.dataset.label}: ${this.formatAmount(numValue)} (Độ tin cậy: ${conf}%)`;
                }
                return `${context.dataset.label}: ${this.formatAmount(numValue)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    };

    this.predictionChart = new Chart(this.predictionChartRef.nativeElement, config);
  }

  /**
   * Initialize weekly prediction chart
   */
  initWeeklyPredictionChart(): void {
    if (!this.weeklyPredictionChartRef?.nativeElement) return;

    const predictions = this.futurePredictions();
    if (predictions.method === 'insufficient_data') return;

    // Destroy existing chart
    if (this.weeklyPredictionChart) {
      this.weeklyPredictionChart.destroy();
    }

    const thisWeekLabels = predictions.thisWeek.map(p => this.formatDateShort(p.date));
    const thisWeekValues = predictions.thisWeek.map(p => p.prediction);
    const thisWeekConfidence = predictions.thisWeek.map(p => p.confidence);

    const nextWeekLabels = predictions.nextWeek.map(p => this.formatDateShort(p.date));
    const nextWeekValues = predictions.nextWeek.map(p => p.prediction);
    const nextWeekConfidence = predictions.nextWeek.map(p => p.confidence);

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: [...thisWeekLabels, ...nextWeekLabels],
        datasets: [
          {
            label: 'Tuần này',
            data: [...thisWeekValues.map(v => v !== undefined && v !== null ? v : null), ...Array(nextWeekLabels.length).fill(null)],
            backgroundColor: 'rgba(33, 150, 243, 0.6)',
            borderColor: '#2196F3',
            borderWidth: 2,
            borderRadius: 4
          },
          {
            label: 'Tuần sau',
            data: [...Array(thisWeekLabels.length).fill(null), ...nextWeekValues.map(v => v !== undefined && v !== null ? v : null)],
            backgroundColor: 'rgba(255, 152, 0, 0.6)',
            borderColor: '#ff9800',
            borderWidth: 2,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                const index = context.dataIndex;
                let conf = 0;
                if (context.datasetIndex === 0 && index < thisWeekConfidence.length) {
                  conf = thisWeekConfidence[index];
                } else if (context.datasetIndex === 1 && index >= thisWeekLabels.length) {
                  conf = nextWeekConfidence[index - thisWeekLabels.length];
                }
                const numValue = value !== null && value !== undefined ? value : 0;
                return `${context.dataset.label}: ${this.formatAmount(numValue)} (TC: ${conf}%)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    };

    this.weeklyPredictionChart = new Chart(this.weeklyPredictionChartRef.nativeElement, config);
  }

  /**
   * Initialize monthly prediction chart
   */
  initMonthlyPredictionChart(): void {
    if (!this.monthlyPredictionChartRef?.nativeElement) return;

    const predictions = this.futurePredictions();
    if (predictions.method === 'insufficient_data') return;

    // Destroy existing chart
    if (this.monthlyPredictionChart) {
      this.monthlyPredictionChart.destroy();
    }

    // Group by week for better visualization
    const weeklyData: { week: string; total: number; days: number }[] = [];
    let currentWeek: { week: string; total: number; days: number } | null = null;

    predictions.thisMonth.forEach((pred, index) => {
      const date = new Date(pred.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = `${this.formatDateShort(weekStart.toISOString().split('T')[0])} - ${this.formatDateShort(pred.date)}`;

      if (!currentWeek || currentWeek.week !== weekKey) {
        if (currentWeek) weeklyData.push(currentWeek);
        currentWeek = { week: weekKey, total: 0, days: 0 };
      }
      currentWeek.total += pred.prediction;
      currentWeek.days += 1;
    });
    if (currentWeek) weeklyData.push(currentWeek);

    const weekLabels = weeklyData.map(w => w.week);
    const weekTotals = weeklyData.map(w => w.total);

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [{
          label: 'Dự đoán chi tiêu theo tuần',
            data: weekTotals.map(v => v !== undefined && v !== null ? v : null),
          backgroundColor: weekTotals.map((_, i) => {
            const avg = weekTotals.reduce((a, b) => a + b, 0) / weekTotals.length;
            return weekTotals[i] > avg ? 'rgba(244, 67, 54, 0.6)' : 'rgba(76, 175, 80, 0.6)';
          }),
          borderColor: weekTotals.map((_, i) => {
            const avg = weekTotals.reduce((a, b) => a + b, 0) / weekTotals.length;
            return weekTotals[i] > avg ? '#f44336' : '#4caf50';
          }),
          borderWidth: 2,
          borderRadius: 4
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
                const y = context.parsed.y;
                const numValue = y !== null && y !== undefined ? y : 0;
                return `Dự đoán: ${this.formatAmount(numValue)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
              }
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    };

    this.monthlyPredictionChart = new Chart(this.monthlyPredictionChartRef.nativeElement, config);
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

  /**
   * Format number with thousand separators for input display
   */
  formatNumberInput(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }
    return value.toLocaleString('vi-VN');
  }

  /**
   * Parse number from formatted string (remove thousand separators)
   */
  parseNumberInput(value: string): number {
    if (!value || value.trim() === '') {
      return 0;
    }
    // Remove all non-digit characters except decimal point
    const cleaned = value.replace(/[^\d]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Handle amount input change for new expense (only update model, no formatting)
   */
  onNewAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const parsed = this.parseNumberInput(value);
    this.newExpense.amount = parsed;
  }

  /**
   * Handle amount blur for new expense (format on blur using ngx-mask)
   */
  onNewAmountBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = this.newExpense.amount;
    // Format the display using Vietnamese locale format (ngx-mask will handle the formatting)
    const formatted = this.formatNumberInput(parsed);
    input.value = formatted;
  }

  /**
   * Handle amount input change for edit expense (only update model, no formatting)
   */
  onEditAmountInputChange(value: string): void {
    // Update display value immediately (for ngx-mask)
    this.editExpenseAmountDisplay.set(value);
    // Parse and update the numeric amount
    const parsed = this.parseNumberInput(value);
    this.editExpense.amount = parsed;
  }

  /**
   * Handle amount blur for edit expense (format on blur using ngx-mask)
   */
  onEditAmountBlur(event: Event): void {
    const parsed = this.editExpense.amount;
    // Format the display using Vietnamese locale format
    const formatted = this.formatNumberInput(parsed);
    this.editExpenseAmountDisplay.set(formatted);
  }

  /**
   * Handle amount input change for multiple expenses (only update model, no formatting)
   */
  onMultipleAmountInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const parsed = this.parseNumberInput(value);
    const expenses = this.multipleExpenses();
    expenses[index].amount = parsed;
    this.multipleExpenses.set([...expenses]);
  }

  /**
   * Handle amount blur for multiple expenses (format on blur using ngx-mask)
   */
  onMultipleAmountBlur(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const expenses = this.multipleExpenses();
    const parsed = expenses[index].amount;
    // Format the display using Vietnamese locale format (ngx-mask will handle the formatting)
    const formatted = this.formatNumberInput(parsed);
    input.value = formatted;
  }

  // Expose Math and Number for template
  Math = Math;
  Number = Number;

  // Column widths for resize functionality
  columnWidths = signal<{ date: number; content: number; actions: number }>({
    date: 150,  // Increased from 100px
    content: 0, // Will be calculated
    actions: 160
  });

  private isResizing = false;
  private resizingColumn: 'date' | 'content' | 'actions' | null = null;
  private startX = 0;
  private startWidth = 0;

  /**
   * Update content column width to fill remaining space
   */
  private updateContentWidth(): void {
    // Content width will be calculated dynamically via CSS flex: 1
    // No need to set explicit width for content column
  }

  /**
   * Start resizing a column
   */
  startResize(event: MouseEvent, column: 'date' | 'content' | 'actions'): void {
    event.preventDefault();
    event.stopPropagation();

    this.isResizing = true;
    this.resizingColumn = column;
    this.startX = event.clientX;

    const widths = this.columnWidths();
    if (column === 'date') {
      this.startWidth = widths.date;
    } else if (column === 'content') {
      this.startWidth = widths.content;
    } else if (column === 'actions') {
      this.startWidth = widths.actions;
    }

    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Handle column resize
   */
  private handleResize = (event: MouseEvent): void => {
    if (!this.isResizing || !this.resizingColumn) return;

    const diff = event.clientX - this.startX;
    const newWidth = Math.max(80, this.startWidth + diff); // Minimum width 80px

    const widths = this.columnWidths();

    if (this.resizingColumn === 'date') {
      this.columnWidths.set({ ...widths, date: newWidth });
    } else if (this.resizingColumn === 'actions') {
      this.columnWidths.set({ ...widths, actions: newWidth });
    }
    // Content column width is handled by flex: 1, so we don't need to set it explicitly

    // Save to localStorage
    localStorage.setItem('expense-column-widths', JSON.stringify(this.columnWidths()));
  };

  /**
   * Stop resizing
   */
  private stopResize = (): void => {
    this.isResizing = false;
    this.resizingColumn = null;
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };


  /**
   * Clear filters
   */
  clearFilters(): void {
    this.filterCategory.set([]);
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.searchText.set('');
    this.filterAmountMin.set(null);
    this.filterAmountMax.set(null);
  }

  /**
   * Toggle category selection
   */
  toggleCategory(category: string): void {
    const current = this.filterCategory();
    if (current.includes(category)) {
      this.filterCategory.set(current.filter(c => c !== category));
    } else {
      this.filterCategory.set([...current, category]);
    }
  }

  /**
   * Check if category is selected
   */
  isCategorySelected(category: string): boolean {
    return this.filterCategory().includes(category);
  }

  /**
   * Get selected categories display text
   */
  getSelectedCategoriesText(): string {
    const selected = this.filterCategory();
    if (selected.length === 0) return 'Tất cả';
    if (selected.length === 1) return selected[0];
    if (selected.length <= 3) return selected.join(', ');
    return `${selected.length} phân loại`;
  }

  /**
   * Select all filtered categories
   */
  selectAllFilteredCategories(): void {
    const filtered = this.filteredCategories();
    const current = this.filterCategory();
    const newSelection = [...current];

    filtered.forEach(cat => {
      if (!newSelection.includes(cat)) {
        newSelection.push(cat);
      }
    });

    this.filterCategory.set(newSelection);
  }

  /**
   * Deselect all filtered categories
   */
  deselectAllFilteredCategories(): void {
    const filtered = this.filteredCategories();
    const current = this.filterCategory();

    this.filterCategory.set(current.filter(cat => !filtered.includes(cat)));
  }

  /**
   * Toggle select all for filtered categories
   */
  toggleSelectAllFilteredCategories(): void {
    if (this.isAllFilteredCategoriesSelected()) {
      this.deselectAllFilteredCategories();
    } else {
      this.selectAllFilteredCategories();
    }
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
   * Show matrix detail dialog
   */
  showMatrixDetailDialog(date: string, category: string): void {
    const expenses = this.filteredExpenses().filter(
      expense => expense.date === date && expense.category === category
    );
    this.selectedMatrixDate.set(date);
    this.selectedMatrixCategory.set(category);
    this.selectedMatrixExpenses.set(expenses);
    this.showMatrixDetail.set(true);
  }

  /**
   * Hide matrix detail dialog
   */
  hideMatrixDetailDialog(): void {
    this.showMatrixDetail.set(false);
    this.selectedMatrixDate.set('');
    this.selectedMatrixCategory.set('');
    this.selectedMatrixExpenses.set([]);
  }

  /**
   * Get matrix cell class based on value compared to daily average
   */
  getMatrixCellClass(value: number, date: string): string {
    if (value === 0) {
      return 'matrix-cell-empty';
    }

    const dailyAverage = this.dailyAverages()[date] || 0;
    if (dailyAverage === 0) {
      return 'matrix-cell-normal-light';
    }

    const percentage = (value / dailyAverage) * 100;

    // Xanh lá đậm: ít chi tiêu nhất (< 50% trung bình)
    if (percentage < 50) {
      return 'matrix-cell-very-low';
    }

    // Xanh lá nhạt: chi tiêu hơi nhiều nhưng < trung bình (50-100%)
    if (percentage < 100) {
      return 'matrix-cell-low';
    }

    // Vàng: chi tiêu nhiều hơn trung bình 5% (100-105%)
    if (percentage <= 105) {
      return 'matrix-cell-medium';
    }

    // Đỏ nhạt: chi tiêu nhiều hơn trung bình 15-20% (115-120%)
    if (percentage <= 120) {
      return 'matrix-cell-high';
    }

    // Đỏ đậm: chi tiêu nhiều >25% (>125%)
    return 'matrix-cell-very-high';
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
                if (value === null || value === undefined) return '';
                const numValue = typeof value === 'number' ? value : 0;
                return this.formatAmount(numValue);
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

  /**
   * Show settings dialog
   */
  showSettingsDialog(): void {
    this.showSettings.set(true);
  }

  /**
   * Hide settings dialog
   */
  hideSettingsDialog(): void {
    this.showSettings.set(false);
  }

  /**
   * Handle settings save
   */
  onSettingsSave(settings: { layout: ExpenseLayout; fontSize: ExpenseFontSize }): void {
    this.currentLayout.set(settings.layout);
    this.currentTheme.set('compact'); // Always use compact theme (like v1)
    this.currentFontSize.set(settings.fontSize);
    // Apply settings to component class
    this.applySettings();
  }

  /**
   * Get active filter count
   */
  getActiveFilterCount(): number {
    let count = 0;
    if (this.filterDateFrom() || this.filterDateTo()) count++;
    if (this.filterCategory().length > 0) count++;
    if (this.searchText()) count++;
    if (this.filterAmountMin() !== null) count++;
    if (this.filterAmountMax() !== null) count++;
    return count;
  }

  toggleDropdown(event?: Event){
    const newValue = !this.showCategoryDropdown();
    this.showCategoryDropdown.set(newValue);

    // Calculate position for v2 filter dialog when opening
    if (newValue && this.currentLayout() === 'v2' && event) {
      const button = event.target as HTMLElement;
      const buttonElement = button.closest('.category-select-btn') as HTMLElement;
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        // Position dropdown above the button
        // Calculate after a small delay to ensure dropdown is rendered
        setTimeout(() => {
          const dropdown = document.querySelector('.filter-dialog-v2 .category-dropdown') as HTMLElement;
          if (dropdown) {
            const dropdownHeight = dropdown.offsetHeight || 300; // fallback to max-height
            this.categoryDropdownPosition.set({
              top: rect.top - dropdownHeight - 8, // 8px gap above button
              left: rect.left
            });
          } else {
            // Fallback: use estimated height
            this.categoryDropdownPosition.set({
              top: rect.top - 308, // 300px max-height + 8px gap
              left: rect.left
            });
          }
        }, 0);
      }
    }

    // Clear search when closing dropdown
    if (!newValue) {
      this.categorySearchText.set('');
      this.categoryDropdownPosition.set(null);
    }
  }

  /**
   * Apply settings to component
   */
  private applySettings(): void {
    const componentElement = document.querySelector('.expense-app');
    if (componentElement) {
      // Remove old classes
      componentElement.classList.remove('layout-v1', 'layout-v2');
      componentElement.classList.remove('theme-compact', 'theme-spacious');
      componentElement.classList.remove('font-small', 'font-medium', 'font-large');
      // Add new classes
      componentElement.classList.add(`layout-${this.currentLayout()}`);
      componentElement.classList.add('theme-compact'); // Always use compact theme (like v1)
      componentElement.classList.add(`font-${this.currentFontSize()}`);
    }
  }
}

