import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  EventLogService,
  FeedingEventLog,
} from '../../../services/event-log.service';

interface EventDraft {
  date: string;
  time: string;
  title: string;
  note: string;
  place: string;
}

export interface ScheduleDayGroup {
  dateIso: string;
  dateLabel: string;
  dateSubLabel?: string;
  dateBadge?: string;
  events: FeedingEventLog[];
}

export interface ScheduleTimeSection {
  id: 'today' | 'soon' | 'nextMonth' | 'later' | 'past';
  title: string;
  subtitle: string;
  icon: string;
  eventCount: number;
  dayGroups: ScheduleDayGroup[];
}

@Component({
  selector: 'app-feeding-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding-schedule.component.html',
  styleUrls: ['./feeding-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingScheduleComponent {
  private static readonly PREVIEW_EVENT_LIMIT = 3;

  private eventLogService = inject(EventLogService);
  private destroyRef = inject(DestroyRef);

  private placePickerOrigin: HTMLInputElement | null = null;

  user = input<string>('guest');

  expandedSections = signal<Set<ScheduleTimeSection['id']>>(new Set());

  saving = signal(false);
  errorMsg = signal('');
  successMsg = signal('');

  addOpen = signal(false);
  draft = signal<EventDraft>(this.emptyDraft());

  editing = signal<FeedingEventLog | null>(null);
  editDraft = signal<EventDraft>(this.emptyDraft());

  now = signal<Date>(new Date());

  placePickerOpen = signal<'add' | 'edit' | null>(null);
  placeMenuRect = signal<{ top: number; left: number; width: number } | null>(null);

  placeMenuView = computed(() => {
    const ctx = this.placePickerOpen();
    const pos = this.placeMenuRect();
    if (!ctx || !pos) {
      return null;
    }
    const places = this.filteredPlaces(ctx);
    if (places.length === 0) {
      return null;
    }
    return { ctx, pos, places };
  });

  constructor() {
    this.refresh();
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(new Date()));
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onPlaceMenuViewportChange(): void {
    this.syncPlaceMenuPosition();
  }

  events = computed(() => this.eventLogService.events());
  loading = computed(() => this.eventLogService.loading());

  /** Vị trí đã dùng — gợi ý combobox khi thêm/sửa. */
  placeOptions = computed(() => {
    const places = new Set<string>();
    for (const ev of this.events()) {
      const p = ev.place?.trim();
      if (p) places.add(p);
    }
    return [...places].sort((a, b) => a.localeCompare(b, 'vi'));
  });

  hasFutureEvents = computed(() => this.futureSections().some((s) => s.dayGroups.length > 0));

  futureSections = computed<ScheduleTimeSection[]>(() => {
    const now = this.now();
    const buckets: Record<'today' | 'soon' | 'nextMonth' | 'later', FeedingEventLog[]> = {
      today: [],
      soon: [],
      nextMonth: [],
      later: [],
    };

    const nowMs = now.getTime();
    for (const ev of this.events()) {
      const dt = EventLogService.eventDateTime(ev);
      if (!dt || dt.getTime() <= nowMs) continue;
      const days = this.daysUntil(ev, now);
      if (days === null) continue;
      if (days === 0) buckets.today.push(ev);
      else if (days <= 7) buckets.soon.push(ev);
      else if (days <= 30) buckets.nextMonth.push(ev);
      else buckets.later.push(ev);
    }

    const sortAsc = (a: FeedingEventLog, b: FeedingEventLog) =>
      (EventLogService.eventDateTime(a)?.getTime() ?? 0) -
      (EventLogService.eventDateTime(b)?.getTime() ?? 0);

    const todayGroups = this.groupByDate(buckets.today, now, sortAsc, false);
    const soonGroups = this.groupByDate(buckets.soon, now, sortAsc, false);
    const nextMonthGroups = this.groupByDate(
      buckets.nextMonth,
      now,
      sortAsc,
      false
    );
    const laterGroups = this.groupByDate(buckets.later, now, sortAsc, false);

    return [
      {
        id: 'today',
        title: 'Hôm nay',
        subtitle: 'Sự kiện hôm nay',
        icon: 'pi-sun',
        dayGroups: todayGroups,
        eventCount: this.countEventsInGroups(todayGroups),
      },
      {
        id: 'soon',
        title: 'Tuần này',
        subtitle: 'Sự kiện trong tuần',
        icon: 'pi-bolt',
        dayGroups: soonGroups,
        eventCount: this.countEventsInGroups(soonGroups),
      },
      {
        id: 'nextMonth',
        title: 'Tháng sau',
        subtitle: 'Sự kiện tháng sau',
        icon: 'pi-calendar',
        dayGroups: nextMonthGroups,
        eventCount: this.countEventsInGroups(nextMonthGroups),
      },
      {
        id: 'later',
        title: 'Khác',
        subtitle: 'Sự kiện xa hơn',
        icon: 'pi-compass',
        dayGroups: laterGroups,
        eventCount: this.countEventsInGroups(laterGroups),
      },
    ];
  });

  pastSection = computed<ScheduleTimeSection | null>(() => {
    const now = this.now();
    const nowMs = now.getTime();
    const past = this.events().filter((e) => {
      const dt = EventLogService.eventDateTime(e);
      return dt !== null && dt.getTime() <= nowMs;
    });

    if (past.length === 0) return null;

    const sortDesc = (a: FeedingEventLog, b: FeedingEventLog) =>
      (EventLogService.eventDateTime(b)?.getTime() ?? 0) -
      (EventLogService.eventDateTime(a)?.getTime() ?? 0);

    const dayGroups = this.groupByDate(past, now, sortDesc, true);
    return {
      id: 'past',
      title: 'Đã qua',
      subtitle: 'Sự kiện đã qua',
      icon: 'pi-history',
      dayGroups,
      eventCount: this.countEventsInGroups(dayGroups),
    };
  });

  refresh() {
    this.errorMsg.set('');
    this.eventLogService.loadEvents().subscribe({
      error: () => {
        this.errorMsg.set('Không tải được lịch. Vui lòng thử lại sau.');
      },
    });
  }

  isFuture(ev: FeedingEventLog): boolean {
    const dt = EventLogService.eventDateTime(ev);
    return dt !== null && dt.getTime() > this.now().getTime();
  }

  openAdd() {
    this.draft.set(this.emptyDraft());
    this.errorMsg.set('');
    this.addOpen.set(true);
  }

  closeAdd() {
    this.addOpen.set(false);
    this.closePlacePicker();
  }

  openEdit(ev: FeedingEventLog) {
    if (!ev.rowIndex || !this.isFuture(ev)) return;
    this.editing.set(ev);
    this.editDraft.set({
      date: ev.date,
      time: ev.time,
      title: ev.title,
      note: ev.note || '',
      place: ev.place || '',
    });
    this.errorMsg.set('');
  }

  cancelEdit() {
    this.editing.set(null);
    this.editDraft.set(this.emptyDraft());
    this.closePlacePicker();
  }

  openPlacePicker(context: 'add' | 'edit', origin: HTMLInputElement): void {
    this.placePickerOpen.set(context);
    this.placePickerOrigin = origin;
    requestAnimationFrame(() => this.syncPlaceMenuPosition());
  }

  private closePlacePicker(): void {
    this.placePickerOpen.set(null);
    this.placeMenuRect.set(null);
    this.placePickerOrigin = null;
  }

  private measurePlaceMenuRect(origin: HTMLInputElement): {
    top: number;
    left: number;
    width: number;
  } {
    const rect = origin.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 200),
    };
  }

  private syncPlaceMenuPosition(): void {
    const origin = this.placePickerOrigin;
    const context = this.placePickerOpen();
    if (!origin || !context) {
      return;
    }
    if (this.filteredPlaces(context).length === 0) {
      this.placeMenuRect.set(null);
      return;
    }
    this.placeMenuRect.set(this.measurePlaceMenuRect(origin));
  }

  filteredPlaces(context: 'add' | 'edit'): string[] {
    const query = (
      context === 'add' ? this.draft().place : this.editDraft().place
    )
      .trim()
      .toLowerCase();
    const all = this.placeOptions();
    if (!query) return all;
    return all.filter((p) => p.toLowerCase().includes(query));
  }

  onPlaceInput(value: string, context: 'add' | 'edit', origin: HTMLInputElement): void {
    if (context === 'add') {
      this.updateDraft({ place: value });
    } else {
      this.updateEditDraft({ place: value });
    }
    this.placePickerOpen.set(context);
    this.placePickerOrigin = origin;
    this.syncPlaceMenuPosition();
  }

  selectPlace(place: string, context: 'add' | 'edit'): void {
    if (context === 'add') {
      this.updateDraft({ place });
    } else {
      this.updateEditDraft({ place });
    }
    this.closePlacePicker();
  }

  onPlaceBlur(context: 'add' | 'edit'): void {
    window.setTimeout(() => {
      if (this.placePickerOpen() === context) {
        this.closePlacePicker();
      }
    }, 160);
  }

  submitAdd() {
    const d = this.draft();
    const title = d.title.trim();
    if (!d.date || !d.time || !title) {
      this.errorMsg.set('Ngày, giờ và tên sự kiện là bắt buộc.');
      return;
    }
    const ev: FeedingEventLog = {
      user: String(this.user() || 'guest').toLowerCase().trim() || 'guest',
      date: d.date,
      time: this.normalizeTimeInput(d.time),
      title,
      note: d.note.trim() || undefined,
      place: d.place.trim() || undefined,
      acknowledged: false,
    };
    this.saving.set(true);
    this.errorMsg.set('');
    this.eventLogService.addEvent(ev).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set('Đã thêm sự kiện.');
        setTimeout(() => this.successMsg.set(''), 3000);
        this.closeAdd();
        setTimeout(() => this.refresh(), 700);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.message || 'Lưu thất bại.');
      },
    });
  }

  submitEdit() {
    const orig = this.editing();
    if (!orig?.rowIndex) return;
    const d = this.editDraft();
    const title = d.title.trim();
    if (!d.date || !d.time || !title) {
      this.errorMsg.set('Ngày, giờ và tên sự kiện là bắt buộc.');
      return;
    }
    this.saving.set(true);
    this.errorMsg.set('');
    this.eventLogService
      .updateEvent(orig.rowIndex, {
        date: d.date,
        time: this.normalizeTimeInput(d.time),
        title,
        note: d.note.trim(),
        place: d.place.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMsg.set('Đã cập nhật.');
          setTimeout(() => this.successMsg.set(''), 3000);
          this.cancelEdit();
          setTimeout(() => this.refresh(), 700);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(err?.message || 'Cập nhật thất bại.');
        },
      });
  }

  deleteEv(ev: FeedingEventLog) {
    if (!ev.rowIndex || !this.isFuture(ev)) return;
    if (!confirm(`Xoá sự kiện «${ev.title}»?`)) return;
    this.eventLogService.deleteEvent(ev.rowIndex).subscribe({
      next: () => {
        this.successMsg.set('Đã xoá.');
        setTimeout(() => this.successMsg.set(''), 3000);
        if (this.editing()?.rowIndex === ev.rowIndex) this.cancelEdit();
        setTimeout(() => this.refresh(), 700);
      },
      error: (err) => {
        this.errorMsg.set(err?.message || 'Xoá thất bại.');
      },
    });
  }

  formatTime(time: string): string {
    return time;
  }

  formatEventDate(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `ngày ${+m[3]} tháng ${+m[2]} năm ${m[1]}`;
  }

  formatEventCount(count: number): string {
    return `${count} sự kiện`;
  }

  isSectionExpanded(id: ScheduleTimeSection['id']): boolean {
    return this.expandedSections().has(id);
  }

  toggleSectionExpand(id: ScheduleTimeSection['id']): void {
    this.expandedSections.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  hasMoreEvents(section: ScheduleTimeSection): boolean {
    return section.eventCount > FeedingScheduleComponent.PREVIEW_EVENT_LIMIT;
  }

  visibleDayGroups(section: ScheduleTimeSection): ScheduleDayGroup[] {
    if (this.isSectionExpanded(section.id)) {
      return section.dayGroups;
    }
    return this.limitDayGroups(
      section.dayGroups,
      FeedingScheduleComponent.PREVIEW_EVENT_LIMIT
    );
  }

  hiddenEventCount(section: ScheduleTimeSection): number {
    return Math.max(
      0,
      section.eventCount - FeedingScheduleComponent.PREVIEW_EVENT_LIMIT
    );
  }

  trackSection(_: number, s: ScheduleTimeSection): string {
    return s.id;
  }

  trackDay(_: number, d: ScheduleDayGroup): string {
    return d.dateIso;
  }

  trackEvent(_: number, ev: FeedingEventLog): string {
    return String(ev.rowIndex ?? `${ev.date}-${ev.time}-${ev.title}`);
  }

  private countEventsInGroups(groups: ScheduleDayGroup[]): number {
    return groups.reduce((total, group) => total + group.events.length, 0);
  }

  private daysUntil(ev: FeedingEventLog, now: Date): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ev.date);
    if (!m) return null;
    return this.calendarDayDiff(+m[1], +m[2], +m[3], now);
  }

  private calendarDayDiff(
    y: number,
    mo: number,
    d: number,
    now: Date
  ): number {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(y, mo - 1, d);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  private limitDayGroups(
    groups: ScheduleDayGroup[],
    limit: number
  ): ScheduleDayGroup[] {
    let count = 0;
    const result: ScheduleDayGroup[] = [];
    for (const day of groups) {
      if (count >= limit) break;
      const take = Math.min(day.events.length, limit - count);
      if (take <= 0) continue;
      result.push({ ...day, events: day.events.slice(0, take) });
      count += take;
    }
    return result;
  }

  private groupByDate(
    events: FeedingEventLog[],
    now: Date,
    sortEvents: (a: FeedingEventLog, b: FeedingEventLog) => number,
    datesDesc = false
  ): ScheduleDayGroup[] {
    const byDate = new Map<string, FeedingEventLog[]>();
    for (const ev of events) {
      const list = byDate.get(ev.date) ?? [];
      list.push(ev);
      byDate.set(ev.date, list);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) =>
        datesDesc ? b.localeCompare(a) : a.localeCompare(b)
      )
      .map(([dateIso, dayEvents]) => {
        const sorted = [...dayEvents].sort(sortEvents);
        const header = this.formatDateHeader(dateIso, now);
        return {
          dateIso,
          dateLabel: header.label,
          dateSubLabel: header.subLabel,
          events: sorted,
        };
      });
  }

  private formatDateHeader(
    iso: string,
    now: Date
  ): { label: string; subLabel: string } {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return { label: iso, subLabel: '' };

    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    return {
      label: this.formatScheduleRelativeLabel(y, mo, d, now),
      subLabel: this.formatFullDateLabel(y, mo, d),
    };
  }

  private formatFullDateLabel(y: number, mo: number, d: number): string {
    const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
    const weekdays = [
      'Chủ nhật',
      'Thứ 2',
      'Thứ 3',
      'Thứ 4',
      'Thứ 5',
      'Thứ 6',
      'Thứ 7',
    ];
    return `${weekdays[date.getDay()]}, ngày ${d} tháng ${mo} năm ${y}`;
  }

  private formatScheduleRelativeLabel(
    y: number,
    mo: number,
    d: number,
    now: Date
  ): string {
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startEv = new Date(y, mo - 1, d);
    const diff = this.calendarDayDiff(y, mo, d, now);

    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Ngày mai';
    if (diff === 2) return 'Ngày mốt';
    if (diff === -1) return 'Hôm qua';

    if (diff > 0) {
      if (diff <= 30) return `${diff} ngày tới`;
      return this.formatFutureSpanLabel(startNow, startEv);
    }

    const abs = Math.abs(diff);
    if (abs <= 30) return `Đã qua ${abs} ngày`;
    return this.formatPastSpanLabel(startEv, startNow);
  }

  private formatFutureSpanLabel(from: Date, to: Date): string {
    const { years, months, days } = this.calendarSpan(from, to);
    if (years > 0 && months === 0 && days === 0) return `${years} năm tới`;
    if (years === 0 && months > 0 && days === 0) return `${months} tháng tới`;
    if (years === 0 && months === 0 && days > 0) return `${days} ngày tới`;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0) parts.push(`${days} ngày`);
    return parts.length > 0 ? `${parts.join(' ')} tới` : 'Sắp tới';
  }

  private formatPastSpanLabel(from: Date, to: Date): string {
    const { years, months, days } = this.calendarSpan(from, to);
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0) parts.push(`${days} ngày`);
    if (parts.length === 0) return 'Đã qua';
    return `Đã qua ${parts.join(' ')}`;
  }

  private calendarSpan(
    start: Date,
    end: Date
  ): { years: number; months: number; days: number } {
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
  }

  private emptyDraft(): EventDraft {
    const t = new Date();
    return {
      date: this.toDateStr(t),
      time: this.toTimeStr(t),
      title: '',
      note: '',
      place: '',
    };
  }

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toTimeStr(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private normalizeTimeInput(raw: string): string {
    const s = String(raw || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return s;
    const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  updateDraft(partial: Partial<EventDraft>) {
    this.draft.update((d) => ({ ...d, ...partial }));
  }

  updateEditDraft(partial: Partial<EventDraft>) {
    this.editDraft.update((d) => ({ ...d, ...partial }));
  }
}
