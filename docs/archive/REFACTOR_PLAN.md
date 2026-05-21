# Kế hoạch Refactor - Lazy Loading Applications

## 📋 Tổng quan

Dự án hiện tại có **30+ ứng dụng** được import trực tiếp vào `app.component.ts`, dẫn đến:
- Bundle size ban đầu rất lớn (có thể > 5MB)
- Thời gian load ban đầu chậm
- Tất cả code được execute ngay cả khi không sử dụng

**Mục tiêu**: Chỉ load code của ứng dụng khi người dùng thực sự mở ứng dụng đó.

---

## 🎯 Mục tiêu

1. **Giảm bundle size ban đầu**: Từ ~5MB+ xuống < 1MB
2. **Cải thiện thời gian load**: Từ 3-5s xuống < 1s
3. **Lazy load từng app**: Chỉ load khi user click vào icon
4. **Giữ nguyên UX**: Không thay đổi trải nghiệm người dùng

---

## 📊 Phân tích hiện trạng

### Cấu trúc hiện tại

```
src/app/
├── app.component.ts          # Import tất cả 30+ components
├── components/
│   └── apps/
│       ├── calculator/
│       ├── expense-app/      # ~2500 lines (rất nặng)
│       ├── business-app/
│       ├── news-app/
│       └── ... (30+ apps)
└── config/
    ├── window-registry.ts    # Định nghĩa windows
    └── app-icons.config.ts   # Định nghĩa icons
```

### Vấn đề

1. **Tất cả components được import trong `app.component.ts`**:
   ```typescript
   import { CalculatorComponent } from './components/apps/calculator/calculator.component';
   import { ExpenseAppComponent } from './components/apps/expense-app/expense-app.component';
   // ... 30+ imports khác
   
   @Component({
     imports: [
       CalculatorComponent,
       ExpenseAppComponent,
       // ... 30+ components
     ]
   })
   ```

2. **Tất cả được bundle vào main.js** ngay từ đầu

3. **Các app nặng như expense-app** (~2500 lines + Chart.js) được load ngay

---

## 🚀 Giải pháp: Dynamic Component Loading

### Phương án 1: Angular Lazy Loading Routes (Khuyến nghị)

**Ưu điểm**:
- Angular hỗ trợ native lazy loading
- Code splitting tự động
- Dễ maintain và scale

**Nhược điểm**:
- Cần refactor sang routing structure
- Phức tạp hơn với window-based UI

### Phương án 2: Dynamic Import + Component Factory (Đề xuất)

**Ưu điểm**:
- Giữ nguyên window-based architecture
- Lazy load theo nhu cầu
- Không cần routing

**Nhược điểm**:
- Cần quản lý component registry
- Phức tạp hơn một chút

---

## 📝 Kế hoạch chi tiết

### Phase 1: Chuẩn bị (1-2 ngày)

#### 1.1 Tạo App Component Registry

**File mới**: `src/app/config/app-component-registry.ts`

```typescript
export interface AppComponentLoader {
  id: string;
  load: () => Promise<any>;
}

export const APP_COMPONENT_REGISTRY: Record<string, AppComponentLoader> = {
  calculator: {
    id: 'calculator',
    load: () => import('../components/apps/calculator/calculator.component')
      .then(m => m.CalculatorComponent)
  },
  expense: {
    id: 'expense',
    load: () => import('../components/apps/expense-app/expense-app.component')
      .then(m => m.ExpenseAppComponent)
  },
  // ... các app khác
};
```

#### 1.2 Tạo Dynamic Component Loader Service

**File mới**: `src/app/services/dynamic-component-loader.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class DynamicComponentLoaderService {
  private componentCache = new Map<string, any>();
  
  async loadComponent(appId: string): Promise<any> {
    // Check cache
    if (this.componentCache.has(appId)) {
      return this.componentCache.get(appId);
    }
    
    // Load from registry
    const loader = APP_COMPONENT_REGISTRY[appId];
    if (!loader) {
      throw new Error(`App component not found: ${appId}`);
    }
    
    const component = await loader.load();
    this.componentCache.set(appId, component);
    return component;
  }
}
```

#### 1.3 Cập nhật Window Component

**File**: `src/app/components/window/window.component.ts`

