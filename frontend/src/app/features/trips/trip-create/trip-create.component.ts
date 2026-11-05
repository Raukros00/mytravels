import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TripService } from '../../../core/services/trip.service';
import { GroupService } from '../../../core/services/group.service';
import { ToastService } from '../../../core/services/toast.service';
import { CoverService, CoverSuggestion, UNSPLASH_LINK } from '../../../core/services/cover.service';

interface CoverPreset {
  title: string;
  url: string;
  tag: string;
}

@Component({
  selector: 'app-trip-create',
  standalone: true,
  imports: [RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './trip-create.component.html',
  styleUrl: './trip-create.component.css'
})
export class TripCreateComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  public tripService = inject(TripService);
  public groupService = inject(GroupService);
  private route = inject(ActivatedRoute);
  private covers = inject(CoverService);
  private destroyRef = inject(DestroyRef);

  /** Copertine suggerite per la destinazione scritta (Unsplash, tramite backend). */
  protected readonly coverSuggestions = signal<CoverSuggestion[]>([]);
  protected readonly coverQuery = signal('');
  protected readonly coversLoading = signal(false);
  protected readonly unsplashLink = UNSPLASH_LINK;
  /** Gruppo da cui si arriva ("Nuovo viaggio" dal dettaglio gruppo: /trips/new?groupId=...). */
  private requestedGroupId = this.route.snapshot.queryParamMap.get('groupId');
  private toastService = inject(ToastService);

  public currentTag = signal('');
  public tagsList = signal<string[]>(['Food Tour', 'Tapas & Gusto']);

  public coverPresets: CoverPreset[] = [
    {
      title: 'Barcellona & Tapas',
      url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80',
      tag: 'Spagna'
    },
    {
      title: 'Napoli & Pizza',
      url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
      tag: 'Italia'
    },
    {
      title: 'Tokyo & Ramen',
      url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
      tag: 'Giappone'
    },
    {
      title: 'Parigi & Bistrot',
      url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
      tag: 'Francia'
    },
    {
      title: 'Roma & Trattorie',
      url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
      tag: 'Italia'
    },
    {
      title: 'Londra & Pubs',
      url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
      tag: 'UK'
    }
  ];

  public tripForm = this.fb.group({
    groupId: [this.defaultGroupId(), Validators.required],
    title: ['', [Validators.required, Validators.minLength(3)]],
    destination: ['', Validators.required],
    country: ['Italia', Validators.required],
    startDate: [new Date().toISOString().split('T')[0], Validators.required],
    endDate: [new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0], Validators.required],
    budgetEstimate: [500],
    currency: [this.groupService.getGroupById(this.defaultGroupId())?.currency || 'EUR'],
    coverUrl: [this.coverPresets[0].url, Validators.required],
    notes: [''],
    asProposal: [false]
  });

  /** Copertina scelta tra i suggerimenti (null se è un preset o un URL personalizzato). */
  private readonly coverUrlValue = toSignal(this.tripForm.controls.coverUrl.valueChanges, {
    initialValue: this.tripForm.controls.coverUrl.value
  });
  protected readonly selectedSuggestion = computed(() =>
    this.coverSuggestions().find(c => c.url === this.coverUrlValue()) ?? null
  );

  constructor() {
    // Suggerimenti di copertina mentre si scrive la destinazione (dopo una breve pausa).
    this.tripForm.controls.destination.valueChanges.pipe(
      map(v => (v ?? '').trim()),
      debounceTime(500),
      distinctUntilChanged(),
      tap(q => {
        this.coverQuery.set(q.length >= 3 ? q : '');
        this.coversLoading.set(q.length >= 3);
      }),
      switchMap(q => q.length < 3
        ? of(null)
        : this.covers.search(q).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(res => {
      this.coversLoading.set(false);
      this.coverSuggestions.set(res?.enabled ? res.results : []);
    });

    // I gruppi possono arrivare dopo l'apertura della pagina: appena ci sono, se il gruppo
    // selezionato non è valido scelgo quello richiesto (o l'attivo, o il primo).
    effect(() => {
      const ids = this.groupService.userGroups().map(g => g.id);
      untracked(() => {
        const current = this.tripForm.controls.groupId.value;
        if (ids.length && (!current || !ids.includes(current))) {
          this.tripForm.controls.groupId.setValue(this.defaultGroupId());
        }
      });
    });

    this.tripForm.controls.groupId.valueChanges.subscribe(id => {
      const currency = this.groupService.getGroupById(id ?? '')?.currency;
      if (currency) this.tripForm.patchValue({ currency });
    });
  }

  /** Gruppo da preselezionare: quello da cui si arriva, se è tra i propri; altrimenti l'attivo o il primo. */
  private defaultGroupId(): string {
    const ids = this.groupService.userGroups().map(g => g.id);
    if (this.requestedGroupId && ids.includes(this.requestedGroupId)) return this.requestedGroupId;
    const active = this.groupService.activeGroupId();
    if (active && ids.includes(active)) return active;
    return ids[0] ?? '';
  }

  /** Le icone foto (data URL) non si possono mostrare in un <option>: lì resta solo il nome. */
  groupOptionLabel(group: { icon?: string; name: string }): string {
    const icon = group.icon ?? '';
    const isImage = icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
    return isImage || !icon ? group.name : `${icon} ${group.name}`;
  }

  selectSuggestion(cover: CoverSuggestion): void {
    this.tripForm.patchValue({ coverUrl: cover.url });
  }

  addTag(event?: Event): void {
    if (event) event.preventDefault();
    const tag = this.currentTag().trim().replace(/^#/, '');
    if (tag && !this.tagsList().includes(tag)) {
      this.tagsList.update(list => [...list, tag]);
      this.currentTag.set('');
    }
  }

  removeTag(tag: string): void {
    this.tagsList.update(list => list.filter(t => t !== tag));
  }

  onSubmit(): void {
    if (this.tripForm.invalid) {
      this.toastService.error('Compila tutti i campi obbligatori.');
      return;
    }

    const val = this.tripForm.value;
    const suggestion = this.selectedSuggestion();
    if (suggestion) this.covers.trackDownload(suggestion.downloadLocation);
    const created = this.tripService.createTrip({
      groupId: val.groupId!,
      title: val.title!,
      destination: val.destination!,
      country: val.country || '',
      startDate: val.startDate!,
      endDate: val.endDate!,
      coverUrl: val.coverUrl || this.coverPresets[0].url,
      coverCreditName: suggestion?.authorName ?? null,
      coverCreditUrl: suggestion?.authorUrl ?? null,
      budgetEstimate: Number(val.budgetEstimate) || 0,
      currency: val.currency || 'EUR',
      tags: this.tagsList(),
      notes: val.notes || '',
      asProposal: !!val.asProposal
    });

    this.router.navigate(val.asProposal ? ['/groups', created.groupId] : ['/trips', created.id]);
  }
}
