import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FlightDetails, FlightInfo } from '../../../../../core/models/trip.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-trip-flights-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-flights-modal.component.html',
  styleUrls: ['../shared/form-helpers.css', './trip-flights-modal.component.css']
})
export class TripFlightsModalComponent {
  readonly isOpen = input(false);
  readonly flights = input<FlightDetails | undefined>();
  readonly closed = output<void>();
  readonly saved = output<FlightDetails>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    outAirline: [''],
    outFlightNum: [''],
    outDepAirport: [''],
    outDepTime: [''],
    outArrAirport: [''],
    outArrTime: [''],
    retAirline: [''],
    retFlightNum: [''],
    retDepAirport: [''],
    retDepTime: [''],
    retArrAirport: [''],
    retArrTime: [''],
    pnr: ['']
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      const fl = untracked(this.flights);
      this.form.patchValue({
        outAirline: fl?.outboundFlight?.airline || '',
        outFlightNum: fl?.outboundFlight?.flightNumber || '',
        outDepAirport: fl?.outboundFlight?.departureAirport || '',
        outDepTime: fl?.outboundFlight?.departureDateTime || '',
        outArrAirport: fl?.outboundFlight?.arrivalAirport || '',
        outArrTime: fl?.outboundFlight?.arrivalDateTime || '',
        retAirline: fl?.returnFlight?.airline || '',
        retFlightNum: fl?.returnFlight?.flightNumber || '',
        retDepAirport: fl?.returnFlight?.departureAirport || '',
        retDepTime: fl?.returnFlight?.departureDateTime || '',
        retArrAirport: fl?.returnFlight?.arrivalAirport || '',
        retArrTime: fl?.returnFlight?.arrivalDateTime || '',
        pnr: fl?.outboundFlight?.bookingReference || fl?.returnFlight?.bookingReference || ''
      });
    });
  }

  protected save(): void {
    const v = this.form.getRawValue();
    const leg = (p: 'out' | 'ret'): FlightInfo => {
      const dep = v[`${p}DepAirport`];
      const arr = v[`${p}ArrAirport`];
      return {
        airline: v[`${p}Airline`] || '',
        flightNumber: v[`${p}FlightNum`] || '',
        departureAirport: dep || '',
        departureCity: dep?.split('-')[1]?.trim() || 'Partenza',
        departureDateTime: v[`${p}DepTime`] || '',
        arrivalAirport: arr || '',
        arrivalCity: arr?.split('-')[1]?.trim() || 'Arrivo',
        arrivalDateTime: v[`${p}ArrTime`] || '',
        bookingReference: v.pnr || '',
        baggageNotes: '1 bagaglio a mano incluso'
      };
    };
    this.saved.emit({ outboundFlight: leg('out'), returnFlight: leg('ret') });
  }
}
