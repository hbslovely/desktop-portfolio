import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessService, BusinessItem, SheetName } from '../../../services/business.service';

@Component({
  selector: 'app-business-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './business-app.component.html',
  styleUrl: './business-app.component.scss'
})
export class BusinessAppComponent implements OnInit, OnDestroy {
  // Active sheet tab
  activeSheet = signal<SheetName>('Menu');
  
  // Data for current sheet
  items = signal<BusinessItem[]>([]);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Add/Edit form
  showAddForm = signal<boolean>(false);
  showEditForm = signal<boolean>(false);
  editingItem = signal<BusinessItem | null>(null);
  
  newItem: BusinessItem = {};
  editItem: BusinessItem = {};

  // Notification
  showNotification = signal<boolean>(false);
  notificationMessage = signal<string>('');
  notificationType = signal<'success' | 'error'>('success');

  // Available sheets
  sheets: SheetName[] = ['Menu', 'Nguồn nguyên liệu', 'Nguồn vật liệu', 'Đầu vào đầu ra'];

  // Authentication
  isAuthenticated = signal<boolean>(false);
  password = signal<string>('');
  passwordError = signal<string>('');

  // Search and Filter for Nguồn nguyên liệu
  searchQuery = signal<string>('');
  selectedBrands = signal<string[]>([]);
  maxGiaCot = signal<string>('');
  sortBy = signal<'giaCot-asc' | 'giaCot-desc' | 'monHang-asc' | 'monHang-desc' | ''>('');
  
  // Available brands for filter
  availableBrands = computed(() => {
    if (!this.isIngredientSheet()) return [];
    const brands = new Set<string>();
    this.items().forEach(item => {
      if (item.thuongHieuNguyenLieu?.trim()) {
        brands.add(item.thuongHieuNguyenLieu.trim());
      }
    });
    return Array.from(brands).sort();
  });

  // Filtered and sorted items for Nguồn nguyên liệu
  filteredItems = computed(() => {
    let result = [...this.items()];

    // Apply search filter (only for Nguồn nguyên liệu)
    if (this.isIngredientSheet() && this.searchQuery().trim()) {
      const query = this.normalizeVietnamese(this.searchQuery().trim().toLowerCase());
      result = result.filter(item => {
        const monHang = this.normalizeVietnamese((item.monHangNguyenLieu || '').toLowerCase());
        return monHang.includes(query);
      });
    }

    // Apply brand filter
    if (this.isIngredientSheet() && this.selectedBrands().length > 0) {
      result = result.filter(item => {
        return this.selectedBrands().includes(item.thuongHieuNguyenLieu || '');
      });
    }

    // Apply max gia cot filter
    if (this.isIngredientSheet() && this.maxGiaCot().trim()) {
      const maxGia = this.businessService.parseAmount(this.maxGiaCot());
      result = result.filter(item => {
        const giaCot = this.businessService.parseAmount(item.giaCot || '0');
        return giaCot <= maxGia;
      });
    }

    // Apply sorting
    if (this.isIngredientSheet() && this.sortBy()) {
      result.sort((a, b) => {
        if (this.sortBy() === 'giaCot-asc') {
          const giaA = this.businessService.parseAmount(a.giaCot || '0');
          const giaB = this.businessService.parseAmount(b.giaCot || '0');
          return giaA - giaB;
        } else if (this.sortBy() === 'giaCot-desc') {
          const giaA = this.businessService.parseAmount(a.giaCot || '0');
          const giaB = this.businessService.parseAmount(b.giaCot || '0');
          return giaB - giaA;
        } else if (this.sortBy() === 'monHang-asc') {
          return (a.monHangNguyenLieu || '').localeCompare(b.monHangNguyenLieu || '', 'vi');
        } else if (this.sortBy() === 'monHang-desc') {
          return (b.monHangNguyenLieu || '').localeCompare(a.monHangNguyenLieu || '', 'vi');
        }
        return 0;
      });
    }

    return result;
  });

