import { Component, OnInit, signal, computed, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AngularGuidelinesService, AngularGuideline, GuidelineCategory } from '../../../services/angular-guidelines.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface CodeExample {
  id: string;
  title: string;
  description: string;
  html: string;
  css: string;
  typescript: string;
  category: string;
}

@Component({
  selector: 'app-angular-learning-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './angular-learning-app.component.html',
  styleUrl: './angular-learning-app.component.scss',
})
export class AngularLearningAppComponent implements OnInit {
  private guidelineService = inject(AngularGuidelinesService);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  @ViewChild('previewFrame', { static: false }) previewFrame!: ElementRef<HTMLIFrameElement>;

  // Service data
  categories = signal<GuidelineCategory[]>([]);
  guidelines = signal<AngularGuideline[]>([]);
  
  // UI state
  selectedCategory = signal<string>('introduction');
  selectedGuideline = signal<AngularGuideline | null>(null);
  selectedExample = signal<CodeExample | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  sidebarCollapsed = signal<boolean>(false);
  
  // Code editor state
  editorMode = signal<'html' | 'css' | 'typescript'>('html');
  htmlCode = signal<string>('');
  cssCode = signal<string>('');
  typescriptCode = signal<string>('');
  isRunning = signal<boolean>(false);
  previewContent = signal<SafeHtml | null>(null);
  hasPreview = signal<boolean>(false);
  
  // Code examples for each category
  codeExamples = signal<CodeExample[]>([]);

  // Computed properties
  filteredGuidelines = computed(() => this.guidelines());
  currentCategory = computed(() => 
    this.categories().find(c => c.id === this.selectedCategory()) || null
  );

  constructor() {
    this.categories.set(this.guidelineService.categories);
    this.initializeCodeExamples();
  }

  ngOnInit() {
    this.loadCategory('introduction');
  }

