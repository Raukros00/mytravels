import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';

/** Elenco delle notifiche dell'utente: usato dal pannello desktop e dal pannello account su mobile. */
@Component({
  selector: 'app-notification-list',
  imports: [RouterLink],
  templateUrl: './notification-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationListComponent {
  protected readonly notifications = inject(NotificationService);

  /** Lista con altezza massima e scroll interno (pannello desktop). */
  readonly scroll = input(true);
  /** Emesso quando si segue un link (per chiudere il pannello che contiene la lista). */
  readonly navigated = output<void>();

  protected isImageIcon(icon?: string): boolean {
    return !!icon && (icon.startsWith('data:') || icon.startsWith('http'));
  }
}
