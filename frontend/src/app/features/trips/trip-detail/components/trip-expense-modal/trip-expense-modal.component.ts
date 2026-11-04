import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { map, startWith } from 'rxjs';
import { BudgetCategory, TripExpense } from '../../../../../core/models/trip.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import {
  EXPENSE_CATEGORIES,
  ExpenseMember,
  fromCents,
  sharesMatchAmount,
  splitEqually,
  toCents
} from '../trip-expenses-tab/trip-expenses.utils';

export type ExpenseFormValue = Omit<TripExpense, 'id' | 'tripId'>;
type SplitMode = 'equal' | 'custom';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

@Component({
  selector: 'app-trip-expense-modal',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-expense-modal.component.html',
  styleUrls: ['../shared/form-helpers.css', './trip-expense-modal.component.css']
})
export class TripExpenseModalComponent {
  readonly isOpen = input(false);
  /** Expense being edited; null/undefined = new expense. */
  readonly expense = input<TripExpense | null | undefined>();
  readonly members = input<ExpenseMember[]>([]);
  readonly currentUserId = input<string | undefined>();
  readonly currency = input('EUR');
  readonly closed = output<void>();
  readonly saved = output<ExpenseFormValue>();

  protected readonly categories = EXPENSE_CATEGORIES;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    category: ['food' as BudgetCategory, Validators.required],
    date: [today(), Validators.required],
    paidBy: ['', Validators.required],
    notes: ['']
  });

  protected readonly selected = signal<string[]>([]);
  protected readonly mode = signal<SplitMode>('equal');
  /** Raw text typed in the custom-amount inputs, per member. */
  protected readonly customInputs = signal<Record<string, string>>({});

  private readonly amount = toSignal(
    this.form.controls.amount.valueChanges.pipe(map(v => Number(v) || 0), startWith(0)),
    { initialValue: 0 }
  );

  protected readonly isEditing = computed(() => !!this.expense());

  /** Former members are listed only if they take part in the edited expense. */
  protected readonly visibleMembers = computed(() => {
    const e = this.expense();
    return this.members().filter(m => !m.former || (e && (e.paidBy === m.id || e.splitAmong.includes(m.id))));
  });

  protected readonly equalShares = computed(() => splitEqually(this.amount(), this.selected()));

  protected readonly customTotal = computed(() => {
    const inputs = this.customInputs();
    return fromCents(this.selected().reduce((acc, id) => acc + toCents(parseFloat(inputs[id]) || 0), 0));
  });

  protected readonly remaining = computed(() => fromCents(toCents(this.amount()) - toCents(this.customTotal())));

  protected readonly splitValid = computed(() => {
    if (this.selected().length === 0) return false;
    return this.mode() === 'equal' || toCents(this.remaining()) === 0;
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      untracked(() => this.resetForm());
    });
  }

  private resetForm(): void {
    const e = this.expense();
    const members = this.visibleMembers();
    const me = this.currentUserId();
    if (e) {
      this.form.reset({
        title: e.title, amount: e.amount, category: e.category, date: e.date, paidBy: e.paidBy, notes: e.notes ?? ''
      });
      this.selected.set([...e.splitAmong]);
      const equal = splitEqually(e.amount, e.splitAmong);
      const isEqual = e.splitAmong.every(id => toCents(e.shares[id] ?? 0) === toCents(equal[id]));
      this.mode.set(isEqual ? 'equal' : 'custom');
      this.customInputs.set(Object.fromEntries(e.splitAmong.map(id => [id, String(e.shares[id] ?? 0)])));
    } else {
      const paidBy = members.find(m => m.id === me && !m.former)?.id ?? members.find(m => !m.former)?.id ?? '';
      this.form.reset({ title: '', amount: null, category: 'food', date: today(), paidBy, notes: '' });
      this.selected.set(members.filter(m => !m.former).map(m => m.id));
      this.mode.set('equal');
      this.customInputs.set({});
    }
  }

  protected isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  protected toggleMember(id: string): void {
    this.selected.update(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  }

  protected setMode(mode: SplitMode): void {
    if (mode === 'custom' && this.mode() !== 'custom') {
      // Start from the equal split so the user only has to tweak it
      const equal = this.equalShares();
      this.customInputs.set(Object.fromEntries(this.selected().map(id => [id, String(equal[id] ?? 0)])));
    }
    this.mode.set(mode);
  }

  protected setCustom(id: string, value: string): void {
    this.customInputs.update(c => ({ ...c, [id]: value }));
  }

  protected shareFor(id: string): number {
    return this.equalShares()[id] ?? 0;
  }

  protected customValue(id: string): string {
    return this.customInputs()[id] ?? '';
  }

  protected save(): void {
    if (this.form.invalid || !this.splitValid()) return;
    const val = this.form.getRawValue();
    const amount = fromCents(toCents(Number(val.amount)));
    const splitAmong = this.selected();
    const shares = this.mode() === 'equal'
      ? splitEqually(amount, splitAmong)
      : Object.fromEntries(splitAmong.map(id => [id, fromCents(toCents(parseFloat(this.customInputs()[id]) || 0))]));
    if (!sharesMatchAmount(amount, shares)) return;
    this.saved.emit({
      title: val.title.trim(),
      amount,
      category: val.category,
      date: val.date,
      paidBy: val.paidBy,
      splitAmong,
      shares,
      type: 'expense',
      notes: val.notes.trim() || undefined
    });
  }
}
