import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { GroupCreateModalComponent } from '../../../features/groups/group-create-modal/group-create-modal.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, GroupCreateModalComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  public authService = inject(AuthService);
  public groupService = inject(GroupService);
  private router = inject(Router);

  public isGroupMenuOpen = signal(false);
  public isUserMenuOpen = signal(false);
  public isCreateGroupModalOpen = signal(false);

  @HostListener('document:click')
  clickOutside(): void {
    this.isGroupMenuOpen.set(false);
    this.isUserMenuOpen.set(false);
  }

  toggleGroupMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isGroupMenuOpen.update(v => !v);
    this.isUserMenuOpen.set(false);
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen.update(v => !v);
    this.isGroupMenuOpen.set(false);
  }

  selectGroup(groupId: string): void {
    this.groupService.setActiveGroup(groupId);
    this.isGroupMenuOpen.set(false);
  }

  openCreateGroupModal(): void {
    this.isGroupMenuOpen.set(false);
    this.isCreateGroupModalOpen.set(true);
  }

  logout(): void {
    this.isUserMenuOpen.set(false);
    this.authService.logout();
  }
}