- Thêm `@ViewChild('componentHost', { read: ViewContainerRef })`
- Sử dụng `ComponentLoader` để load component động
- Hiển thị loading state khi đang load

---

### Phase 2: Refactor App Component (2-3 ngày)

#### 2.1 Xóa tất cả imports của app components

**File**: `src/app/app.component.ts`

**Trước**:
```typescript
import { CalculatorComponent } from './components/apps/calculator/calculator.component';
import { ExpenseAppComponent } from './components/apps/expense-app/expense-app.component';
// ... 30+ imports

@Component({
  imports: [
    CalculatorComponent,
    ExpenseAppComponent,
    // ... 30+ components
  ]
})
```

**Sau**:
```typescript
// Chỉ import WindowComponent và core components
import { WindowComponent } from './components/window/window.component';
// Không import app components nữa

@Component({
  imports: [
    WindowComponent,
    DesktopIconComponent,
    WelcomeScreenComponent,
    // Chỉ core components
  ]
})
```

#### 2.2 Cập nhật Window Component để load dynamic

**File**: `src/app/components/window/window.component.ts`

```typescript
export class WindowComponent implements OnInit, OnDestroy {
  @Input() windowId!: string;
  @ViewChild('componentHost', { read: ViewContainerRef }) 
  componentHost!: ViewContainerRef;
  
  private componentRef: ComponentRef<any> | null = null;
  isLoading = signal(true);
  
  constructor(
    private componentLoader: DynamicComponentLoaderService,
    private cfr: ComponentFactoryResolver
  ) {}
  
  async ngOnInit() {
    const definition = getWindowDefinition(this.windowId);
    if (!definition) return;
    
    try {
      // Load component dynamically
      const ComponentClass = await this.componentLoader.loadComponent(definition.component);
      
      // Create component
      this.componentRef = this.componentHost.createComponent(ComponentClass);
      this.isLoading.set(false);
    } catch (error) {
      console.error('Error loading component:', error);
      this.isLoading.set(false);
    }
  }
  
  ngOnDestroy() {
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }
}
```

#### 2.3 Template cập nhật

**File**: `src/app/components/window/window.component.html`

```html
<div class="window-content">
  <!-- Loading state -->
  <div class="loading-overlay" *ngIf="isLoading()">
    <div class="loading-spinner">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Đang tải ứng dụng...</p>
    </div>
  </div>
  
  <!-- Component host -->
  <ng-container #componentHost></ng-container>
</div>
```

---

### Phase 3: Tối ưu hóa (1-2 ngày)

#### 3.1 Preload các app thường dùng

**File**: `src/app/services/dynamic-component-loader.service.ts`

```typescript
// Preload calculator và explorer (apps được dùng nhiều nhất)
ngOnInit() {
  this.preloadComponents(['calculator', 'explorer']);
}

private preloadComponents(appIds: string[]) {
  appIds.forEach(id => {
    // Load in background
    this.loadComponent(id).catch(() => {});
  });
}
```

#### 3.2 Code splitting cho các app lớn

**File**: `src/app/config/app-component-registry.ts`

```typescript
// Tách expense-app thành nhiều chunks
expense: {
  id: 'expense',
  load: async () => {
    // Load main component
    const main = await import('../components/apps/expense-app/expense-app.component');
    
    // Load Chart.js chỉ khi cần (đã implement)
    // Chart.js được lazy load trong expense-app component
    
    return main.ExpenseAppComponent;
  }
}
```

#### 3.3 Caching strategy

- Cache components đã load trong memory
- Không reload nếu đã có trong cache
- Clear cache khi cần (ví dụ: sau khi update)

---

### Phase 4: Testing & Optimization (1-2 ngày)

#### 4.1 Testing checklist

- [ ] Tất cả apps có thể mở được
- [ ] Loading state hiển thị đúng
- [ ] Error handling khi load fail
- [ ] Performance: bundle size giảm
- [ ] Performance: load time cải thiện
- [ ] Memory: không leak khi đóng/mở nhiều windows

#### 4.2 Performance metrics

**Trước refactor**:
- Initial bundle: ~5MB
- Load time: 3-5s
- All apps loaded: Yes

**Sau refactor** (mục tiêu):
- Initial bundle: < 1MB
- Load time: < 1s
- All apps loaded: No (lazy)

#### 4.3 Bundle analysis