  // For Đầu vào đầu ra: separate tabs
  incomeExpenseTab = signal<'all' | 'income' | 'expense'>('all');

  // Filtered items for Đầu vào đầu ra based on tab
  filteredIncomeExpenseItems = computed(() => {
    if (!this.isIncomeExpenseSheet()) return this.items();
    
    const tab = this.incomeExpenseTab();
    if (tab === 'all') return this.items();
    
    return this.items().filter(item => {
      const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
      if (tab === 'income') return amount > 0;
      if (tab === 'expense') return amount < 0;
      return true;
    });
  });

  // Global search
  globalSearchQuery = signal<string>('');
  showGlobalSearch = signal<boolean>(false);
  globalSearchResults = signal<{ sheet: SheetName; items: BusinessItem[] }[]>([]);
  allSheetsData = signal<{ [key in SheetName]?: BusinessItem[] }>({});

  // Report dialog
  showReportDialog = signal<boolean>(false);
  reportType = signal<'income-expense' | 'ingredient' | 'material' | 'menu' | null>(null);

  // Computed report data
  reportData = computed(() => {
    const sheet = this.activeSheet();
    const allItems = this.items();

    if (sheet === 'Đầu vào đầu ra') {
      const incomeItems = allItems.filter(item => {
        const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
        return amount > 0;
      });
      const expenseItems = allItems.filter(item => {
        const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
        return amount < 0;
      });

      // Group by platform (Sàn)
      const incomeByPlatform = new Map<string, number>();
      incomeItems.forEach(item => {
        const platform = item.san || 'Khác';
        const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
        incomeByPlatform.set(platform, (incomeByPlatform.get(platform) || 0) + amount);
      });

      // Group by category (Phân loại)
      const expenseByCategory = new Map<string, number>();
      expenseItems.forEach(item => {
        const category = item.phanLoai || 'Khác';
        const amount = Math.abs(this.businessService.parseAmountWithSign(item.soTien || '0'));
        expenseByCategory.set(category, (expenseByCategory.get(category) || 0) + amount);
      });

      return {
        type: 'income-expense' as const,
        totalIncome: this.totalThuVao(),
        totalExpense: this.totalChiRa(),
        netAmount: this.totalChiPhi(),
        incomeByPlatform: Array.from(incomeByPlatform.entries()).map(([platform, amount]) => ({
          platform,
          amount
        })),
        expenseByCategory: Array.from(expenseByCategory.entries()).map(([category, amount]) => ({
          category,
          amount
        })),
        incomeCount: incomeItems.length,
        expenseCount: expenseItems.length
      };
    } else if (sheet === 'Nguồn nguyên liệu') {
      // Group by brand
      const byBrand = new Map<string, { count: number; totalGiaGoc: number; avgGiaCot: number }>();
      allItems.forEach(item => {
        const brand = item.thuongHieuNguyenLieu || 'Khác';
        const giaGoc = this.businessService.parseAmount(item.giaGoc || '0');
        const giaCot = this.businessService.parseAmount(item.giaCot || '0');
        
        const existing = byBrand.get(brand) || { count: 0, totalGiaGoc: 0, avgGiaCot: 0 };
        existing.count += 1;
        existing.totalGiaGoc += giaGoc;
        existing.avgGiaCot = (existing.avgGiaCot * (existing.count - 1) + giaCot) / existing.count;
        byBrand.set(brand, existing);
      });

      return {
        type: 'ingredient' as const,
        totalItems: allItems.length,
        byBrand: Array.from(byBrand.entries()).map(([brand, data]) => ({
          brand,
          count: data.count,
          totalGiaGoc: data.totalGiaGoc,
          avgGiaCot: data.avgGiaCot
        }))
      };
    } else if (sheet === 'Nguồn vật liệu') {
      // Group by brand
      const byBrand = new Map<string, { count: number; totalGiaTien: number }>();
      allItems.forEach(item => {
        const brand = item.thuongHieu || 'Khác';
        const giaTien = this.businessService.parseAmount(item.giaTien || '0');
        
        const existing = byBrand.get(brand) || { count: 0, totalGiaTien: 0 };
        existing.count += 1;
        existing.totalGiaTien += giaTien;
        byBrand.set(brand, existing);
      });

      return {
        type: 'material' as const,
        totalItems: allItems.length,
        totalGiaTien: this.totalChiPhi(),
        byBrand: Array.from(byBrand.entries()).map(([brand, data]) => ({
          brand,
          count: data.count,
          totalGiaTien: data.totalGiaTien
        }))
      };
    } else if (sheet === 'Menu') {
      // Group by category
      const byCategory = new Map<string, { count: number; totalGiaBan: number }>();
      allItems.forEach(item => {
        const category = item.danhMuc || 'Khác';
        const giaBan = this.businessService.parseAmount(item.giaBan || '0');
        
        const existing = byCategory.get(category) || { count: 0, totalGiaBan: 0 };
        existing.count += 1;
        existing.totalGiaBan += giaBan;
        byCategory.set(category, existing);
      });

      return {
        type: 'menu' as const,
        totalItems: allItems.length,
        totalGiaBan: this.totalChiPhi(),
        byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
          category,
          count: data.count,
          totalGiaBan: data.totalGiaBan
        }))
      };
    }

    return null;
  });

  // Computed totals
  totalChiPhi = computed(() => {
    const sheet = this.activeSheet();
    if (sheet === 'Đầu vào đầu ra') {
      return this.items().reduce((sum, item) => {
        const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
        return sum + amount;
      }, 0);
    } else if (sheet === 'Nguồn vật liệu') {
      return this.items().reduce((sum, item) => {
        return sum + this.businessService.parseAmount(item.giaTien || '0');
      }, 0);
    } else if (sheet === 'Menu') {
      return this.items().reduce((sum, item) => {
        return sum + this.businessService.parseAmount(item.giaBan || '0');
      }, 0);
    }
    return 0;
  });

  totalTong = computed(() => {
    // Only used for non-income-expense sheets
    if (this.isIncomeExpenseSheet()) return 0;
    return this.items().reduce((sum, item) => {
      return sum + this.businessService.parseAmount(item.tongChiPhi || '0');
    }, 0);
  });

  // For "Đầu vào đầu ra" tab: separate income and expense
  totalThuVao = computed(() => {
    if (!this.isIncomeExpenseSheet()) return 0;
    return this.items().reduce((sum, item) => {
      const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
      return amount > 0 ? sum + amount : sum;
    }, 0);
  });

  totalChiRa = computed(() => {
    if (!this.isIncomeExpenseSheet()) return 0;
    return this.items().reduce((sum, item) => {
      const amount = this.businessService.parseAmountWithSign(item.soTien || '0');
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
  });

  // Check sheet types
  isIncomeExpenseSheet = computed(() => {
    return this.activeSheet() === 'Đầu vào đầu ra';
  });

  isMaterialSheet = computed(() => {
    return this.activeSheet() === 'Nguồn vật liệu';
  });

  isIngredientSheet = computed(() => {
    return this.activeSheet() === 'Nguồn nguyên liệu';
  });

  isMenuSheet = computed(() => {
    return this.activeSheet() === 'Menu';
  });

  constructor(private businessService: BusinessService) {}

  ngOnInit(): void {
    // Check if already authenticated and still valid (same day)
    if (this.businessService.isAuthenticationValid()) {
      this.isAuthenticated.set(true);
      this.loadItems();
      // Load all sheets data for global search
      this.loadAllSheetsData();
    } else {
      // Clear invalid authentication
      sessionStorage.removeItem('business_app_auth_hash');
      this.isAuthenticated.set(false);
    }
  }

  /**
   * Load all sheets data for global search
   */
  loadAllSheetsData(): void {
    this.sheets.forEach(sheet => {
      this.businessService.getItems(sheet, false).subscribe({
        next: (data) => {
          this.allSheetsData.update(current => ({
            ...current,
            [sheet]: data
          }));
        },
        error: (err) => {
          console.error(`Error loading ${sheet}:`, err);
        }
      });
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Switch to different sheet
   */
  switchSheet(sheetName: SheetName): void {
    this.activeSheet.set(sheetName);
    // Reset filters when switching sheets
    this.searchQuery.set('');
    this.selectedBrands.set([]);
    this.maxGiaCot.set('');
    this.sortBy.set('');
    this.incomeExpenseTab.set('all');
    this.loadItems();
    // Reload all sheets data for global search
    this.loadAllSheetsData();
  }

  /**
   * Normalize Vietnamese text (remove diacritics for search)
   */
  normalizeVietnamese(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Get sheet icon for display
   */
  getSheetIcon(sheet: SheetName): string {
    switch (sheet) {
      case 'Menu':
        return 'pi-list';
      case 'Nguồn nguyên liệu':
        return 'pi-box';
      case 'Nguồn vật liệu':
        return 'pi-shopping-bag';
      case 'Đầu vào đầu ra':
        return 'pi-chart-line';
      default:
        return 'pi-file';
    }
  }

  /**
   * Toggle brand filter
   */
  toggleBrand(brand: string): void {
    const brands = this.selectedBrands();
    if (brands.includes(brand)) {
      this.selectedBrands.set(brands.filter(b => b !== brand));
    } else {
      this.selectedBrands.set([...brands, brand]);
    }
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedBrands.set([]);
    this.maxGiaCot.set('');
    this.sortBy.set('');
  }

  /**
   * Switch income/expense tab
   */
  switchIncomeExpenseTab(tab: 'all' | 'income' | 'expense'): void {
    this.incomeExpenseTab.set(tab);
  }

  /**
   * Toggle global search
   */
  toggleGlobalSearch(): void {
    this.showGlobalSearch.set(!this.showGlobalSearch());
    if (!this.showGlobalSearch()) {
      this.globalSearchQuery.set('');
    }
  }

  /**
   * Load items from current sheet
   */
  loadItems(forceRefresh: boolean = false): void {
    if (this.isLoading() && !forceRefresh) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.businessService.getItems(this.activeSheet(), forceRefresh).subscribe({
      next: (data) => {
        this.items.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.error.set(`Không thể tải dữ liệu từ ${this.activeSheet()}. Vui lòng kiểm tra quyền truy cập Google Sheets.`);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Show add item form
   */
  showAddItemForm(): void {
    this.newItem = this.createEmptyItem();
    this.showAddForm.set(true);
  }

  /**
   * Hide add item form
   */
  hideAddItemForm(): void {
    this.showAddForm.set(false);
    this.newItem = {};
  }

  /**
   * Show edit item form
   */
  showEditItemForm(item: BusinessItem): void {
    this.editItem = { ...item };
    this.editingItem.set(item);
    this.showEditForm.set(true);
  }

  /**
   * Hide edit item form
   */
  hideEditItemForm(): void {
    this.showEditForm.set(false);
    this.editingItem.set(null);
    this.editItem = {};
  }

  /**
   * Create empty item based on current sheet type
   */
  createEmptyItem(): BusinessItem {
    const sheet = this.activeSheet();
    
    if (sheet === 'Đầu vào đầu ra') {
      return {
        tenChiPhi: '',
        soTien: '',
        tongChiPhi: '',
        phanLoai: '',
        san: ''
      };
    } else if (sheet === 'Nguồn vật liệu') {
      return {
        monHang: '',
        giaTien: '',
        khoiLuong: '',
        thuongHieu: ''
      };
    } else if (sheet === 'Nguồn nguyên liệu') {
      return {
        soThuTu: '',
        monHangNguyenLieu: '',
        giaGoc: '',
        donViTinh: '',
        thuongHieuNguyenLieu: '',
        soLuongVien: ''
      };
    } else if (sheet === 'Menu') {
      return {
        tenMon: '',
        moTa: '',
        danhMuc: '',
        giaBan: '',
        cachCheBien: ''
      };
    }
    
    return {};
  }

  /**
   * Add new item
   */
  addItem(): void {
    // Validate based on sheet type
    const sheet = this.activeSheet();
    let isValid = false;
    let errorMessage = '';

    if (sheet === 'Đầu vào đầu ra') {
      isValid = !!(this.newItem.tenChiPhi?.trim());
      errorMessage = 'Vui lòng nhập tên chi phí';
    } else if (sheet === 'Nguồn vật liệu') {
      isValid = !!(this.newItem.monHang?.trim());
      errorMessage = 'Vui lòng nhập món hàng';
    } else if (sheet === 'Nguồn nguyên liệu') {
      isValid = !!(this.newItem.monHangNguyenLieu?.trim());
      errorMessage = 'Vui lòng nhập món hàng';
    } else if (sheet === 'Menu') {
      isValid = !!(this.newItem.tenMon?.trim());
      errorMessage = 'Vui lòng nhập tên món';
    }

    if (!isValid) {
      this.showNotificationDialog(errorMessage, 'error');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.businessService.addItem(this.activeSheet(), this.newItem).subscribe({
      next: () => {
        this.loadItems(true);
        this.loadAllSheetsData(); // Reload for global search
        this.hideAddItemForm();
        this.isLoading.set(false);
        this.showNotificationDialog('Thêm dữ liệu thành công!', 'success');
      },
      error: (err) => {
        console.error('Error adding item:', err);
        this.isLoading.set(false);
        this.showNotificationDialog('Lỗi: Không thể thêm dữ liệu. Vui lòng kiểm tra kết nối hoặc quyền truy cập Google Sheets.', 'error');
      }
    });
  }

  /**
   * Update item
   */
  updateItem(): void {
    // Validate based on sheet type
    const sheet = this.activeSheet();
    let isValid = false;
    let errorMessage = '';

    if (sheet === 'Đầu vào đầu ra') {
      isValid = !!(this.editItem.tenChiPhi?.trim());
      errorMessage = 'Vui lòng nhập tên chi phí';
    } else if (sheet === 'Nguồn vật liệu') {
      isValid = !!(this.editItem.monHang?.trim());
      errorMessage = 'Vui lòng nhập món hàng';
    } else if (sheet === 'Nguồn nguyên liệu') {
      isValid = !!(this.editItem.monHangNguyenLieu?.trim());
      errorMessage = 'Vui lòng nhập món hàng';
    } else if (sheet === 'Menu') {
      isValid = !!(this.editItem.tenMon?.trim());
      errorMessage = 'Vui lòng nhập tên món';
    }

    if (!isValid) {
      this.showNotificationDialog(errorMessage, 'error');
      return;
    }

    const item = this.editingItem();
    if (!item || !item.rowIndex) {
      this.showNotificationDialog('Không tìm thấy dữ liệu cần cập nhật', 'error');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.businessService.updateItem(this.activeSheet(), this.editItem, item.rowIndex).subscribe({
      next: () => {
        this.loadItems(true);
        this.loadAllSheetsData(); // Reload for global search
        this.hideEditItemForm();
        this.isLoading.set(false);
        this.showNotificationDialog('Cập nhật dữ liệu thành công!', 'success');
      },
      error: (err) => {
        console.error('Error updating item:', err);
        this.isLoading.set(false);
        this.showNotificationDialog('Lỗi: Không thể cập nhật dữ liệu. Vui lòng kiểm tra kết nối hoặc quyền truy cập Google Sheets.', 'error');
      }
    });
  }

  /**
   * Delete item
   */
  deleteItem(item: BusinessItem): void {
    if (!item.rowIndex) {
      this.showNotificationDialog('Không tìm thấy dữ liệu cần xóa', 'error');
      return;
    }

    // Get item name based on sheet type
    const sheet = this.activeSheet();
    let itemName = '';
    if (sheet === 'Đầu vào đầu ra') {
      itemName = item.tenChiPhi || '';
    } else if (sheet === 'Nguồn vật liệu') {
      itemName = item.monHang || '';
    } else if (sheet === 'Nguồn nguyên liệu') {
      itemName = item.monHangNguyenLieu || '';
    } else if (sheet === 'Menu') {
      itemName = item.tenMon || '';
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa "${itemName}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.businessService.deleteItem(this.activeSheet(), item.rowIndex).subscribe({
      next: () => {
        this.loadItems(true);
        this.loadAllSheetsData(); // Reload for global search
        this.isLoading.set(false);
        this.showNotificationDialog('Xóa dữ liệu thành công!', 'success');
      },
      error: (err) => {
        console.error('Error deleting item:', err);
        this.isLoading.set(false);
        this.showNotificationDialog('Lỗi: Không thể xóa dữ liệu. Vui lòng kiểm tra kết nối hoặc quyền truy cập Google Sheets.', 'error');
      }
    });
  }

  /**
   * Show notification dialog
   */
  showNotificationDialog(message: string, type: 'success' | 'error' = 'success'): void {
    this.notificationMessage.set(message);
    this.notificationType.set(type);
    this.showNotification.set(true);

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
   * Format amount for display
   */
  formatAmount(amount: number): string {
    return this.businessService.formatAmount(amount);
  }

  /**
   * Check if amount is negative
   */
  isNegativeAmount(amountStr: string): boolean {
    if (!amountStr) return false;
    const amount = this.businessService.parseAmountWithSign(amountStr);
    return amount < 0;
  }

  /**
   * Get sheet display name
   */
  getSheetDisplayName(sheetName: SheetName): string {
    return sheetName;
  }

  /**
   * Get icon for sheet
   */
  getSheetIcon(sheetName: SheetName): string {
    const icons: { [key in SheetName]: string } = {
      'Menu': 'pi-list',
      'Nguồn nguyên liệu': 'pi-box',
      'Nguồn vật liệu': 'pi-cube',
      'Đầu vào đầu ra': 'pi-chart-line'
    };
    return icons[sheetName] || 'pi-file';
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

    if (this.businessService.verifyPassword(inputPassword)) {
      this.isAuthenticated.set(true);
      this.passwordError.set('');
      this.password.set('');

      // Store hashed password in sessionStorage (expires next day)
      const hashedPassword = this.businessService.getTodayHashedPassword();
      sessionStorage.setItem('business_app_auth_hash', hashedPassword);

      this.loadItems();
    } else {
      this.passwordError.set('Mật khẩu không đúng');
      this.password.set('');
    }
  }

  /**
   * Logout
   */
  logout(): void {
    this.isAuthenticated.set(false);
    this.password.set('');
    this.passwordError.set('');

    // Clear authentication
    sessionStorage.removeItem('business_app_auth_hash');
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
   * Perform global search
   */
  performGlobalSearch(): void {
    const query = this.globalSearchQuery().trim().toLowerCase();
    
    if (!query) {
      this.globalSearchResults.set([]);
      return;
    }

    const normalizedQuery = this.normalizeVietnamese(query);
    const results: { sheet: SheetName; items: BusinessItem[] }[] = [];
    const allData = this.allSheetsData();

    // Search in each sheet
    this.sheets.forEach(sheet => {
      const items = allData[sheet] || [];
      const matchedItems: BusinessItem[] = [];

      items.forEach(item => {
        let match = false;
        let searchText = '';

        if (sheet === 'Menu') {
          searchText = `${item.tenMon || ''} ${item.moTa || ''} ${item.danhMuc || ''} ${item.giaBan || ''} ${item.cachCheBien || ''}`;
        } else if (sheet === 'Nguồn nguyên liệu') {
          searchText = `${item.monHangNguyenLieu || ''} ${item.thuongHieuNguyenLieu || ''} ${item.donViTinh || ''} ${item.giaGoc || ''} ${item.giaCot || ''}`;
        } else if (sheet === 'Nguồn vật liệu') {
          searchText = `${item.monHang || ''} ${item.thuongHieu || ''} ${item.giaTien || ''} ${item.khoiLuong || ''}`;
        } else if (sheet === 'Đầu vào đầu ra') {
          searchText = `${item.tenChiPhi || ''} ${item.phanLoai || ''} ${item.san || ''} ${item.soTien || ''}`;
        }

        const normalizedText = this.normalizeVietnamese(searchText.toLowerCase());
        if (normalizedText.includes(normalizedQuery)) {
          match = true;
        }

        if (match) {
          matchedItems.push(item);
        }
      });

      if (matchedItems.length > 0) {
        results.push({
          sheet: sheet,
          items: matchedItems
        });
      }
    });

    this.globalSearchResults.set(results);
  }

  /**
   * Navigate to item from global search
   */
  navigateToSearchResult(sheet: SheetName, item: BusinessItem): void {
    this.showGlobalSearch.set(false);
    this.globalSearchQuery.set('');
    this.globalSearchResults.set([]);
    this.switchSheet(sheet);
    
    // Scroll to item after a short delay
    setTimeout(() => {
      // Could implement scroll to item if needed
      if (item.rowIndex) {
        console.log('Navigate to item at row:', item.rowIndex);
      }
    }, 100);
  }

  /**
   * Show report dialog
   */
  showReport(): void {
    const sheet = this.activeSheet();
    if (sheet === 'Đầu vào đầu ra') {
      this.reportType.set('income-expense');
    } else if (sheet === 'Nguồn nguyên liệu') {
      this.reportType.set('ingredient');
    } else if (sheet === 'Nguồn vật liệu') {
      this.reportType.set('material');
    } else if (sheet === 'Menu') {
      this.reportType.set('menu');
    }
    this.showReportDialog.set(true);
  }

  /**
   * Hide report dialog
   */
  hideReport(): void {
    this.showReportDialog.set(false);
    this.reportType.set(null);
  }

  /**
   * Helper methods for report data access
   */
  getReportTotalIncome(): number {
    const data = this.reportData();
    return (data as any)?.totalIncome || 0;
  }

  getReportTotalExpense(): number {
    const data = this.reportData();
    return (data as any)?.totalExpense || 0;
  }

  getReportNetAmount(): number {
    const data = this.reportData();
    return (data as any)?.netAmount || 0;
  }

  getReportIncomeCount(): number {
    const data = this.reportData();
    return (data as any)?.incomeCount || 0;
  }

  getReportExpenseCount(): number {
    const data = this.reportData();
    return (data as any)?.expenseCount || 0;
  }

  getReportIncomeByPlatform(): any[] {
    const data = this.reportData();
    return (data as any)?.incomeByPlatform || [];
  }

  getReportExpenseByCategory(): any[] {
    const data = this.reportData();
    return (data as any)?.expenseByCategory || [];
  }

  getReportTotalItems(): number {
    const data = this.reportData();
    return (data as any)?.totalItems || 0;
  }

  getReportTotalGiaTien(): number {
    const data = this.reportData();
    return (data as any)?.totalGiaTien || 0;
  }

  getReportTotalGiaBan(): number {
    const data = this.reportData();
    return (data as any)?.totalGiaBan || 0;
  }

  getReportByBrand(): any[] {
    const data = this.reportData();
    return (data as any)?.byBrand || [];
  }

  getReportByCategory(): any[] {
    const data = this.reportData();
    return (data as any)?.byCategory || [];
  }
}