  initializeCodeExamples() {
    const examples: CodeExample[] = [
      {
        id: 'intro-1',
        title: 'Hello Angular Component',
        description: 'Tạo component Angular đầu tiên',
        category: 'introduction',
        html: `<div class="container">
  <h1>{{ title }}</h1>
  <p>{{ message }}</p>
  <button (click)="onClick()">Click me!</button>
  <p *ngIf="clicked">Button đã được click!</p>
</div>`,
        css: `.container {
  padding: 20px;
  text-align: center;
  font-family: Arial, sans-serif;
}

h1 {
  color: #1976d2;
  margin-bottom: 10px;
}

button {
  background: #1976d2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

button:hover {
  background: #1565c0;
}`,
        typescript: `export class AppComponent {
  title = 'Hello Angular!';
  message = 'Chào mừng đến với Angular';
  clicked = false;

  onClick() {
    this.clicked = true;
    this.message = 'Bạn đã click vào button!';
  }
}`
      },
      {
        id: 'component-1',
        title: 'Component với Input và Output',
        description: 'Tạo component có thể nhận và gửi dữ liệu',
        category: 'components',
        html: `<div class="card">
  <h2>{{ name }}</h2>
  <p>Tuổi: {{ age }}</p>
  <button (click)="incrementAge()">Tăng tuổi</button>
  <p *ngIf="age > 18">Bạn đã trưởng thành!</p>
</div>`,
        css: `.card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h2 {
  color: #1976d2;
  margin-bottom: 10px;
}

button {
  background: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}`,
        typescript: `@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css']
})
export class UserCardComponent {
  @Input() name: string = 'Người dùng';
  @Input() age: number = 0;
  @Output() ageChanged = new EventEmitter<number>();

  incrementAge() {
    this.age++;
    this.ageChanged.emit(this.age);
  }
}`
      },
      {
        id: 'template-1',
        title: 'Template với Control Flow',
        description: 'Sử dụng @if, @for trong template',
        category: 'templates',
        html: `<div class="container">
  <h2>Danh sách sản phẩm</h2>
  <div class="product-list">
    @for (product of products; track product.id) {
      <div class="product-card">
        <h3>{{ product.name }}</h3>
        <p>Giá: {{ product.price | currency:'VND' }}</p>
        @if (product.inStock) {
          <span class="badge in-stock">Còn hàng</span>
        } @else {
          <span class="badge out-of-stock">Hết hàng</span>
        }
      </div>
    }
  </div>
</div>`,
        css: `.container {
  padding: 20px;
}

.product-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.product-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background: white;
}

.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}

.in-stock {
  background: #4caf50;
  color: white;
}

.out-of-stock {
  background: #f44336;
  color: white;
}`,
        typescript: `export class ProductListComponent {
  products = [
    { id: 1, name: 'Laptop', price: 15000000, inStock: true },
    { id: 2, name: 'Mouse', price: 200000, inStock: true },
    { id: 3, name: 'Keyboard', price: 500000, inStock: false },
    { id: 4, name: 'Monitor', price: 5000000, inStock: true }
  ];
}`
      },
      {
        id: 'directive-1',
        title: 'Structural Directives',
        description: 'Sử dụng *ngIf và *ngFor',
        category: 'directives',
        html: `<div class="container">
  <h2>Quản lý Tasks</h2>
  <input [(ngModel)]="newTask" placeholder="Nhập task mới..." />
  <button (click)="addTask()">Thêm Task</button>
  
  <div class="task-list">
    <div *ngFor="let task of tasks; let i = index" class="task-item">
      <span [class.completed]="task.completed">{{ task.name }}</span>
      <button (click)="toggleTask(i)">Toggle</button>
      <button (click)="removeTask(i)">Xóa</button>
    </div>
  </div>
  
  <p *ngIf="tasks.length === 0">Chưa có task nào!</p>
</div>`,
        css: `.container {
  padding: 20px;
  max-width: 500px;
}

input {
  width: 100%;
  padding: 8px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.task-list {
  margin-top: 20px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.completed {
  text-decoration: line-through;
  color: #999;
}

button {
  padding: 6px 12px;
  margin-left: 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #1976d2;
  color: white;
}`,
        typescript: `export class TaskManagerComponent {
  tasks: { name: string; completed: boolean }[] = [];
  newTask = '';

  addTask() {
    if (this.newTask.trim()) {
      this.tasks.push({ name: this.newTask, completed: false });
      this.newTask = '';
    }
  }

  toggleTask(index: number) {
    this.tasks[index].completed = !this.tasks[index].completed;
  }

  removeTask(index: number) {
    this.tasks.splice(index, 1);
  }
}`
      }
    ];
    
    this.codeExamples.set(examples);
  }

