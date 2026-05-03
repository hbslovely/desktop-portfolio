import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  ExplorerEntry,
  ExplorerService,
} from '../../../services/explorer.service';
import {
  MedicalEventKind,
  MedicalHistoryEntry,
  MedicalHistoryService,
} from '../../../services/medical-history.service';
import {
  MEDICAL_KINDS,
  MedicalKindMeta,
  kindMeta,
} from './medical-history-kinds.data';
import { DEFAULT_PLACES_VI } from './medical-places.presets';

interface EntryDraft {
  date: string;
  kind: MedicalEventKind;
  title: string;
  detail: string;
  place: string;
}

const EXPLORER_ROOT_ID = 1;
const MEDICAL_FOLDER_NAME = 'Y tế';
const MAX_ATTACH_CHARS = 49000 * 100;

/** Bỏ dấu + đ → d để so khớp tiếng Việt (ô≈o, ă≈a…) */
function foldViKey(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase();
}

/** So khớp chuỗi con sau khi gộp dấu — gõ "o" hay "ô" đều được */
function viFoldIncludes(haystack: string, needle: string): boolean {
  const n = foldViKey(needle);
  if (!n) return true;
  return foldViKey(haystack).includes(n);
}

@Component({
  selector: 'app-medical-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medical-history.component.html',
  styleUrls: ['./medical-history.component.scss'],
})
export class MedicalHistoryComponent {
  private medicalService = inject(MedicalHistoryService);
  private explorerService = inject(ExplorerService);

  /** Cùng `?user=` với trang feeding */
  user = input<string>('guest');

  entries = signal<MedicalHistoryEntry[]>([]);
  /** Explorer entries — dùng để resolve ảnh đính kèm + tạo thư mục « Y tế » */
  explorerEntries = signal<ExplorerEntry[]>([]);
  medicalFolderId = signal<number | null>(null);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  /**
   * Lọc theo một hoặc nhiều loại — rỗng = không giới hạn (tương đương « Tất cả »).
   */
  kindFilterKinds = signal<MedicalEventKind[]>([]);

  /** Panel lọc gọn (thay cho hàng chip đầy đủ) */
  filterPanelOpen = signal<boolean>(false);
  filterPanelKindSearch = signal<string>('');
  /** Thứ tự tháng / mục trong timeline */
  timelineSort = signal<'newest' | 'oldest'>('newest');
  /** Thứ tự danh sách loại trong panel */
  kindListSort = signal<'count' | 'alpha'>('count');

  kindPickerOpen = signal<boolean>(false);
  kindSearch = signal<string>('');

  placePickerOpen = signal<boolean>(false);
  /** Nơi khám do người dùng thêm — lưu theo user */
  customPlaces = signal<string[]>([]);

  dialogOpen = signal<boolean>(false);
  draft = signal<EntryDraft>(this.emptyDraft());
  editingEntry = signal<MedicalHistoryEntry | null>(null);

  /** Ảnh chọn tạm (chưa lên Explorer cho đến khi Lưu) */
  pendingAttachment = signal<File | null>(null);
  pendingAttachmentPreviewUrl = signal<string | null>(null);
  /** Khi sửa: gỡ ảnh đã lưu */
  stripExistingAttachment = signal<boolean>(false);

  readonly kindCatalog: readonly MedicalKindMeta[] = MEDICAL_KINDS;
  readonly defaultPlaces = DEFAULT_PLACES_VI;

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

  /** Loại hiển thị trong panel (search + sort) */
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

  kindFilterKindSet = computed(
    () => new Set(this.kindFilterKinds())
  );

  kindFilterSummary = computed(() => {
    const sel = this.kindFilterKinds();
    if (sel.length === 0) return 'Tất cả loại';
    if (sel.length === 1) return kindMeta(sel[0]).label;
    if (sel.length <= 3) {
      return sel
        .map((id) => kindMeta(id).shortLabel)
        .join(' · ');
    }
    return `${sel.length} loại`;
  });

