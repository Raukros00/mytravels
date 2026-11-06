import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validatore di gruppo: la data di fine (`endKey`) non può precedere quella di inizio (`startKey`).
 * Le date sono stringhe `yyyy-MM-dd` (input type="date"), quindi il confronto tra stringhe basta.
 * Errore: `{ dateRange: true }` sul gruppo.
 */
export function dateRangeValidator(startKey = 'startDate', endKey = 'endDate'): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey)?.value as string | null | undefined;
    const end = group.get(endKey)?.value as string | null | undefined;
    return start && end && end < start ? { dateRange: true } : null;
  };
}
