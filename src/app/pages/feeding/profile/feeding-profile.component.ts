import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FeedingProfile {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
}

export interface FeedingProfileDraft {
  babyName: string;
  birthDate: string;
  gender?: 'boy' | 'girl' | '';
}

export interface FeedingAgeBreakdown {
  days: number;
  weeks: number;
  months: number;
  remainingMonths: number;
  years: number;
  weeksInMonth: number;
  remainingDays: number;
}

@Component({
  selector: 'app-feeding-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding-profile.component.html',
  styleUrls: ['./feeding-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingProfileComponent {
  user = input.required<string>();
  profile = input<FeedingProfile | null>(null);
  draft = input.required<FeedingProfileDraft>();
  editing = input(false);
  ageBreakdown = input<FeedingAgeBreakdown | null>(null);
  latestWeightKg = input<number | undefined>(undefined);
  maxBirthDate = input.required<string>();

  save = output<void>();
  cancelEdit = output<void>();
  startEdit = output<void>();
  clearProfile = output<void>();
  draftNameChange = output<string>();
  draftBirthChange = output<string>();
  draftGenderChange = output<'boy' | 'girl' | ''>();

  /** Hiển thị kg (sheet Weight) trong summary profile. */
  formatWeightKgFromSheet(kg: number | undefined): string {
    if (kg === undefined || !Number.isFinite(kg) || kg <= 0) return '';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);
  }

  onDraftGender(gender: 'boy' | 'girl' | ''): void {
    this.draftGenderChange.emit(gender);
  }
}