```bash
# Analyze bundle
npm run build -- --stats-json
npx webpack-bundle-analyzer dist/desktop-portfolio/stats.json
```

---

## 📁 Cấu trúc file mới

```
src/app/
├── config/
│   ├── app-component-registry.ts    # NEW: Component loaders
│   ├── window-registry.ts            # Existing
│   └── app-icons.config.ts           # Existing
├── services/
│   ├── dynamic-component-loader.service.ts  # NEW: Loader service
│   └── ... (existing services)
└── components/
    └── window/
        ├── window.component.ts       # MODIFIED: Add dynamic loading
        └── window.component.html     # MODIFIED: Add loading state
```

---

## 🔧 Implementation Steps

### Step 1: Tạo App Component Registry

1. Tạo file `app-component-registry.ts`
2. Định nghĩa loader cho từng app
3. Export registry

### Step 2: Tạo Dynamic Component Loader Service

1. Tạo service với method `loadComponent()`
2. Implement caching
3. Error handling

### Step 3: Refactor Window Component

1. Thêm ViewContainerRef
2. Implement dynamic loading logic
3. Add loading state UI
4. Handle errors

### Step 4: Update App Component

1. Xóa tất cả app component imports
2. Xóa khỏi imports array
3. Test lại

### Step 5: Testing

1. Test từng app
2. Check bundle size
3. Measure performance
4. Fix bugs

---

## 📊 Expected Results

### Bundle Size Reduction

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Main bundle | ~5MB | ~800KB | 84% |
| Calculator | Included | ~50KB | Lazy |
| Expense App | Included | ~300KB | Lazy |
| News App | Included | ~150KB | Lazy |
| ... | ... | ... | ... |

### Load Time Improvement

- **Initial load**: 3-5s → < 1s (80% improvement)
- **App open time**: 0s (cached) → 100-300ms (first time)

---

## ⚠️ Risks & Mitigation

### Risk 1: Breaking changes
- **Mitigation**: Test từng app một, có rollback plan

### Risk 2: Performance regression
- **Mitigation**: Monitor bundle size và load time, optimize nếu cần

### Risk 3: Memory leaks
- **Mitigation**: Proper cleanup trong ngOnDestroy, test memory usage

### Risk 4: Type safety
- **Mitigation**: Sử dụng TypeScript types, proper typing cho dynamic components

---

## 🎯 Success Criteria

- [ ] Bundle size giảm > 80%
- [ ] Load time < 1s
- [ ] Tất cả apps hoạt động bình thường
- [ ] No breaking changes cho users
- [ ] Code maintainable và scalable

---

## 📅 Timeline

- **Week 1**: Phase 1 + Phase 2 (Setup + Core refactor)
- **Week 2**: Phase 3 + Phase 4 (Optimization + Testing)
- **Total**: ~2 weeks

---

## 🔍 Notes

1. **Angular Standalone Components**: Dự án đã dùng standalone, việc dynamic loading sẽ dễ hơn
2. **ComponentFactoryResolver**: Có thể cần dùng `createComponent()` thay vì `ComponentFactoryResolver` (Angular 13+)
3. **Preloading**: Có thể preload một số app thường dùng trong background
4. **Error boundaries**: Cần handle errors khi load component fail

---

## 📚 References

- [Angular Dynamic Component Loading](https://angular.io/guide/dynamic-component-loader)
- [Angular Standalone Components](https://angular.io/guide/standalone-components)
- [Webpack Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [Angular Lazy Loading](https://angular.io/guide/lazy-loading-ngmodules)

---

## ✅ Checklist

### Preparation
- [ ] Tạo app-component-registry.ts
- [ ] Tạo dynamic-component-loader.service.ts
- [ ] Research Angular dynamic component loading best practices

### Implementation
- [ ] Refactor WindowComponent
- [ ] Update AppComponent (remove imports)
- [ ] Test calculator app
- [ ] Test expense app
- [ ] Test all other apps

### Optimization
- [ ] Implement caching
- [ ] Add preloading
- [ ] Optimize bundle splitting

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance tests
- [ ] Bundle analysis

### Documentation
- [ ] Update README
- [ ] Document new architecture
- [ ] Add code comments

---

**Last Updated**: 2024-12-19
**Status**: Planning Phase

