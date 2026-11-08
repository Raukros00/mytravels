import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AuthModalComponent } from './shared/components/auth-modal/auth-modal.component';
import { AuthModalService } from './core/services/auth-modal.service';
import { PushNotificationService } from './core/services/push-notification.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToastComponent, AuthModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'WanderBite';
  protected readonly authModal = inject(AuthModalService);
  /** Sempre attivo: rimuove l'abbonamento push al logout e lo ripristina al login. */
  private readonly push = inject(PushNotificationService);
}
