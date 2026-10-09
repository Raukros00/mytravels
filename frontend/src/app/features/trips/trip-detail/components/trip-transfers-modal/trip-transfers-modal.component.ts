import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AirportTransfer } from '../../../../../core/models/trip.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-trip-transfers-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-transfers-modal.component.html',
  styleUrls: ['../shared/form-helpers.css']
})
export class TripTransfersModalComponent {
  readonly isOpen = input(false);
  readonly transfers = input<AirportTransfer | undefined>();
  readonly closed = output<void>();
  readonly saved = output<AirportTransfer>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    recommendedOption: ['bus' as AirportTransfer['recommendedOption']],
    passDetails: [''],
    specialTickets: [''],
    taxiVsUberAdvice: [''],
    estimatedCost: [''],
    estimatedDuration: [''],
    instructions: ['']
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      const tr = untracked(this.transfers);
      this.form.patchValue({
        recommendedOption: tr?.recommendedOption || 'bus',
        passDetails: tr?.passDetails || '',
        specialTickets: tr?.specialTickets || '',
        taxiVsUberAdvice: tr?.taxiVsUberAdvice || '',
        estimatedCost: tr?.estimatedCost || '',
        estimatedDuration: tr?.estimatedDuration || '',
        instructions: tr?.instructions || ''
      });
    });
  }

  protected save(): void {
    const val = this.form.getRawValue();
    this.saved.emit({
      recommendedOption: val.recommendedOption || 'bus',
      passRequired: !!val.passDetails,
      passDetails: val.passDetails || '',
      specialTickets: val.specialTickets || '',
      taxiVsUberAdvice: val.taxiVsUberAdvice || '',
      estimatedCost: val.estimatedCost || '',
      estimatedDuration: val.estimatedDuration || '',
      instructions: val.instructions || ''
    });
  }
}
