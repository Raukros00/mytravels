import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ProfilePushComponent } from './profile-push/profile-push.component';
import { ProfileEditComponent } from './profile-edit/profile-edit.component';
import { ProfileDeleteComponent } from './profile-delete/profile-delete.component';
import { AuthService } from '../../core/services/auth.service';
import { TripService } from '../../core/services/trip.service';
import { GroupService } from '../../core/services/group.service';
import { I18nService } from '../../core/services/i18n.service';
import { deriveTripStatus, isProposal } from '../../core/models/trip.model';

interface ProfileStat {
  key: string;
  icon: string;
  label: string;
  value: number;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslatePipe, UserAvatarComponent, ProfilePushComponent, ProfileEditComponent, ProfileDeleteComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  protected readonly authService = inject(AuthService);
  private readonly tripService = inject(TripService);
  private readonly groupService = inject(GroupService);
  private readonly i18n = inject(I18nService);

  /** Lingua attiva, per formattare le date (it / en). */
  protected readonly lang = this.i18n.currentLang;

  constructor() {
    // I viaggi si caricano per gruppo (all'avvio solo quelli del gruppo attivo): come nella
    // lista viaggi, qui servono quelli di tutti i gruppi dell'utente.
    effect(() => {
      for (const group of this.groupService.userGroups()) {
        this.tripService.loadTripsByGroup(group.id);
      }
    });
  }

  /**
   * Statistiche su tutti i viaggi confermati dei gruppi (non archiviati) dell'utente, gli stessi
   * della lista "I miei viaggi". Le proposte non contano; lo stato deriva dalle date (giorno locale).
   */
  protected readonly stats = computed<ProfileStat[]>(() => {
    const groups = this.groupService.userGroups();
    const groupIds = new Set(groups.map(g => g.id));
    const trips = this.tripService.trips().filter(t => groupIds.has(t.groupId) && !isProposal(t));
    const countries = new Set(trips.map(t => t.country?.trim().toLowerCase()).filter(Boolean));
    const upcoming = trips.filter(t => deriveTripStatus(t) === 'upcoming').length;
    return [
      { key: 'trips', icon: 'map', label: 'profile.stat_trips', value: trips.length },
      { key: 'groups', icon: 'group', label: 'profile.stat_groups', value: groups.length },
      { key: 'countries', icon: 'public', label: 'profile.stat_countries', value: countries.size },
      { key: 'upcoming', icon: 'flight_takeoff', label: 'profile.stat_upcoming', value: upcoming }
    ];
  });

  /** Modale "Modifica profilo" (#120). */
  protected readonly editOpen = signal(false);

  /**
   * Dopo la modifica del profilo si ricaricano i gruppi: i membri contengono una copia di nome,
   * avatar e foto (aggiornata dal backend), così il nuovo nome compare subito anche negli elenchi.
   */
  protected onProfileSaved(): void {
    this.groupService.loadGroups();
  }

  protected logout(): void {
    this.authService.logout();
  }
}
