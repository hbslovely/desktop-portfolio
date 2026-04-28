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

interface FolderDraft {
  mode: 'add' | 'rename';
  /** id của folder đang rename. add → undefined */
  targetId?: number;
  name: string;
}

export type ViewMode = 'large' | 'icons' | 'detail';

/** Tối đa ký tự cho 1 cell Google Sheets (an toàn): 49000 < 50000. */
const MAX_CELL_CHARS = 49000;

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

  /** Folder draft (modal: add new folder hoặc rename folder hiện có) */
  folderDraft = signal<FolderDraft | null>(null);

  /** File preview fullscreen */
  previewEntry = signal<ExplorerEntry | null>(null);

  /** Chế độ xem: large icons / small icons / detail list. Persist qua localStorage. */
  viewMode = signal<ViewMode>(this.loadViewMode());

  /** Dropdown menu thư mục (Thêm thư mục / Đổi tên thư mục hiện tại) */
  folderMenuOpen = signal<boolean>(false);

  // ===== Selection / clipboard state =====
  /** Khi true: click vào file = toggle chọn (không mở preview). */
  selectMode = signal<boolean>(false);
  /** Tập id file đang được tích chọn. Folder không thể chọn. */
  selectedIds = signal<Set<number>>(new Set());
  /**
   * Clipboard cho cut & paste. Chỉ chứa file ids — folder bị filter ra
   * client-side khi cut, server cũng chặn ở `moveExplorer`.
   */
  clipboard = signal<{ ids: number[] } | null>(null);

  /** Tiến độ upload nhiều file: hiện "Đang tải 3/8…". */
  uploadProgress = signal<{ done: number; total: number; failed: number } | null>(
    null
  );

  // ===== Image preview zoom & pan =====
  /**
   * Trạng thái zoom/pan của ảnh preview:
   *  - `previewScale = 1`: ảnh fit, không cho pan, click backdrop sẽ đóng preview.
   *  - `> 1`: ảnh phóng to, có thể kéo (1 ngón / chuột) hoặc zoom toàn cục
   *    (wheel / pinch / nút). Click backdrop **không** đóng để tránh đóng nhầm.
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

  /** True khi tất cả file ở folder hiện tại đều được chọn. */
  allFilesSelected = computed<boolean>(() => {
    const fileIds = this.currentChildren()
      .filter((e) => e.type === 'file')
      .map((e) => e.id);
    if (fileIds.length === 0) return false;
    const sel = this.selectedIds();
    return fileIds.every((id) => sel.has(id));
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

  goUp() {
    const cur = this.currentFolder();
    if (!cur || cur.parentId === null) return;
    this.currentFolderId.set(cur.parentId);
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

  /** Đóng menu khi click ra ngoài */
  @HostListener('document:click')
  onDocumentClick() {
    if (this.folderMenuOpen()) this.folderMenuOpen.set(false);
  }

  // ===== Folder add / rename =====
  openAddFolder() {
    this.folderMenuOpen.set(false);
    this.folderDraft.set({ mode: 'add', name: '' });
    this.errorMsg.set('');
  }

  /** Đổi tên folder HIỆN TẠI (folder đang đứng trong). Disabled ở root. */
  openRenameCurrentFolder() {
    this.folderMenuOpen.set(false);
    const cur = this.currentFolder();
    if (!cur || cur.id === this.ROOT_ID) return;
    this.folderDraft.set({
      mode: 'rename',
      targetId: cur.id,
      name: cur.name,
    });
    this.errorMsg.set('');
  }

  openRenameFolder(entry: ExplorerEntry) {
    if (entry.type !== 'folder') return;
    this.folderDraft.set({ mode: 'rename', targetId: entry.id, name: entry.name });
    this.errorMsg.set('');
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
    const name = d.name.trim();
    if (!name) {
      this.errorMsg.set('Vui lòng nhập tên thư mục.');
      return;
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
      this.explorerService
        .updateEntry(d.targetId, { name })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.folderDraft.set(null);
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
   * Bậc giảm dần: 720/0.7 → 560/0.6 → 400/0.5.
   */
  private async compressUntilFits(file: File): Promise<string> {
    const tries: Array<[number, number]> = [
      [720, 0.7],
      [560, 0.6],
      [400, 0.5],
    ];
    let last = '';
    for (const [size, q] of tries) {
      last = await this.explorerService.fileToCompressedBase64(file, size, q);
      if (last.length <= MAX_CELL_CHARS) return last;
    }
    throw new Error(
      `Ảnh quá lớn (${Math.round(last.length / 1024)}KB sau khi nén). Thử ảnh nhỏ hơn.`
    );
  }

  // ===== File preview =====
  /**
   * Click vào file:
   *  - Nếu đang `selectMode` → toggle chọn.
   *  - Nếu đang có clipboard (paste mode) → vẫn cho chọn để có thể bỏ thêm.
   *  - Bình thường → mở preview.
   */
  onFileClick(entry: ExplorerEntry) {
    if (entry.type !== 'file') return;
    if (this.selectMode()) {
      this.toggleSelectFile(entry.id);
      return;
    }
    this.openPreview(entry);
  }

  /** Riêng cho detail-row + grid: gộp click cho cả folder + file. */
  onEntryClick(entry: ExplorerEntry) {
    if (entry.type === 'folder') {
      // Trong selectMode vẫn cho navigate vào folder để chọn xuyên thư mục.
      this.openFolder(entry.id);
      return;
    }
    this.onFileClick(entry);
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
   * Click vào nền (backdrop). KHÔNG đóng nếu:
   *  - Người dùng vừa kéo/pinch (`didPan`) → click chỉ là đuôi của drag.
   *  - Đang zoom (>1) → tránh đóng nhầm khi đang xem chi tiết.
   * Nếu thoả mãn 1 trong 2 thì swallow click; bấm nút × để đóng tường minh.
   */
  onPreviewBackdropClick(ev: MouseEvent) {
    if (this.didPan) {
      this.didPan = false;
      ev.stopPropagation();
      return;
    }
    if (this.previewScale() > 1.001) {
      // Đang zoom — yêu cầu user bấm × để đóng (an toàn hơn).
      ev.stopPropagation();
      return;
    }
    this.closePreview();
  }

  /**
   * Esc đóng preview. +/- zoom in/out. 0 reset zoom. Chỉ active khi đang
   * mở preview.
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent) {
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

  /** Bật select mode rồi tích sẵn 1 file (long-press / nút trên card). */
  startSelectionWith(id: number) {
    const s = new Set(this.selectedIds());
    s.add(id);
    this.selectedIds.set(s);
    this.selectMode.set(true);
  }

  toggleSelectFile(id: number) {
    const s = new Set(this.selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selectedIds.set(s);
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  /** Chọn / bỏ chọn tất cả file ở folder hiện tại. */
  toggleSelectAllInCurrent() {
    const fileIds = this.currentChildren()
      .filter((e) => e.type === 'file')
      .map((e) => e.id);
    if (fileIds.length === 0) return;

    const sel = new Set(this.selectedIds());
    const allHere = fileIds.every((id) => sel.has(id));
    if (allHere) {
      fileIds.forEach((id) => sel.delete(id));
    } else {
      fileIds.forEach((id) => sel.add(id));
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

  // ===== Clipboard (cut & paste files) =====
  cutSelection() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    // An toàn: filter chỉ giữ ids của file (loại folder nếu có lọt).
    const fileIds = ids.filter((id) => {
      const e = this.entriesById().get(id);
      return e?.type === 'file';
    });
    if (fileIds.length === 0) {
      this.errorMsg.set('Chỉ cắt được file ảnh, không cắt được thư mục.');
      return;
    }

    this.clipboard.set({ ids: fileIds });
    this.exitSelectMode();
    this.flashSuccess(
      `Đã cắt ${fileIds.length} ảnh — vào thư mục đích rồi bấm "Dán vào đây"`
    );
  }

  cancelClipboard() {
    this.clipboard.set(null);
  }

  pasteHere() {
    const cb = this.clipboard();
    if (!cb || cb.ids.length === 0) return;

    const target = this.currentFolderId();

    // Nếu tất cả file đều đã ở folder đích → không cần gọi server.
    const map = this.entriesById();
    const needsMove = cb.ids.filter((id) => {
      const e = map.get(id);
      return e && e.parentId !== target;
    });
    if (needsMove.length === 0) {
      this.clipboard.set(null);
      this.flashSuccess('Các ảnh đã ở đúng thư mục này.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');
    this.explorerService.moveEntries(needsMove, target).subscribe({
      next: () => {
        this.saving.set(false);
        const count = needsMove.length;
        const targetName = this.currentFolder()?.name || 'thư mục này';
        this.clipboard.set(null);
        this.flashSuccess(`Đã chuyển ${count} ảnh vào "${targetName}"`);
        setTimeout(() => this.loadEntries(), 800);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.message || 'Chuyển file thất bại.');
      },
    });
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
  bulkDeleteSelection() {
    const ids = Array.from(this.selectedIds()).filter((id) => {
      const e = this.entriesById().get(id);
      return e?.type === 'file';
    });
    if (ids.length === 0) return;
    if (!confirm(`Xoá ${ids.length} ảnh đã chọn?`)) return;

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
      this.flashSuccess(`Đã xoá ${done} ảnh`);
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
