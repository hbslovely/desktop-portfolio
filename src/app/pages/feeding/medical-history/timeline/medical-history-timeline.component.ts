import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExplorerEntry } from '../../../../services/explorer.service';
import {
  MedicalEventKind,
  MedicalHistoryEntry,
} from '../../../../services/medical-history.service';
import {
  MedicalKindMeta,
  kindMeta,
} from '../medical-history-kinds.data';

export interface MedicalTimelineGroup {
  key: string;
  monthLabel: string;
  entries: MedicalHistoryEntry[];
}

@Component({
  selector: 'app-medical-history-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medical-history-timeline.component.html',
  styleUrls: ['./medical-history-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHistoryTimelineComponent {
  timelineGroups = input<MedicalTimelineGroup[]>([]);
  resolveAttachment = input<
    (entry: MedicalHistoryEntry) => ExplorerEntry | undefined
  >(() => undefined);

  editEntry = output<MedicalHistoryEntry>();
  deleteEntry = output<MedicalHistoryEntry>();
  openPreview = output<MedicalHistoryEntry>();
  openInDocuments = output<MedicalHistoryEntry>();

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
}
