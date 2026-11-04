import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Trip, TripExpense } from '../../../../../core/models/trip.model';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { TripBudgetComponent } from '../trip-budget/trip-budget.component';
import {
  ExpenseMember,
  FORMER_MEMBER_NAME,
  Transfer,
  computeBalances,
  expenseImpact,
  getCategoryInfo,
  groupExpensesByDate,
  isSettlement,
  shareOf,
  simplifyDebts,
  totalPaidBy,
  totalSpent
} from './trip-expenses.utils';

interface BalanceRow {
  member: ExpenseMember;
  balance: number;
}

const FALLBACK_MEMBER: ExpenseMember = { id: '', name: FORMER_MEMBER_NAME, avatar: '👤', color: '#9CA3AF', former: true };

@Component({
  selector: 'app-trip-expenses-tab',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, EmptyStateComponent, TripBudgetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-expenses-tab.component.html',
  styleUrls: ['../shared/tab-common.css', './trip-expenses-tab.component.css']
})
export class TripExpensesTabComponent {
  readonly trip = input.required<Trip>();
  /** Group members plus "former" members still referenced by expenses. */
  readonly members = input<ExpenseMember[]>([]);
  readonly currentUserId = input<string | undefined>();

  readonly addExpense = output<void>();
  readonly editExpense = output<TripExpense>();
  readonly deleteExpense = output<string>();
  readonly settle = output<Transfer>();

  protected readonly currency = computed(() => this.trip().currency || 'EUR');
  protected readonly expenses = computed(() => this.trip().expenses ?? []);
  protected readonly budget = computed(() => this.trip().budgetEstimate || 0);

  protected readonly spent = computed(() => totalSpent(this.expenses()));
  protected readonly budgetPercent = computed(() => {
    const b = this.budget();
    return b > 0 ? Math.min(100, (this.spent() / b) * 100) : 0;
  });
  protected readonly overBudget = computed(() => this.budget() > 0 && this.spent() > this.budget());
  protected readonly myShare = computed(() => {
    const id = this.currentUserId();
    return id ? shareOf(this.expenses(), id) : 0;
  });
  protected readonly myPaid = computed(() => {
    const id = this.currentUserId();
    return id ? totalPaidBy(this.expenses(), id) : 0;
  });

  private readonly balances = computed(() => computeBalances(this.expenses()));

  /** Group members always; former members only while they still have a balance to settle. */
  protected readonly balanceRows = computed<BalanceRow[]>(() => {
    const balances = this.balances();
    return this.members()
      .map(member => ({ member, balance: balances[member.id] ?? 0 }))
      .filter(r => !r.member.former || Math.abs(r.balance) >= 0.005)
      .sort((a, b) => b.balance - a.balance);
  });

  protected readonly transfers = computed(() => simplifyDebts(this.balances()));
  protected readonly dayGroups = computed(() => groupExpensesByDate(this.expenses()));
  protected readonly showSplitSections = computed(() => this.members().filter(m => !m.former).length > 1 || this.expenses().length > 0);

  protected member(id: string): ExpenseMember {
    return this.members().find(m => m.id === id) ?? FALLBACK_MEMBER;
  }

  protected memberLabel(id: string): string {
    const m = this.member(id);
    return id === this.currentUserId() ? `${m.name} (tu)` : m.name;
  }

  protected category(e: TripExpense) {
    return getCategoryInfo(e.category);
  }

  protected isSettlement(e: TripExpense): boolean {
    return isSettlement(e);
  }

  protected impact(e: TripExpense) {
    const id = this.currentUserId();
    return id ? expenseImpact(e, id) : { kind: 'none' as const, amount: 0 };
  }

  protected payerText(e: TripExpense): string {
    return e.paidBy === this.currentUserId() ? 'Hai pagato' : `${this.member(e.paidBy).name} ha pagato`;
  }

  protected settlementText(e: TripExpense): string {
    const to = e.splitAmong[0];
    const from = e.paidBy === this.currentUserId() ? 'Hai pagato' : `${this.member(e.paidBy).name} ha pagato`;
    return `${from} ${to === this.currentUserId() ? 'a te' : 'a ' + this.member(to).name}`;
  }

  protected dayLabel(date: string): string {
    return new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  protected confirmDelete(e: TripExpense): void {
    if (confirm(`Vuoi rimuovere "${e.title}"?`)) this.deleteExpense.emit(e.id);
  }
}
