import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LEGAL_DOCS, LEGAL_UPDATED, LEGAL_VERSION, LegalDocKey } from './legal.content';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.css'
})
export class LegalPageComponent {
  private route = inject(ActivatedRoute);

  readonly updated = LEGAL_UPDATED;
  readonly version = LEGAL_VERSION;
  readonly tabs: { key: LegalDocKey; label: string; path: string }[] = [
    { key: 'privacy', label: 'Privacy', path: '/privacy' },
    { key: 'termini', label: "Termini d'uso", path: '/termini' },
    { key: 'cookie', label: 'Cookie', path: '/cookie' }
  ];

  private docKey = toSignal(
    this.route.data.pipe(map(d => d['doc'] as LegalDocKey)),
    { initialValue: 'privacy' as LegalDocKey }
  );

  readonly doc = computed(() => LEGAL_DOCS[this.docKey()]);

  /** Sezioni aperte (solo mobile: su desktop sono sempre tutte visibili). */
  private openIds = signal<Set<string>>(new Set());

  isOpen(id: string): boolean {
    return this.openIds().has(id) || (this.openIds().size === 0 && id === this.doc().sections[0].id);
  }

  toggle(id: string): void {
    const next = new Set(this.openIds().size === 0 ? [this.doc().sections[0].id] : this.openIds());
    if (!next.delete(id)) next.add(id);
    this.openIds.set(next);
  }

  goTo(id: string): void {
    const next = new Set(this.openIds());
    next.add(id);
    this.openIds.set(next);
    // Aspetta il rendering della sezione aperta prima di scorrere
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
