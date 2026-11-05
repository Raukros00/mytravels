import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { User } from '../../../core/models/user.model';
import { MIN_REGISTRATION_AGE } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { AuthModalService, AuthTab } from '../../../core/services/auth-modal.service';
import { ModalComponent } from '../modal/modal.component';
import { ImageCropperComponent } from '../image-cropper/image-cropper.component';

/** Data ISO (yyyy-mm-dd) di `years` anni fa: l'ultima data di nascita ammessa. */
function isoYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

/** Almeno `years` anni compiuti oggi (stessa regola del backend). */
function minAgeValidator(years: number) {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    control.value && control.value > isoYearsAgo(years) ? { minAge: { years } } : null;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Accesso e registrazione in un'unica modale con due schede (stile Airbnb). */
@Component({
  selector: 'app-auth-modal',
  imports: [ReactiveFormsModule, ModalComponent, ImageCropperComponent],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthModalComponent {
  protected readonly authModal = inject(AuthModalService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly avatarList = ['👨‍🍳', '👩‍🎨', '🎒', '🏄‍♂️', '🧘‍♀️', '📸', '🗺️', '☕'];
  protected readonly colorList = ['#4f46e5', '#f97316', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4'];

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  protected readonly minAge = MIN_REGISTRATION_AGE;
  /** Ultima data di nascita selezionabile (oggi meno l'età minima). */
  protected readonly maxBirthDate = isoYearsAgo(MIN_REGISTRATION_AGE);

  protected readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    birthDate: ['', [Validators.required, minAgeValidator(MIN_REGISTRATION_AGE)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    avatar: [this.avatarList[0]],
    color: [this.colorList[0]]
  });

  /** Foto scelta e in fase di ritaglio. */
  protected readonly photoFile = signal<File | null>(null);
  /** Foto ritagliata (data URL) che verrà inviata con la registrazione. */
  protected readonly profileImage = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);

  constructor() {
    // Ogni apertura riparte pulita: niente errori o campi rimasti dalla volta precedente.
    effect(() => {
      if (this.authModal.isOpen()) {
        this.error.set(null);
        this.pending.set(false);
        this.loginForm.reset();
        this.registerForm.reset();
        this.photoFile.set(null);
        this.profileImage.set(null);
        this.photoError.set(null);
      }
    });
  }

  protected selectTab(tab: AuthTab): void {
    this.error.set(null);
    this.authModal.tab.set(tab);
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid || this.pending()) return;
    this.run(this.authService.login(this.loginForm.getRawValue()));
  }

  protected submitRegister(): void {
    if (this.registerForm.invalid || this.pending()) return;
    this.run(this.authService.register({ ...this.registerForm.getRawValue(), profileImage: this.profileImage() }));
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permette di riscegliere lo stesso file
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      this.photoError.set('Formato non supportato: usa un\'immagine JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set('L\'immagine è troppo grande (massimo 10 MB).');
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

  private run(request: Observable<User>): void {
    this.pending.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.pending.set(false);
        this.authModal.completed();
      },
      error: (err: Error) => {
        this.pending.set(false);
        this.error.set(err.message);
      }
    });
  }
}
