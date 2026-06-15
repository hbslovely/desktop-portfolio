import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ExplorerEntry } from '../../../../services/explorer.service';
import {
  MedicalEventKind,
  MedicalHistoryEntry,
} from '../../../../services/medical-history.service';
import { MedicalKindMeta, kindMeta } from '../medical-history-kinds.data';

export interface MedicalTimelineGroup {
  key: string;
  monthLabel: string;
  entries: MedicalHistoryEntry[];
}

@Component({
  selector: 'app-medical-history-timeline',
  standalone: true,
  imports: [],
  templateUrl: './medical-history-timeline.component.html',
  styleUrls: ['./medical-history-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHistoryTimelineComponent {
  timelineGroups = input<MedicalTimelineGroup[]>([]);
  resolveAttachment = input<(entry: MedicalHistoryEntry) => ExplorerEntry | undefined>(
    () => undefined
  );

  editEntry = output<MedicalHistoryEntry>();
  deleteEntry = output<MedicalHistoryEntry>();
  openPreview = output<MedicalHistoryEntry>();
  openInDocuments = output<MedicalHistoryEntry>();

  // Placeholder SVG as computed property
  readonly placeholderSvg =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Im0xMiAxMiAyIDJoNXYtNXoiIGZpbGw9IiM5Y2EzYWYiLz4KPC9zdmc+';

  metaFor(kind: MedicalEventKind): MedicalKindMeta {
    return kindMeta(kind);
  }

  formatDateDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  attachmentFor(entry: MedicalHistoryEntry): ExplorerEntry | undefined {
    return this.resolveAttachment()(entry);
  }

  onOpenPreview(entry: MedicalHistoryEntry): void {
    this.openPreview.emit(entry);
  }

  onOpenInDocuments(entry: MedicalHistoryEntry): void {
    this.openInDocuments.emit(entry);
  }

  onImageError(event: Event, att: ExplorerEntry): void {
    const img = event.target as HTMLImageElement;
    // Mark as error and set fallback image
    att.loadError = true;
    img.src = this.placeholderSvg;
  }
}
