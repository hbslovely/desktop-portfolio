import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MedicalEventKind } from '../../../../services/medical-history.service';
import { MedicalKindMeta } from '../medical-history-kinds.data';

@Component({
  selector: 'app-medical-history-filter',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './medical-history-filter.component.html',
  styleUrls: ['./medical-history-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHistoryFilterComponent {
  loading = input(false);
  myEntriesCount = input(0);
  visibleCount = input(0);
  textSearchQuery = input('');
  filterPanelOpen = input(false);
  filterPanelKindSearch = input('');
  timelineSort = input<'newest' | 'oldest'>('newest');
  kindListSort = input<'count' | 'alpha'>('count');
  kindFilterKinds = input<MedicalEventKind[]>([]);
  kindFilterSummary = input('Tất cả loại');
  kindsInFilterPanel = input<readonly MedicalKindMeta[]>([]);
  kindCounts = input<Record<MedicalEventKind, number>>({} as Record<MedicalEventKind, number>);
  kindFilterKindSet = input<Set<MedicalEventKind>>(new Set());

  textSearchQueryChange = output<string>();
  filterPanelOpenChange = output<boolean>();
  toggleFilterPanel = output<void>();
  resetFilterPanel = output<void>();
  clearTextSearch = output<void>();
  clearKindFilters = output<void>();
  toggleKindFilter = output<MedicalEventKind>();
  timelineSortChange = output<'newest' | 'oldest'>();
  kindListSortChange = output<'count' | 'alpha'>();
  filterPanelKindSearchChange = output<string>();

  onTextSearchChange(value: string): void {
    this.textSearchQueryChange.emit(value);
  }

  onFilterPanelKindSearchChange(value: string): void {
    this.filterPanelKindSearchChange.emit(value);
  }

  onTimelineSort(sort: 'newest' | 'oldest'): void {
    this.timelineSortChange.emit(sort);
  }

  onKindListSort(sort: 'count' | 'alpha'): void {
    this.kindListSortChange.emit(sort);
  }
}
