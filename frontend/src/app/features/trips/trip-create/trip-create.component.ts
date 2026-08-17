import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TripService } from '../../../core/services/trip.service';
import { GroupService } from '../../../core/services/group.service';
import { ToastService } from '../../../core/services/toast.service';

interface CoverPreset {
  title: string;
  url: string;
  tag: string;
}

@Component({
  selector: 'app-trip-create',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './trip-create.component.html',
  styleUrl: './trip-create.component.css'
})
export class TripCreateComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  public tripService = inject(TripService);
  public groupService = inject(GroupService);
  private toastService = inject(ToastService);

  public currentTag = '';
  public tagsList: string[] = ['Food Tour', 'Tapas & Gusto'];

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
    groupId: [this.groupService.activeGroupId() || this.groupService.userGroups()[0]?.id || '', Validators.required],
    title: ['', [Validators.required, Validators.minLength(3)]],
    destination: ['', Validators.required],
    country: ['Italia', Validators.required],
    startDate: [new Date().toISOString().split('T')[0], Validators.required],
    endDate: [new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0], Validators.required],
    budgetEstimate: [500],
    currency: ['EUR'],
    coverUrl: [this.coverPresets[0].url, Validators.required],
    notes: ['']
  });

  addTag(event?: Event): void {
    if (event) event.preventDefault();
    const tag = this.currentTag.trim().replace(/^#/, '');
    if (tag && !this.tagsList.includes(tag)) {
      this.tagsList.push(tag);
      this.currentTag = '';
    }
  }

  removeTag(tag: string): void {
    this.tagsList = this.tagsList.filter(t => t !== tag);
  }

  onSubmit(): void {
    if (this.tripForm.invalid) {
      this.toastService.error('Compila tutti i campi obbligatori.');
      return;
    }

    const val = this.tripForm.value;
    const created = this.tripService.createTrip({
      groupId: val.groupId!,
      title: val.title!,
      destination: val.destination!,
      country: val.country || '',
      startDate: val.startDate!,
      endDate: val.endDate!,
      coverUrl: val.coverUrl || this.coverPresets[0].url,
      budgetEstimate: Number(val.budgetEstimate) || 0,
      currency: val.currency || 'EUR',
      tags: this.tagsList,
      notes: val.notes || ''
    });

    this.router.navigate(['/trips', created.id]);
  }
}
