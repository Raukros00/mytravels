import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { User } from '../../../../../core/models/user.model';

@Component({
  selector: 'app-group-hero',
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

  private readonly heroIcon = viewChild<ElementRef<HTMLElement>>('heroIcon');

  readonly isImageIcon = computed(() => {
    const icon = this.group().icon;
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  });

  constructor() {
    effect(onCleanup => {
      const el = this.heroIcon()?.nativeElement;
      if (!el) return;
      const sync = () => (el.style.width = el.offsetHeight + 'px');
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }
}
