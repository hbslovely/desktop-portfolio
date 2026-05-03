import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, inject, input, signal } from '@angular/core';
import {
  WeightLog,
  WeightLogService,
} from '../../../services/weight-log.service';

interface WeightDraft {
  date: string;
  weightInput: string;
  note: string;
}

@Component({
  selector: 'app-weight',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weight.component.html',
  styleUrls: ['./weight.component.scss'],
})
export class WeightComponent {
  private weightLogService = inject(WeightLogService);

  /** Cùng user với trang feeding (`?user=`) — ghi vào cột A sheet Weight. */
  user = input<string>('guest');

  logs = signal<WeightLog[]>([]);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  draft = signal<WeightDraft>(this.defaultDraft());

  /** Đang sửa 1 dòng đã có trên sheet (giữ `rowIndex`). */
  editingLog = signal<WeightLog | null>(null);
  editDraft = signal<WeightDraft>(this.defaultDraft());

  constructor() {
    this.load();
  }

  /** Gọi từ nút refresh header trang. */
  refresh() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.errorMsg.set('');

    this.weightLogService.getLogs().subscribe({
      next: (rows) => {
        this.logs.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.errorMsg.set(
          'Không tải được dữ liệu. Kiểm tra Sheet có tab "Weight" và quyền đọc public.'
        );
      },
    });
  }

  updateDraftDate(v: string) {
    this.draft.update((d) => ({ ...d, date: v }));
  }

  updateDraftWeight(v: string) {
    const cleaned = String(v ?? '').replace(/,/g, '.');
    this.draft.update((d) => ({ ...d, weightInput: cleaned }));
  }

  updateDraftNote(v: string) {
    this.draft.update((d) => ({ ...d, note: v }));
  }

  private parseDraftKg(raw: string): number | null {
    const s = raw.trim().replace(/,/g, '.');
    if (!s) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  submitAdd() {
    const d = this.draft();
    const kg = this.parseDraftKg(d.weightInput);
    if (!d.date || kg === null) {
      this.errorMsg.set('Vui lòng nhập ngày và cân nặng (kg) hợp lệ.');
      return;
    }

    const log: WeightLog = {
      user: String(this.user() || 'guest').toLowerCase().trim() || 'guest',
      date: d.date,
      weightKg: kg,
      note: d.note.trim() || undefined,
    };

    this.saving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    this.weightLogService.addLog(log).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set(
          `Đã lưu ${this.formatKg(kg)} kg ngày ${this.formatDateDisplay(log.date)}`
        );
        setTimeout(() => this.successMsg.set(''), 4000);
        this.draft.set({
          ...this.defaultDraft(),
          date: d.date,
        });
        setTimeout(() => this.load(), 900);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(
          err?.message || 'Lưu thất bại. Kiểm tra Apps Script đã có action addWeight.'
        );
      },
    });
  }

  openEdit(log: WeightLog) {
    if (!log.rowIndex) return;
    this.editingLog.set(log);
    this.editDraft.set({
      date: log.date,
      weightInput: this.formatKg(log.weightKg),
      note: log.note || '',
    });
    this.errorMsg.set('');
  }

  cancelEdit() {
    this.editingLog.set(null);
    this.editDraft.set(this.defaultDraft());
  }

  updateEditDate(v: string) {
    this.editDraft.update((d) => ({ ...d, date: v }));
  }

  updateEditWeight(v: string) {
    const cleaned = String(v ?? '').replace(/,/g, '.');
    this.editDraft.update((d) => ({ ...d, weightInput: cleaned }));
  }

  updateEditNote(v: string) {
    this.editDraft.update((d) => ({ ...d, note: v }));
  }

  submitEdit() {
    const orig = this.editingLog();
    if (!orig?.rowIndex) return;

    const d = this.editDraft();
    const kg = this.parseDraftKg(d.weightInput);
    if (!d.date || kg === null) {
      this.errorMsg.set('Vui lòng nhập ngày và cân nặng hợp lệ.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');

    this.weightLogService
      .updateLog(orig.rowIndex, {
        date: d.date,
        weightKg: kg,
        note: d.note.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMsg.set('Đã cập nhật.');
          setTimeout(() => this.successMsg.set(''), 3000);
          this.cancelEdit();
          setTimeout(() => this.load(), 900);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(
            err?.message ||
              'Cập nhật thất bại. Kiểm tra Apps Script đã có action updateWeight.'
          );
        },
      });
  }

  deleteLog(log: WeightLog) {
    if (!log.rowIndex) return;
    if (
      !confirm(
        `Xoá ghi nhận ${this.formatKg(log.weightKg)} kg ngày ${this.formatDateDisplay(log.date)}?`
      )
    ) {
      return;
    }

    this.weightLogService.deleteLog(log.rowIndex).subscribe({
      next: () => {
        this.successMsg.set('Đã xoá.');
        setTimeout(() => this.successMsg.set(''), 3000);
        if (this.editingLog()?.rowIndex === log.rowIndex) this.cancelEdit();
        setTimeout(() => this.load(), 900);
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

  formatKg(n: number): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  }

  private defaultDraft(): WeightDraft {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return {
      date: `${y}-${m}-${d}`,
      weightInput: '',
      note: '',
    };
  }
}
