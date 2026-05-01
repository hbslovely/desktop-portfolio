import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ExplorerEntry,
  ExplorerService,
} from '../../../services/explorer.service';

interface Crumb {
  id: number;
  name: string;
}

/**
 * Draft cho modal Add / Rename.
 *
 * Dùng chung cho cả thư mục **và** file (rename). `entryType` xác định
 * UI string + icon. Mode `add` hiện chỉ áp dụng cho folder (file thêm qua
 * upload, không qua modal text).
 */
interface EntryDraft {
  mode: 'add' | 'rename';
  /** Loại entry đang đổi: folder hoặc file. Mặc định 'folder'. */
  entryType: 'folder' | 'file';
  /** id entry đang rename. Khi `mode === 'add'` → undefined. */
  targetId?: number;
  /**
   * Phần tên USER nhìn thấy + chỉnh trong input. Với file đang rename,
   * đây là **base name** (đã tách extension) — user khỏi phải gõ `.jpg`.
   */
  name: string;
  /**
   * Phần extension (bao gồm dấu chấm, vd `.jpg`). Chỉ set khi rename file.
   * Lúc submit sẽ được nối lại trừ khi user tự gõ extension khác.
   */
  extension?: string;
}

export type ViewMode = 'large' | 'icons' | 'detail';

/**
 * Tối đa ký tự cho content base64 sau khi nén.
 *
 * Server hỗ trợ chia content ra **100 cells** (E + H..DB) × ~49.000 ký tự/cell
 * = ~4.900.000 ký tự ≈ 3.6MB binary JPEG. Dung lượng này cho phép giữ chất
 * lượng ảnh cao hơn rất nhiều so với cấu hình cũ.
 */
const MAX_CELL_CHARS = 49000 * 100;

const VIEW_MODE_KEY = 'documents:viewMode';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
})
export class DocumentsComponent {
  private explorerService = inject(ExplorerService);

  /** id của root folder. App giả định row đầu tiên (id=1) là root. */
  private readonly ROOT_ID = 1;

  // ===== State =====
  entries = signal<ExplorerEntry[]>([]);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  /** Folder hiện tại đang xem. Mặc định = root. */
  currentFolderId = signal<number>(this.ROOT_ID);

  /**
   * Draft cho modal: add folder, rename folder, hoặc rename file.
   * Tên giữ là `folderDraft` để tránh churn template, nhưng kiểu giờ là
   * `EntryDraft` chứa `entryType` để phân biệt.
   */
  folderDraft = signal<EntryDraft | null>(null);

  /** File preview fullscreen */
  previewEntry = signal<ExplorerEntry | null>(null);

  /** Chế độ xem: large icons / small icons / detail list. Persist qua localStorage. */
  viewMode = signal<ViewMode>(this.loadViewMode());

  /** Dropdown menu thư mục (Thêm thư mục / Đổi tên thư mục hiện tại) */
  folderMenuOpen = signal<boolean>(false);

  /**
   * Dropdown 3-chấm trong selection action bar — gom Tải xuống / Cắt /
   * Xoá vào 1 menu để bar đỡ rối khi nhiều nút.
   */
  selectActionsMenuOpen = signal<boolean>(false);

  // ===== Search state =====
  /**
   * Toggle thanh search trong toolbar. Khi true, breadcrumb sẽ ẩn đi và
   * input chiếm chỗ; phím tắt `/` (không trong input) cũng mở search.
   */
  searchOpen = signal<boolean>(false);

  /** Query hiện tại — trim/lowercase được tính ở `searchResults` & highlight. */
  searchQuery = signal<string>('');

  /**
   * id entry vừa được click trong search result — để pulse highlight ~1.5s
   * sau khi navigate, giúp user tìm thấy item trong thư mục đông đúc.
   */
  highlightedEntryId = signal<number | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  // ===== Selection / clipboard state =====
  /** Khi true: click vào file/folder = toggle chọn (không mở preview/navigate). */
  selectMode = signal<boolean>(false);
  /** Tập id (file HOẶC folder) đang được tích chọn. Root không bao giờ vào. */
  selectedIds = signal<Set<number>>(new Set());
  /**
   * Clipboard cho cut & paste. Chứa cả file lẫn folder ids. Server kiểm
   * tra chu kỳ (folder không paste được vào chính nó hoặc descendant)
   * — client cũng check sớm để báo lỗi rõ ràng trước khi gọi API.
   */
  clipboard = signal<{ ids: number[] } | null>(null);

  /** Tiến độ upload nhiều file: hiện "Đang tải 3/8…". */
  uploadProgress = signal<{ done: number; total: number; failed: number } | null>(
    null
  );

  // ===== Image preview zoom & pan =====
  /**
   * Trạng thái zoom/pan của ảnh preview:
   *  - `previewScale = 1`: ảnh fit, không cho pan.
   *  - `> 1`: ảnh phóng to, có thể kéo (1 ngón / chuột) hoặc zoom toàn cục
   *    (wheel / pinch / nút).
   *
   * Click vào nền KHÔNG đóng preview — user phải bấm nút × hoặc Esc. Tránh
   * tình trạng vô tình tap ra ngoài (nhất là trên mobile) làm mất ảnh.
   *
   * Transform áp dụng lên `<img>`: `translate(tx, ty) scale(s)`. Reference
   * point = tâm của stage (DIV chứa ảnh, không bị transform). Khi zoom vào
   * 1 toạ độ cụ thể, dịch chuyển translate sao cho điểm đó đứng yên trong
   * viewport (xem `applyZoom` bên dưới).
   */
  previewScale = signal<number>(1);
  previewTx = signal<number>(0);
  previewTy = signal<number>(0);
  /** True khi đang drag/pinch — tắt CSS transition để response tức thì. */
  previewInteracting = signal<boolean>(false);

  private readonly MIN_ZOOM = 1;
  private readonly MAX_ZOOM = 6;
  /** Hệ số zoom mỗi lần bấm nút +/-. Zoom đôi mỗi 2 lần bấm là vừa phải. */
  private readonly ZOOM_STEP = 1.4;

