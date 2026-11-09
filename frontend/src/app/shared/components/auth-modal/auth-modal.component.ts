import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { User } from '../../../core/models/user.model';
import { MIN_REGISTRATION_AGE } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { AuthModalService, AuthTab } from '../../../core/services/auth-modal.service';
import { ModalComponent } from '../modal/modal.component';
import { ImageCropperComponent } from '../image-cropper/image-cropper.component';
import { isoYearsAgo } from '../../../core/utils/date.utils';
import { minAgeValidator } from '../../../core/utils/min-age.validator';

/** Email valida anche con spazi iniziali/finali (vengono tolti all'invio, come fa il backend). */
function trimmedEmailValidator(control: AbstractControl<string>): ValidationErrors | null {
  return Validators.email({ value: (control.value ?? '').trim() } as AbstractControl);
}

/** Forma canonica dell'email (trim + minuscolo), la stessa usata dal backend. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lunghezza minima delle nuove password (stessa regola del backend, #70). */
export const MIN_PASSWORD_LENGTH = 8;

/** La password non può essere l'email né la parte prima della @ (stessa regola del backend). */
const passwordNotEmailValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const email = normalizeEmail(group.get('email')?.value ?? '');
  const password = (group.get('password')?.value ?? '').trim().toLowerCase();
  if (!email || !password) return null;
  const local = email.split('@')[0];
  return password === email || password === local ? { passwordIsEmail: true } : null;
};

export type PasswordStrength = 'weak' | 'fair' | 'good';

/**
 * Stima semplice della robustezza (lunghezza + varietà di caratteri), solo come aiuto visivo:
 * le regole vincolanti sono minimo 8 caratteri, niente password comuni, diversa dall'email.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH || /^(.)\1*$/.test(password)) return 'weak';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(password)).length;
  if ((password.length >= 12 && classes >= 3) || (password.length >= 16 && classes >= 2)) return 'good';
  if (classes >= 2 || password.length >= 12) return 'fair';
  return 'weak';
}

const STRENGTH_LABELS: Record<PasswordStrength, string> = { weak: 'Debole', fair: 'Discreta', good: 'Buona' };

/** Limiti della foto scelta prima del ritaglio (anche nella modifica del profilo, #120). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Avatar emoji proposti (registrazione e modifica del profilo). */
export const AVATAR_CHOICES = ['👨‍🍳', '👩‍🎨', '🎒', '🏄‍♂️', '🧘‍♀️', '📸', '🗺️', '☕'];

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

  protected readonly avatarList = AVATAR_CHOICES;
  protected readonly colorList = ['#4f46e5', '#f97316', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4'];

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, trimmedEmailValidator]],
    password: ['', Validators.required]
  });

  protected readonly minAge = MIN_REGISTRATION_AGE;
  /** Ultima data di nascita selezionabile (oggi meno l'età minima). */
  protected readonly maxBirthDate = isoYearsAgo(MIN_REGISTRATION_AGE);

  protected readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    birthDate: ['', [Validators.required, minAgeValidator(MIN_REGISTRATION_AGE)]],
    email: ['', [Validators.required, trimmedEmailValidator]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH), Validators.maxLength(128)]],
    avatar: [this.avatarList[0]],
    color: [this.colorList[0]]
  }, { validators: passwordNotEmailValidator });

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  /** Mostra/nascondi password (accesso e registrazione). */
  protected readonly showLoginPassword = signal(false);
  protected readonly showRegisterPassword = signal(false);

  private readonly registerPassword = toSignal(this.registerForm.controls.password.valueChanges, { initialValue: '' });
  /** Robustezza della password in registrazione (null finché il campo è vuoto). */
  protected readonly strength = computed(() => {
    const value = this.registerPassword() ?? '';
    if (!value) return null;
    const level = passwordStrength(value);
    return { level, label: STRENGTH_LABELS[level] };
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
        this.showLoginPassword.set(false);
        this.showRegisterPassword.set(false);
      }
    });
  }

  protected selectTab(tab: AuthTab): void {
    this.error.set(null);
    this.authModal.tab.set(tab);
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid || this.pending()) return;
    const { email, password } = this.loginForm.getRawValue();
    // Solo trim: il backend confronta senza distinzione tra maiuscole/minuscole (vedi AuthService.findByEmail).
    this.run(this.authService.login({ email: email.trim(), password }));
  }

  protected submitRegister(): void {
    if (this.registerForm.invalid || this.pending()) return;
    const value = this.registerForm.getRawValue();
    this.run(this.authService.register({ ...value, email: normalizeEmail(value.email), profileImage: this.profileImage() }));
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
