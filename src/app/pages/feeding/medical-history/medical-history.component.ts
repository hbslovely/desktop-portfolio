import {
  Component,
  computed,
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

type KindFilter = 'all' | MedicalEventKind;

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

  /** V2: lọc theo loại */
  kindFilter = signal<KindFilter>('all');

  dialogOpen = signal<boolean>(false);
  draft = signal<EntryDraft>(this.emptyDraft());
  editingEntry = signal<MedicalHistoryEntry | null>(null);

  /** Ảnh chọn tạm (chưa lên Explorer cho đến khi Lưu) */
  pendingAttachment = signal<File | null>(null);
  pendingAttachmentPreviewUrl = signal<string | null>(null);
  /** Khi sửa: gỡ ảnh đã lưu */
  stripExistingAttachment = signal<boolean>(false);

  readonly kindCatalog: readonly MedicalKindMeta[] = MEDICAL_KINDS;

  constructor() {
    this.load();
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
    const f = this.kindFilter();
    const rows = this.myEntries();
    if (f === 'all') return rows;
    return rows.filter((e) => e.kind === f);
  });

  /** Nhóm timeline theo tháng (V2) */
  timelineGroups = computed(() => {
    const list = this.filteredEntries();
    const map = new Map<string, MedicalHistoryEntry[]>();
    for (const e of list) {
      const ym = e.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(e);
    }
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return keys.map((key) => ({
      key,
      monthLabel: this.formatMonthHeading(key),
      entries: map.get(key)!,
    }));
  });

  kindCounts = computed(() => {
    const rows = this.myEntries();
    const counts: Record<MedicalEventKind, number> = {
      vaccine: 0,
      checkup: 0,
      medication: 0,
      illness: 0,
      lab: 0,
      other: 0,
    };
    for (const e of rows) {
      counts[e.kind]++;
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

  setKindFilter(f: KindFilter) {
    this.kindFilter.set(f);
  }

  metaFor(kind: MedicalEventKind): MedicalKindMeta {
    return kindMeta(kind);
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
    this.dialogOpen.set(true);
  }

  closeDialog() {
    this.dialogOpen.set(false);
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
