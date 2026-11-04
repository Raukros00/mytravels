import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { TripExpense } from '../../../../../core/models/trip.model';
import { EXPENSE_CATEGORIES, totalSpent, totalsByCategory } from '../trip-expenses-tab/trip-expenses.utils';

interface BudgetSlice {
  key: string;
  label: string;
  icon: string;
  color: string;
  percent: number;
  amount: number;
}

@Component({
  selector: 'app-trip-budget',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-budget.component.html',
  styleUrl: './trip-budget.component.css'
})
export class TripBudgetComponent {
  readonly expenses = input<TripExpense[]>([]);
  readonly budget = input(0);
  readonly currency = input('EUR');

  protected readonly spent = computed(() => totalSpent(this.expenses()));

  /** Only categories with real spending, with their share of the total spent. */
  protected readonly slices = computed<BudgetSlice[]>(() => {
    const spent = this.spent();
    if (spent <= 0) return [];
    const totals = totalsByCategory(this.expenses());
    return EXPENSE_CATEGORIES
      .map(c => ({ ...c, amount: totals.find(t => t.key === c.key)?.amount ?? 0 }))
      .filter(c => c.amount > 0)
      .map(c => ({ ...c, percent: (c.amount / spent) * 100 }));
  });

  /** Conic gradient painting the donut segments in order. */
  protected readonly donutGradient = computed(() => {
    const slices = this.slices();
    if (!slices.length) return 'conic-gradient(var(--wb-surface-2) 0 100%)';
    let acc = 0;
    const stops = slices.map(s => {
      const from = acc;
      acc += s.percent;
      return `${s.color} ${from}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });
}
