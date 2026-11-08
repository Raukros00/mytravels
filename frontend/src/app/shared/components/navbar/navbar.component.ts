import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ModalComponent } from '../modal/modal.component';
import { NotificationListComponent } from '../notification-list/notification-list.component';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthModalService } from '../../../core/services/auth-modal.service';
import { GroupService } from '../../../core/services/group.service';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LiveTripService } from '../../../core/services/live-trip.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import { GroupCreateModalComponent } from '../../../features/groups/group-create-modal/group-create-modal.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, GroupCreateModalComponent, UserAvatarComponent, ModalComponent, NotificationListComponent],
  host: { '(document:click)': 'clickOutside()' },
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  public authService = inject(AuthService);
  public authModal = inject(AuthModalService);
  public groupService = inject(GroupService);
  public i18n = inject(I18nService);
  public notifService = inject(NotificationService);
  /** Viaggio in corso: voce "Oggi" (#104). */
  public liveTrips = inject(LiveTripService);
  private router = inject(Router);

  /** Sulla guida della giornata è attiva la voce "Oggi", non "Viaggi". */
  public readonly isLivePage = toSignal(this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(e => /^\/trips\/[^/?#]+\/live(?:[?#]|$)/.test(e.urlAfterRedirects))
  ), { initialValue: false });

  public isGroupMenuOpen = signal(false);
  public isUserMenuOpen = signal(false);
  public isNotifPanelOpen = signal(false);
  public isCreateGroupModalOpen = signal(false);
  /** Pannello account su mobile (dalla barra in basso). */
  public isAccountSheetOpen = signal(false);

  clickOutside(): void {
    this.isGroupMenuOpen.set(false);
    this.isUserMenuOpen.set(false);
    this.isNotifPanelOpen.set(false);
  }

  toggleGroupMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isGroupMenuOpen.update(v => !v);
    this.isUserMenuOpen.set(false);
    this.isNotifPanelOpen.set(false);
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen.update(v => !v);
    this.isGroupMenuOpen.set(false);
    this.isNotifPanelOpen.set(false);
  }

  isImageIcon(icon?: string): boolean {
    return !!icon && (icon.startsWith('data:') || icon.startsWith('http'));
  }

  toggleNotifPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.isNotifPanelOpen.update(v => !v);
    this.isUserMenuOpen.set(false);
    this.isGroupMenuOpen.set(false);
    if (this.isNotifPanelOpen()) {
      this.notifService.markAllRead();
    }
  }

  selectGroup(groupId: string): void {
    this.groupService.setActiveGroup(groupId);
    this.isGroupMenuOpen.set(false);
  }

  openCreateGroupModal(): void {
    this.isGroupMenuOpen.set(false);
    this.isCreateGroupModalOpen.set(true);
  }

  openAccountSheet(): void {
    this.isAccountSheetOpen.set(true);
    if (this.authService.isAuthenticated()) this.notifService.markAllRead();
  }

  loginFromSheet(): void {
    this.isAccountSheetOpen.set(false);
    this.authModal.open({ tab: 'login' });
  }

  logoutFromSheet(): void {
    this.isAccountSheetOpen.set(false);
    this.authService.logout();
  }

  logout(): void {
    this.isUserMenuOpen.set(false);
    this.authService.logout();
  }
}
