import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { User } from '../../../../../core/models/user.model';

/** Intestazione del dettaglio gruppo: copertina (foto o emoji sul colore del gruppo), dati e azioni. */
@Component({
  selector: 'app-group-hero',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-hero.component.html',
  styleUrl: './group-hero.component.css'
})
export class GroupHeroComponent {
  readonly group = input.required<Group>();
  readonly creator = input<User | null>(null);
  readonly isAdmin = input(false);

  readonly edit = output<void>();
  readonly invite = output<void>();

  readonly isImageIcon = computed(() => {
    const icon = this.group().icon ?? '';
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  });
}
