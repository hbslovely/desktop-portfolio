import {
  ChangeDetectionStrategy,
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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ExplorerEntry,
  ExplorerService,
  ExplorerType,
} from '../../../../services/explorer.service';
import {
  MedicalEventKind,
  MedicalHistoryEntry,
  MedicalHistoryService,
} from '../../../../services/medical-history.service';
import {
  MEDICAL_KINDS,
  MedicalKindMeta,
  kindMeta,
} from '../medical-history-kinds.data';
import { DEFAULT_PLACES_VI } from '../medical-places.presets';
import { viFoldIncludes } from '../medical-history-vi.utils';
import { ActivityLogService } from '../../../../services/activity-log.service';

export interface EntryDraft {
  date: string;
  kind: MedicalEventKind;
  title: string;
  detail: string;
  place: string;
}

const EXPLORER_ROOT_ID = 1;
const MEDICAL_FOLDER_NAME = 'Y tế';
const MAX_ATTACH_CHARS = 49000 * 100;

@Component({
  selector: 'app-medical-history-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medical-history-dialog.component.html',
  styleUrls: ['./medical-history-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHistoryDialogComponent {
  private medicalService = inject(MedicalHistoryService);
  private explorerService = inject(ExplorerService);
  private destroyRef = inject(DestroyRef);
  private activityLogService = inject(ActivityLogService);

  user = input<string>('guest');
  explorerEntries = input<ExplorerEntry[]>([]);
  medicalFolderId = input<number | null>(null);
  /** Tiền sử hiện có — gợi ý nơi khám từ mục đã lưu */
  entries = input<MedicalHistoryEntry[]>([]);

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  dialogOpen = signal<boolean>(false);
  draft = signal<EntryDraft>(this.emptyDraft());
  editingEntry = signal<MedicalHistoryEntry | null>(null);

  pendingAttachment = signal<File | null>(null);
  pendingAttachmentPreviewUrl = signal<string | null>(null);
  stripExistingAttachment = signal<boolean>(false);

  kindPickerOpen = signal<boolean>(false);
  kindSearch = signal<string>('');

  placePickerOpen = signal<boolean>(false);
  customPlaces = signal<string[]>([]);

  saving = signal<boolean>(false);
  errorMsg = signal<string>('');

  readonly kindCatalog: readonly MedicalKindMeta[] = MEDICAL_KINDS;
  readonly defaultPlaces = DEFAULT_PLACES_VI;

  explorerById = computed(() => {
    const m = new Map<number, ExplorerEntry>();
    for (const e of this.explorerEntries()) {
      m.set(e.id, e);
    }
    return m;
  });

  userNorm = computed(
    () =>
      String(this.user() || 'guest')
        .toLowerCase()
        .trim() || 'guest'
  );


  filteredKindCatalog = computed(() => {
    const q = this.kindSearch().trim();
    if (!q) return this.kindCatalog;
    return this.kindCatalog.filter(
      (km) =>
        viFoldIncludes(km.label, q) ||
        viFoldIncludes(km.shortLabel, q) ||
        viFoldIncludes(km.id, q)
    );
  });

  placesFromEntries = computed(() => {
    const set = new Set<string>();
    for (const e of this.entries()) {
      const p = this.normalizePlace(e.place || '');
      if (p) set.add(p);
    }
    return [...set];
  });

  filteredPlaceSuggestions = computed(() => {
    const raw = [
      ...this.defaultPlaces,
      ...this.customPlaces(),
      ...this.placesFromEntries(),
    ];
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const p of raw) {
      const t = this.normalizePlace(p);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      uniq.push(t);
    }
    const q = this.normalizePlace(this.draft().place).toLowerCase();
    const filtered = !q
      ? uniq
      : uniq.filter((p) => p.toLowerCase().includes(q));
    filtered.sort((a, b) => a.localeCompare(b, 'vi'));
    return filtered;
  });

  placeSuggestionsUnion = computed(() => {
    const set = new Set<string>();
    for (const p of this.defaultPlaces) {
      set.add(this.normalizePlace(p));
    }
    for (const p of this.customPlaces()) {
      set.add(this.normalizePlace(p));
    }
    for (const e of this.entries()) {
      if (e.place) set.add(this.normalizePlace(e.place));
    }
    return set;
  });

  canAddCustomPlace = computed(() => {
    const t = this.normalizePlace(this.draft().place);
    if (!t) return false;
    return !this.placeSuggestionsUnion().has(t);
  });

  constructor() {
    effect(
      () => {
        this.userNorm();
        this.loadCustomPlacesFromStorage();
      },
      { allowSignalWrites: true }
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: Event): void {
    const path = ev.composedPath?.() ?? [];
    const inCombo = path.some(
      (n) => n instanceof HTMLElement && n.classList.contains('mh-combo')
    );
    if (!inCombo) {
      this.kindPickerOpen.set(false);
      this.placePickerOpen.set(false);
    }
  }

  metaFor(kind: MedicalEventKind): MedicalKindMeta {
    return kindMeta(kind);
  }

  attachmentFor(entry: MedicalHistoryEntry): ExplorerEntry | undefined {
    // Ưu tiên driveFileId trực tiếp từ medical entry  
    if (entry.driveFileId) {
      // Create a minimal ExplorerEntry object for the driveFileId
      return {
        id: -1, // Fake ID for Drive-only files
        name: `med-attachment-${entry.driveFileId}`,
        type: 'file' as ExplorerType,
        parentId: null,
        driveFileId: entry.driveFileId,
        mimeType: 'image/jpeg',
        storageStatus: 'drive',
      };
    }
    
    // Fallback: tìm trong Explorer entries (để tương thích với data cũ)
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

  get maxDateToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  openAdd(): void {
    this.editingEntry.set(null);
    this.draft.set(this.emptyDraft());
    this.resetAttachmentDraft();
    this.errorMsg.set('');
    this.kindPickerOpen.set(false);
    this.placePickerOpen.set(false);
    this.kindSearch.set('');
    this.dialogOpen.set(true);
  }

  openEdit(entry: MedicalHistoryEntry): void {
    if (!entry.rowIndex) return;
    this.editingEntry.set(entry);
    this.draft.set({
      date: entry.date,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail,
      place: entry.place || '',
    });
    this.resetAttachmentDraft();
    this.errorMsg.set('');
    this.kindPickerOpen.set(false);
    this.placePickerOpen.set(false);
    this.kindSearch.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.kindPickerOpen.set(false);
    this.placePickerOpen.set(false);
    this.kindSearch.set('');
    this.resetAttachmentDraft();
    this.closed.emit();
  }

  updateDraft(partial: Partial<EntryDraft>): void {
    this.draft.update((d) => ({ ...d, ...partial }));
  }

  toggleKindPicker(): void {
    const next = !this.kindPickerOpen();
    this.kindPickerOpen.set(next);
    if (next) {
      this.placePickerOpen.set(false);
      this.kindSearch.set('');
    }
  }

  onPlaceFieldFocus(): void {
    this.kindPickerOpen.set(false);
    this.placePickerOpen.set(true);
  }

  selectKind(kind: MedicalEventKind): void {
    this.updateDraft({ kind });
    this.kindPickerOpen.set(false);
    this.kindSearch.set('');
  }

  selectPlace(place: string): void {
    this.updateDraft({ place: this.normalizePlace(place) });
    this.placePickerOpen.set(false);
  }

  addCustomPlaceFromDraft(): void {
    const t = this.normalizePlace(this.draft().place);
    if (!t) return;
    if (this.placeSuggestionsUnion().has(t)) return;
    this.customPlaces.update((arr) => {
      if (arr.some((x) => this.normalizePlace(x) === t)) return arr;
      return [...arr, t];
    });
    this.persistCustomPlaces();
  }

  onAttachmentInput(input: HTMLInputElement): void {
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length === 0) return;
    const file = files[0];
    if (!this.isImageFile(file)) {
      this.errorMsg.set(
        'Chỉ hỗ trợ ảnh (jpg, png, heic…). Thử chụp lại hoặc chọn từ thư viện.'
      );
      return;
    }
    this.errorMsg.set('');
    this.stripExistingAttachment.set(false);
    this.clearPendingOnly();
    this.pendingAttachment.set(file);
    this.pendingAttachmentPreviewUrl.set(URL.createObjectURL(file));
  }

  clearPendingAttachment(): void {
    this.clearPendingOnly();
  }

  removeSavedAttachment(): void {
    this.clearPendingOnly();
    this.stripExistingAttachment.set(true);
  }

  async submitDialog(): Promise<void> {
    const d = this.draft();
    const title = d.title.trim();
    if (!d.date || !title) {
      this.errorMsg.set('Vui lòng nhập ngày và tiêu đề.');
      return;
    }

    const edit = this.editingEntry();
    const pending = this.pendingAttachment();

    this.saving.set(true);
    this.errorMsg.set('');

    try {
      let driveFileId: string | undefined = edit?.driveFileId;

      if (this.stripExistingAttachment()) {
        driveFileId = undefined;
      }
      if (pending) {
        driveFileId = await this.uploadAttachmentToDrive(pending);
      }

      const base: MedicalHistoryEntry = {
        user: this.userNorm(),
        date: d.date,
        kind: d.kind,
        title,
        detail: d.detail.trim(),
        place: d.place.trim() || undefined,
        driveFileId,
      };

      if (edit?.rowIndex) {
        const patch: {
          date: string;
          kind: MedicalEventKind;
          title: string;
          detail: string;
          place: string;
          driveFileId?: string | null;
        } = {
          date: base.date,
          kind: base.kind,
          title: base.title,
          detail: base.detail,
          place: base.place ?? '',
        };
        if (pending || this.stripExistingAttachment()) {
          patch.driveFileId = driveFileId ?? null;
        }
        await firstValueFrom(
          this.medicalService.updateEntry(edit.rowIndex, patch)
        );
        this.activityLogService
          .logMedical(this.userNorm(), 'MEDICAL_UPDATED', {
            title: base.title,
            location: base.place,
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();
      } else {
        await firstValueFrom(this.medicalService.addEntry(base));
        this.activityLogService
          .logMedical(this.userNorm(), 'MEDICAL_ADDED', {
            title: base.title,
            location: base.place,
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();
      }

      this.dialogOpen.set(false);
      this.kindPickerOpen.set(false);
      this.placePickerOpen.set(false);
      this.kindSearch.set('');
      this.resetAttachmentDraft();
      this.saved.emit();
    } catch (err: unknown) {
      this.errorMsg.set(
        err instanceof Error ? err.message : 'Thao tác thất bại.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  private normalizePlace(s: string): string {
    return String(s ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private placesStorageKey(): string {
    return `medicalCustomPlaces:${this.userNorm()}`;
  }

  private loadCustomPlacesFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.placesStorageKey());
      if (!raw) {
        this.customPlaces.set([]);
        return;
      }
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) {
        this.customPlaces.set([]);
        return;
      }
      this.customPlaces.set(
        arr
          .filter((x): x is string => typeof x === 'string')
          .map((x) => this.normalizePlace(x))
      );
    } catch {
      this.customPlaces.set([]);
    }
  }

  private persistCustomPlaces(): void {
    try {
      localStorage.setItem(
        this.placesStorageKey(),
        JSON.stringify(this.customPlaces())
      );
    } catch {
      /* ignore quota */
    }
  }

  private clearPendingOnly(): void {
    const url = this.pendingAttachmentPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.pendingAttachment.set(null);
    this.pendingAttachmentPreviewUrl.set(null);
  }

  private resetAttachmentDraft(): void {
    this.clearPendingOnly();
    this.stripExistingAttachment.set(false);
  }

  private isImageFile(f: File): boolean {
    const t = (f.type || '').toLowerCase();
    if (t.startsWith('image/')) return true;
    if (
      !t &&
      /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(f.name)
    ) {
      return true;
    }
    return false;
  }

  private emptyDraft(): EntryDraft {
    const t = new Date();
    const y = t.getFullYear();
    const mo = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return {
      date: `${y}-${mo}-${d}`,
      kind: 'checkup',
      title: '',
      detail: '',
      place: '',
    };
  }


  private async compressMedicalImage(file: File): Promise<string> {
    const tries: Array<[number, number]> = [
      [2048, 0.92],
      [1920, 0.9],
      [1600, 0.88],
      [1280, 0.84],
      [1024, 0.8],
      [820, 0.74],
      [640, 0.65],
      [480, 0.55],
    ];
    let last = '';
    for (const [size, q] of tries) {
      last = await this.explorerService.fileToCompressedBase64(
        file,
        size,
        q
      );
      if (last.length <= MAX_ATTACH_CHARS) return last;
    }
    throw new Error(
      `Ảnh quá lớn sau khi nén (~${Math.round(last.length / 1024)}KB). Chọn ảnh nhỏ hơn.`
    );
  }

  private async uploadAttachmentToDrive(file: File): Promise<string> {
    const parentId = await this.ensureMedicalFolderId();
    const dataUrl = await this.compressMedicalImage(file);
    const safeName = `med-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.jpg`;

    const response = await firstValueFrom(
      this.explorerService.uploadMedicalImageToDrive({
        fileName: safeName,
        dataUrl,
        mimeType: 'image/jpeg',
        sizeBytes: this.estimateBase64Bytes(dataUrl),
        parentId,
      })
    );

    if (!response.driveFileId) {
      throw new Error('Không nhận được Drive file ID sau khi upload ảnh.');
    }
    
    return response.driveFileId;
  }

  private async ensureMedicalFolderId(): Promise<number> {
    const cached = this.medicalFolderId();
    if (cached != null) return cached;

    let all =
      this.explorerEntries().length > 0
        ? this.explorerEntries()
        : await firstValueFrom(this.explorerService.getEntries());

    let folder = all.find(
      (e) =>
        e.type === 'folder' &&
        e.parentId === EXPLORER_ROOT_ID &&
        e.name === MEDICAL_FOLDER_NAME
    );
    if (folder?.id) {
      return folder.id;
    }

    await firstValueFrom(
      this.explorerService.addEntry({
        name: MEDICAL_FOLDER_NAME,
        type: 'folder',
        parentId: EXPLORER_ROOT_ID,
      })
    );

    all = await firstValueFrom(this.explorerService.getEntries());
    folder = all.find(
      (e) =>
        e.type === 'folder' &&
        e.parentId === EXPLORER_ROOT_ID &&
        e.name === MEDICAL_FOLDER_NAME
    );
    if (!folder?.id) {
      throw new Error(
        'Không tạo được thư mục « Y tế » trong tab Tài liệu.'
      );
    }
    return folder.id;
  }

  private estimateBase64Bytes(dataUrl: string): number {
    const commaIdx = dataUrl.indexOf(',');
    const payload = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    if (!payload) return 0;
    let padding = 0;
    if (payload.endsWith('==')) padding = 2;
    else if (payload.endsWith('=')) padding = 1;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
}
