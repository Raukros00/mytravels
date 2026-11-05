import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { AuthModalService, AuthTab } from '../../../core/services/auth-modal.service';
import { ModalComponent } from '../modal/modal.component';

/** Accesso e registrazione in un'unica modale con due schede (stile Airbnb). */
@Component({
  selector: 'app-auth-modal',
  imports: [ReactiveFormsModule, ModalComponent],
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

  protected readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    avatar: [this.avatarList[0]],
    color: [this.colorList[0]]
  });

  constructor() {
    // Ogni apertura riparte pulita: niente errori o campi rimasti dalla volta precedente.
    effect(() => {
      if (this.authModal.isOpen()) {
        this.error.set(null);
        this.pending.set(false);
        this.loginForm.reset();
        this.registerForm.reset();
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
    this.run(this.authService.register(this.registerForm.getRawValue()));
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
