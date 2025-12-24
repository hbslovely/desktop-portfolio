import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import ExpenseService, { Expense, ExpenseGroup } from '../../../services/expense.service';
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
  savedRowIndices = signal<Set<number>>(new Set()); // Track which rows have been saved
  selectedGroupForAll = signal<string>(''); // Group selected for all rows
  expandedGroupId = signal<string | null>(null); // Currently expanded group in groups tab

  // Category detail dialog
  showCategoryDetail = signal<boolean>(false);
  selectedCategory = signal<string>('');
  showCustomDateDialog = signal<boolean>(false); // For custom date range filter

  // Budget category detail dialog
  showBudgetCategoryDetailDialog = signal<boolean>(false);
  selectedBudgetCategory = signal<string>('');

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

  // Computed total for selected group expenses
  selectedGroupTotal = computed(() => {
    const expenses = this.selectedGroupExpenses();
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  });

  // Expense Groups
  expenseGroups = signal<ExpenseGroup[]>([]);
  isLoadingGroups = signal<boolean>(false);
  showGroupDetail = signal<boolean>(false);
  selectedGroup = signal<ExpenseGroup | null>(null);
  selectedGroupExpenses = signal<Expense[]>([]);
  showGroupForm = signal<boolean>(false);
  editingGroup = signal<ExpenseGroup | null>(null);
  newGroup: ExpenseGroup = {
    id: '',
    name: '',
    content: '',
    dateFrom: '',
    dateTo: '',
    totalAmount: 0
  };

  // Computed: Group expenses by groupId
  expensesByGroup = computed(() => {
    const expenses = this.expenses();
    const groups = this.expenseGroups();
    const grouped: { [groupId: string]: Expense[] } = {};
    
    expenses.forEach(expense => {
      if (expense.groupId) {
        if (!grouped[expense.groupId]) {
          grouped[expense.groupId] = [];
        }
        grouped[expense.groupId].push(expense);
      }
    });

    // Calculate total amount for each group
    groups.forEach(group => {
      if (grouped[group.id]) {
        const total = grouped[group.id].reduce((sum, exp) => sum + exp.amount, 0);
        // Update group totalAmount if different
        if (group.totalAmount !== total) {
          // Note: This doesn't update the signal, just for display
        }
      }
    });

    return grouped;
  });

  // Computed: Expenses list with groups merged
  expensesWithGroups = computed(() => {
    const expenses = this.expenses();
    const groups = this.expenseGroups();
    const expensesByGroup = this.expensesByGroup();
    const result: Array<Expense | ExpenseGroup> = [];
    const processedGroupIds = new Set<string>();

    // Sort expenses by date descending
    const sortedExpenses = [...expenses].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Group expenses by groupId
    const expensesByGroupId: { [groupId: string]: Expense[] } = {};
    const expensesWithoutGroup: Expense[] = [];

    sortedExpenses.forEach(expense => {
      if (expense.groupId) {
        if (!expensesByGroupId[expense.groupId]) {
          expensesByGroupId[expense.groupId] = [];
        }
        expensesByGroupId[expense.groupId].push(expense);
      } else {
        expensesWithoutGroup.push(expense);
      }
    });

    // Add groups with their expenses
    groups.forEach(group => {
      if (expensesByGroupId[group.id] && expensesByGroupId[group.id].length > 0) {
        // Use the first expense date as group date for sorting
        const groupExpenses = expensesByGroupId[group.id];
        const groupDate = groupExpenses[0].date;
        result.push({ ...group, date: groupDate } as any);
        processedGroupIds.add(group.id);
      }
    });

    // Add expenses without groups
    result.push(...expensesWithoutGroup);

    // Sort by date descending
    result.sort((a, b) => {
      const dateA = 'date' in a ? new Date(a.date).getTime() : 0;
      const dateB = 'date' in b ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  });

  newExpense: Expense = {
    date: '',
    content: '',
    amount: 0,
    category: '',
    note: '',
    groupId: ''
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
    note: '',
    groupId: ''
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

  // Category icons and colors mapping - Using Font Awesome icons directly with bright colors
  categoryConfig: { [key: string]: { icon: string; color: string; bgColor: string } } = {
    'Kinh doanh': { icon: 'fa-briefcase', color: '#4F46E5', bgColor: '#EEF2FF' },
    'Đi chợ': { icon: 'fa-shopping-bag', color: '#059669', bgColor: '#ECFDF5' },
    'Siêu thị': { icon: 'fa-shopping-cart', color: '#0284C7', bgColor: '#F0F9FF' },
    'Ăn uống ngoài': { icon: 'fa-coffee', color: '#EA580C', bgColor: '#FFF7ED' },
    'Nhà hàng': { icon: 'fa-cutlery', color: '#DB2777', bgColor: '#FDF2F8' },
    'Đi lại - xăng xe': { icon: 'fa-bus', color: '#7C3AED', bgColor: '#F5F3FF' },
    'Gia đình/Bạn bè': { icon: 'fa-users', color: '#0D9488', bgColor: '#F0FDFA' },
    'Điện - nước': { icon: 'fa-tint', color: '#CA8A04', bgColor: '#FEFCE8' },
    'Pet/Thú cưng/Vật nuôi khác': { icon: 'fa-paw', color: '#E11D48', bgColor: '#FFF1F2' },
    'Sức khỏe': { icon: 'fa-user-md', color: '#DC2626', bgColor: '#FEF2F2' },
    'Thời trang / Mỹ Phẩm/ Làm đẹp': { icon: 'fa-wand-magic-sparkles', color: '#9333EA', bgColor: '#FAF5FF' },
    'Mua sắm / Mua sắm online': { icon: 'fa-shopping-cart', color: '#2563EB', bgColor: '#EFF6FF' },
    'Sữa/vitamin/chất bổ/Thuốc khác': { icon: 'fa-pills', color: '#16A34A', bgColor: '#F0FDF4' },
    'Từ thiện': { icon: 'fa-gift', color: '#EC4899', bgColor: '#FCE7F3' },
    'Điện thoại': { icon: 'fa-mobile-alt', color: '#475569', bgColor: '#F8FAFC' },
    'Sinh hoạt (Lee)': { icon: 'fa-home', color: '#0891B2', bgColor: '#ECFEFF' },
    'Ăn vặt / Ăn uống ngoài bữa chính': { icon: 'fa-cookie-bite', color: '#F59E0B', bgColor: '#FFFBEB' },
    'Du lịch – Nghỉ dưỡng': { icon: 'fa-plane', color: '#0D9488', bgColor: '#ECFDF5' },
    'Thiết bị làm việc': { icon: 'fa-laptop', color: '#2563EB', bgColor: '#EFF6FF' },
    'Chi tiêu khác': { icon: 'fa-circle-question', color: '#6B7280', bgColor: '#F9FAFB' }
  };

  categories = computed(() => {
    const allCategories = Object.keys(this.categoryConfig);
    const settings = this.settingsService()?.settings();
    const excludeCategories = settings?.excludeCategories || [];
    return allCategories.filter(cat => !excludeCategories.includes(cat));
  })

  getCategoryIcon(category: string): string {
    return this.categoryConfig[category]?.icon || 'fa-tag';
  }

  getCategoryColor(category: string): string {
    return this.categoryConfig[category]?.color || '#64748b';
  }

  getCategoryBgColor(category: string): string {
    return this.categoryConfig[category]?.bgColor || '#f8fafc';
  }

  // Filter
  filterCategory = signal<string[]>([]);
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');
  searchText = signal<string>('');
  searchInNote = signal<boolean>(false); // Search in note field
  searchMode = signal<'contains' | 'starts' | 'ends' | 'exact' | 'regex'>('contains');
  filterAmountMin = signal<number | null>(null);
  filterAmountMax = signal<number | null>(null);
  showHighAmountOnly = signal<boolean>(false); // Show only high amount expenses
  showRecentOnly = signal<boolean>(false); // Show only recent expenses (last 7 days)
  showWithNoteOnly = signal<boolean>(false); // Show only expenses with notes
  showWithoutNoteOnly = signal<boolean>(false); // Show only expenses without notes
  showAboveAverageOnly = signal<boolean>(false); // Show only above average
  showBelowAverageOnly = signal<boolean>(false); // Show only below average
  searchKeywords = signal<string[]>([]); // Multiple keywords search
  showSearchSuggestions = signal<boolean>(false);
  recentSearches = signal<string[]>([]);
  savedFilterPresets = signal<Array<{ name: string; filters: any }>>([]);

  // Category filter dropdown state
  showCategoryDropdown = signal<boolean>(false);
  categorySearchText = signal<string>('');
  categoryDropdownPosition = signal<{ top: number; left: number } | null>(null);

  // Sidebar panels system (WebStorm style)
  activeSidebarPanel = signal<'filters' | 'dates' | 'statistics' | 'categories' | null>('filters');
  sidebarPanelsCollapsed = signal<boolean>(false); // All panels collapsed

  // Right info panel state
  rightPanelOpen = signal<boolean>(false);

  // Check if filter is single day
  isSingleDayFilter = computed(() => {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();
    return dateFrom && dateTo && dateFrom === dateTo;
  });

  // Screens and Tabs
  currentScreen = signal<'transactions' | 'insights'>('transactions'); // Screen 1: Giao dịch, Screen 2: Insights
  activeTab = signal<'list' | 'summary' | 'budget' | 'insights' | 'groups'>('list');
  // Legacy signals (kept for compatibility)
  currentView = signal<'main' | 'insights'>('main');
  insightsActiveTab = signal<'budget' | 'insights'>('budget');

  // Month/Year picker for insights view
  insightsYear = signal<number>(new Date().getFullYear());
  insightsMonth = signal<number | null>(new Date().getMonth() + 1); // null = whole year
  predictionTab = signal<'thisWeek' | 'nextWeek' | 'thisMonth'>('thisWeek');

  // Budget Settings
  showBudgetSettings = signal<boolean>(false);
  editMonthlyBudget = signal<number>(10000000); // Default 10M VND
  editCategoryBudgets = signal<{ [category: string]: number }>({});
  showSetAllDialog = signal<boolean>(false);
  setAllValue = signal<number>(1000000); // Default 1M for set all

  // Budget mode: 'topDown' = set total and distribute by weight, 'bottomUp' = set each category
  budgetMode = signal<'topDown' | 'bottomUp'>('topDown');
  categoryWeights = signal<{ [category: string]: number }>({}); // Weight percentages for each category

  // Backup values for cancel functionality
  private originalMonthlyBudget = 0;
  private originalCategoryBudgets: { [category: string]: number } = {};
  private originalCategoryWeights: { [category: string]: number } = {};
  private originalBudgetMode: 'topDown' | 'bottomUp' = 'topDown';

  // Report Period Picker (for Budget & Insights tabs)
  reportYear = signal<number>(new Date().getFullYear());
  reportMonth = signal<number | null>(new Date().getMonth() + 1); // 1-12, null = whole year

  // Computed: expenses filtered by report period
  reportPeriodExpenses = computed(() => {
    const allExpenses = this.expenses();
    const year = this.reportYear();
    const month = this.reportMonth();

    return allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const expenseYear = expenseDate.getFullYear();
      const expenseMonth = expenseDate.getMonth() + 1;

      if (month === null) {
        // Whole year
        return expenseYear === year;
      } else {
        // Specific month
        return expenseYear === year && expenseMonth === month;
      }
    });
  });

  // Report period label
  getReportPeriodLabel(): string {
    const year = this.reportYear();
    const month = this.reportMonth();

    if (month === null) {
      return `Năm ${year}`;
    }

    const monthNames = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    return `${monthNames[month]} ${year}`;
  }

  // Set report period shortcuts
  setReportPeriod(period: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear'): void {
    const now = new Date();
    switch (period) {
      case 'thisMonth':
        this.reportYear.set(now.getFullYear());
        this.reportMonth.set(now.getMonth() + 1);
        break;
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        this.reportYear.set(lastMonth.getFullYear());
        this.reportMonth.set(lastMonth.getMonth() + 1);
        break;
      case 'thisYear':
        this.reportYear.set(now.getFullYear());
        this.reportMonth.set(null);
        break;
      case 'lastYear':
        this.reportYear.set(now.getFullYear() - 1);
        this.reportMonth.set(null);
        break;
    }
    // Reinitialize charts when period changes
    if (this.activeTab() === 'insights') {
      this.initInsightCharts();
    } else if (this.activeTab() === 'budget') {
      setTimeout(() => this.initBudgetTrendChart(), 100);
    }
  }

  // Navigate months/years
  navigateReportPeriod(direction: 'prev' | 'next'): void {
    const year = this.reportYear();
    const month = this.reportMonth();

    if (month === null) {
      // Navigate years
      this.reportYear.set(direction === 'prev' ? year - 1 : year + 1);
    } else {
      // Navigate months
      if (direction === 'prev') {
        if (month === 1) {
          this.reportYear.set(year - 1);
          this.reportMonth.set(12);
        } else {
          this.reportMonth.set(month - 1);
        }
      } else {
        if (month === 12) {
          this.reportYear.set(year + 1);
          this.reportMonth.set(1);
        } else {
          this.reportMonth.set(month + 1);
        }
      }
    }
    // Reinitialize charts
    if (this.activeTab() === 'insights') {
      this.initInsightCharts();
    } else if (this.activeTab() === 'budget') {
      setTimeout(() => this.initBudgetTrendChart(), 100);
    }
  }

  // Toggle between month and year view
  toggleReportMode(): void {
    const month = this.reportMonth();
    if (month === null) {
      // Switch to current month
      this.reportMonth.set(new Date().getMonth() + 1);
    } else {
      // Switch to whole year
      this.reportMonth.set(null);
    }
    // Reinitialize charts
    if (this.activeTab() === 'insights') {
      this.initInsightCharts();
    } else if (this.activeTab() === 'budget') {
      setTimeout(() => this.initBudgetTrendChart(), 100);
    }
  }

  // Check if report period is this month
  isThisMonthReport(): boolean {
    const now = new Date();
    return this.reportYear() === now.getFullYear() && this.reportMonth() === (now.getMonth() + 1);
  }

  // Check if report period is last month
  isLastMonthReport(): boolean {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return this.reportYear() === lastMonth.getFullYear() && this.reportMonth() === (lastMonth.getMonth() + 1);
  }

  // Sorting for expenses list - dropdown options
  sortOption = signal<'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'most_frequent' | 'least_frequent'>('newest');

  // Sort options for dropdown
  sortOptions = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
    { value: 'amount_desc', label: 'Số tiền giảm dần' },
    { value: 'amount_asc', label: 'Số tiền tăng dần' },
    { value: 'most_frequent', label: 'Thường xuyên nhất' },
    { value: 'least_frequent', label: 'Ít thường xuyên nhất' }
  ];

  // Legacy signals for backward compatibility
  sortField = signal<'date' | 'amount' | 'category' | 'content'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Computed: frequency map for content (for frequency-based sorting)
  contentFrequencyMap = computed(() => {
    const frequencyMap = new Map<string, number>();
    this.expenses().forEach(expense => {
      const key = expense.content.toLowerCase().trim();
      frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
    });
    return frequencyMap;
  });

  // Computed signals for optimized performance
  filteredExpenses = computed(() => {
    const allExpenses = this.expenses();
    const category = this.filterCategory();
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();
    const search = this.searchText().toLowerCase().trim();
    const amountMin = this.filterAmountMin();
    const amountMax = this.filterAmountMax();
    const sortOption = this.sortOption();
    const frequencyMap = this.contentFrequencyMap();

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

    // Filter by search text with advanced options
    if (search) {
      const searchInNote = this.searchInNote();
      const searchMode = this.searchMode();
      const keywords = this.searchKeywords();

      filtered = filtered.filter(expense => {
        // Multiple keywords search (AND logic)
        if (keywords.length > 0) {
          return keywords.every(keyword => {
            const contentMatch = this.matchSearch(expense.content.toLowerCase(), keyword.toLowerCase(), searchMode);
            const categoryMatch = this.matchSearch(expense.category.toLowerCase(), keyword.toLowerCase(), searchMode);
            const noteMatch = searchInNote && expense.note ? this.matchSearch(expense.note.toLowerCase(), keyword.toLowerCase(), searchMode) : false;
            return contentMatch || categoryMatch || noteMatch;
          });
        }

        // Single search
        const contentMatch = this.matchSearch(expense.content.toLowerCase(), search, searchMode);
        const categoryMatch = this.matchSearch(expense.category.toLowerCase(), search, searchMode);
        const noteMatch = searchInNote && expense.note ? this.matchSearch(expense.note.toLowerCase(), search, searchMode) : false;

        return contentMatch || categoryMatch || noteMatch;
      });
    }

    // Filter by amount range
    if (amountMin !== null) {
      filtered = filtered.filter(expense => expense.amount >= amountMin);
    }
    if (amountMax !== null) {
      filtered = filtered.filter(expense => expense.amount <= amountMax);
    }

    // Quick filters
    if (this.showHighAmountOnly()) {
      const allExpenses = this.expenses();
      if (allExpenses.length > 0) {
        const total = allExpenses.reduce((sum, e) => sum + e.amount, 0);
        const avg = total / allExpenses.length;
        filtered = filtered.filter(expense => expense.amount > avg);
      }
    }

    if (this.showRecentOnly()) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      filtered = filtered.filter(expense => expense.date >= sevenDaysAgoStr);
    }

    if (this.showWithNoteOnly()) {
      filtered = filtered.filter(expense => expense.note && expense.note.trim().length > 0);
    }

    if (this.showWithoutNoteOnly()) {
      filtered = filtered.filter(expense => !expense.note || expense.note.trim().length === 0);
    }

    if (this.showAboveAverageOnly()) {
      const allExpenses = this.expenses();
      if (allExpenses.length > 0) {
        const total = allExpenses.reduce((sum, e) => sum + e.amount, 0);
        const avg = total / allExpenses.length;
        filtered = filtered.filter(expense => expense.amount > avg);
      }
    }

    if (this.showBelowAverageOnly()) {
      const allExpenses = this.expenses();
      if (allExpenses.length > 0) {
        const total = allExpenses.reduce((sum, e) => sum + e.amount, 0);
        const avg = total / allExpenses.length;
        filtered = filtered.filter(expense => expense.amount < avg);
      }
    }

    // Sort expenses based on dropdown option
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          const dateANew = this.parseDate(a.date);
          const dateBNew = this.parseDate(b.date);
          if (!dateANew || !dateBNew) return 0;
          return dateBNew.getTime() - dateANew.getTime();

        case 'oldest':
          const dateAOld = this.parseDate(a.date);
          const dateBOld = this.parseDate(b.date);
          if (!dateAOld || !dateBOld) return 0;
          return dateAOld.getTime() - dateBOld.getTime();

        case 'amount_desc':
          return b.amount - a.amount;

        case 'amount_asc':
          return a.amount - b.amount;

        case 'most_frequent':
          const freqAMost = frequencyMap.get(a.content.toLowerCase().trim()) || 0;
          const freqBMost = frequencyMap.get(b.content.toLowerCase().trim()) || 0;
          // Sort by frequency desc, then by date desc for same frequency
          if (freqBMost !== freqAMost) return freqBMost - freqAMost;
          const dateAFreq = this.parseDate(a.date);
          const dateBFreq = this.parseDate(b.date);
          if (!dateAFreq || !dateBFreq) return 0;
          return dateBFreq.getTime() - dateAFreq.getTime();

        case 'least_frequent':
          const freqALeast = frequencyMap.get(a.content.toLowerCase().trim()) || 0;
          const freqBLeast = frequencyMap.get(b.content.toLowerCase().trim()) || 0;
          // Sort by frequency asc, then by date desc for same frequency
          if (freqALeast !== freqBLeast) return freqALeast - freqBLeast;
          const dateALFreq = this.parseDate(a.date);
          const dateBLFreq = this.parseDate(b.date);
          if (!dateALFreq || !dateBLFreq) return 0;
          return dateBLFreq.getTime() - dateALFreq.getTime();

        default:
          return 0;
      }
    });

    return filtered;
  });

  // Computed: Merge groups with filtered expenses for display
  filteredExpensesWithGroups = computed(() => {
    const filtered = this.filteredExpenses();
    const groups = this.expenseGroups();
    const expensesByGroup = this.expensesByGroup();
    const result: Array<Expense | ExpenseGroup> = [];
    const processedGroupIds = new Set<string>();
    const expensesInGroups = new Set<Expense>();

    // Find groups that have at least one expense in filtered list
    groups.forEach(group => {
      const groupExpenses = expensesByGroup[group.id] || [];
      const filteredGroupExpenses = groupExpenses.filter(exp => 
        filtered.some(fExp => fExp.date === exp.date && fExp.content === exp.content && fExp.amount === exp.amount)
      );

      if (filteredGroupExpenses.length > 0 && !processedGroupIds.has(group.id)) {
        // Use the first expense date as group date for sorting
        const firstExpense = filteredGroupExpenses[0];
        if (firstExpense) {
          result.push({ ...group, date: firstExpense.date } as any);
          processedGroupIds.add(group.id);
          // Mark all expenses in this group as processed
          groupExpenses.forEach(exp => expensesInGroups.add(exp));
        }
      }
    });

    // Add filtered expenses that are not in any processed group
    filtered.forEach(expense => {
      if (!expense.groupId || !processedGroupIds.has(expense.groupId)) {
        result.push(expense);
      }
    });

    // Sort by date descending
    result.sort((a, b) => {
      const dateA = 'date' in a ? new Date(a.date).getTime() : 0;
      const dateB = 'date' in b ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return result;
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

  // Get top N expenses by amount
  getTopExpenses(count: number = 5): { content: string; amount: number; category: string; date: string }[] {
    return [...this.filteredExpenses()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, count);
  }

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
          weekStart: this.formatDateLocal(weekStart)
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

  // ============ BUDGET COMPUTED VALUES ============

  // Get selected month's expenses (based on reportMonth/reportYear)
  currentMonthExpenses = computed(() => {
    const year = this.reportYear();
    const month = this.reportMonth();

    // If viewing whole year, return all expenses for that year
    if (month === null) {
      return this.expenses().filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getFullYear() === year;
      });
    }

    // Otherwise filter by specific month
    return this.expenses().filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === (month - 1) && expenseDate.getFullYear() === year;
    });
  });

  // Monthly spent amount
  monthlySpent = computed(() => {
    return this.currentMonthExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  });

  // Monthly budget (default 10M VND)
  monthlyBudget = computed(() => {
    return this.editMonthlyBudget();
  });

  // Budget percentage used
  budgetPercentage = computed(() => {
    const budget = this.monthlyBudget();
    if (budget === 0) return 0;
    return Math.round((this.monthlySpent() / budget) * 100);
  });

  // Remaining budget
  remainingBudget = computed(() => {
    return this.monthlyBudget() - this.monthlySpent();
  });

  // Remaining days in selected month
  remainingDaysInMonth = computed(() => {
    const year = this.reportYear();
    const month = this.reportMonth();
    const now = new Date();

    // If viewing whole year or a past month, return 0
    if (month === null) return 0;

    const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);

    if (isCurrentMonth) {
      const lastDay = new Date(year, month, 0);
      return lastDay.getDate() - now.getDate();
    }

    // For past/future months, return total days in month
    const lastDay = new Date(year, month, 0);
    return lastDay.getDate();
  });

  // Daily budget suggestion
  dailyBudgetSuggestion = computed(() => {
    const remaining = this.remainingBudget();
    const days = this.remainingDaysInMonth();
    if (days === 0 || remaining <= 0) return 0;
    return Math.round(remaining / days);
  });

  // Category budgets with spending
  categoryBudgets = computed(() => {
    const categories = this.categories();
    const catBudgets = this.editCategoryBudgets();
    const monthExpenses = this.currentMonthExpenses();

    return categories.map(category => {
      const spent = monthExpenses
        .filter(e => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0);
      const budget = catBudgets[category] || 0;
      const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const remaining = budget - spent;

      return {
        category,
        spent,
        budget,
        percentage,
        remaining
      };
    }).sort((a, b) => b.spent - a.spent);
  });

  // ============ INSIGHTS COMPUTED VALUES ============

  // Top spending category
  topSpendingCategory = computed(() => {
    const byCategory = this.totalByCategory();
    if (byCategory.length === 0) return null;
    const total = this.totalAmount();
    const top = byCategory[0];
    return {
      ...top,
      percentage: total > 0 ? Math.round((top.total / total) * 100) : 0
    };
  });

  // Highest spending day of week
  highestSpendingDay = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return null;

    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayTotals: { [key: number]: { total: number; count: number } } = {};

    for (let i = 0; i < 7; i++) {
      dayTotals[i] = { total: 0, count: 0 };
    }

    expenses.forEach(expense => {
      const day = new Date(expense.date).getDay();
      dayTotals[day].total += expense.amount;
      dayTotals[day].count++;
    });

    let maxDay = 0;
    let maxAverage = 0;

    for (let i = 0; i < 7; i++) {
      const avg = dayTotals[i].count > 0 ? dayTotals[i].total / dayTotals[i].count : 0;
      if (avg > maxAverage) {
        maxAverage = avg;
        maxDay = i;
      }
    }

    return {
      day: maxDay,
      dayName: dayNames[maxDay],
      average: Math.round(maxAverage)
    };
  });

  // Spending trend (last 30 days vs previous 30 days)
  spendingTrend = computed(() => {
    const expenses = this.expenses();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recent = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= thirtyDaysAgo && d <= now;
    });

    const previous = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });

    const recentTotal = recent.reduce((sum, e) => sum + e.amount, 0);
    const previousTotal = previous.reduce((sum, e) => sum + e.amount, 0);

    if (previousTotal === 0) {
      return { trend: 'Chưa đủ dữ liệu', percentage: 0 };
    }

    const percentage = Math.round(((recentTotal - previousTotal) / previousTotal) * 100);

    if (percentage > 10) return { trend: 'Tăng', percentage };
    if (percentage < -10) return { trend: 'Giảm', percentage };
    return { trend: 'Ổn định', percentage };
  });

  // Average transactions per day
  averageTransactionsPerDay = computed(() => {
    const expenses = this.filteredExpenses();
    const dates = this.uniqueDates();
    if (dates.length === 0) return 0;
    return expenses.length / dates.length;
  });

  // ============ INSIGHTS COMPUTED VALUES (based on reportPeriodExpenses) ============

  // Top spending category for insights (uses reportPeriodExpenses)
  insightsTopSpendingCategory = computed(() => {
    const expenses = this.reportPeriodExpenses();
    if (expenses.length === 0) return null;

    const totals: { [key: string]: number } = {};
    expenses.forEach(expense => {
      if (expense.category) {
        totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
      }
    });

    const byCategory = Object.keys(totals).map(category => ({
      category,
      total: totals[category]
    })).sort((a, b) => b.total - a.total);

    if (byCategory.length === 0) return null;
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const top = byCategory[0];
    return {
      ...top,
      percentage: total > 0 ? Math.round((top.total / total) * 100) : 0
    };
  });

  // Highest spending day of week for insights (uses reportPeriodExpenses)
  insightsHighestSpendingDay = computed(() => {
    const expenses = this.reportPeriodExpenses();
    if (expenses.length === 0) return null;

    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayTotals: { [key: number]: { total: number; count: number } } = {};

    for (let i = 0; i < 7; i++) {
      dayTotals[i] = { total: 0, count: 0 };
    }

    expenses.forEach(expense => {
      const day = new Date(expense.date).getDay();
      dayTotals[day].total += expense.amount;
      dayTotals[day].count++;
    });

    let maxDay = 0;
    let maxAverage = 0;

    for (let i = 0; i < 7; i++) {
      const avg = dayTotals[i].count > 0 ? dayTotals[i].total / dayTotals[i].count : 0;
      if (avg > maxAverage) {
        maxAverage = avg;
        maxDay = i;
      }
    }

    return {
      day: maxDay,
      dayName: dayNames[maxDay],
      average: Math.round(maxAverage)
    };
  });

  // Spending trend for insights (compares selected period vs previous period)
  insightsSpendingTrend = computed(() => {
    const expenses = this.expenses();
    const year = this.reportYear();
    const month = this.reportMonth();

    if (month === null) {
      // Year view: compare this year vs last year
      const thisYear = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year;
      });
      const lastYear = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year - 1;
      });

      const thisYearTotal = thisYear.reduce((sum, e) => sum + e.amount, 0);
      const lastYearTotal = lastYear.reduce((sum, e) => sum + e.amount, 0);

      if (lastYearTotal === 0) {
        return { trend: 'Chưa đủ dữ liệu', percentage: 0 };
      }

      const percentage = Math.round(((thisYearTotal - lastYearTotal) / lastYearTotal) * 100);
      if (percentage > 10) return { trend: 'Tăng', percentage };
      if (percentage < -10) return { trend: 'Giảm', percentage };
      return { trend: 'Ổn định', percentage };
    } else {
      // Month view: compare this month vs last month
      const thisMonth = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      let lastMonthYear = year;
      let lastMonthNum = month - 1;
      if (lastMonthNum === 0) {
        lastMonthNum = 12;
        lastMonthYear = year - 1;
      }

      const lastMonth = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === lastMonthYear && d.getMonth() + 1 === lastMonthNum;
      });

      const thisMonthTotal = thisMonth.reduce((sum, e) => sum + e.amount, 0);
      const lastMonthTotal = lastMonth.reduce((sum, e) => sum + e.amount, 0);

      if (lastMonthTotal === 0) {
        return { trend: 'Chưa đủ dữ liệu', percentage: 0 };
      }

      const percentage = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
      if (percentage > 10) return { trend: 'Tăng', percentage };
      if (percentage < -10) return { trend: 'Giảm', percentage };
      return { trend: 'Ổn định', percentage };
    }
  });

  // Average transactions per day for insights (uses reportPeriodExpenses)
  insightsAverageTransactionsPerDay = computed(() => {
    const expenses = this.reportPeriodExpenses();
    if (expenses.length === 0) return 0;

    const dateSet = new Set<string>();
    expenses.forEach(expense => {
      dateSet.add(expense.date);
    });
    const dates = Array.from(dateSet);

    if (dates.length === 0) return 0;
    return expenses.length / dates.length;
  });

  // Average daily expense for insights (uses reportPeriodExpenses)
  insightsAverageDailyExpense = computed(() => {
    const expenses = this.reportPeriodExpenses();
    if (expenses.length === 0) return 0;

    const dailyMap: { [key: string]: number } = {};
    expenses.forEach(expense => {
      const date = expense.date;
      if (dailyMap[date]) {
        dailyMap[date] += expense.amount;
      } else {
        dailyMap[date] = expense.amount;
      }
    });

    const dailyTotals = Object.values(dailyMap);
    if (dailyTotals.length === 0) return 0;

    const total = dailyTotals.reduce((sum, item) => sum + item, 0);
    return Math.round(total / dailyTotals.length);
  });

  // Total by category for insights (uses reportPeriodExpenses)
  insightsTotalByCategory = computed(() => {
    const expenses = this.reportPeriodExpenses();
    const totals: { [key: string]: number } = {};

    expenses.forEach(expense => {
      if (expense.category) {
        totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
      }
    });

    return Object.keys(totals).map(category => ({
      category,
      total: totals[category]
    })).sort((a, b) => b.total - a.total);
  });

  // Total amount for insights (uses reportPeriodExpenses)
  insightsTotalAmount = computed(() => {
    return this.reportPeriodExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  });

  // Weekday spending for insights (uses reportPeriodExpenses)
  insightsWeekdaySpending = computed(() => {
    const expenses = this.reportPeriodExpenses();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const fullDayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayData: { [key: number]: { total: number; count: number } } = {};

    for (let i = 0; i < 7; i++) {
      dayData[i] = { total: 0, count: 0 };
    }

    expenses.forEach(expense => {
      const day = new Date(expense.date).getDay();
      dayData[day].total += expense.amount;
      dayData[day].count++;
    });

    const averages = Object.entries(dayData).map(([day, data]) => ({
      day: parseInt(day),
      average: data.count > 0 ? data.total / data.count : 0
    }));

    const maxAverage = Math.max(...averages.map(d => d.average));

    return averages.map(item => ({
      day: item.day,
      shortName: dayNames[item.day],
      fullName: fullDayNames[item.day],
      average: Math.round(item.average),
      percentage: maxAverage > 0 ? Math.round((item.average / maxAverage) * 100) : 0,
      isHighest: item.average === maxAverage && maxAverage > 0
    }));
  });

  // Weekday spending analysis
  weekdaySpending = computed(() => {
    const expenses = this.filteredExpenses();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const fullDayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayData: { [key: number]: { total: number; count: number } } = {};

    for (let i = 0; i < 7; i++) {
      dayData[i] = { total: 0, count: 0 };
    }

    expenses.forEach(expense => {
      const day = new Date(expense.date).getDay();
      dayData[day].total += expense.amount;
      dayData[day].count++;
    });

    const averages = Object.entries(dayData).map(([day, data]) => ({
      day: parseInt(day),
      average: data.count > 0 ? data.total / data.count : 0
    }));

    const maxAverage = Math.max(...averages.map(d => d.average));

    return averages.map(item => ({
      day: item.day,
      shortName: dayNames[item.day],
      fullName: fullDayNames[item.day],
      average: Math.round(item.average),
      percentage: maxAverage > 0 ? Math.round((item.average / maxAverage) * 100) : 0,
      isHighest: item.average === maxAverage && maxAverage > 0
    }));
  });

  // Week of month spending analysis
  weekOfMonthSpending = computed(() => {
    const expenses = this.filteredExpenses();
    const weekLabels = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5'];
    const weekData: { [key: number]: { total: number; count: number } } = {};

    for (let i = 1; i <= 5; i++) {
      weekData[i] = { total: 0, count: 0 };
    }

    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const week = Math.ceil(date.getDate() / 7);
      if (week <= 5) {
        weekData[week].total += expense.amount;
        weekData[week].count++;
      }
    });

    const averages = Object.entries(weekData).map(([week, data]) => ({
      week: parseInt(week),
      average: data.count > 0 ? data.total / data.count : 0
    }));

    const maxAverage = Math.max(...averages.map(w => w.average));

    return averages.map(item => ({
      week: item.week,
      label: weekLabels[item.week - 1],
      average: Math.round(item.average),
      percentage: maxAverage > 0 ? Math.round((item.average / maxAverage) * 100) : 0,
      isHighest: item.average === maxAverage && maxAverage > 0
    }));
  });

  // Spending tips based on analysis
  spendingTips = computed(() => {
    const tips: Array<{ title: string; description: string; type: 'warning' | 'success' | 'info'; icon: string; action?: string }> = [];

    // Check budget status
    const budgetPercent = this.budgetPercentage();
    if (budgetPercent > 100) {
      tips.push({
        title: 'Vượt ngân sách!',
        description: `Bạn đã chi tiêu vượt ${budgetPercent - 100}% ngân sách tháng này.`,
        type: 'warning',
        icon: 'pi-exclamation-triangle',
        action: 'Xem xét cắt giảm các chi tiêu không cần thiết'
      });
    } else if (budgetPercent > 80) {
      tips.push({
        title: 'Gần hết ngân sách',
        description: `Đã sử dụng ${budgetPercent}% ngân sách. Còn ${this.remainingDaysInMonth()} ngày trong tháng.`,
        type: 'warning',
        icon: 'pi-exclamation-circle',
        action: 'Hạn chế chi tiêu để không vượt ngân sách'
      });
    }

    // Top spending category tip
    const topCat = this.topSpendingCategory();
    if (topCat && topCat.percentage > 30) {
      tips.push({
        title: `${topCat.category} chiếm ${topCat.percentage}%`,
        description: `Danh mục này chiếm tỷ trọng lớn trong chi tiêu của bạn.`,
        type: 'info',
        icon: 'pi-chart-pie',
        action: 'Xem xét tối ưu chi tiêu cho danh mục này'
      });
    }

    // Spending trend tip
    const trend = this.spendingTrend();
    if (trend.percentage < -15) {
      tips.push({
        title: 'Chi tiêu giảm đáng kể!',
        description: `Chi tiêu 30 ngày qua giảm ${Math.abs(trend.percentage)}% so với kỳ trước.`,
        type: 'success',
        icon: 'pi-thumbs-up'
      });
    }

    // Highest spending day tip
    const highestDay = this.highestSpendingDay();
    if (highestDay) {
      tips.push({
        title: `${highestDay.dayName} là ngày chi tiêu nhiều`,
        description: `Trung bình ${this.formatAmount(highestDay.average)} mỗi ${highestDay.dayName}.`,
        type: 'info',
        icon: 'pi-calendar',
        action: 'Cân nhắc lên kế hoạch chi tiêu cho ngày này'
      });
    }

    // Add default tip if no warnings
    if (tips.length < 2) {
      tips.push({
        title: 'Theo dõi chi tiêu thường xuyên',
        description: 'Ghi chép chi tiêu hàng ngày giúp bạn kiểm soát tài chính tốt hơn.',
        type: 'info',
        icon: 'pi-bookmark'
      });
    }

    return tips.slice(0, 4); // Max 4 tips
  });

  // Recent achievements
  recentAchievements = computed(() => {
    const achievements: Array<{
      title: string;
      description: string;
      icon: string;
      achieved: boolean;
      progress?: number
    }> = [];

    const budgetPercent = this.budgetPercentage();
    const trend = this.spendingTrend();
    const daysRemaining = this.remainingDaysInMonth();
    const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysPassed = totalDays - daysRemaining;

    // Budget control achievement
    if (budgetPercent <= 100) {
      const targetPercent = (daysPassed / totalDays) * 100;
      if (budgetPercent <= targetPercent) {
        achievements.push({
          title: 'Kiểm soát ngân sách tốt',
          description: 'Chi tiêu theo đúng kế hoạch ngân sách',
          icon: 'pi-wallet',
          achieved: true
        });
      } else {
        achievements.push({
          title: 'Đang nỗ lực kiểm soát',
          description: 'Tiếp tục cố gắng để đạt mục tiêu',
          icon: 'pi-wallet',
          achieved: false,
          progress: Math.max(0, Math.round(100 - (budgetPercent - targetPercent)))
        });
      }
    }

    // Saving trend achievement
    if (trend.percentage < 0) {
      achievements.push({
        title: 'Xu hướng tiết kiệm',
        description: `Giảm ${Math.abs(trend.percentage)}% so với kỳ trước`,
        icon: 'pi-chart-line',
        achieved: true
      });
    }

    // Consistent tracking achievement
    const uniqueDates = this.uniqueDates();
    if (uniqueDates.length >= 7) {
      achievements.push({
        title: 'Ghi chép đều đặn',
        description: `Đã ghi chép ${uniqueDates.length} ngày`,
        icon: 'pi-check-circle',
        achieved: true
      });
    } else {
      achievements.push({
        title: 'Ghi chép đều đặn',
        description: 'Ghi chép ít nhất 7 ngày để đạt thành tích',
        icon: 'pi-check-circle',
        achieved: false,
        progress: Math.round((uniqueDates.length / 7) * 100)
      });
    }

    // Low single transaction achievement
    const avgExpense = this.averageExpense();
    if (avgExpense > 0 && avgExpense < 200000) {
      achievements.push({
        title: 'Chi tiêu hợp lý',
        description: `Trung bình ${this.formatAmount(avgExpense)}/giao dịch`,
        icon: 'pi-star',
        achieved: true
      });
    }

    return achievements.slice(0, 4);
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
    const sixtyDaysAgoStr = this.formatDateLocal(sixtyDaysAgo);

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
    const tomorrowStr = this.formatDateLocal(tomorrowDate);
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
      const futureDateStr = this.formatDateLocal(futureDate);
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
      const futureDateStr = this.formatDateLocal(futureDate);
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
      const futureDateStr = this.formatDateLocal(futureDate);
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
      const futureDateStr = this.formatDateLocal(futureDate);
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
    const todayStr = this.formatDateLocal(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = this.formatDateLocal(yesterday);

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
    const todayStr = this.formatDateLocal(today);
    const allExpenses = this.expenses(); // Use all expenses, not filtered

    // Get today's expenses
    const todayExpenses = allExpenses.filter(e => e.date === todayStr);
    const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const todayCount = todayExpenses.length;

    // Calculate average of last 30 days (excluding today)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = this.formatDateLocal(thirtyDaysAgo);

    const last30DaysExpenses = allExpenses.filter(e => {
      return e.date >= thirtyDaysAgoStr && e.date < todayStr;
    });

    const last30DaysDates = new Set(last30DaysExpenses.map(e => e.date));
    const last30DaysTotal = last30DaysExpenses.reduce((sum, e) => sum + e.amount, 0);
    const last30DaysAvg = last30DaysDates.size > 0 ? last30DaysTotal / last30DaysDates.size : 0;

    // Calculate average of last 7 days (excluding today)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = this.formatDateLocal(sevenDaysAgo);

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
    const weekStartStr = this.formatDateLocal(weekStart);

    const currentWeekExpenses = allExpenses.filter(e => {
      return e.date >= weekStartStr && e.date < todayStr;
    });

    const currentWeekDates = new Set(currentWeekExpenses.map(e => e.date));
    const currentWeekTotal = currentWeekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const currentWeekAvg = currentWeekDates.size > 0 ? currentWeekTotal / currentWeekDates.size : 0;

    // Calculate current month average (excluding today)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = this.formatDateLocal(monthStart);

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
      this.loadGroups();
      this.loadBudgets(); // Load budgets from Google Sheets
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

      // Load expenses and groups
      this.loadExpenses();
      this.loadGroups();
    } else {
      // Generic error message - don't reveal which field is incorrect
      this.passwordError.set(genericError);
    }
    // inputPassword goes out of scope here - garbage collected
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
   * Load expense groups from Google Sheets
   */
  loadGroups(forceRefresh: boolean = false): void {
    if (this.isLoadingGroups() && !forceRefresh) {
      return;
    }

    this.isLoadingGroups.set(true);

    this.expenseService.getGroups(forceRefresh).subscribe({
      next: (groups) => {
        this.expenseGroups.set(groups);
        this.isLoadingGroups.set(false);
      },
      error: (err) => {
        console.error('Error loading groups:', err);
        this.isLoadingGroups.set(false);
        // Don't show error to user, groups are optional
      }
    });
  }

  /**
   * Show group detail dialog
   */
  showGroupDetailDialog(group: ExpenseGroup): void {
    const expenses = this.expenses();
    const groupExpenses = expenses.filter(exp => exp.groupId === group.id);
    this.selectedGroup.set(group);
    this.selectedGroupExpenses.set(groupExpenses);
    this.showGroupDetail.set(true);
  }

  /**
   * Hide group detail dialog
   */
  hideGroupDetailDialog(): void {
    this.showGroupDetail.set(false);
    this.selectedGroup.set(null);
    this.selectedGroupExpenses.set([]);
  }

  /**
   * Toggle group expanded state in groups tab
   */
  toggleGroupExpanded(groupId: string): void {
    if (this.expandedGroupId() === groupId) {
      this.expandedGroupId.set(null);
    } else {
      this.expandedGroupId.set(groupId);
    }
  }

  /**
   * Apply selected group to all expenses in multiple input mode
   */
  applyGroupToAll(): void {
    const groupId = this.selectedGroupForAll();
    const expenses = this.multipleExpenses();
    expenses.forEach(expense => {
      expense.groupId = groupId;
    });
    this.multipleExpenses.set([...expenses]);
  }

  /**
   * Show add/edit group form
   */
  showAddGroupForm(): void {
    this.newGroup = {
      id: this.generateGroupId(),
      name: '',
      content: '',
      dateFrom: '',
      dateTo: '',
      totalAmount: 0
    };
    this.editingGroup.set(null);
    this.showGroupForm.set(true);
  }

  /**
   * Show edit group form
   */
  showEditGroupForm(group: ExpenseGroup): void {
    this.newGroup = { ...group };
    this.editingGroup.set(group);
    this.showGroupForm.set(true);
  }

  /**
   * Hide group form
   */
  hideGroupForm(): void {
    this.showGroupForm.set(false);
    this.editingGroup.set(null);
  }

  /**
   * Save group (add or update)
   */
  saveGroup(): void {
    if (!this.newGroup.name || !this.newGroup.id) {
      this.showNotificationDialog('Vui lòng nhập tên nhóm và ID nhóm', 'error');
      return;
    }

    const group = { ...this.newGroup };
    const isEditing = this.editingGroup() !== null;

    if (isEditing && this.editingGroup()) {
      const rowIndex = this.editingGroup()!.rowIndex || 0;
      this.expenseService.updateGroup(group, rowIndex).subscribe({
        next: () => {
          this.showNotificationDialog('Đã cập nhật nhóm chi tiêu thành công', 'success');
          this.loadGroups(true);
          this.hideGroupForm();
        },
        error: (err) => {
          this.showNotificationDialog('Không thể cập nhật nhóm chi tiêu: ' + err.message, 'error');
        }
      });
    } else {
      this.expenseService.addGroup(group).subscribe({
        next: () => {
          this.showNotificationDialog('Đã thêm nhóm chi tiêu thành công', 'success');
          this.loadGroups(true);
          this.hideGroupForm();
        },
        error: (err) => {
          this.showNotificationDialog('Không thể thêm nhóm chi tiêu: ' + err.message, 'error');
        }
      });
    }
  }

  /**
   * Delete group
   */
  deleteGroup(group: ExpenseGroup): void {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhóm "${group.name}"?`)) {
      return;
    }

    const rowIndex = group.rowIndex || 0;
    if (rowIndex < 2) {
      this.showNotificationDialog('Không thể xóa nhóm: Row index không hợp lệ', 'error');
      return;
    }

    this.expenseService.deleteGroup(rowIndex).subscribe({
      next: () => {
        this.showNotificationDialog('Đã xóa nhóm chi tiêu thành công', 'success');
        this.loadGroups(true);
        if (this.showGroupDetail()) {
          this.hideGroupDetailDialog();
        }
      },
      error: (err) => {
        this.showNotificationDialog('Không thể xóa nhóm chi tiêu: ' + err.message, 'error');
      }
    });
  }

  /**
   * Generate unique group ID
   */
  generateGroupId(): string {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Check if item is a group (not an expense)
   */
  isGroup(item: Expense | ExpenseGroup): item is ExpenseGroup {
    return 'id' in item && 'name' in item && !('content' in item && 'category' in item);
  }

  /**
   * Get total amount for a group
   */
  getGroupTotalAmount(group: ExpenseGroup): number {
    const groupExpenses = this.expensesByGroup()[group.id] || [];
    const calculatedTotal = groupExpenses.reduce((sum, e) => sum + e.amount, 0);
    // Use calculated total if group.totalAmount is 0 or not set, otherwise use group.totalAmount
    return group.totalAmount && group.totalAmount > 0 ? group.totalAmount : calculatedTotal;
  }

  /**
   * Get expenses count for a group
   */
  getGroupExpensesCount(group: ExpenseGroup): number {
    const groupExpenses = this.expensesByGroup()[group.id] || [];
    return groupExpenses.length;
  }

  /**
   * Get first expense date for a group
   */
  getGroupFirstExpenseDate(group: ExpenseGroup): string {
    const groupExpenses = this.expensesByGroup()[group.id] || [];
    return groupExpenses.length > 0 ? groupExpenses[0].date : '';
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
      note: '',
      groupId: ''
    };
    this.inputMode.set('single');
    this.multipleExpenses.set([this.createEmptyExpense()]);
    this.savingProgress.set({ current: 0, total: 0, saving: false });
    this.savedRowIndices.set(new Set()); // Reset saved row tracking
    this.showSuccessMessage.set(false);
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
      note: '',
      groupId: ''
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
      category: '',
      note: '',
      groupId: ''
    };
  }

  /**
   * Reset form for next expense (keep date and category)
   */
  resetFormForNext(): void {
    this.newExpense.content = '';
    this.newExpense.amount = 0;
    this.newExpense.note = '';
    this.newExpense.groupId = '';
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
      note: expense.note || '',
      groupId: expense.groupId || ''
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
   * Switch screen (Giao dịch or Insights)
   */
  switchScreen(screen: 'transactions' | 'insights'): void {
    this.currentScreen.set(screen);

    // Set default tab for each screen
    if (screen === 'transactions') {
      this.activeTab.set('list');
    } else {
      this.activeTab.set('budget');
      // Initialize budget chart when switching to insights screen
      setTimeout(() => {
        this.initBudgetTrendChart();
      }, 100);
    }
  }

  /**
   * Switch tab
   */
  switchTab(tab: 'list' | 'summary' | 'budget' | 'insights' | 'groups'): void {
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
    } else if (tab === 'budget') {
      // Initialize budget chart when switching to budget tab
      setTimeout(() => {
        this.initBudgetTrendChart();
      }, 100);
    } else if (tab === 'insights') {
      // Initialize insight charts when switching to insights tab
      this.initInsightCharts();
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
    const todayStr = this.formatDateLocal(today);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = this.formatDateLocal(thirtyDaysAgo);

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
      const dateStr = this.formatDateLocal(date);
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
    const thirtyDaysAgoStr = this.formatDateLocal(thirtyDaysAgo);

    const allExpenses = this.expenses();
    const historicalExpenses = allExpenses.filter(e => e.date >= thirtyDaysAgoStr && e.date <= this.formatDateLocal(today));

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
      const weekKey = `${this.formatDateShort(this.formatDateLocal(weekStart))} - ${this.formatDateShort(pred.date)}`;

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
    this.savedRowIndices.set(new Set()); // Reset saved indices
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
        // Mark this row as saved
        const saved = new Set(this.savedRowIndices());
        saved.add(index);
        this.savedRowIndices.set(saved);

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

  // Check if a row has been saved
  isRowSaved(index: number): boolean {
    return this.savedRowIndices().has(index);
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
   * Duplicate an expense
   */
  duplicateExpense(expense: Expense): void {
    this.newExpense = {
      date: expense.date,
      content: expense.content,
      amount: expense.amount,
      category: expense.category,
      note: expense.note || '',
      groupId: expense.groupId || ''
    };
    this.showAddForm.set(true);
    this.inputMode.set('single');
  }

  /**
   * Copy data from previous row in multiple expenses table
   */
  copyFromPreviousRow(index: number): void {
    if (index === 0) return;
    const expenses = this.multipleExpenses();
    const previousExpense = expenses[index - 1];
    if (previousExpense) {
      expenses[index] = {
        ...expenses[index],
        date: previousExpense.date,
        category: previousExpense.category,
        note: previousExpense.note
      };
      this.multipleExpenses.set([...expenses]);
    }
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
  abs = Math.abs;
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
    this.searchInNote.set(false);
    this.searchMode.set('contains');
    this.filterAmountMin.set(null);
    this.filterAmountMax.set(null);
    this.showHighAmountOnly.set(false);
    this.showRecentOnly.set(false);
    this.showWithNoteOnly.set(false);
    this.showWithoutNoteOnly.set(false);
    this.showAboveAverageOnly.set(false);
    this.showBelowAverageOnly.set(false);
    this.searchKeywords.set([]);
    this.showSearchSuggestions.set(false);
  }

  /**
   * Match search text based on search mode
   */
  matchSearch(text: string, search: string, mode: 'contains' | 'starts' | 'ends' | 'exact' | 'regex'): boolean {
    switch (mode) {
      case 'contains':
        return text.includes(search);
      case 'starts':
        return text.startsWith(search);
      case 'ends':
        return text.endsWith(search);
      case 'exact':
        return text === search;
      case 'regex':
        try {
          const regex = new RegExp(search, 'i');
          return regex.test(text);
        } catch (e) {
          // Invalid regex, fallback to contains
          return text.includes(search);
        }
      default:
        return text.includes(search);
    }
  }

  /**
   * Get search suggestions based on expenses
   */
  getSearchSuggestions(query: string): string[] {
    if (!query || query.length < 2) return [];

    const suggestions = new Set<string>();
    const lowerQuery = query.toLowerCase();

    this.expenses().forEach(expense => {
      // Content suggestions
      if (expense.content.toLowerCase().includes(lowerQuery)) {
        suggestions.add(expense.content);
      }

      // Category suggestions
      if (expense.category.toLowerCase().includes(lowerQuery)) {
        suggestions.add(expense.category);
      }

      // Note suggestions (first 50 chars)
      if (expense.note && expense.note.toLowerCase().includes(lowerQuery)) {
        const noteSnippet = expense.note.substring(0, 50);
        if (noteSnippet.length === 50) {
          suggestions.add(noteSnippet + '...');
        } else {
          suggestions.add(noteSnippet);
        }
      }
    });

    return Array.from(suggestions).slice(0, 5);
  }

  /**
   * Add to recent searches
   */
  addToRecentSearches(search: string): void {
    if (!search || search.trim().length === 0) return;

    const recent = this.recentSearches();
    const trimmedSearch = search.trim();

    // Remove if already exists
    const filtered = recent.filter(s => s !== trimmedSearch);

    // Add to beginning
    filtered.unshift(trimmedSearch);

    // Keep only last 10
    this.recentSearches.set(filtered.slice(0, 10));
  }

  /**
   * Parse keywords from search text (comma or space separated)
   */
  parseKeywords(searchText: string): string[] {
    if (!searchText) return [];

    // Split by comma or space, filter empty
    return searchText
      .split(/[,\s]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
  }

  /**
   * Handle search text change
   */
  onSearchTextChange(text: string): void {
    this.searchText.set(text);

    // Parse keywords if multiple
    const keywords = this.parseKeywords(text);
    if (keywords.length > 1) {
      this.searchKeywords.set(keywords);
    } else {
      this.searchKeywords.set([]);
    }

    // Show suggestions if text is long enough
    this.showSearchSuggestions.set(text.length >= 2);
  }

  /**
   * Handle search input focus
   */
  onSearchFocus(): void {
    this.showSearchSuggestions.set(this.searchText().length >= 2);
  }

  /**
   * Handle search input blur
   */
  onSearchBlur(): void {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      this.showSearchSuggestions.set(false);
    }, 200);
  }

  /**
   * Toggle sidebar panel
   */
  toggleSidebarPanel(panel: 'filters' | 'dates' | 'statistics' | 'categories'): void {
    if (this.activeSidebarPanel() === panel && !this.sidebarPanelsCollapsed()) {
      // If clicking the same panel, collapse it
      this.sidebarPanelsCollapsed.set(true);
    } else {
      // Open the selected panel
      this.activeSidebarPanel.set(panel);
      this.sidebarPanelsCollapsed.set(false);

      // Sync filters when switching panels
      // This ensures UI reflects current filter state when switching between panels
      // The signals are already shared, but this triggers change detection
      if (panel === 'categories' || panel === 'filters') {
        // Force update by reading the signal (triggers change detection)
        this.filterCategory();
      }
      if (panel === 'dates' || panel === 'filters') {
        // Force update date filters
        this.filterDateFrom();
        this.filterDateTo();
      }
    }
  }

  /**
   * Get unique dates from expenses with stats (computed signal)
   */
  uniqueDatesWithStats = computed((): Array<{ date: string; count: number; total: number }> => {
    const dateMap = new Map<string, { count: number; total: number }>();

    this.expenses().forEach(expense => {
      const existing = dateMap.get(expense.date) || { count: 0, total: 0 };
      dateMap.set(expense.date, {
        count: existing.count + 1,
        total: existing.total + expense.amount
      });
    });

    return Array.from(dateMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  });

  /**
   * Check if date is selected
   */
  isDateSelected(date: string): boolean {
    return this.filterDateFrom() === date && this.filterDateTo() === date;
  }

  /**
   * Select a date to filter and show day detail
   */
  selectDate(date: string): void {
    this.filterDateFrom.set(date);
    this.filterDateTo.set(date);
  }

  /**
   * Get max expense amount
   */
  getMaxExpense(): number {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return 0;
    return Math.max(...expenses.map(e => e.amount));
  }

  /**
   * Get min expense amount
   */
  getMinExpense(): number {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return 0;
    return Math.min(...expenses.map(e => e.amount));
  }

  // Date search for date list panel
  dateSearchText = signal<string>('');

  /**
   * Get filtered unique dates based on search (computed signal)
   */
  filteredUniqueDates = computed((): Array<{ date: string; count: number; total: number }> => {
    const dates = this.uniqueDatesWithStats();
    const search = this.dateSearchText().toLowerCase().trim();

    if (!search) return dates;

    return dates.filter(dateGroup => {
      const dateStr = this.formatDate(dateGroup.date).toLowerCase();
      return dateStr.includes(search);
    });
  });

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
   * Change sort option from dropdown
   */
  onSortOptionChange(option: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'most_frequent' | 'least_frequent'): void {
    this.sortOption.set(option);
  }

  /**
   * Get current sort option label
   */
  getSortOptionLabel(): string {
    const option = this.sortOptions.find(o => o.value === this.sortOption());
    return option?.label || 'Mới nhất';
  }

  /**
   * Legacy: Sort expenses by field (kept for backward compatibility)
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
   * Legacy: Get sort icon for field (kept for backward compatibility)
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
   * Format date to YYYY-MM-DD in local timezone (not UTC)
   */
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Quick filter: Today
   */
  filterToday(): void {
    const today = new Date();
    const todayStr = this.formatDateLocal(today);
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
    const yesterdayStr = this.formatDateLocal(yesterday);
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
    this.filterDateFrom.set(this.formatDateLocal(last7Days));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Quick filter: Last 30 days
   */
  filterLast30Days(): void {
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    this.filterDateFrom.set(this.formatDateLocal(last30Days));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Quick filter: Current month (from day 1 to today)
   */
  filterCurrentMonth(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.filterDateFrom.set(this.formatDateLocal(firstDay));
    this.filterDateTo.set(this.formatDateLocal(today));
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
    this.filterDateFrom.set(this.formatDateLocal(last3Days));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: Last 10 days
   */
  setDateRangeLast10Days(): void {
    const today = new Date();
    const last10Days = new Date(today);
    last10Days.setDate(today.getDate() - 10);
    this.filterDateFrom.set(this.formatDateLocal(last10Days));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: Last 7 days
   */
  setDateRangeLast7Days(): void {
    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    this.filterDateFrom.set(this.formatDateLocal(last7Days));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: Last 30 days
   */
  setDateRangeLast30Days(): void {
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    this.filterDateFrom.set(this.formatDateLocal(last30Days));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: This month
   */
  setDateRangeThisMonth(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.filterDateFrom.set(this.formatDateLocal(firstDay));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: Last month
   */
  setDateRangeLastMonth(): void {
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    this.filterDateFrom.set(this.formatDateLocal(firstDayLastMonth));
    this.filterDateTo.set(this.formatDateLocal(lastDayLastMonth));
  }

  /**
   * Set date range preset: Last 3 months
   */
  setDateRangeLast3Months(): void {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    this.filterDateFrom.set(this.formatDateLocal(threeMonthsAgo));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: Last 6 months
   */
  setDateRangeLast6Months(): void {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    this.filterDateFrom.set(this.formatDateLocal(sixMonthsAgo));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: This year
   */
  setDateRangeThisYear(): void {
    const today = new Date();
    const firstDayYear = new Date(today.getFullYear(), 0, 1);
    this.filterDateFrom.set(this.formatDateLocal(firstDayYear));
    this.filterDateTo.set(this.formatDateLocal(today));
  }

  /**
   * Set date range preset: Last year
   */
  setDateRangeLastYear(): void {
    const today = new Date();
    const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
    this.filterDateFrom.set(this.formatDateLocal(firstDayLastYear));
    this.filterDateTo.set(this.formatDateLocal(lastDayLastYear));
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
    const todayStr = this.formatDateLocal(today);
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
    const yesterdayStr = this.formatDateLocal(yesterday);
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
    return this.filterDateFrom() === this.formatDateLocal(last7Days) &&
           this.filterDateTo() === this.formatDateLocal(today);
  }

  /**
   * Check if last 30 days filter is active
   */
  isLast30DaysActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    return this.filterDateFrom() === this.formatDateLocal(last30Days) &&
           this.filterDateTo() === this.formatDateLocal(today);
  }

  /**
   * Check if current month filter is active
   */
  isCurrentMonthActive(): boolean {
    if (!this.filterDateFrom() || !this.filterDateTo()) return false;
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return this.filterDateFrom() === this.formatDateLocal(firstDay) &&
           this.filterDateTo() === this.formatDateLocal(today);
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

  // ============ BUDGET METHODS ============

  /**
   * Get selected month name for budget display
   */
  getCurrentMonthName(): string {
    const year = this.reportYear();
    const month = this.reportMonth();

    if (month === null) {
      return `năm ${year}`;
    }

    return `${month}/${year}`;
  }

  /**
   * Get category budget value for editing
   */
  getCategoryBudgetValue(category: string): number {
    return this.editCategoryBudgets()[category] || 0;
  }

  /**
   * Format budget display with thousand separators
   */
  formatBudgetDisplay(value: number): string {
    if (!value || value === 0) return '';
    return value.toLocaleString('vi-VN');
  }

  /**
   * Parse budget input value
   */
  parseBudgetInput(value: string): number {
    // Remove all non-digit characters (dots, commas, spaces)
    const cleaned = value.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  /**
   * Handle monthly budget input
   */
  onMonthlyBudgetInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numericValue = this.parseBudgetInput(input.value);
    this.editMonthlyBudget.set(numericValue);
    // Update display with formatted value
    input.value = this.formatBudgetDisplay(numericValue);
  }

  /**
   * Handle category budget input
   */
  onCategoryBudgetInput(category: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const numericValue = this.parseBudgetInput(input.value);
    const currentBudgets = { ...this.editCategoryBudgets() };
    currentBudgets[category] = numericValue;
    this.editCategoryBudgets.set(currentBudgets);
    // Update display with formatted value
    input.value = this.formatBudgetDisplay(numericValue);
  }

  /**
   * Handle set all value input
   */
  onSetAllValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numericValue = this.parseBudgetInput(input.value);
    this.setAllValue.set(numericValue);
    // Update display with formatted value
    input.value = this.formatBudgetDisplay(numericValue);
  }

  /**
   * Load budgets from Google Sheets
   */
  loadBudgets(forceRefresh: boolean = false): void {
    this.expenseService.getBudgets(forceRefresh).subscribe({
      next: (budgets) => {
        console.log('📊 Loaded budgets:', budgets);

        // Map budgets to editCategoryBudgets signal
        const budgetMap: { [category: string]: number } = {};
        let totalBudget = 0;

        budgets.forEach(b => {
          if (b.category && b.amount > 0) {
            budgetMap[b.category] = b.amount;
            totalBudget += b.amount;
          }
        });

        this.editCategoryBudgets.set(budgetMap);

        // If total budget was set via bottom-up, use sum of categories
        // Otherwise keep the default monthly budget
        if (totalBudget > 0) {
          this.editMonthlyBudget.set(totalBudget);
        }

        // Initialize weights from loaded budgets
        this.calculateWeightsFromBudgets();
      },
      error: (err) => {
        console.error('Failed to load budgets:', err);
        // Continue with default values
      }
    });
  }

  /**
   * Open budget settings dialog and backup current values
   */
  openBudgetSettings(): void {
    // Backup current values before opening dialog
    this.originalMonthlyBudget = this.editMonthlyBudget();
    this.originalCategoryBudgets = { ...this.editCategoryBudgets() };
    this.originalCategoryWeights = { ...this.categoryWeights() };
    this.originalBudgetMode = this.budgetMode();

    // Show dialog
    this.showBudgetSettings.set(true);
  }

  /**
   * Cancel budget settings and restore original values
   */
  cancelBudgetSettings(): void {
    // Restore original values
    this.editMonthlyBudget.set(this.originalMonthlyBudget);
    this.editCategoryBudgets.set({ ...this.originalCategoryBudgets });
    this.categoryWeights.set({ ...this.originalCategoryWeights });
    this.budgetMode.set(this.originalBudgetMode);

    // Close dialogs
    this.showBudgetSettings.set(false);
    this.showSetAllDialog.set(false);
  }

  /**
   * Save budget settings to Google Sheets
   */
  saveBudgetSettings(): void {
    // Prepare budgets array from editCategoryBudgets
    const categoryBudgets = this.editCategoryBudgets();
    const budgets = this.categories().map(category => ({
      category,
      amount: categoryBudgets[category] || 0
    }));

    // Save to Google Sheets
    this.expenseService.saveBudgets(budgets).subscribe({
      next: () => {
        this.showBudgetSettings.set(false);
        this.showSetAllDialog.set(false);
        this.showNotificationDialog('Đã lưu ngân sách thành công!', 'success');

        // Refresh the budget trend chart
        setTimeout(() => {
          this.initBudgetTrendChart();
        }, 100);
      },
      error: (err) => {
        console.error('Failed to save budgets:', err);
        this.showNotificationDialog('Lỗi khi lưu ngân sách: ' + err.message, 'error');
      }
    });
  }

  /**
   * Switch budget mode
   * Note: Does NOT auto-recalculate budgets when switching modes - preserves current values
   */
  switchBudgetMode(mode: 'topDown' | 'bottomUp'): void {
    this.budgetMode.set(mode);

    if (mode === 'topDown') {
      // Calculate weights from current category budgets (for display only)
      this.calculateWeightsFromBudgets();
    }
    // Don't auto-apply weights when switching to bottomUp - preserve current values
  }

  /**
   * Calculate weights from current category budgets
   */
  calculateWeightsFromBudgets(): void {
    const categories = this.categories();
    const budgets = this.editCategoryBudgets();
    const total = this.getTotalCategoryBudgets();
    const weights: { [category: string]: number } = {};

    if (total > 0) {
      categories.forEach(cat => {
        const budget = budgets[cat] || 0;
        weights[cat] = Math.round((budget / total) * 100);
      });
    } else {
      // Default equal weights
      const equalWeight = Math.floor(100 / categories.length);
      categories.forEach(cat => {
        weights[cat] = equalWeight;
      });
    }

    this.categoryWeights.set(weights);
  }

  /**
   * Apply weights to calculate category budgets from total
   */
  applyWeightsToBudgets(): void {
    const categories = this.categories();
    const weights = this.categoryWeights();
    const total = this.editMonthlyBudget();
    const newBudgets: { [category: string]: number } = {};

    // Ensure weights exist
    let totalWeight = 0;
    categories.forEach(cat => {
      totalWeight += weights[cat] || 0;
    });

    if (totalWeight === 0) {
      // Default equal weights
      const equalWeight = Math.floor(100 / categories.length);
      categories.forEach(cat => {
        newBudgets[cat] = Math.floor(total * equalWeight / 100);
      });
    } else {
      categories.forEach(cat => {
        const weight = weights[cat] || 0;
        newBudgets[cat] = Math.floor(total * weight / totalWeight);
      });
    }

    this.editCategoryBudgets.set(newBudgets);
  }

  /**
   * Update category weight (in topDown mode)
   */
  updateCategoryWeight(category: string, weight: number): void {
    const weights = { ...this.categoryWeights() };
    weights[category] = Math.max(0, Math.min(100, weight));
    this.categoryWeights.set(weights);

    // Recalculate budgets based on new weights
    this.applyWeightsToBudgets();
  }

  /**
   * Get category weight
   */
  getCategoryWeight(category: string): number {
    return this.categoryWeights()[category] || 0;
  }

  /**
   * Get total weight
   */
  getTotalWeight(): number {
    const weights = this.categoryWeights();
    return Object.values(weights).reduce((sum, w) => sum + w, 0);
  }

  /**
   * Normalize weights to 100%
   */
  normalizeWeights(): void {
    const categories = this.categories();
    const weights = this.categoryWeights();
    const total = this.getTotalWeight();

    if (total === 0) return;

    const normalized: { [category: string]: number } = {};
    let remaining = 100;

    categories.forEach((cat, index) => {
      if (index === categories.length - 1) {
        // Last category gets the remaining to ensure total is 100
        normalized[cat] = Math.max(0, remaining);
      } else {
        const normalizedWeight = Math.round((weights[cat] || 0) / total * 100);
        normalized[cat] = normalizedWeight;
        remaining -= normalizedWeight;
      }
    });

    this.categoryWeights.set(normalized);
    this.applyWeightsToBudgets();
    this.showNotificationDialog('Đã chuẩn hóa trọng số về 100%', 'success');
  }

  /**
   * Update total budget (in topDown mode)
   * Note: Does NOT auto-recalculate category budgets - user must click "Chia đều" to redistribute
   */
  onTotalBudgetChange(amount: number): void {
    this.editMonthlyBudget.set(amount);
    // Don't auto-apply weights - let user explicitly click "Chia đều" button
  }

  /**
   * Update category budget (in bottomUp mode) - recalculates total
   */
  onCategoryBudgetChangeBottomUp(category: string, amount: number): void {
    const currentBudgets = { ...this.editCategoryBudgets() };
    currentBudgets[category] = amount;
    this.editCategoryBudgets.set(currentBudgets);

    // Recalculate total from category budgets
    const newTotal = Object.values(currentBudgets).reduce((sum, val) => sum + val, 0);
    this.editMonthlyBudget.set(newTotal);
  }

  /**
   * Set monthly budget preset
   * Note: Does NOT auto-apply weights - user must click "Chia đều" to redistribute
   */
  setMonthlyBudgetPreset(amount: number): void {
    this.editMonthlyBudget.set(amount);
    // Don't auto-apply weights - let user explicitly click "Chia đều" button
  }

  /**
   * Distribute budget evenly across all categories
   */
  distributeBudgetEvenly(): void {
    const categories = this.categories();
    const budgetPerCategory = Math.floor(this.editMonthlyBudget() / categories.length);
    const newBudgets: { [category: string]: number } = {};
    const equalWeight = Math.floor(100 / categories.length);
    const newWeights: { [category: string]: number } = {};

    categories.forEach(cat => {
      newBudgets[cat] = budgetPerCategory;
      newWeights[cat] = equalWeight;
    });

    this.editCategoryBudgets.set(newBudgets);
    this.categoryWeights.set(newWeights);
    this.showNotificationDialog(`Đã chia đều ${this.formatCompactAmount(budgetPerCategory)} cho mỗi danh mục`, 'success');
  }

  /**
   * Clear all category budgets
   */
  clearAllCategoryBudgets(): void {
    this.editCategoryBudgets.set({});
    this.categoryWeights.set({});
  }

  /**
   * Apply set all value to all categories
   */
  applySetAllValue(): void {
    const categories = this.categories();
    const value = this.setAllValue();
    const newBudgets: { [category: string]: number } = {};

    categories.forEach(cat => {
      newBudgets[cat] = value;
    });

    this.editCategoryBudgets.set(newBudgets);

    // Update total in bottomUp mode
    if (this.budgetMode() === 'bottomUp') {
      const newTotal = value * categories.length;
      this.editMonthlyBudget.set(newTotal);
    }

    this.showSetAllDialog.set(false);
    this.showNotificationDialog(`Đã đặt ${this.formatCompactAmount(value)} cho tất cả danh mục`, 'success');
  }

  /**
   * Set category budget preset
   */
  setCategoryBudgetPreset(category: string, amount: number): void {
    const currentBudgets = { ...this.editCategoryBudgets() };
    currentBudgets[category] = amount;
    this.editCategoryBudgets.set(currentBudgets);

    // Update total in bottomUp mode
    if (this.budgetMode() === 'bottomUp') {
      const newTotal = Object.values(currentBudgets).reduce((sum, val) => sum + val, 0);
      this.editMonthlyBudget.set(newTotal);
    }
  }

  /**
   * Get total of all category budgets
   */
  getTotalCategoryBudgets(): number {
    const budgets = this.editCategoryBudgets();
    return Object.values(budgets).reduce((sum, val) => sum + val, 0);
  }

  /**
   * Initialize category weights with default values
   */
  initDefaultWeights(): void {
    const categories = this.categories();
    const weights = this.categoryWeights();

    // Only initialize if weights are empty
    if (Object.keys(weights).length === 0 && categories.length > 0) {
      const equalWeight = Math.floor(100 / categories.length);
      const newWeights: { [category: string]: number } = {};
      categories.forEach(cat => {
        newWeights[cat] = equalWeight;
      });
      this.categoryWeights.set(newWeights);
    }
  }

  /**
   * Format compact amount (e.g., 1.5M, 500K)
   */
  formatCompactAmount(amount: number): string {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + 'K';
    }
    return amount.toString();
  }

  // ========== BUDGET CATEGORY DETAIL ==========
  @ViewChild('budgetCategoryMonthlyChart') budgetCategoryMonthlyChartRef!: ElementRef<HTMLCanvasElement>;
  private budgetCategoryMonthlyChart: Chart | null = null;

  /**
   * Get selected budget category info
   */
  selectedBudgetCategoryInfo = computed(() => {
    const category = this.selectedBudgetCategory();
    if (!category) return null;

    const budgets = this.categoryBudgets();
    return budgets.find(b => b.category === category) || null;
  });

  /**
   * Get expenses for selected budget category in current month
   */
  budgetCategoryExpenses = computed(() => {
    const category = this.selectedBudgetCategory();
    if (!category) return [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.expenses()
      .filter(e => {
        const expenseDate = new Date(e.date);
        return e.category === category &&
               expenseDate.getMonth() === currentMonth &&
               expenseDate.getFullYear() === currentYear;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  /**
   * Get daily spending for selected budget category in current month
   */
  budgetCategoryDailySpending = computed(() => {
    const category = this.selectedBudgetCategory();
    if (!category) return [];

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const dailyTotals: { day: number; amount: number }[] = [];

    // Initialize all days
    for (let day = 1; day <= daysInMonth; day++) {
      dailyTotals.push({ day, amount: 0 });
    }

    // Sum expenses by day
    this.expenses()
      .filter(e => {
        const expenseDate = new Date(e.date);
        return e.category === category &&
               expenseDate.getMonth() === currentMonth &&
               expenseDate.getFullYear() === currentYear;
      })
      .forEach(e => {
        const day = new Date(e.date).getDate();
        dailyTotals[day - 1].amount += e.amount;
      });

    return dailyTotals;
  });

  /**
   * Show budget category detail dialog
   */
  showBudgetCategoryDetail(category: string): void {
    this.selectedBudgetCategory.set(category);
    this.showBudgetCategoryDetailDialog.set(true);

    // Initialize chart after dialog is shown
    setTimeout(() => {
      this.initBudgetCategoryMonthlyChart();
    }, 150);
  }

  /**
   * Hide budget category detail dialog
   */
  hideBudgetCategoryDetail(): void {
    this.showBudgetCategoryDetailDialog.set(false);
    this.selectedBudgetCategory.set('');

    // Destroy chart
    if (this.budgetCategoryMonthlyChart) {
      this.budgetCategoryMonthlyChart.destroy();
      this.budgetCategoryMonthlyChart = null;
    }
  }

  /**
   * Initialize budget category monthly chart
   */
  initBudgetCategoryMonthlyChart(): void {
    if (!this.budgetCategoryMonthlyChartRef?.nativeElement) return;

    // Destroy existing chart
    if (this.budgetCategoryMonthlyChart) {
      this.budgetCategoryMonthlyChart.destroy();
    }

    const dailyData = this.budgetCategoryDailySpending();
    const categoryInfo = this.selectedBudgetCategoryInfo();
    const now = new Date();
    const daysInMonth = dailyData.length;
    const today = now.getDate();

    // Calculate daily budget line
    const dailyBudget = categoryInfo?.budget ? categoryInfo.budget / daysInMonth : 0;

    const labels = dailyData.map(d => d.day.toString());
    const actualData = dailyData.map(d => d.amount);
    const budgetLineData = dailyData.map(() => dailyBudget);

    // Cumulative data for area chart
    let cumulative = 0;
    const cumulativeData = dailyData.map((d, index) => {
      if (index + 1 <= today) {
        cumulative += d.amount;
        return cumulative;
      }
      return null;
    });

    // Budget cumulative line
    const budgetCumulativeData = dailyData.map((_, index) => dailyBudget * (index + 1));

    const ctx = this.budgetCategoryMonthlyChartRef.nativeElement.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Chi tiêu ngày',
            data: actualData,
            backgroundColor: actualData.map((val, idx) => {
              if (idx + 1 > today) return 'rgba(200, 200, 200, 0.3)';
              return val > dailyBudget ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)';
            }),
            borderRadius: 4,
            order: 2
          },
          {
            type: 'line',
            label: 'Ngân sách ngày',
            data: budgetLineData,
            borderColor: 'rgba(139, 92, 246, 0.8)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 0,
              callback: (_, index) => {
                // Show only every 5th day
                const day = index + 1;
                if (day === 1 || day % 5 === 0 || day === daysInMonth) {
                  return day.toString();
                }
                return '';
              }
            }
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (value) => this.formatCompactAmount(value as number)
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 11 },
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => `Ngày ${items[0].label}`,
              label: (context) => {
                const value = context.raw as number;
                if (context.datasetIndex === 0) {
                  return `Chi tiêu: ${this.formatAmount(value)}`;
                }
                return `Ngân sách: ${this.formatAmount(value)}`;
              }
            }
          }
        }
      }
    };

    this.budgetCategoryMonthlyChart = new Chart(this.budgetCategoryMonthlyChartRef.nativeElement, config);
  }

  /**
   * Initialize budget trend chart
   */
  @ViewChild('budgetTrendChart') budgetTrendChartRef!: ElementRef<HTMLCanvasElement>;
  private budgetTrendChart: Chart | null = null;

  initBudgetTrendChart(): void {
    if (!this.budgetTrendChartRef?.nativeElement) return;

    // Destroy existing chart
    if (this.budgetTrendChart) {
      this.budgetTrendChart.destroy();
    }

    const year = this.reportYear();
    const month = this.reportMonth();
    const now = new Date();

    // If viewing whole year, don't show the chart
    if (month === null) return;

    const daysInMonth = new Date(year, month, 0).getDate();
    const labels: string[] = [];
    const budgetLine: number[] = [];
    const actualSpending: number[] = [];

    // Generate cumulative budget line
    const dailyBudget = this.monthlyBudget() / daysInMonth;
    let cumulativeBudget = 0;

    // Get actual daily spending for selected month
    const monthExpenses = this.currentMonthExpenses();
    const dailyTotals: { [key: number]: number } = {};

    monthExpenses.forEach(expense => {
      const day = new Date(expense.date).getDate();
      dailyTotals[day] = (dailyTotals[day] || 0) + expense.amount;
    });

    let cumulativeActual = 0;

    // Determine how many days to show actual spending
    const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
    const lastDayWithData = isCurrentMonth ? now.getDate() : daysInMonth;

    for (let day = 1; day <= daysInMonth; day++) {
      labels.push(day.toString());
      cumulativeBudget += dailyBudget;
      budgetLine.push(Math.round(cumulativeBudget));

      if (day <= lastDayWithData) {
        cumulativeActual += dailyTotals[day] || 0;
        actualSpending.push(cumulativeActual);
      }
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ngân sách dự kiến',
            data: budgetLine,
            borderColor: 'rgba(99, 102, 241, 0.5)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderDash: [5, 5],
            fill: false,
            tension: 0,
            pointRadius: 0
          },
          {
            label: 'Chi tiêu thực tế',
            data: actualSpending,
            borderColor: actualSpending[actualSpending.length - 1] > budgetLine[actualSpending.length - 1]
              ? 'rgba(239, 68, 68, 1)'
              : 'rgba(16, 185, 129, 1)',
            backgroundColor: actualSpending[actualSpending.length - 1] > budgetLine[actualSpending.length - 1]
              ? 'rgba(239, 68, 68, 0.1)'
              : 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return context.dataset.label + ': ' + this.formatAmount(context.parsed.y || 0);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => this.formatCompactAmount(value as number)
            }
          },
          x: {
            title: {
              display: true,
              text: 'Ngày trong tháng'
            }
          }
        }
      }
    };

    this.budgetTrendChart = new Chart(this.budgetTrendChartRef.nativeElement, config);
  }

  // ============ INSIGHT CHARTS ============
  @ViewChild('categoryPieChart') categoryPieChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('dailyTrendChart') dailyTrendChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weekdayChart') weekdayChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyCompareChart') monthlyCompareChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthDailyCompareChart') monthDailyCompareChartRef!: ElementRef<HTMLCanvasElement>;

  private categoryPieChart: Chart | null = null;
  private dailyTrendChart: Chart | null = null;
  private weekdayChart: Chart | null = null;
  private monthlyCompareChart: Chart | null = null;
  private monthDailyCompareChart: Chart | null = null;

  private insightChartColors = [
    '#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316'
  ];

  getCategoryChartColor(index: number): string {
    return this.insightChartColors[index % this.insightChartColors.length];
  }

  getLast30DaysTotal(): number {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.filteredExpenses()
      .filter(e => new Date(e.date) >= thirtyDaysAgo)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  getLast30DaysAverage(): number {
    return this.getLast30DaysTotal() / 30;
  }

  /**
   * Get current month daily spending data
   */
  currentMonthDailyData = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyAmounts: number[] = new Array(31).fill(0);
    let total = 0;

    this.expenses()
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .forEach(e => {
        const day = new Date(e.date).getDate();
        dailyAmounts[day - 1] += e.amount;
        total += e.amount;
      });

    return { dailyAmounts, total, daysInMonth };
  });

  /**
   * Get previous month daily spending data
   */
  previousMonthDailyData = computed(() => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() - 1;

    if (month < 0) {
      month = 11;
      year--;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyAmounts: number[] = new Array(31).fill(0);
    let total = 0;

    this.expenses()
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .forEach(e => {
        const day = new Date(e.date).getDate();
        dailyAmounts[day - 1] += e.amount;
        total += e.amount;
      });

    return { dailyAmounts, total, daysInMonth };
  });

  /**
   * Get current month label for chart
   */
  getCurrentMonthLabel(): string {
    const now = new Date();
    return `Tháng ${now.getMonth() + 1}`;
  }

  /**
   * Get previous month label for chart
   */
  getPreviousMonthLabel(): string {
    const now = new Date();
    let month = now.getMonth();
    if (month === 0) {
      return 'Tháng 12';
    }
    return `Tháng ${month}`;
  }

  /**
   * Get month comparison percentage
   */
  getMonthComparisonPercentage(): string {
    const current = this.currentMonthDailyData().total;
    const previous = this.previousMonthDailyData().total;

    if (previous === 0) return '0';

    const diff = ((current - previous) / previous) * 100;
    return Math.abs(diff).toFixed(1);
  }

  initInsightCharts(): void {
    setTimeout(() => {
      this.initCategoryPieChart();
      this.initDailyTrendChart();
      this.initWeekdayChart();
      this.initMonthlyCompareChart();
      this.initMonthDailyCompareChart();
    }, 100);
  }

  private initCategoryPieChart(): void {
    if (!this.categoryPieChartRef?.nativeElement) return;

    if (this.categoryPieChart) {
      this.categoryPieChart.destroy();
    }

    const categories = this.insightsTotalByCategory().slice(0, 6);
    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.total);

    this.categoryPieChart = new Chart(this.categoryPieChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: this.insightChartColors.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const total = data.reduce((a, b) => a + b, 0);
                const percentage = ((context.raw as number) / total * 100).toFixed(1);
                return `${this.formatAmount(context.raw as number)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  private initDailyTrendChart(): void {
    if (!this.dailyTrendChartRef?.nativeElement) return;

    if (this.dailyTrendChart) {
      this.dailyTrendChart.destroy();
    }

    const expenses = this.reportPeriodExpenses();
    const year = this.reportYear();
    const month = this.reportMonth();

    const labels: string[] = [];
    const data: number[] = [];

    if (month === null) {
      // Year view: show monthly data
      for (let m = 1; m <= 12; m++) {
        labels.push(`Tháng ${m}`);
        const monthTotal = expenses
          .filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === year && d.getMonth() + 1 === m;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        data.push(monthTotal);
      }
    } else {
      // Month view: show daily data for the selected month
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(`${day}/${month}`);

        const dayTotal = expenses
          .filter(e => e.date === dateStr)
          .reduce((sum, e) => sum + e.amount, 0);
        data.push(dayTotal);
      }
    }

    const gradient = this.dailyTrendChartRef.nativeElement.getContext('2d')!.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    this.dailyTrendChart = new Chart(this.dailyTrendChartRef.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#8b5cf6',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#8b5cf6',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 0,
              maxTicksLimit: 10
            }
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (value) => this.formatCompactAmount(value as number)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: (context) => this.formatAmount(context.raw as number)
            }
          }
        }
      }
    });
  }

  private initWeekdayChart(): void {
    if (!this.weekdayChartRef?.nativeElement) return;

    if (this.weekdayChart) {
      this.weekdayChart.destroy();
    }

    const weekdays = this.insightsWeekdaySpending();
    const labels = weekdays.map(d => d.shortName);
    const data = weekdays.map(d => d.average);
    const maxVal = Math.max(...data);

    this.weekdayChart = new Chart(this.weekdayChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map(v => v === maxVal ? '#f43f5e' : '#06b6d4'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 500 } }
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (value) => this.formatCompactAmount(value as number)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: (context) => `TB: ${this.formatAmount(context.raw as number)}`
            }
          }
        }
      }
    });
  }

  private initMonthlyCompareChart(): void {
    if (!this.monthlyCompareChartRef?.nativeElement) return;

    if (this.monthlyCompareChart) {
      this.monthlyCompareChart.destroy();
    }

    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('vi-VN', { month: 'short' });
      labels.push(monthName);

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthTotal = this.filteredExpenses()
        .filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      data.push(monthTotal);
    }

    const maxVal = Math.max(...data);

    this.monthlyCompareChart = new Chart(this.monthlyCompareChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map((v, i) => i === data.length - 1 ? '#10b981' : (v === maxVal ? '#f43f5e' : '#8b5cf6')),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 500 } }
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (value) => this.formatCompactAmount(value as number)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: (context) => this.formatAmount(context.raw as number)
            }
          }
        }
      }
    });
  }

  private initMonthDailyCompareChart(): void {
    if (!this.monthDailyCompareChartRef?.nativeElement) return;

    if (this.monthDailyCompareChart) {
      this.monthDailyCompareChart.destroy();
    }

    const currentData = this.currentMonthDailyData();
    const previousData = this.previousMonthDailyData();
    const now = new Date();
    const today = now.getDate();

    // Create labels for days 1-31
    const labels = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

    // Current month data (only up to today)
    const currentMonthData = currentData.dailyAmounts.map((val, idx) => {
      if (idx + 1 <= today) return val;
      return null; // Future days show as null
    });

    // Previous month data (all days)
    const previousMonthData = previousData.dailyAmounts;

    // Calculate cumulative data
    let currentCumulative = 0;
    const currentCumulativeData = currentData.dailyAmounts.map((val, idx) => {
      if (idx + 1 <= today) {
        currentCumulative += val;
        return currentCumulative;
      }
      return null;
    });

    let previousCumulative = 0;
    const previousCumulativeData = previousData.dailyAmounts.map(val => {
      previousCumulative += val;
      return previousCumulative;
    });

    const ctx = this.monthDailyCompareChartRef.nativeElement.getContext('2d')!;

    // Gradient for current month
    const currentGradient = ctx.createLinearGradient(0, 0, 0, 300);
    currentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    currentGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    // Gradient for previous month
    const previousGradient = ctx.createLinearGradient(0, 0, 0, 300);
    previousGradient.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
    previousGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    this.monthDailyCompareChart = new Chart(this.monthDailyCompareChartRef.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.getCurrentMonthLabel(),
            data: currentCumulativeData,
            borderColor: '#10b981',
            backgroundColor: currentGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointRadius: currentCumulativeData.map((_, idx) => idx + 1 === today ? 6 : 0),
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: this.getPreviousMonthLabel(),
            data: previousCumulativeData,
            borderColor: '#8b5cf6',
            backgroundColor: previousGradient,
            borderWidth: 2,
            borderDash: [5, 5],
            fill: true,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 0,
              callback: (_, index) => {
                // Show only every 5th day and first/last
                const day = index + 1;
                if (day === 1 || day % 5 === 0 || day === 31) {
                  return day.toString();
                }
                return '';
              }
            }
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (value) => this.formatCompactAmount(value as number)
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 12 },
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 14,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => `Ngày ${items[0].label}`,
              label: (context) => {
                const value = context.raw as number;
                if (value === null) return '';
                return `${context.dataset.label}: ${this.formatAmount(value)} (lũy kế)`;
              },
              afterBody: (items) => {
                const dayIndex = items[0].dataIndex;
                const currentDay = currentData.dailyAmounts[dayIndex];
                const previousDay = previousData.dailyAmounts[dayIndex];

                const lines = [];
                if (dayIndex + 1 <= today && currentDay > 0) {
                  lines.push(`Chi trong ngày (${this.getCurrentMonthLabel()}): ${this.formatAmount(currentDay)}`);
                }
                if (previousDay > 0) {
                  lines.push(`Chi trong ngày (${this.getPreviousMonthLabel()}): ${this.formatAmount(previousDay)}`);
                }
                return lines.length > 0 ? ['\n' + lines.join('\n')] : [];
              }
            }
          }
        }
      }
    });
  }
}

