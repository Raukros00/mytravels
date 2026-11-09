import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ImageCropperComponent } from '../../../shared/components/image-cropper/image-cropper.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { AVATAR_CHOICES, MAX_PHOTO_BYTES, PHOTO_TYPES } from '../../../shared/components/auth-modal/auth-modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_REGISTRATION_AGE } from '../../../core/models/auth.model';
import { User } from '../../../core/models/user.model';
import { isoYearsAgo } from '../../../core/utils/date.utils';
import { minAgeValidator } from '../../../core/utils/min-age.validator';

/** Limite del data URL accettato dal backend (stesso della registrazione). */
const MAX_PHOTO_DATA_URL = 400_000;

/**
 * Modale "Modifica profilo" (#120): nome, cognome, data di nascita, foto (ritaglio 1:1) o avatar emoji.
 * Le regole sono quelle della registrazione; email e password non si cambiano da qui.
 */
@Component({
  selector: 'app-profile-edit',
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, ImageCropperComponent, UserAvatarComponent],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileEditComponent {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  readonly isOpen = input(false);
  readonly closed = output<void>();
  /** Profilo salvato: il genitore ricarica i dati che ne contengono una copia (es. membri dei gruppi). */
  readonly saved = output<User>();

  protected readonly avatarList = AVATAR_CHOICES;
  protected readonly minAge = MIN_REGISTRATION_AGE;
  protected readonly maxBirthDate = isoYearsAgo(MIN_REGISTRATION_AGE);
  protected readonly maxPhotoLength = MAX_PHOTO_DATA_URL;

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    birthDate: ['', [Validators.required, minAgeValidator(MIN_REGISTRATION_AGE)]],
    avatar: [AVATAR_CHOICES[0]]
  });

  protected readonly photoFile = signal<File | null>(null);
  protected readonly profileImage = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // A ogni apertura il modulo riparte dai dati attuali dell'utente.
    effect(() => {
      if (!this.isOpen()) return;
      const user = this.authService.currentUser();
      this.form.reset({
        firstName: user?.firstName ?? user?.name?.split(' ')[0] ?? '',
        lastName: user?.lastName ?? '',
        birthDate: user?.birthDate ?? '',
        avatar: user?.avatar || AVATAR_CHOICES[0]
      });
      this.profileImage.set(user?.profileImage ?? null);
      this.photoFile.set(null);
      this.photoError.set(null);
      this.error.set(null);
      this.pending.set(false);
    });
  }

  /** Anteprima con i valori del modulo (foto, avatar e colore attuali). */
  protected preview(): { name: string; avatar: string; color?: string; profileImage: string | null } {
    const user = this.authService.currentUser();
    return {
      name: this.form.controls.firstName.value,
      avatar: this.form.controls.avatar.value,
      color: user?.color,
      profileImage: this.profileImage()
    };
  }

  protected onPhotoSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      this.photoError.set(this.translate.instant('profile.edit_photo_format'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set(this.translate.instant('profile.edit_photo_too_big'));
      return;
    }
    this.photoError.set(null);
    this.photoFile.set(file);
  }

  protected onPhotoCropped(dataUrl: string): void {
    this.profileImage.set(dataUrl);
    this.photoFile.set(null);
  }

  protected removePhoto(): void {
    this.profileImage.set(null);
  }

  protected close(): void {
    if (this.pending()) return;
    this.closed.emit();
  }

  protected submit(): void {
    if (this.form.invalid || this.pending() || this.photoFile()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.authService.updateProfile({
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      birthDate: value.birthDate,
      avatar: value.avatar,
      profileImage: this.profileImage()
    }).subscribe({
      next: user => {
        this.pending.set(false);
        this.toast.success(this.translate.instant('profile.edit_saved'));
        this.saved.emit(user);
        this.closed.emit();
      },
      error: err => {
        this.pending.set(false);
        const message: string = err?.error?.message ?? '';
        this.error.set(this.translate.instant(
          err?.status === 400 && message.startsWith('birthDate') ? 'profile.edit_error_age'
            : err?.status === 400 && message.startsWith('profileImage') ? 'profile.edit_error_photo'
            : err?.status === 400 ? 'profile.edit_error_invalid'
            : 'profile.edit_error'
        ));
      }
    });
  }
}