  loadCategory(categoryId: string) {
    this.selectedCategory.set(categoryId);
    this.loading.set(true);
    this.error.set(null);
    this.guidelines.set([]);
    this.selectedGuideline.set(null);

    const category = this.categories().find(c => c.id === categoryId);
    if (!category) {
      this.error.set('Category not found');
      this.loading.set(false);
      return;
    }

    const guidelineUrls = category.guidelines;
    let loadedCount = 0;
    const totalCount = guidelineUrls.length;
    const loadedGuidelines: AngularGuideline[] = [];

    guidelineUrls.forEach(url => {
      this.guidelineService.fetchGuideline(url).subscribe({
        next: (html) => {
          const guideline = this.guidelineService.parseGuidelineContent(html, url);
          loadedGuidelines.push(guideline);
          loadedCount++;

          if (loadedCount === totalCount) {
            this.guidelines.set(loadedGuidelines);
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error(`Failed to load ${url}:`, err);
          loadedCount++;

          if (loadedCount === totalCount) {
            this.guidelines.set(loadedGuidelines);
            this.loading.set(false);
            if (loadedGuidelines.length === 0) {
              this.error.set('Failed to load guidelines. Some content may not be available.');
            }
          }
        }
      });
    });
  }

  selectGuideline(guideline: AngularGuideline) {
    this.selectedGuideline.set(guideline);
    // Load example if available
    const example = this.codeExamples().find(ex => ex.category === guideline.category);
    if (example) {
      this.loadExample(example);
    }
  }

  loadExample(example: CodeExample) {
    this.selectedExample.set(example);
    this.htmlCode.set(example.html);
    this.cssCode.set(example.css);
    this.typescriptCode.set(example.typescript);
    this.editorMode.set('html');
  }

  getExamplesForCategory(categoryId: string): CodeExample[] {
    return this.codeExamples().filter(ex => ex.category === categoryId);
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(collapsed => !collapsed);
  }

  setEditorMode(mode: 'html' | 'css' | 'typescript') {
    this.editorMode.set(mode);
  }

  buildAndRun() {
    this.isRunning.set(true);
    
    // Create a simple HTML page with the code
    let html = this.htmlCode();
    const css = this.cssCode();
    const ts = this.typescriptCode();
    
    // Convert Angular template syntax to vanilla HTML/JS
    html = this.convertAngularTemplate(html);
    
    // Convert TypeScript to JavaScript (simplified - just remove types)
    const js = this.convertTypeScriptToJavaScript(ts);
    
    // Create full HTML document
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Angular Learning Preview</title>
  <style>
    ${css}
    body {
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  ${html}
  <script>
    // Simple Angular-like functionality simulation
    ${js}
    
    // Simple binding simulation
    function bindData() {
      // Handle {{ }} bindings
      document.querySelectorAll('*').forEach(el => {
        el.innerHTML = el.innerHTML.replace(/\\{\\{([^}]+)\\}\\}/g, (match, prop) => {
          prop = prop.trim();
          if (window[prop] !== undefined) {
            return window[prop];
          }
          return match;
        });
      });
      
      // Handle [class.xxx] bindings
      document.querySelectorAll('[data-class]').forEach(el => {
        const className = el.getAttribute('data-class');
        const condition = el.getAttribute('data-class-condition');
        if (window[condition] !== undefined && window[condition]) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
      });
    }
    
    // Simple click handler simulation
    document.addEventListener('click', function(e) {
      const target = e.target;
      const clickHandler = target.getAttribute('data-click');
      if (clickHandler && window[clickHandler]) {
        window[clickHandler]();
        bindData();
      }
    });
    
    // Handle *ngIf simulation
    function updateNgIf() {
      document.querySelectorAll('[data-ng-if]').forEach(el => {
        const condition = el.getAttribute('data-ng-if');
        if (window[condition] !== undefined) {
          el.style.display = window[condition] ? '' : 'none';
        }
      });
    }
    
    // Handle *ngFor simulation
    function updateNgFor() {
      document.querySelectorAll('[data-ng-for]').forEach(container => {
        const arrayName = container.getAttribute('data-ng-for');
        const itemName = container.getAttribute('data-ng-for-item') || 'item';
        const indexName = container.getAttribute('data-ng-for-index') || 'index';
        const template = container.getAttribute('data-ng-for-template');
        
        if (window[arrayName] && Array.isArray(window[arrayName])) {
          container.innerHTML = window[arrayName].map((item, index) => {
            let html = template || container.innerHTML;
            // Replace {{item.property}} patterns - use simple string replacement
            const itemPattern = '{{' + itemName + '.';
            const itemPatternLen = itemPattern.length;
            let pos = html.indexOf(itemPattern);
            while (pos !== -1) {
              const endPos = html.indexOf('}}', pos + itemPatternLen);
              if (endPos !== -1) {
                const prop = html.substring(pos + itemPatternLen, endPos);
                const value = item[prop] || '';
                html = html.substring(0, pos) + value + html.substring(endPos + 2);
                pos = html.indexOf(itemPattern, pos + value.length);
              } else {
                break;
              }
            }
            // Replace {{index}} patterns
            const indexPattern = '{{' + indexName + '}}';
            html = html.split(indexPattern).join(String(index));
            return html;
          }).join('');
        }
      });
    }
    
    // Initial bind
    setTimeout(() => {
      bindData();
      updateNgIf();
      updateNgFor();
    }, 100);
  </script>
</body>
</html>`;
    
    // Create blob URL and set to iframe
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    if (this.previewFrame?.nativeElement) {
      this.previewFrame.nativeElement.src = url;
      this.hasPreview.set(true);
    }
    
    // Clean up after a moment
    setTimeout(() => {
      this.isRunning.set(false);
    }, 500);
  }

  private convertAngularTemplate(html: string): string {
    // Convert Angular template syntax to vanilla HTML
    let converted = html;
    
    // Convert (click)="method()" to data-click="method"
    converted = converted.replace(/\(click\)="([^"]+)"/g, 'data-click="$1"');
    
    // Convert *ngIf="condition" to data-ng-if="condition" and wrap
    converted = converted.replace(/\*ngIf="([^"]+)"/g, 'data-ng-if="$1"');
    
    // Convert *ngFor="let item of items" to data-ng-for
    converted = converted.replace(/\*ngFor="let\s+(\w+)\s+of\s+(\w+)"/g, (match, item, array) => {
      return `data-ng-for="${array}" data-ng-for-item="${item}"`;
    });
    
    // Convert *ngFor="let item of items; let i = index"
    converted = converted.replace(/\*ngFor="let\s+(\w+)\s+of\s+(\w+);\s*let\s+(\w+)\s*=\s*index"/g, 
      (match, item, array, index) => {
        return `data-ng-for="${array}" data-ng-for-item="${item}" data-ng-for-index="${index}"`;
      });
    
    // Convert [class.xxx]="condition" to data-class
    converted = converted.replace(/\[class\.(\w+)\]="([^"]+)"/g, 'data-class="$1" data-class-condition="$2"');
    
    // Convert [(ngModel)] to data-ng-model (simplified)
    converted = converted.replace(/\[\(ngModel\)\]="([^"]+)"/g, 'data-ng-model="$1"');
    
    return converted;
  }

  hasPreviewContent(): boolean {
    return this.hasPreview();
  }

  private convertTypeScriptToJavaScript(ts: string): string {
    // Very simple TypeScript to JavaScript conversion
    // This is a simplified version - in production, you'd use a proper compiler
    let js = ts
      .replace(/export class/g, 'class')
      .replace(/@Input\(\)/g, '')
      .replace(/@Output\(\)/g, '')
      .replace(/EventEmitter<.*?>/g, '')
      .replace(/: string/g, '')
      .replace(/: number/g, '')
      .replace(/: boolean/g, '')
      .replace(/: \w+\[\]/g, '')
      .replace(/@Component\([^)]*\)/g, '')
      .replace(/selector: '[^']*'/g, '')
      .replace(/templateUrl: '[^']*'/g, '')
      .replace(/styleUrls: \[[^\]]*\]/g, '');
    
    // Extract class content and create instance
    const classMatch = js.match(/class\s+(\w+)\s*{([\s\S]+)}/);
    if (classMatch) {
      const className = classMatch[1];
      const classBody = classMatch[2];
      
      // Clean up class body - remove decorators and type annotations
      let cleanBody = classBody
        .replace(/@\w+\([^)]*\)/g, '')
        .replace(/:\s*\w+(\[\])?/g, '')
        .replace(/=\s*\[/g, '= [')
        .replace(/=\s*'/g, "= '")
        .replace(/=\s*"/g, '= "')
        .replace(/=\s*\d+/g, (match) => match);
      
      // Create instance
      js = `
        class ${className} {
          ${cleanBody}
        }
        const app = new ${className}();
        Object.keys(app).forEach(key => {
          window[key] = app[key];
        });
        Object.getOwnPropertyNames(${className}.prototype).forEach(method => {
          if (method !== 'constructor') {
            window[method] = app[method].bind(app);
          }
        });
      `;
    } else {
      // If no class found, just use the code as-is (might be plain JS)
      js = ts.replace(/export /g, '');
    }
    
    return js;
  }

  resetCode() {
    const example = this.selectedExample();
    if (example) {
      this.htmlCode.set(example.html);
      this.cssCode.set(example.css);
      this.typescriptCode.set(example.typescript);
    }
  }

  getCategoryById(categoryId: string): GuidelineCategory | undefined {
    return this.categories().find(c => c.id === categoryId);
  }
}

