import {
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-medical-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medical-history.component.html',
  styleUrls: ['./medical-history.component.scss'],
})
export class MedicalHistoryComponent {
  private medicalService = inject(MedicalHistoryService);

  /** Cùng `?user=` với trang feeding */
  user = input<string>('guest');

  entries = signal<MedicalHistoryEntry[]>([]);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  /** V2: lọc theo loại */
  kindFilter = signal<KindFilter>('all');

  dialogOpen = signal<boolean>(false);
  draft = signal<EntryDraft>(this.emptyDraft());
  editingEntry = signal<MedicalHistoryEntry | null>(null);

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

  /** Đếm theo loại (trong tập đã lọc user, không lọc kind) */
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
    this.medicalService.getEntries().subscribe({
      next: (rows) => {
        this.entries.set(rows);
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

  setKindFilter(f: KindFilter) {
    this.kindFilter.set(f);
  }

  metaFor(kind: MedicalEventKind): MedicalKindMeta {
    return kindMeta(kind);
  }

  openAddDialog() {
    this.editingEntry.set(null);
    this.draft.set(this.emptyDraft());
    this.errorMsg.set('');
    this.successMsg.set('');
    this.dialogOpen.set(true);
  }

  closeDialog() {
    this.dialogOpen.set(false);
  }

  updateDraft(partial: Partial<EntryDraft>) {
    this.draft.update((d) => ({ ...d, ...partial }));
  }

  submitDialog() {
    const d = this.draft();
    const title = d.title.trim();
    if (!d.date || !title) {
      this.errorMsg.set('Vui lòng nhập ngày và tiêu đề.');
      return;
    }

    const base: MedicalHistoryEntry = {
      user: this.userNorm(),
      date: d.date,
      kind: d.kind,
      title,
      detail: d.detail.trim(),
      place: d.place.trim() || undefined,
    };

    const edit = this.editingEntry();
    this.saving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    if (edit?.rowIndex) {
      this.medicalService
        .updateEntry(edit.rowIndex, {
          date: base.date,
          kind: base.kind,
          title: base.title,
          detail: base.detail,
          place: base.place ?? '',
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.successMsg.set('Đã cập nhật.');
            setTimeout(() => this.successMsg.set(''), 3000);
            this.closeDialog();
            setTimeout(() => this.load(), 600);
          },
          error: (err) => {
            this.saving.set(false);
            this.errorMsg.set(
              err?.message ||
                'Cập nhật thất bại. Kiểm tra Apps Script có action updateMedicalHistory.'
            );
          },
        });
    } else {
      this.medicalService.addEntry(base).subscribe({
        next: () => {
          this.saving.set(false);
          this.successMsg.set('Đã lưu sự kiện.');
          setTimeout(() => this.successMsg.set(''), 3000);
          this.closeDialog();
          setTimeout(() => this.load(), 600);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(
            err?.message ||
              'Lưu thất bại. Kiểm tra Apps Script có action addMedicalHistory.'
          );
        },
      });
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
}
