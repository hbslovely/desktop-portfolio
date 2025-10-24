import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AngularGuidelinesService, AngularGuideline, GuidelineCategory } from '../../../services/angular-guidelines.service';

@Component({
  selector: 'app-angular-guidelines-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './angular-guidelines-app.component.html',
  styleUrl: './angular-guidelines-app.component.scss',
})
export class AngularGuidelinesAppComponent implements OnInit {
  // Service data
  categories = signal<GuidelineCategory[]>([]);
  
  // UI state
  selectedCategory = signal<string>('introduction');
  selectedGuideline = signal<AngularGuideline | null>(null);
  guidelines = signal<AngularGuideline[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  searchTerm = signal<string>('');
  viewMode = signal<'browse' | 'viewer'>('browse');
  
  // Viewer state
  guidelineLoading = signal<boolean>(false);
  guidelineError = signal<string | null>(null);
  
  // Sidebar collapsed state
  sidebarCollapsed = signal<boolean>(false);

  // Computed filtered guidelines based on search
  filteredGuidelines = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const allGuidelines = this.guidelines();
    
    if (!search) {
      return allGuidelines;
    }
    
    return this.guidelineService.searchGuidelines(search, allGuidelines);
  });

  constructor(
    private guidelineService: AngularGuidelinesService,
    private http: HttpClient
  ) {
    this.categories.set(this.guidelineService.categories);
  }

  ngOnInit() {
    // Load the first category by default
    this.loadCategory('introduction');
  }

  /**
   * Load all guidelines for a category
   */
  loadCategory(categoryId: string) {
    this.selectedCategory.set(categoryId);
    this.loading.set(true);
    this.error.set(null);
    this.guidelines.set([]);
    this.viewMode.set('browse');

    const category = this.categories().find(c => c.id === categoryId);
    if (!category) {
      this.error.set('Category not found');
      this.loading.set(false);
      return;
    }

    // Fetch all guidelines for this category
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

          // Update once all are loaded
          if (loadedCount === totalCount) {
            this.guidelines.set(loadedGuidelines);
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error(`Failed to load ${url}:`, err);
          loadedCount++;

          // Continue even if some fail
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

  /**
   * Open a guideline in the viewer
   */
  openGuideline(guideline: AngularGuideline) {
    this.selectedGuideline.set(guideline);
    this.viewMode.set('viewer');
    this.guidelineLoading.set(false);
    this.guidelineError.set(null);

    // Setup code highlighting and copy buttons
    setTimeout(() => {
      this.setupCodeBlocks();
    }, 100);
  }

  /**
   * Close the viewer and return to browse mode
   */
  closeViewer() {
    this.viewMode.set('browse');
    this.selectedGuideline.set(null);
  }

  /**
   * Open guideline in new tab on angular.dev
   */
  openInNewTab() {
    const guideline = this.selectedGuideline();
    if (guideline) {
      window.open(guideline.url, '_blank');
    }
  }

  /**
   * Handle search input
   */
  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  /**
   * Clear search
   */
  clearSearch() {
    this.searchTerm.set('');
  }

  /**
   * Toggle sidebar collapse
   */
  toggleSidebar() {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  /**
   * Get time-based greeting
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Setup code blocks with syntax highlighting and copy buttons
   */
  setupCodeBlocks(): void {
    setTimeout(() => {
      const codeBlocks = document.querySelectorAll('.guideline-content pre');
      codeBlocks.forEach((pre) => {
        if (!pre.querySelector('.code-copy-btn')) {
          const copyBtn = document.createElement('button');
          copyBtn.className = 'code-copy-btn';
          copyBtn.type = 'button';
          
          copyBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            color: #333;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            z-index: 10;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            backdrop-filter: blur(10px);
          `;
          
          copyBtn.innerHTML = '<i class="pi pi-copy" style="font-size: 11px;"></i><span>Copy</span>';

          const code = pre.querySelector('code');
          if (code) {
            copyBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.copyCode(code as HTMLElement, copyBtn);
            };
            
            copyBtn.onmouseenter = () => {
              copyBtn.style.background = 'rgba(221, 51, 51, 0.95)';
              copyBtn.style.borderColor = '#dd3333';
              copyBtn.style.color = 'white';
            };
            
            copyBtn.onmouseleave = () => {
              if (!copyBtn.classList.contains('copied')) {
                copyBtn.style.background = 'rgba(255, 255, 255, 0.9)';
                copyBtn.style.borderColor = '#e0e0e0';
                copyBtn.style.color = '#333';
              }
            };
          }

          const preElement = pre as HTMLElement;
          preElement.style.position = 'relative';
          pre.insertBefore(copyBtn, pre.firstChild);
        }
      });
    }, 200);
  }

  /**
   * Copy code to clipboard
   */
  copyCode(codeElement: HTMLElement, button: HTMLElement): void {
    const code = codeElement.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      const originalHTML = button.innerHTML;
      button.classList.add('copied');
      button.style.background = 'rgba(76, 175, 80, 0.95)';
      button.style.borderColor = '#4caf50';
      button.style.color = 'white';
      button.innerHTML = '<i class="pi pi-check" style="font-size: 11px;"></i><span>Copied!</span>';

      setTimeout(() => {
        button.classList.remove('copied');
        button.style.background = 'rgba(255, 255, 255, 0.9)';
        button.style.borderColor = '#e0e0e0';
        button.style.color = '#333';
        button.innerHTML = originalHTML;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  /**
   * Get category by ID
   */
  getCategoryById(id: string): GuidelineCategory | undefined {
    return this.categories().find(c => c.id === id);
  }

  /**
   * Refresh guidelines for current category
   */
  refreshGuidelines() {
    const currentCategory = this.selectedCategory();
    this.loadCategory(currentCategory);
  }
}


