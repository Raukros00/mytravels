import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isoYearsAgo } from './date.utils';

/**
 * Data di nascita (`yyyy-MM-dd`) di chi ha almeno `years` anni compiuti oggi (stessa regola del backend).
 * Errore: `{ minAge: { years } }`.
 */
export function minAgeValidator(years: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    control.value && control.value > isoYearsAgo(years) ? { minAge: { years } } : null;
}
