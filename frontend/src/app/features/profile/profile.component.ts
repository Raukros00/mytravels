import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ProfilePushComponent } from './profile-push/profile-push.component';
import { ProfileEditComponent } from './profile-edit/profile-edit.component';
import { ProfileDeleteComponent } from './profile-delete/profile-delete.component';
import { ProfileCountriesComponent } from './profile-countries/profile-countries.component';
import { ClockService } from '../../core/services/clock.service';
import { countryBadges } from '../../core/utils/country-badges.utils';
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
  imports: [DatePipe, NgTemplateOutlet, TranslatePipe, ProfileCountriesComponent, UserAvatarComponent, ProfilePushComponent, ProfileEditComponent, ProfileDeleteComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  protected readonly authService = inject(AuthService);
  private readonly tripService = inject(TripService);
  private readonly groupService = inject(GroupService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(ClockService);

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
  protected readonly userTrips = computed(() => {
    const groupIds = new Set(this.groupService.userGroups().map(g => g.id));
    return this.tripService.trips().filter(t => groupIds.has(t.groupId) && !isProposal(t));
  });

  protected readonly stats = computed<ProfileStat[]>(() => {
    const groups = this.groupService.userGroups();
    const trips = this.userTrips();
    // #123: nazioni esplorate = nazioni con almeno un viaggio concluso (come i badge "visitata").
    const countries = countryBadges(trips, this.clock.now()).filter(b => b.state === 'visited').length;
    const upcoming = trips.filter(t => deriveTripStatus(t, this.clock.now()) === 'upcoming').length;
    return [
      { key: 'trips', icon: 'map', label: 'profile.stat_trips', value: trips.length },
      { key: 'groups', icon: 'group', label: 'profile.stat_groups', value: groups.length },
      { key: 'countries', icon: 'public', label: 'profile.stat_countries', value: countries },
      { key: 'upcoming', icon: 'flight_takeoff', label: 'profile.stat_upcoming', value: upcoming }
    ];
  });

  /** Dalla statistica "Nazioni esplorate" alla sezione dei badge (#123). */
  protected goToCountries(event: Event): void {
    event.preventDefault();
    const section = document.getElementById('profile-countries');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }

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
