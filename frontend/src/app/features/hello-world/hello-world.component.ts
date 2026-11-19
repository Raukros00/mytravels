import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Pose della mascotte: "idle" è lo stato di riposo, le altre durano il tempo dell'animazione. */
export type MascotPose = 'idle' | 'poke' | 'wave' | 'jump';

/** Durata (ms) dopo cui la mascotte torna a riposo. */
const POSE_DURATION_MS = 1100;

interface PoseCard {
  /** Chiave nei file i18n (`hello.pose_<key>_*`). */
  key: 'rest' | 'wave' | 'jump';
  pose: MascotPose;
  index: string;
}

@Component({
  selector: 'app-hello-world',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './hello-world.component.html',
  styleUrl: './hello-world.component.css'
})
export class HelloWorldComponent {
  private destroyRef = inject(DestroyRef);
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  /** Pose attuale della mascotte. */
  readonly pose = signal<MascotPose>('idle');
  /** Si incrementa a ogni reazione: serve a riavviare l'animazione anche se la posa è la stessa. */
  readonly pulse = signal(0);

  readonly reactions: { pose: Exclude<MascotPose, 'idle'>; icon: string; key: string }[] = [
    { pose: 'poke', icon: '👆', key: 'poke' },
    { pose: 'wave', icon: '👋', key: 'wave' },
    { pose: 'jump', icon: '🦘', key: 'jump' }
  ];

  readonly poses: PoseCard[] = [
    { key: 'rest', pose: 'idle', index: '01' },
    { key: 'wave', pose: 'wave', index: '02' },
    { key: 'jump', pose: 'jump', index: '03' }
  ];

  /** Posa mostrata nelle card: "poke" conta come riposo. */
  readonly activeCard = computed<PoseCard['key']>(() => {
    switch (this.pose()) {
      case 'wave': return 'wave';
      case 'jump': return 'jump';
      default: return 'rest';
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  /** Il tocco sulla mascotte la fa saltare, come dice il fumetto. */
  tapMascot(): void {
    this.play('jump');
  }

  play(pose: Exclude<MascotPose, 'idle'>): void {
    this.clearTimer();
    this.pose.set(pose);
    this.pulse.update(n => n + 1);
    this.resetTimer = setTimeout(() => this.pose.set('idle'), POSE_DURATION_MS);
  }

  /** Mostra una posa dalle card; il riposo azzera semplicemente l'animazione. */
  showPose(card: PoseCard): void {
    if (card.pose === 'idle') {
      this.clearTimer();
      this.pose.set('idle');
      this.pulse.update(n => n + 1);
    } else {
      this.play(card.pose);
    }
  }

  private clearTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}