  placesFromEntries = computed(() => {
    const set = new Set<string>();
    for (const e of this.myEntries()) {
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
    for (const e of this.myEntries()) {
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
    this.load();
    effect(() => {
      this.userNorm();
      this.loadCustomPlacesFromStorage();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: Event): void {
    const path = ev.composedPath?.() ?? [];
    const inCombo = path.some(
      (n) => n instanceof HTMLElement && n.classList.contains('mh-combo')
    );
    const inFilter = path.some(
      (n) => n instanceof HTMLElement && n.classList.contains('mh-filter')
    );
    if (!inCombo) {
      this.kindPickerOpen.set(false);
      this.placePickerOpen.set(false);
    }
    if (!inFilter) {
      this.filterPanelOpen.set(false);
    }
  }

  refresh() {
    this.load();
  }

  userNorm = computed(() =>
    String(this.user() || 'guest')
      .toLowerCase()
      .trim() || 'guest'
  );

  explorerById = computed(() => {
    const m = new Map<number, ExplorerEntry>();
    for (const e of this.explorerEntries()) {
      m.set(e.id, e);
    }
    return m;
  });

  myEntries = computed(() => {
    const u = this.userNorm();
    return this.entries().filter((e) => e.user === u);
  });

  filteredEntries = computed(() => {
    const rows = this.myEntries();
    const sel = this.kindFilterKinds();
    if (sel.length === 0) return rows;
    const allow = new Set(sel);
    return rows.filter((e) => allow.has(e.kind));
  });

  /** Nhóm timeline theo tháng (V2) */
  timelineGroups = computed(() => {
    const list = this.filteredEntries();
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
    forkJoin({
      medical: this.medicalService.getEntries(),
      explorer: this.explorerService.getEntries(),
    }).subscribe({
      next: ({ medical, explorer }) => {
        this.entries.set(medical);
        this.explorerEntries.set(explorer);
        const folder = explorer.find(
          (e) =>
            e.type === 'folder' &&
            e.parentId === EXPLORER_ROOT_ID &&
            e.name === MEDICAL_FOLDER_NAME
        );
        this.medicalFolderId.set(folder?.id ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.errorMsg.set(
          'Không tải được tiền sử. Thêm tab "MedicalHistory" trong Sheet và redeploy Apps Script (xem FEEDING_SETUP).'
        );
      },
    });
  }

  attachmentFor(entry: MedicalHistoryEntry): ExplorerEntry | undefined {
    const id = entry.attachmentExplorerId;
    if (!id) return undefined;
    return this.explorerById().get(id);
  }

  toggleFilterPanel(): void {
    this.filterPanelOpen.update((v) => !v);
  }

  /** Xóa lọc — hiển thị mọi loại */
  clearKindFilters(): void {
    this.kindFilterKinds.set([]);
  }

  /** Đặt lại toàn bộ tùy chọn trong panel lọc */
  resetFilterPanel(): void {
    this.kindFilterKinds.set([]);
    this.timelineSort.set('newest');
    this.kindListSort.set('count');
    this.filterPanelKindSearch.set('');
  }

  /** Bật/tắt một loại trong bộ lọc */
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

  toggleKindPicker(): void {
    this.kindPickerOpen.update((o) => !o);
    if (this.kindPickerOpen()) {
      this.kindSearch.set('');
    }
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
        arr.filter((x): x is string => typeof x === 'string').map((x) => this.normalizePlace(x))
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

  private clearPendingOnly() {
    const url = this.pendingAttachmentPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.pendingAttachment.set(null);
    this.pendingAttachmentPreviewUrl.set(null);
  }

  private resetAttachmentDraft() {
    this.clearPendingOnly();
    this.stripExistingAttachment.set(false);
  }

  openAddDialog() {
    this.editingEntry.set(null);
    this.draft.set(this.emptyDraft());
    this.resetAttachmentDraft();
    this.errorMsg.set('');
    this.successMsg.set('');
    this.kindPickerOpen.set(false);
    this.placePickerOpen.set(false);
    this.kindSearch.set('');
    this.dialogOpen.set(true);
  }

  closeDialog() {
    this.dialogOpen.set(false);
    this.kindPickerOpen.set(false);
    this.placePickerOpen.set(false);
    this.kindSearch.set('');
    this.resetAttachmentDraft();
  }

  updateDraft(partial: Partial<EntryDraft>) {
    this.draft.update((d) => ({ ...d, ...partial }));
  }

  onAttachmentInput(input: HTMLInputElement) {
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

  clearPendingAttachment() {
    this.clearPendingOnly();
  }

  removeSavedAttachment() {
    this.clearPendingOnly();
    this.stripExistingAttachment.set(true);
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

  async submitDialog() {
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
    this.successMsg.set('');

    try {
      let attachmentExplorerId: number | undefined = edit?.attachmentExplorerId;

      if (this.stripExistingAttachment()) {
        attachmentExplorerId = undefined;
      }
      if (pending) {
        attachmentExplorerId = await this.uploadAttachmentToExplorer(pending);
      }

      const base: MedicalHistoryEntry = {
        user: this.userNorm(),
        date: d.date,
        kind: d.kind,
        title,
        detail: d.detail.trim(),
        place: d.place.trim() || undefined,
        attachmentExplorerId,
      };

      if (edit?.rowIndex) {
        const patch: {
          date: string;
          kind: MedicalEventKind;
          title: string;
          detail: string;
          place: string;
          attachmentExplorerId?: number | null;
        } = {
          date: base.date,
          kind: base.kind,
          title: base.title,
          detail: base.detail,
          place: base.place ?? '',
        };
        if (pending || this.stripExistingAttachment()) {
          patch.attachmentExplorerId =
            attachmentExplorerId ?? null;
        }
        await firstValueFrom(
          this.medicalService.updateEntry(edit.rowIndex, patch)
        );
        this.successMsg.set('Đã cập nhật.');
      } else {
        await firstValueFrom(this.medicalService.addEntry(base));
        this.successMsg.set('Đã lưu sự kiện.');
      }

      setTimeout(() => this.successMsg.set(''), 3000);
      this.closeDialog();
      setTimeout(() => this.load(), 600);
    } catch (err: unknown) {
      this.errorMsg.set(
        err instanceof Error ? err.message : 'Thao tác thất bại.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  openEdit(entry: MedicalHistoryEntry) {
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

  deleteEntry(entry: MedicalHistoryEntry) {
    if (!entry.rowIndex) return;
    if (
      !confirm(
        `Xoá "${entry.title}" (${this.formatDateDisplay(entry.date)})?`
      )
    ) {
      return;
    }
    this.medicalService.deleteEntry(entry.rowIndex).subscribe({
      next: () => {
        this.successMsg.set('Đã xoá.');
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

  get maxDateToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async ensureMedicalFolderId(): Promise<number> {
    let cached = this.medicalFolderId();
    if (cached != null) return cached;

    let all =
      this.explorerEntries().length > 0
        ? this.explorerEntries()
        : await firstValueFrom(this.explorerService.getEntries());
    this.explorerEntries.set(all);

    let folder = all.find(
      (e) =>
        e.type === 'folder' &&
        e.parentId === EXPLORER_ROOT_ID &&
        e.name === MEDICAL_FOLDER_NAME
    );
    if (folder?.id) {
      this.medicalFolderId.set(folder.id);
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
    this.explorerEntries.set(all);
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
    this.medicalFolderId.set(folder.id);
    return folder.id;
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

  private async uploadAttachmentToExplorer(file: File): Promise<number> {
    const parentId = await this.ensureMedicalFolderId();
    const dataUrl = await this.compressMedicalImage(file);
    const safeName = `med-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.jpg`;

    await firstValueFrom(
      this.explorerService.addEntry({
        name: safeName,
        type: 'file',
        parentId,
        content: dataUrl,
      })
    );

    const all = await firstValueFrom(this.explorerService.getEntries());
    this.explorerEntries.set(all);

    const found = all.find(
      (e) =>
        e.type === 'file' &&
        e.parentId === parentId &&
        e.name === safeName
    );
    if (!found?.id) {
      throw new Error(
        'Đã gửi ảnh nhưng chưa thấy file trên Explorer — bấm Tải lại trên trang chủ.'
      );
    }
    return found.id;
  }
}
