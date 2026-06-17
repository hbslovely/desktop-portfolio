import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Output,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ExplorerEntry, ExplorerService, ExplorerType } from '../../../services/explorer.service';
import {
  MedicalEventKind,
  MedicalHistoryEntry,
  MedicalHistoryService,
} from '../../../services/medical-history.service';
import { MEDICAL_KINDS, MedicalKindMeta, kindMeta } from './medical-history-kinds.data';
import { ActivityLogService } from '../../../services/activity-log.service';
import { viFoldIncludes } from './medical-history-vi.utils';
import { MedicalHistoryDialogComponent } from './dialog/medical-history-dialog.component';
import { MedicalHistoryFilterComponent } from './filter/medical-history-filter.component';
import { MedicalHistoryTimelineComponent } from './timeline/medical-history-timeline.component';
import {
  MedicalHistoryPreviewComponent,
  MedicalImagePreviewState,
} from './preview/medical-history-preview.component';

const EXPLORER_ROOT_ID = 1;
const MEDICAL_FOLDER_NAME = 'Y tế';

@Component({
  selector: 'app-medical-history',
  standalone: true,
  imports: [
    MedicalHistoryDialogComponent,
    MedicalHistoryFilterComponent,
    MedicalHistoryTimelineComponent,
    MedicalHistoryPreviewComponent,
  ],
  templateUrl: './medical-history.component.html',
  styleUrls: ['./medical-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHistoryComponent {
  private medicalService = inject(MedicalHistoryService);
  private explorerService = inject(ExplorerService);
  readonly explorerEnabled = this.explorerService.isEnabled;
  private destroyRef = inject(DestroyRef);
  private activityLogService = inject(ActivityLogService);
  private cdr = inject(ChangeDetectorRef);

  /** Cùng `?user=` với trang feeding */
  user = input<string>('guest');

  /** Cha (`feeding`) chuyển tab Tài liệu + `DocumentsComponent.revealFileEntry`. */
  @Output() openExplorerFile = new EventEmitter<number>();

  entries = signal<MedicalHistoryEntry[]>([]);
  explorerEntries = signal<ExplorerEntry[]>([]);
  medicalFolderId = signal<number | null>(null);

  loading = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  kindFilterKinds = signal<MedicalEventKind[]>([]);
  filterPanelOpen = signal<boolean>(false);
  filterPanelKindSearch = signal<string>('');
  timelineSort = signal<'newest' | 'oldest'>('newest');
  kindListSort = signal<'count' | 'alpha'>('count');
  textSearchQuery = signal<string>('');

  imagePreview = signal<MedicalImagePreviewState | null>(null);

  readonly kindCatalog: readonly MedicalKindMeta[] = MEDICAL_KINDS;

  explorerById = computed(() => {
    const m = new Map<number, ExplorerEntry>();
    for (const e of this.explorerEntries()) {
      m.set(e.id, e);
    }
    return m;
  });

  kindsInFilterPanel = computed(() => {
    const q = this.filterPanelKindSearch().trim();
    const filtered = !q
      ? [...this.kindCatalog]
      : this.kindCatalog.filter(
          (km) =>
            viFoldIncludes(km.label, q) ||
            viFoldIncludes(km.shortLabel, q) ||
            viFoldIncludes(km.id.replace(/_/g, ' '), q)
        );
    const counts = this.kindCounts();
    const mode = this.kindListSort();
    if (mode === 'alpha') {
      filtered.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    } else {
      filtered.sort((a, b) => {
        const d = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
        if (d !== 0) return d;
        return a.label.localeCompare(b.label, 'vi');
      });
    }
    return filtered;
  });

  kindFilterKindSet = computed(() => new Set(this.kindFilterKinds()));

  kindFilterSummary = computed(() => {
    const sel = this.kindFilterKinds();
    if (sel.length === 0) return 'Tất cả loại';
    if (sel.length === 1) return kindMeta(sel[0]).label;
    if (sel.length <= 3) {
      return sel.map((id) => kindMeta(id).shortLabel).join(' · ');
    }
    return `${sel.length} loại`;
  });

  constructor() {
    this.load();
    effect(
      () => {
        this.userNorm();
      },
      { allowSignalWrites: true }
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: Event): void {
    const path = ev.composedPath?.() ?? [];
    const inFilter = path.some(
      (n) => n instanceof HTMLElement && n.classList.contains('mh-filter')
    );
    if (!inFilter) {
      this.filterPanelOpen.set(false);
    }
  }

  refresh() {
    this.load();
  }

  userNorm = computed(
    () =>
      String(this.user() || 'guest')
        .toLowerCase()
        .trim() || 'guest'
  );

  myEntries = computed(() => {
    return this.entries();
  });

  filteredEntries = computed(() => {
    const rows = this.myEntries();
    const sel = this.kindFilterKinds();
    if (sel.length === 0) return rows;
    const allow = new Set(sel);
    return rows.filter((e) => allow.has(e.kind));
  });

  visibleEntries = computed(() => {
    const rows = this.filteredEntries();
    const q = this.textSearchQuery().trim();
    if (!q) return rows;
    return rows.filter((e) => this.entryMatchesFreeText(e, q));
  });

  timelineGroups = computed(() => {
    const list = this.visibleEntries();
    const order = this.timelineSort();
    const map = new Map<string, MedicalHistoryEntry[]>();
    for (const e of list) {
      const ym = e.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(e);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const cmp = a.date.localeCompare(b.date);
        return order === 'newest' ? -cmp : cmp;
      });
    }
    const keys = [...map.keys()].sort((a, b) =>
      order === 'newest' ? b.localeCompare(a) : a.localeCompare(b)
    );
    return keys.map((key) => ({
      key,
      monthLabel: this.formatMonthHeading(key),
      entries: map.get(key)!,
    }));
  });

  kindCounts = computed(() => {
    const rows = this.myEntries();
    const counts = {} as Record<MedicalEventKind, number>;
    for (const km of MEDICAL_KINDS) {
      counts[km.id] = 0;
    }
    for (const e of rows) {
      const k = counts[e.kind] !== undefined ? e.kind : 'other';
      counts[k]++;
    }
    return counts;
  });

  load() {
    this.loading.set(true);
    this.errorMsg.set('');

    // Track completion của từng API call
    let medicalLoaded = false;
    let explorerLoaded = false;
    let medicalData: any[] = [];
    let explorerData: any[] = [];

    const checkAndFinalize = () => {
      if (medicalLoaded && explorerLoaded) {
        // Cả 2 APIs đã hoàn thành, finalize
        const folder = explorerData.find(
          (e) =>
            e.type === 'folder' && e.parentId === EXPLORER_ROOT_ID && e.name === MEDICAL_FOLDER_NAME
        );
        this.medicalFolderId.set(folder?.id ?? null);
        this.loading.set(false);

        // 🚀 Pre-load all medical attachments
        this.preloadAttachments(medicalData);
      }
    };

    // 🚀 Load Medical History - độc lập
    this.medicalService
      .getEntries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (medical) => {
          this.entries.set(medical);
          medicalData = medical;
          medicalLoaded = true;
          checkAndFinalize();
        },
        error: (err) => {
          console.error('Medical load failed:', err);
          this.errorMsg.set('Không tải được Medical History data.');
          this.loading.set(false);
        },
      });

    // 🚀 Load Explorer - độc lập, không block medical
    this.explorerService
      .getEntries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (explorer) => {
          this.explorerEntries.set(explorer);
          explorerData = explorer;
          explorerLoaded = true;
          checkAndFinalize();
        },
        error: (err) => {
          console.error('Explorer load failed:', err);
          // Explorer fail không block medical data
          explorerLoaded = true; // Set true để không block finalization
          explorerData = []; // Empty fallback
          checkAndFinalize();
        },
      });
  }

  onDialogSaved(): void {
    this.successMsg.set('Đã lưu.');
    setTimeout(() => this.successMsg.set(''), 3000);
    setTimeout(() => this.load(), 600);
  }

  // Cache để lưu trữ các attachment đã enriched với previewUrl/content
  private attachmentCache = new Map<string, ExplorerEntry>();

  attachmentFor(entry: MedicalHistoryEntry): ExplorerEntry | undefined {
    // Ưu tiên driveFileId trực tiếp từ medical entry
    if (entry.driveFileId) {
      // Kiểm tra cache trước
      const cached = this.attachmentCache.get(entry.driveFileId);
      if (cached) {
        return cached;
      }

      // Create a minimal ExplorerEntry object for the driveFileId
      const attachment: ExplorerEntry = {
        id: -1, // Fake ID for Drive-only files
        name: `med-attachment-${entry.driveFileId}`,
        type: 'file' as ExplorerType,
        parentId: null,
        driveFileId: entry.driveFileId,
        mimeType: 'image/jpeg',
        storageStatus: 'drive',
        // Add loading state properties
        previewUrl: undefined, // Will be populated when loaded
        isLoading: true, // Custom property để track loading state
        loadError: false,
      };

      // Cache ngay lập tức để tránh multiple requests
      this.attachmentCache.set(entry.driveFileId, attachment);

      return attachment;
    }

    // Fallback: tìm trong Explorer entries (để tương thích với data cũ)
    // Giả sử attachmentExplorerId có thể còn trong data cũ
    const legacyId = (entry as any).attachmentExplorerId;
    if (legacyId) {
      const numericId = typeof legacyId === 'string' ? parseInt(legacyId, 10) : legacyId;
      if (!isNaN(numericId)) {
        const explorerEntry = this.explorerById().get(numericId);
        if (explorerEntry?.driveFileId) {
          return explorerEntry;
        }
      }
    }

    return undefined;
  }

  readonly resolveAttachment = (entry: MedicalHistoryEntry) => this.attachmentFor(entry);

  private preloadAttachments(entries: MedicalHistoryEntry[]): void {
    // Collect tất cả driveFileIds cần load (bao gồm cả những item đã có trong cache nhưng chưa load xong)
    const driveFileIds = entries
      .map((entry) => entry.driveFileId)
      .filter((id): id is string => {
        if (!id) return false;

        const cached = this.attachmentCache.get(id);
        // Load nếu: chưa có trong cache HOẶC đang loading HOẶC chưa có previewUrl
        return !cached || cached.isLoading || !cached.previewUrl;
      });

    if (driveFileIds.length === 0) {
      return;
    }

    // 🚀 Load each attachment independently - API nào về trước complete trước
    driveFileIds.forEach((driveFileId) => {
      this.explorerService
        .getFileDataUrl(driveFileId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError((error) => {
            return of({
              success: false,
              error: error.message || 'Load failed',
              dataUrl: undefined,
            });
          })
        )
        .subscribe({
          next: (response) => {
            const attachment = this.attachmentCache.get(driveFileId);

            if (attachment && response.success && (response as any).dataUrl) {
              // ✅ Update cached attachment với loaded data
              const dataUrl = (response as any).dataUrl;
              attachment.previewUrl = dataUrl;
              attachment.content = dataUrl; // Fallback
              attachment.isLoading = false;

              // 🔄 Update UI ngay lập tức cho attachment này (không đợi others)
              const currentEntries = this.entries();
              this.entries.set([...currentEntries]);
            } else if (attachment) {
              // ❌ Mark as failed to load
              attachment.isLoading = false;
              attachment.loadError = true;

              // 🔄 Update UI ngay cả khi fail
              const currentEntries = this.entries();
              this.entries.set([...currentEntries]);
            }
          },
          error: (error) => {
            const attachment = this.attachmentCache.get(driveFileId);
            if (attachment) {
              attachment.isLoading = false;
              attachment.loadError = true;
            }

            // Check for Drive authorization errors
            const isDriveAuthError =
              error.message && error.message.includes('DriveApp.getFileById');
            if (isDriveAuthError) {
              this.errorMsg.set(
                '🚨 Apps Script chưa có quyền truy cập Google Drive. Hãy authorize Apps Script.'
              );
            }

            // 🔄 Update UI ngay cả khi error
            const currentEntries = this.entries();
            this.entries.set([...currentEntries]);
          },
        });
    });
  }

  openAttachmentInDocuments(entry: MedicalHistoryEntry): void {
    // Ưu tiên mở trong Explorer nếu có legacy ID
    const legacyId = (entry as any).attachmentExplorerId;
    if (legacyId) {
      const numericId = typeof legacyId === 'string' ? parseInt(legacyId, 10) : legacyId;
      if (!isNaN(numericId)) {
        const explorerEntry = this.explorerById().get(numericId);
        if (explorerEntry?.id) {
          this.openExplorerFile.emit(explorerEntry.id);
          return;
        }
      }
    }

    // Fallback: fetch từ Drive và mở tab mới
    const att = this.attachmentFor(entry);
    if (!att?.driveFileId) return;

    this.explorerService
      .getFileDataUrl(att.driveFileId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.dataUrl) {
            window.open(response.dataUrl, '_blank', 'noopener,noreferrer');
          }
        },
        error: (err) => {
          console.error('Failed to load attachment:', err);
          this.errorMsg.set('Không tải được ảnh đính kèm.');
        },
      });
  }

  openImagePreview(entry: MedicalHistoryEntry): void {
    const att = this.attachmentFor(entry);
    if (!att?.driveFileId) return;

    // Use cached data if available, otherwise fetch from Drive
    if (att.previewUrl || att.content) {
      // ⚡ Fast path: Use cached image data
      this.imagePreview.set({
        src: att.previewUrl || att.content || '',
        title: entry.title || 'Ảnh đính kèm',
        driveFileId: att.driveFileId,
      });
    } else {
      // 🔄 Fallback: Fetch from Drive if not cached
      this.explorerService
        .getFileDataUrl(att.driveFileId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response.dataUrl) {
              // Update cache for future use
              att.previewUrl = response.dataUrl;
              att.content = response.dataUrl;
              att.isLoading = false;

              this.imagePreview.set({
                src: response.dataUrl,
                title: entry.title || 'Ảnh đính kèm',
                driveFileId: att.driveFileId,
              });
            }
          },
          error: () => {
            this.errorMsg.set('Không tải được ảnh đính kèm.');
          },
        });
    }
  }

  closeImagePreview(): void {
    this.imagePreview.set(null);
  }

  openInDocumentsFromPreview(driveFileId: string): void {
    this.closeImagePreview();

    // Since we no longer have Explorer integration, we'll just open the Drive file directly
    this.explorerService
      .getFileDataUrl(driveFileId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.dataUrl) {
            window.open(response.dataUrl, '_blank', 'noopener,noreferrer');
          }
        },
        error: (err) => {
          console.error('Failed to open file:', err);
          this.errorMsg.set('Không mở được file.');
        },
      });
  }

  toggleFilterPanel(): void {
    this.filterPanelOpen.update((v) => !v);
  }

  clearKindFilters(): void {
    this.kindFilterKinds.set([]);
  }

  resetFilterPanel(): void {
    this.kindFilterKinds.set([]);
    this.timelineSort.set('newest');
    this.kindListSort.set('count');
    this.filterPanelKindSearch.set('');
    this.textSearchQuery.set('');
  }

  clearTextSearch(): void {
    this.textSearchQuery.set('');
  }

  private entryMatchesFreeText(e: MedicalHistoryEntry, query: string): boolean {
    const m = kindMeta(e.kind);
    return (
      viFoldIncludes(e.title, query) ||
      viFoldIncludes(e.detail, query) ||
      viFoldIncludes(e.place || '', query) ||
      viFoldIncludes(m.label, query) ||
      viFoldIncludes(m.shortLabel, query) ||
      viFoldIncludes(e.kind.replace(/_/g, ' '), query)
    );
  }

  toggleKindFilter(kind: MedicalEventKind): void {
    this.kindFilterKinds.update((arr) => {
      const next = new Set(arr);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return [...next];
    });
  }

  metaFor(kind: MedicalEventKind): MedicalKindMeta {
    return kindMeta(kind);
  }

  deleteEntry(entry: MedicalHistoryEntry) {
    if (!entry.rowIndex) return;
    if (!confirm(`Xoá "${entry.title}" (${this.formatDateDisplay(entry.date)})?`)) {
      return;
    }
    this.medicalService.deleteEntry(entry.rowIndex).subscribe({
      next: () => {
        this.successMsg.set('Đã xoá.');

        this.activityLogService
          .logMedical(this.userNorm(), 'MEDICAL_DELETED', {
            title: entry.title,
          })
          .subscribe();

        setTimeout(() => this.successMsg.set(''), 3000);
        setTimeout(() => this.load(), 600);
      },
      error: (err) => {
        this.errorMsg.set(err?.message || 'Xoá thất bại.');
      },
    });
  }

  formatDateDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private formatMonthHeading(ym: string): string {
    const [y, m] = ym.split('-');
    const mi = parseInt(m, 10);
    return `Tháng ${mi}/${y}`;
  }
}