  /** Toạ độ con trỏ đang active (cho pinch & pan). pointerId → {x, y}. */
  private pointers = new Map<number, { x: number; y: number }>();
  /** Snapshot khi bắt đầu pan 1 ngón / chuột. */
  private panStart: {
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null = null;
  /** Snapshot khi bắt đầu pinch 2 ngón. */
  private pinchStart: {
    dist: number;
    scale: number;
    tx: number;
    ty: number;
    midX: number;
    midY: number;
    centerX: number;
    centerY: number;
  } | null = null;
  /** True nếu trong 1 lượt tương tác đã có drag/pinch — chặn click backdrop. */
  private didPan = false;

  /** CSS transform string áp lên `<img class="docs-preview__img">`. */
  previewTransform = computed(
    () =>
      `translate3d(${ this.previewTx() }px, ${ this.previewTy() }px, 0) scale(${ this.previewScale() })`
  );

  previewZoomPercent = computed(() => Math.round(this.previewScale() * 100));
  canZoomIn = computed(() => this.previewScale() < this.MAX_ZOOM - 0.001);
  canZoomOut = computed(() => this.previewScale() > this.MIN_ZOOM + 0.001);

  /**
   * Danh sách file ảnh ANH/EM trong cùng thư mục cha của entry đang preview.
   * Dùng để chuyển ảnh trước/sau bằng nút mũi tên hoặc phím ←/→ mà không
   * phải đóng preview rồi mở lại.
   *
   * Sort theo cùng thứ tự lưới hiển thị (alphabet vi locale) để index khớp.
   * Folder bị loại — chỉ điều hướng giữa các file. Soft-deleted entries đã
   * được service filter trước.
   */
  previewSiblings = computed<ExplorerEntry[]>(() => {
    const cur = this.previewEntry();
    if (!cur) return [];
    const parentId = cur.parentId;
    return this.entries()
      .filter((e) => e.parentId === parentId && e.type === 'file')
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  });

  previewIndex = computed<number>(() => {
    const cur = this.previewEntry();
    if (!cur) return -1;
    return this.previewSiblings().findIndex((e) => e.id === cur.id);
  });

  /** Tổng số ảnh trong thư mục — dùng cho counter "3/12". */
  previewTotal = computed<number>(() => this.previewSiblings().length);

  canPreviewPrev = computed<boolean>(() => this.previewIndex() > 0);
  canPreviewNext = computed<boolean>(() => {
    const idx = this.previewIndex();
    const total = this.previewSiblings().length;
    return idx >= 0 && idx < total - 1;
  });

  // ===== Derived =====
  entriesById = computed<Map<number, ExplorerEntry>>(() => {
    const m = new Map<number, ExplorerEntry>();
    for (const e of this.entries()) m.set(e.id, e);
    return m;
  });

  /** Children của folder hiện tại, sort: folder trước, file sau, theo tên. */
  currentChildren = computed<ExplorerEntry[]>(() => {
    const cid = this.currentFolderId();
    return this.entries()
      .filter((e) => e.parentId === cid)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, 'vi');
      });
  });

  currentFolder = computed<ExplorerEntry | null>(() => {
    return this.entriesById().get(this.currentFolderId()) || null;
  });

  /**
   * Breadcrumb từ root → folder hiện tại. **KHÔNG bao gồm root** theo yêu
   * cầu: chỉ hiện đường dẫn dưới root.
   */
  breadcrumbs = computed<Crumb[]>(() => {
    const map = this.entriesById();
    const path: Crumb[] = [];
    let id: number | null = this.currentFolderId();
    let safety = 32;
    while (id !== null && safety-- > 0) {
      const e: ExplorerEntry | undefined = map.get(id);
      if (!e) break;
      if (e.id === this.ROOT_ID) break;
      path.unshift({ id: e.id, name: e.name });
      id = e.parentId;
    }
    return path;
  });

  isAtRoot = computed<boolean>(() => this.currentFolderId() === this.ROOT_ID);

  folderCount = computed<number>(
    () => this.currentChildren().filter((e) => e.type === 'folder').length
  );
  fileCount = computed<number>(
    () => this.currentChildren().filter((e) => e.type === 'file').length
  );

  selectedCount = computed<number>(() => this.selectedIds().size);

  /**
   * True khi mọi entry CON ở folder hiện tại đều đang được chọn (cả folder
   * lẫn file, trừ root). Dùng cho nút "Chọn tất cả".
   */
  allFilesSelected = computed<boolean>(() => {
    const ids = this.currentChildren()
      .filter((e) => e.id !== this.ROOT_ID)
      .map((e) => e.id);
    if (ids.length === 0) return false;
    const sel = this.selectedIds();
    return ids.every((id) => sel.has(id));
  });

  /** True nếu trong selection có ít nhất 1 file — dùng enable nút Download. */
  selectionHasFile = computed<boolean>(() => {
    const map = this.entriesById();
    for (const id of this.selectedIds()) {
      const e = map.get(id);
      if (e?.type === 'file') return true;
    }
    return false;
  });

  /**
   * Search result: filter mọi entry (folder + file) khắp cây theo
   * `searchQuery`. Loại root và soft-deleted (đã filter ở service).
   * Sort: folder trước, sau đó theo tên (vi locale).
   *
   * Empty query → mảng rỗng (UI sẽ hiện hint "Gõ để tìm…").
   */
  searchResults = computed<ExplorerEntry[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return this.entries()
      .filter((e) => e.id !== this.ROOT_ID && e.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, 'vi');
      })
      .slice(0, 200);
  });

  constructor() {
    this.loadEntries();
  }

  // ===== Loading =====
  loadEntries() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.explorerService.getEntries().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
        // Nếu folder hiện tại đã bị xoá ở nơi khác → fallback về root.
        if (!this.entriesById().has(this.currentFolderId())) {
          this.currentFolderId.set(this.ROOT_ID);
        }
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.errorMsg.set(
          'Không tải được danh sách. Kiểm tra tab "Explorer" và quyền truy cập sheet.'
        );
      },
    });
  }

  refresh() {
    this.loadEntries();
  }

  // ===== Navigation =====
  openFolder(id: number) {
    this.currentFolderId.set(id);
  }

  goToCrumb(id: number) {
    this.currentFolderId.set(id);
  }

  goRoot() {
    this.currentFolderId.set(this.ROOT_ID);
  }

  // ===== View mode =====
  setViewMode(mode: ViewMode) {
    this.viewMode.set(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
  }

  private loadViewMode(): ViewMode {
    try {
      const v = localStorage.getItem(VIEW_MODE_KEY);
      if (v === 'large' || v === 'icons' || v === 'detail') return v;
    } catch {
      /* ignore */
    }
    return 'large';
  }

  // ===== Folder dropdown menu =====
  toggleFolderMenu(ev?: Event) {
    ev?.stopPropagation();
    this.folderMenuOpen.update((v) => !v);
  }

  closeFolderMenu() {
    this.folderMenuOpen.set(false);
  }

  // ===== Selection actions ellipsis menu =====
  toggleSelectActionsMenu(ev?: Event) {
    ev?.stopPropagation();
    this.selectActionsMenuOpen.update((v) => !v);
  }

  closeSelectActionsMenu() {
    this.selectActionsMenuOpen.set(false);
  }

  // ===== Search =====
  /**
   * Mở thanh search (hoặc đóng nếu đang mở). Khi đóng → clear query.
   * Khi mở → focus input ở chu kỳ tick kế tiếp (tránh template chưa render).
   */
  toggleSearch(ev?: Event) {
    ev?.stopPropagation();
    const next = !this.searchOpen();
    this.searchOpen.set(next);
    if (!next) {
      this.searchQuery.set('');
    } else {
      // Đóng các overlay khác đang mở để tránh xung đột.
      this.folderMenuOpen.set(false);
      this.selectActionsMenuOpen.set(false);
      // Focus input sau khi *ngIf render xong.
      setTimeout(() => {
        const el = document.querySelector(
          '.docs-search-input'
        ) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }, 0);
    }
  }

  closeSearch() {
    this.searchOpen.set(false);
    this.searchQuery.set('');
  }

  /** Hai-way binding cho input search (dùng `[ngModel]` + change). */
  setSearchQuery(v: string) {
    this.searchQuery.set(v);
  }

  /**
   * Click 1 result trong list:
   *  - Folder → navigate vào.
   *  - File → set folder hiện tại = parent của file (để breadcrumb +
   *    siblings preview đúng), sau đó mở preview.
   * Đóng search và pulse highlight trên item ~1.5s.
   */
  clickSearchResult(entry: ExplorerEntry, ev?: Event) {
    ev?.stopPropagation();
    this.closeSearch();
    if (entry.type === 'folder') {
      this.openFolder(entry.id);
    } else {
      if (entry.parentId !== null) {
        this.currentFolderId.set(entry.parentId);
      }
      this.openPreview(entry);
    }
    this.pulseHighlight(entry.id);
  }

  /**
   * Bật highlight ngắn hạn cho 1 entry — UI bind class `is-flash` để pulse.
   * Tự tắt sau 1.5s. Cancel timer cũ nếu user click liên tiếp nhiều result.
   */
  private pulseHighlight(id: number) {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightedEntryId.set(id);
    this.highlightTimer = setTimeout(() => {
      this.highlightedEntryId.set(null);
      this.highlightTimer = null;
    }, 1500);
  }

  /**
   * Build path string của 1 entry (vd "docs / reports / 2026-04") — không
   * gồm tên entry, chỉ ancestor chain (loại root). Dùng trong search result
   * để user biết item nằm ở đâu.
   */
  getEntryPath(entry: ExplorerEntry): string {
    const map = this.entriesById();
    const parts: string[] = [];
    let safety = 32;
    let cur: ExplorerEntry | undefined =
      entry.parentId !== null ? map.get(entry.parentId) : undefined;
    while (cur && safety-- > 0) {
      if (cur.id === this.ROOT_ID) break;
      parts.unshift(cur.name);
      cur = cur.parentId !== null ? map.get(cur.parentId) : undefined;
    }
    return parts.length ? parts.join(' / ') : 'Thư mục gốc';
  }

  /**
   * Cắt 1 string thành các segment {text, match} để render <mark> highlight
   * cho phần khớp query. Case-insensitive. Empty query → nguyên chuỗi.
   *
   * Vẫn giữ được chữ hoa/thường gốc (chỉ dùng lower để tìm vị trí). Không
   * normalize accent — user gõ có dấu hay không thì cứ match nguyên dạng,
   * giữ logic đơn giản và dự đoán được.
   */
  highlightSegments(name: string, query: string): { text: string; match: boolean }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [{ text: name, match: false }];
    const lower = name.toLowerCase();
    const segments: { text: string; match: boolean }[] = [];
    let i = 0;
    while (i < name.length) {
      const idx = lower.indexOf(q, i);
      if (idx === -1) {
        segments.push({ text: name.slice(i), match: false });
        break;
      }
      if (idx > i) segments.push({ text: name.slice(i, idx), match: false });
      segments.push({ text: name.slice(idx, idx + q.length), match: true });
      i = idx + q.length;
    }
    return segments;
  }

  /** Đóng tất cả popover khi click ra ngoài */
  @HostListener('document:click')
  onDocumentClick() {
    if (this.folderMenuOpen()) this.folderMenuOpen.set(false);
    if (this.selectActionsMenuOpen()) this.selectActionsMenuOpen.set(false);
  }

  // ===== Folder + File add / rename =====
  openAddFolder() {
    this.folderMenuOpen.set(false);
    this.folderDraft.set({ mode: 'add', entryType: 'folder', name: '' });
    this.errorMsg.set('');
  }

  /** Đổi tên folder HIỆN TẠI (folder đang đứng trong). Disabled ở root. */
  openRenameCurrentFolder() {
    this.folderMenuOpen.set(false);
    const cur = this.currentFolder();
    if (!cur || cur.id === this.ROOT_ID) return;
    this.folderDraft.set({
      mode: 'rename',
      entryType: 'folder',
      targetId: cur.id,
      name: cur.name,
    });
    this.errorMsg.set('');
  }

  openRenameFolder(entry: ExplorerEntry) {
    if (entry.type !== 'folder') return;
    this.folderDraft.set({
      mode: 'rename',
      entryType: 'folder',
      targetId: entry.id,
      name: entry.name,
    });
    this.errorMsg.set('');
  }

  /**
   * Đổi tên 1 file. Tách base name khỏi extension trước khi đặt vào input
   * — user không phải lo chuyện gõ `.jpg`. Lúc submit sẽ tự ghép lại trừ
   * khi user gõ extension khác (ví dụ chuyển `.png`).
   */
  openRenameFile(entry: ExplorerEntry, ev?: Event) {
    ev?.stopPropagation();
    if (entry.type !== 'file') return;
    const ext = this.extractExtension(entry.name);
    const base = ext ? entry.name.slice(0, -ext.length) : entry.name;
    this.folderDraft.set({
      mode: 'rename',
      entryType: 'file',
      targetId: entry.id,
      name: base,
      extension: ext || '.jpg',
    });
    this.errorMsg.set('');
  }

  /**
   * Trích phần extension cuối tên file (bao gồm dấu chấm). Chấp nhận
   * 2-5 ký tự alphanum sau dấu chấm cuối cùng để tránh nhầm với tên có
   * dấu chấm ở giữa (vd `2026.04.29-cat.jpg` → `.jpg`).
   */
  private extractExtension(filename: string): string {
    const m = filename.match(/(\.[a-z0-9]{2,5})$/i);
    return m ? m[1] : '';
  }

  closeFolderDraft() {
    this.folderDraft.set(null);
  }

  updateFolderDraftName(v: string) {
    this.folderDraft.update((d) => (d ? { ...d, name: v } : d));
  }

  submitFolderDraft() {
    const d = this.folderDraft();
    if (!d) return;
    let name = d.name.trim();
    if (!name) {
      this.errorMsg.set(
        d.entryType === 'file' ? 'Vui lòng nhập tên file.' : 'Vui lòng nhập tên thư mục.'
      );
      return;
    }

    // Đảm bảo file luôn có extension:
    //  - Nếu user gõ tay extension khác (vd `.png`) → tôn trọng.
    //  - Nếu không có extension → ghép lại extension gốc đã tách lúc mở
    //    modal (`d.extension`). Fallback `.jpg` cho trường hợp file legacy
    //    không có extension và đang được rename lần đầu.
    if (d.entryType === 'file' && !/\.[a-z0-9]{2,5}$/i.test(name)) {
      name = `${ name }${ d.extension || '.jpg' }`;
    }

    if (d.mode === 'add') {
      this.saving.set(true);
      this.errorMsg.set('');
      this.explorerService
        .addEntry({
          name,
          type: 'folder',
          parentId: this.currentFolderId(),
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.folderDraft.set(null);
            this.flashSuccess(`Đã tạo thư mục "${name}"`);
            setTimeout(() => this.loadEntries(), 800);
          },
          error: (err) => {
            this.saving.set(false);
            this.errorMsg.set(err?.message || 'Tạo thư mục thất bại.');
          },
        });
    } else if (d.mode === 'rename' && d.targetId) {
      this.saving.set(true);
      this.errorMsg.set('');
      const targetId = d.targetId;
      this.explorerService
        .updateEntry(targetId, { name })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.folderDraft.set(null);
            // Cập nhật cục bộ entry trong preview nếu user vừa đổi tên ảnh
            // đang xem — tránh phải đợi reload mới thấy tên mới.
            this.previewEntry.update((p) =>
              p && p.id === targetId ? { ...p, name } : p
            );
            this.flashSuccess(`Đã đổi tên thành "${name}"`);
            setTimeout(() => this.loadEntries(), 800);
          },
          error: (err) => {
            this.saving.set(false);
            this.errorMsg.set(err?.message || 'Đổi tên thất bại.');
          },
        });
    }
  }

  // ===== Delete =====
  deleteEntry(entry: ExplorerEntry) {
    if (entry.id === this.ROOT_ID) return;
    const isFolder = entry.type === 'folder';
    const childCount = this.entries().filter((e) => e.parentId === entry.id)
      .length;

    let msg: string;
    if (isFolder) {
      msg = childCount > 0
        ? `Xoá thư mục "${entry.name}"?\n\nThư mục này chứa ${childCount} mục con — TẤT CẢ con cháu cũng sẽ bị xoá vĩnh viễn.`
        : `Xoá thư mục "${entry.name}"?`;
    } else {
      msg = `Xoá ảnh "${entry.name}"?`;
    }
    if (!confirm(msg)) return;

    this.errorMsg.set('');
    this.explorerService.deleteEntry(entry.id).subscribe({
      next: () => {
        this.flashSuccess(
          isFolder
            ? `Đã xoá thư mục "${entry.name}"`
            : `Đã xoá ảnh "${entry.name}"`
        );
        setTimeout(() => this.loadEntries(), 800);
      },
      error: (err) => {
        this.errorMsg.set(err?.message || 'Xoá thất bại.');
      },
    });
  }

  // ===== File upload (multi) =====
  /**
   * Upload nhiều file ảnh tuần tự. Mỗi file:
   *  1) Compress xuống ≤ MAX_CELL_CHARS (~49.000 ký tự / cell Sheets).
   *  2) Gọi `addEntry`. Apps Script tự stamp `created_at`.
   *
   * Tuần tự (chứ không Promise.all) vì Apps Script web app chạy đơn nhiệm
   * — gửi parallel chỉ tốn time-out chứ không nhanh hơn.
   */
  async onFileSelected(input: HTMLInputElement) {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    // Lọc bỏ file không phải ảnh.
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const skipped = files.length - imageFiles.length;
    if (imageFiles.length === 0) {
      this.errorMsg.set('Chỉ hỗ trợ file ảnh (jpg, png, webp...).');
      input.value = '';
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');
    this.uploadProgress.set({ done: 0, total: imageFiles.length, failed: skipped });

    const targetParent = this.currentFolderId();
    let success = 0;
    let failed = skipped;
    const failedNames: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      try {
        const dataUrl = await this.compressUntilFits(file);
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
        const safeName = `${baseName}.jpg`;

        await firstValueFrom(
          this.explorerService.addEntry({
            name: safeName,
            type: 'file',
            parentId: targetParent,
            content: dataUrl,
          })
        );
        success++;
      } catch (e: unknown) {
        failed++;
        failedNames.push(
          `${file.name}: ${e instanceof Error ? e.message : 'lỗi không rõ'}`
        );
      } finally {
        this.uploadProgress.update((p) =>
          p ? { ...p, done: success } : p
        );
      }
    }

    this.saving.set(false);
    this.uploadProgress.set(null);
    input.value = '';

    if (success > 0 && failed === 0) {
      this.flashSuccess(
        success === 1 ? 'Đã tải lên 1 ảnh' : `Đã tải lên ${success} ảnh`
      );
    } else if (success > 0 && failed > 0) {
      this.flashSuccess(`Đã tải lên ${success}/${success + failed} ảnh`);
      this.errorMsg.set(
        failedNames.length > 0
          ? `Lỗi: ${failedNames.slice(0, 3).join(' | ')}`
          : `${failed} file thất bại.`
      );
    } else {
      this.errorMsg.set(
        failedNames.length > 0
          ? `Tải lên thất bại: ${failedNames.slice(0, 3).join(' | ')}`
          : 'Tải lên thất bại.'
      );
    }

    if (success > 0) {
      setTimeout(() => this.loadEntries(), 1000);
    }
  }

  /**
   * Resize-compress ảnh thử nhiều bậc tới khi <= MAX_CELL_CHARS hoặc fail.
   *
   * Server cho phép tổng ~4.9M ký tự (chia 100 cells), nên các bậc đầu giữ
   * chất lượng rất cao (2048/0.92). Chỉ rớt xuống bậc thấp khi ảnh quá khổ
   * (chụp DSLR / panorama). Bậc thấp cuối cùng (480/0.55) thường ~30-40KB
   * — gần như chắc chắn fit dù ảnh ban đầu là gì.
   */
  private async compressUntilFits(file: File): Promise<string> {
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
      last = await this.explorerService.fileToCompressedBase64(file, size, q);
      if (last.length <= MAX_CELL_CHARS) return last;
    }
    throw new Error(
      `Ảnh quá lớn (${Math.round(last.length / 1024)}KB sau khi nén tối đa). Thử ảnh nhỏ hơn.`
    );
  }

  // ===== File preview =====
  /**
   * Click vào file (file card riêng — không phải detail row):
   *  - Nếu đang `selectMode` → toggle chọn.
   *  - Bình thường → mở preview.
   */
  onFileClick(entry: ExplorerEntry) {
    if (entry.type !== 'file') return;
    if (this.selectMode()) {
      this.toggleSelectEntry(entry.id);
      return;
    }
    this.openPreview(entry);
  }

  /**
   * Click cho cả folder + file (detail row + grid):
   *  - Trong `selectMode`: toggle chọn entry (folder + file đều được).
   *  - Bình thường: folder → navigate, file → preview.
   *
   * Lưu ý: vì selectMode hijack click trên folder để toggle, user muốn
   * chuyển sang folder khác trong lúc đang chọn thì phải dùng breadcrumb.
   */
  onEntryClick(entry: ExplorerEntry) {
    if (this.selectMode()) {
      if (entry.id === this.ROOT_ID) return;
      this.toggleSelectEntry(entry.id);
      return;
    }
    if (entry.type === 'folder') {
      this.openFolder(entry.id);
      return;
    }
    this.openPreview(entry);
  }

  private openPreview(entry: ExplorerEntry) {
    // Mỗi lần mở 1 ảnh mới → reset zoom/pan để khỏi dính state ảnh trước.
    this.resetPreviewZoom();
    this.previewEntry.set(entry);
  }

  closePreview() {
    this.previewEntry.set(null);
    this.resetPreviewZoom();
    this.pointers.clear();
    this.panStart = null;
    this.pinchStart = null;
    this.previewInteracting.set(false);
    this.didPan = false;
  }

  /**
   * Chuyển sang ảnh trước trong cùng thư mục. Reset zoom/pan trước khi
   * đổi để ảnh mới luôn fit tự nhiên. No-op khi đã ở ảnh đầu.
   */
  prevImage(ev?: Event) {
    ev?.stopPropagation();
    if (!this.canPreviewPrev()) return;
    const siblings = this.previewSiblings();
    const idx = this.previewIndex();
    this.openPreview(siblings[idx - 1]);
  }

  nextImage(ev?: Event) {
    ev?.stopPropagation();
    if (!this.canPreviewNext()) return;
    const siblings = this.previewSiblings();
    const idx = this.previewIndex();
    this.openPreview(siblings[idx + 1]);
  }

  // ===== Preview zoom + pan handlers =====
  /**
   * Đặt lại scale=1, tx=ty=0 và bỏ "interacting". Gọi khi mở/đóng preview
   * hoặc khi user bấm vào label "100%".
   */
  resetPreviewZoom() {
    this.previewScale.set(1);
    this.previewTx.set(0);
    this.previewTy.set(0);
  }

  zoomInPreview(ev?: Event) {
    ev?.stopPropagation();
    this.applyZoom(this.previewScale() * this.ZOOM_STEP);
  }

  zoomOutPreview(ev?: Event) {
    ev?.stopPropagation();
    this.applyZoom(this.previewScale() / this.ZOOM_STEP);
  }

  /**
   * Lõi của zoom: đặt scale mới (đã clamp), điều chỉnh translate để giữ
   * `anchor` (toạ độ viewport — ví dụ vị trí chuột / midpoint pinch) đứng
   * yên. Nếu không có anchor → zoom quanh tâm stage (giảm tỉ lệ translate
   * theo cùng `ratio` để hiệu ứng zoom-from-center).
   *
   * Công thức: với `centerX/Y` = tâm stage và điểm anchor `P`, để giữ P
   * đứng yên trong viewport sau khi đổi scale theo tỉ lệ r = newScale/oldScale:
   *   newTx = (P.x - centerX) * (1 - r) + tx * r
   *   newTy = (P.y - centerY) * (1 - r) + ty * r
   * Khi scale chạm về 1.0 thì snap luôn translate về 0 để ảnh tự fit.
   */
  private applyZoom(
    targetScale: number,
    anchor?: { x: number; y: number; centerX: number; centerY: number }
  ) {
    const oldScale = this.previewScale();
    const clamped = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, targetScale));
    if (Math.abs(clamped - oldScale) < 0.001) return;

    if (clamped <= this.MIN_ZOOM + 0.001) {
      this.resetPreviewZoom();
      return;
    }

    const ratio = clamped / oldScale;
    const tx = this.previewTx();
    const ty = this.previewTy();
    if (anchor) {
      const kx = anchor.x - anchor.centerX;
      const ky = anchor.y - anchor.centerY;
      this.previewTx.set(kx * (1 - ratio) + tx * ratio);
      this.previewTy.set(ky * (1 - ratio) + ty * ratio);
    } else {
      this.previewTx.set(tx * ratio);
      this.previewTy.set(ty * ratio);
    }
    this.previewScale.set(clamped);
  }

  /**
   * Wheel zoom: lăn lên = zoom in, lăn xuống = zoom out. Anchor = vị trí
   * con trỏ → "zoom toward cursor" trải nghiệm tự nhiên.
   *
   * `passive: false` cần thiết để gọi `preventDefault()` ngăn page scroll.
   * Angular template binding mặc định không passive nên `preventDefault`
   * có hiệu lực.
   */
  onPreviewWheel(ev: WheelEvent) {
    if (!this.previewEntry()) return;
    ev.preventDefault();
    const stage = ev.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.applyZoom(this.previewScale() * factor, {
      x: ev.clientX,
      y: ev.clientY,
      centerX,
      centerY,
    });
  }

  /**
   * Pointerdown: track pointer + bắt đầu pan (1 pointer) hoặc pinch (2 pointer).
   * Sau khi có 2 pointer → huỷ panStart, ưu tiên pinch.
   */
  onPreviewPointerDown(ev: PointerEvent) {
    if (!this.previewEntry()) return;
    const stage = ev.currentTarget as HTMLElement;
    try {
      stage.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore: 1 số browser/touch không hỗ trợ */
    }
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    this.didPan = false;
    this.previewInteracting.set(true);

    if (this.pointers.size >= 2) {
      this.startPinch(stage);
      this.panStart = null;
    } else if (this.previewScale() > 1.001) {
      // Chỉ cho pan khi đang zoom-in (scale=1 thì ảnh đã fit, kéo vô nghĩa).
      this.panStart = {
        x: ev.clientX,
        y: ev.clientY,
        tx: this.previewTx(),
        ty: this.previewTy(),
      };
    } else {
      this.panStart = null;
    }
  }

  onPreviewPointerMove(ev: PointerEvent) {
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (this.pointers.size >= 2 && this.pinchStart) {
      this.updatePinch();
      return;
    }

    if (this.panStart && this.pointers.size === 1) {
      const dx = ev.clientX - this.panStart.x;
      const dy = ev.clientY - this.panStart.y;
      if (!this.didPan && Math.hypot(dx, dy) > 4) this.didPan = true;
      this.previewTx.set(this.panStart.tx + dx);
      this.previewTy.set(this.panStart.ty + dy);
    }
  }

  onPreviewPointerUp(ev: PointerEvent) {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 0) {
      this.panStart = null;
      this.previewInteracting.set(false);
    } else if (this.pointers.size === 1 && this.previewScale() > 1.001) {
      // Vừa nhả 1 ngón pinch → chuyển sang pan với ngón còn lại.
      const remaining = Array.from(this.pointers.values())[0];
      this.panStart = {
        x: remaining.x,
        y: remaining.y,
        tx: this.previewTx(),
        ty: this.previewTy(),
      };
    }
  }

  /**
   * Double-click / double-tap: toggle giữa 1x ↔ 2.5x quanh điểm bấm.
   * Nhanh hơn click nhiều lần nút +/-, đặc biệt trên touch.
   */
  onPreviewDblClick(ev: MouseEvent) {
    if (!this.previewEntry()) return;
    const stage = ev.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const target = this.previewScale() > 1.01 ? 1 : 2.5;
    this.applyZoom(target, { x: ev.clientX, y: ev.clientY, centerX, centerY });
    ev.preventDefault();
  }

  /**
   * Phím tắt:
   *   Khi search đang mở:
   *     Esc → đóng search
   *   Khi đang xem preview:
   *     Esc       → đóng
   *     +/-       → zoom in / out
   *     0         → reset zoom
   *     ← / →     → ảnh trước / sau trong cùng thư mục
   *   Khi không có overlay nào:
   *     /         → mở search (focus input)
   *
   * Bỏ qua nếu user đang gõ trong input/textarea/contenteditable — TRỪ khi
   * input đó là search box (Esc vẫn phải đóng được search).
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent) {
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName;
    const inSearchInput = !!target?.classList?.contains('docs-search-input');
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;

    // Esc đóng search ngay cả khi đang focus search-input.
    if (this.searchOpen() && ev.key === 'Escape') {
      ev.preventDefault();
      this.closeSearch();
      return;
    }

    // Còn lại: nếu đang gõ trong field thường → bỏ qua (trừ search input đã xử trên).
    if (typing && !inSearchInput) return;

    // Phím `/` mở search khi không có overlay nào (modal/preview/search).
    if (
      !this.previewEntry() &&
      !this.searchOpen() &&
      !this.folderDraft() &&
      ev.key === '/'
    ) {
      ev.preventDefault();
      this.toggleSearch();
      return;
    }

    if (!this.previewEntry()) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closePreview();
    } else if (ev.key === '+' || ev.key === '=') {
      ev.preventDefault();
      this.zoomInPreview();
    } else if (ev.key === '-' || ev.key === '_') {
      ev.preventDefault();
      this.zoomOutPreview();
    } else if (ev.key === '0') {
      ev.preventDefault();
      this.resetPreviewZoom();
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.prevImage();
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.nextImage();
    }
  }

  private startPinch(stage: HTMLElement) {
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const rect = stage.getBoundingClientRect();
    this.pinchStart = {
      dist: dist || 1,
      scale: this.previewScale(),
      tx: this.previewTx(),
      ty: this.previewTy(),
      midX,
      midY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  }

  private updatePinch() {
    const start = this.pinchStart;
    if (!start) return;
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = dist / start.dist;
    const target = Math.min(
      this.MAX_ZOOM,
      Math.max(this.MIN_ZOOM, start.scale * ratio)
    );
    const r = target / start.scale;
    const kx = start.midX - start.centerX;
    const ky = start.midY - start.centerY;
    this.previewScale.set(target);
    this.previewTx.set(kx * (1 - r) + start.tx * r);
    this.previewTy.set(ky * (1 - r) + start.ty * r);
    this.didPan = true;
  }

  // ===== Selection (multi-select files) =====
  toggleSelectMode() {
    if (this.selectMode()) {
      this.selectedIds.set(new Set());
      this.selectMode.set(false);
    } else {
      this.selectMode.set(true);
    }
  }

  /** Bật select mode rồi tích sẵn 1 entry (long-press / nút trên card). */
  startSelectionWith(id: number) {
    if (id === this.ROOT_ID) return;
    const s = new Set(this.selectedIds());
    s.add(id);
    this.selectedIds.set(s);
    this.selectMode.set(true);
  }

  /** Toggle 1 entry (file hoặc folder). Không cho thêm root. */
  toggleSelectEntry(id: number) {
    if (id === this.ROOT_ID) return;
    const s = new Set(this.selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selectedIds.set(s);
  }

  /** @deprecated dùng `toggleSelectEntry` thay thế. Giữ alias cho code cũ. */
  toggleSelectFile(id: number) {
    this.toggleSelectEntry(id);
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  /** Chọn / bỏ chọn tất cả entry ở folder hiện tại (cả folder + file, trừ root). */
  toggleSelectAllInCurrent() {
    const ids = this.currentChildren()
      .filter((e) => e.id !== this.ROOT_ID)
      .map((e) => e.id);
    if (ids.length === 0) return;

    const sel = new Set(this.selectedIds());
    const allHere = ids.every((id) => sel.has(id));
    if (allHere) {
      ids.forEach((id) => sel.delete(id));
    } else {
      ids.forEach((id) => sel.add(id));
    }
    this.selectedIds.set(sel);
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  exitSelectMode() {
    this.selectedIds.set(new Set());
    this.selectMode.set(false);
  }

  // ===== Clipboard (cut & paste files + folders) =====
  /**
   * Cắt các entry đang được tích chọn (file + folder) vào clipboard. Loại
   * root nếu lỡ lọt. Server sẽ check chu kỳ ở paste, client cũng check
   * trước để có UX tốt hơn.
   */
  cutSelection() {
    this.closeSelectActionsMenu();
    const ids = Array.from(this.selectedIds()).filter(
      (id) => id !== this.ROOT_ID && this.entriesById().has(id)
    );
    if (ids.length === 0) {
      this.errorMsg.set('Không có mục nào để cắt.');
      return;
    }

    this.clipboard.set({ ids });
    this.exitSelectMode();

    const folderCount = ids.filter(
      (id) => this.entriesById().get(id)?.type === 'folder'
    ).length;
    const fileCount = ids.length - folderCount;
    const parts: string[] = [];
    if (folderCount > 0) parts.push(`${folderCount} thư mục`);
    if (fileCount > 0) parts.push(`${fileCount} ảnh`);
    this.flashSuccess(
      `Đã cắt ${parts.join(' + ')} — vào thư mục đích rồi bấm "Dán vào đây"`
    );
  }

  cancelClipboard() {
    this.clipboard.set(null);
  }

  /**
   * Paste tại folder hiện tại. Trước khi gọi server, validate:
   *  1. Bỏ các entry đã ở target.
   *  2. Nếu trong clipboard có folder F, target không được là F hoặc bất
   *     kỳ descendant nào của F (sẽ tạo chu kỳ vô hạn).
   * Server cũng check lần nữa để đảm bảo dữ liệu nhất quán.
   */
  pasteHere() {
    const cb = this.clipboard();
    if (!cb || cb.ids.length === 0) return;

    const target = this.currentFolderId();
    const map = this.entriesById();

    // [1] Bỏ entry đã ở target — không cần move.
    const candidates = cb.ids.filter((id) => {
      const e = map.get(id);
      return e && e.parentId !== target;
    });
    if (candidates.length === 0) {
      this.clipboard.set(null);
      this.flashSuccess('Các mục đã ở đúng thư mục này.');
      return;
    }

    // [2] Cycle check: target không được là chính folder cắt hoặc descendant.
    const targetAncestors = this.getAncestorIds(target);
    targetAncestors.add(target);
    const cycle = candidates.find((id) => {
      const e = map.get(id);
      return e?.type === 'folder' && targetAncestors.has(id);
    });
    if (cycle !== undefined) {
      const cycleEntry = map.get(cycle);
      this.errorMsg.set(
        `Không thể dán "${cycleEntry?.name || cycle}" vào chính nó hoặc thư mục con của nó.`
      );
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');
    this.explorerService.moveEntries(candidates, target).subscribe({
      next: () => {
        this.saving.set(false);
        const count = candidates.length;
        const targetName = this.currentFolder()?.name || 'thư mục này';
        this.clipboard.set(null);
        this.flashSuccess(`Đã chuyển ${count} mục vào "${targetName}"`);
        setTimeout(() => this.loadEntries(), 800);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.message || 'Chuyển mục thất bại.');
      },
    });
  }

  /**
   * Trả về Set chứa id của tất cả ancestor (loại trừ chính nó). Dùng cho
   * cycle check khi paste folder.
   */
  private getAncestorIds(id: number): Set<number> {
    const ancestors = new Set<number>();
    const map = this.entriesById();
    let cur: ExplorerEntry | undefined = map.get(id);
    let safety = 64;
    while (cur && safety-- > 0) {
      const pid = cur.parentId;
      if (pid === null) break;
      ancestors.add(pid);
      cur = map.get(pid);
    }
    return ancestors;
  }

  // ===== Download =====
  /**
   * Tải 1 ảnh về máy. Dùng cho cả trường hợp click nút download trên card,
   * trong detail row, và trong preview. Convert `data:image/...;base64,...`
   * → Blob → ObjectURL → trigger anchor click.
   *
   * Lý do dùng Blob thay vì set thẳng `<a href="data:...">`: Safari + một
   * số mobile browser từ chối download data URL dài (>~2MB). Blob ổn hơn.
   */
  downloadEntry(entry: ExplorerEntry, ev?: Event) {
    ev?.stopPropagation();
    if (entry.type !== 'file') return;
    if (!entry.content) {
      this.errorMsg.set('Ảnh chưa có nội dung để tải xuống.');
      return;
    }
    try {
      this.triggerDownload(entry.content, entry.name);
      this.flashSuccess(`Đã tải "${ entry.name }"`);
    } catch (e) {
      console.error('downloadEntry failed', e);
      this.errorMsg.set('Tải xuống thất bại.');
    }
  }

  /**
   * Tải nhiều ảnh đã chọn (multi-select). Trigger lần lượt với một
   * khoảng delay nhỏ giữa các lần để tránh browser chặn pop-up "site này
   * muốn tải nhiều file" — đa số trình duyệt cho phép sau khi user accept
   * 1 lần đầu trong session.
   */
  async bulkDownloadSelection() {
    this.closeSelectActionsMenu();
    const ids = Array.from(this.selectedIds()).filter((id) => {
      const e = this.entriesById().get(id);
      return e?.type === 'file' && !!e.content;
    });
    if (ids.length === 0) {
      this.errorMsg.set('Không có ảnh nào để tải xuống.');
      return;
    }

    this.errorMsg.set('');
    this.uploadProgress.set({ done: 0, total: ids.length, failed: 0 });

    const map = this.entriesById();
    let done = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      const e = map.get(ids[i]);
      if (!e || !e.content) {
        failed++;
        continue;
      }
      try {
        this.triggerDownload(e.content, e.name);
        done++;
      } catch (err) {
        console.warn('triggerDownload failed', e.name, err);
        failed++;
      }
      this.uploadProgress.update((p) =>
        p ? { ...p, done, failed } : p
      );
      // Delay nhỏ giữa các download để browser không nuốt request.
      if (i < ids.length - 1) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }
    this.uploadProgress.set(null);

    if (failed === 0) {
      this.flashSuccess(`Đã tải ${ done } ảnh`);
    } else {
      this.flashSuccess(`Đã tải ${ done }/${ ids.length } ảnh`);
      if (failed > 0) {
        this.errorMsg.set(`${ failed } ảnh không tải được (thiếu nội dung).`);
      }
    }
  }

  /** Trigger tải xuống 1 file qua anchor + Blob URL. */
  private triggerDownload(dataUrl: string, rawName: string) {
    const blob = this.dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = this.sanitizeFilename(rawName);
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke sau 1s để chắc chắn browser đã start download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  /**
   * Convert `data:<mime>;base64,<payload>` → Blob. Nếu không phải base64
   * data URL thì throw → caller hiển thị error.
   */
  private dataUrlToBlob(dataUrl: string): Blob {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) throw new Error('Data URL không hợp lệ');
    const header = dataUrl.slice(0, commaIdx);
    const payload = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const isBase64 = /;base64/i.test(header);
    if (!isBase64) {
      // Plain text data URL — fall back to UTF-8 bytes.
      const bytes = new TextEncoder().encode(decodeURIComponent(payload));
      return new Blob([bytes], { type: mime });
    }
    const bin = atob(payload);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /**
   * Lọc bỏ ký tự không hợp lệ trong filename trên các OS chính (Windows
   * khắt khe nhất). Đảm bảo có extension; nếu thiếu thì append `.jpg`
   * vì uploads của app đều convert sang JPEG.
   */
  private sanitizeFilename(name: string): string {
    const cleaned = (name || 'image').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').trim();
    const safe = cleaned.length > 0 ? cleaned : 'image';
    return /\.[a-z0-9]{2,5}$/i.test(safe) ? safe.slice(0, 200) : `${ safe }.jpg`.slice(0, 200);
  }

  // ===== Bulk delete =====
  /**
   * Xoá hàng loạt: cả folder lẫn file. Server soft-delete folder cascading
   * sang descendant. Confirm message phân biệt số lượng folder/file để
   * user nhận thức được phạm vi.
   */
  bulkDeleteSelection() {
    this.closeSelectActionsMenu();
    const ids = Array.from(this.selectedIds()).filter(
      (id) => id !== this.ROOT_ID && this.entriesById().has(id)
    );
    if (ids.length === 0) return;

    const map = this.entriesById();
    const folderCount = ids.filter((id) => map.get(id)?.type === 'folder').length;
    const fileCount = ids.length - folderCount;
    const parts: string[] = [];
    if (folderCount > 0) parts.push(`${folderCount} thư mục`);
    if (fileCount > 0) parts.push(`${fileCount} ảnh`);
    const summary = parts.join(' + ');
    const warn = folderCount > 0
      ? '\n\nTẤT CẢ ảnh con & thư mục con bên trong cũng sẽ bị xoá.'
      : '';
    if (!confirm(`Xoá ${summary} đã chọn?${warn}`)) return;

    this.deleteSequentially(ids);
  }

  /**
   * Xoá tuần tự nhiều entry. Apps Script đơn nhiệm/sequential nên gọi
   * tuần tự an toàn hơn parallel.
   */
  private async deleteSequentially(ids: number[]) {
    this.saving.set(true);
    this.errorMsg.set('');
    let done = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await firstValueFrom(this.explorerService.deleteEntry(id));
        done++;
      } catch (e) {
        failed++;
        console.warn('deleteEntry failed', id, e);
      }
    }
    this.saving.set(false);
    this.exitSelectMode();
    if (failed === 0) {
      this.flashSuccess(`Đã xoá ${done} mục`);
    } else {
      this.errorMsg.set(`Xoá xong ${done}/${ids.length}, ${failed} lỗi.`);
    }
    setTimeout(() => this.loadEntries(), 1000);
  }

  // ===== Helpers =====
  private flashSuccess(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3000);
  }

  isEmpty(): boolean {
    return !this.loading() && this.currentChildren().length === 0;
  }

  /** Số ảnh trong 1 folder (đếm con trực tiếp + con cháu type=file). */
  countFilesInFolder(folderId: number): number {
    const all = this.entries();
    const stack = [folderId];
    const visited = new Set<number>();
    let count = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const e of all) {
        if (e.parentId === cur) {
          if (e.type === 'file') count++;
          else stack.push(e.id);
        }
      }
    }
    return count;
  }

  // ===== Formatters =====
  /** "12 KB", "1.4 MB", v.v. */
  formatSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /** "29/04/2026" hoặc "29/04/2026 14:30" tuỳ độ dài input. */
  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      // Fallback: đôi khi sheet trả về Date object đã format sẵn (string).
      return iso;
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  }

  /** Label tóm tắt cho folder trong detail view: "5 mục" / "trống". */
  describeFolderContent(folderId: number): string {
    const all = this.entries();
    let folders = 0;
    let files = 0;
    for (const e of all) {
      if (e.parentId === folderId) {
        if (e.type === 'folder') folders++;
        else files++;
      }
    }
    if (folders === 0 && files === 0) return 'Trống';
    const parts: string[] = [];
    if (folders > 0) parts.push(`${folders} thư mục`);
    if (files > 0) parts.push(`${files} ảnh`);
    return parts.join(' · ');
  }

  /** Label viewMode (cho aria/title) */
  viewModeLabel(mode: ViewMode): string {
    switch (mode) {
      case 'large':
        return 'Biểu tượng lớn';
      case 'icons':
        return 'Biểu tượng nhỏ';
      case 'detail':
        return 'Chi tiết';
    }
  }
}
