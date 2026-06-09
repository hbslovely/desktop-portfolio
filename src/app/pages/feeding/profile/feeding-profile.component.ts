import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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

@Component({
  selector: 'app-feeding-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './feeding-profile.component.html',
  styleUrls: ['./feeding-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingProfileComponent {
  user = input.required<string>();
  profile = input<FeedingProfile | null>(null);
  draft = input.required<FeedingProfileDraft>();
  editing = input(false);
  maxBirthDate = input.required<string>();

  save = output<void>();
  cancelEdit = output<void>();
  startEdit = output<void>();
  clearProfile = output<void>();
  draftNameChange = output<string>();
  draftBirthChange = output<string>();
  draftGenderChange = output<'boy' | 'girl' | ''>();

  onDraftGender(gender: 'boy' | 'girl' | ''): void {
    this.draftGenderChange.emit(gender);
  }
}
