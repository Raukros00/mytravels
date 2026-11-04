import { TripExpense } from '../../../../../core/models/trip.model';
import {
  buildExpenseMembers, computeBalances, expenseImpact, groupExpensesByDate,
  sharesMatchAmount, simplifyDebts, splitEqually, sumShares, totalsByCategory
} from './trip-expenses.utils';

function exp(p: Partial<TripExpense> & Pick<TripExpense, 'amount' | 'paidBy' | 'splitAmong'>): TripExpense {
  return {
    id: 'e' + Math.random(), tripId: 't', title: 'x', category: 'food', date: '2026-09-18',
    shares: splitEqually(p.amount, p.splitAmong), ...p
  };
}

describe('trip-expenses.utils', () => {
  it('splits equally and distributes remainder cents so the sum is exact', () => {
    const shares = splitEqually(10, ['a', 'b', 'c']);
    expect(shares).toEqual({ a: 3.34, b: 3.33, c: 3.33 });
    expect(sumShares(shares)).toBe(10);
    expect(sharesMatchAmount(10, shares)).toBeTrue();
    expect(sharesMatchAmount(10, { a: 5, b: 4.99 })).toBeFalse();
  });

  it('computes balances that sum to zero', () => {
    const b = computeBalances([
      exp({ amount: 90, paidBy: 'a', splitAmong: ['a', 'b', 'c'] }),
      exp({ amount: 30, paidBy: 'b', splitAmong: ['a', 'b'] })
    ]);
    expect(b['a']).toBe(45);
    expect(b['b']).toBe(-15 + 0);
    expect(b['c']).toBe(-30);
    expect(Object.values(b).reduce((x, y) => x + y, 0)).toBeCloseTo(0, 10);
  });

  it('simplifies debts into a minimal set of payments', () => {
    const transfers = simplifyDebts({ a: 45, b: -15, c: -30 });
    expect(transfers).toEqual([
      { from: 'c', to: 'a', amount: 30 },
      { from: 'b', to: 'a', amount: 15 }
    ]);
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('a settlement brings balances back to zero', () => {
    const base = [exp({ amount: 20, paidBy: 'a', splitAmong: ['a', 'b'] })];
    const settle = exp({ amount: 10, paidBy: 'b', splitAmong: ['a'], type: 'settlement' });
    const b = computeBalances([...base, settle]);
    expect(b['a']).toBe(0);
    expect(b['b']).toBe(0);
  });

  it('totals by category ignore settlements', () => {
    const totals = totalsByCategory([
      exp({ amount: 20, paidBy: 'a', splitAmong: ['a'], category: 'transport' }),
      exp({ amount: 10, paidBy: 'b', splitAmong: ['a'], type: 'settlement', category: 'other' })
    ]);
    expect(totals.find(t => t.key === 'transport')?.amount).toBe(20);
    expect(totals.find(t => t.key === 'other')?.amount).toBe(0);
  });

  it('computes the impact of an expense on a member', () => {
    const e = exp({ amount: 30, paidBy: 'a', splitAmong: ['a', 'b', 'c'] });
    expect(expenseImpact(e, 'a')).toEqual({ kind: 'receive', amount: 20 });
    expect(expenseImpact(e, 'b')).toEqual({ kind: 'owe', amount: 10 });
    expect(expenseImpact(e, 'z')).toEqual({ kind: 'none', amount: 0 });
  });

  it('groups by date descending and flags former members', () => {
    const groups = groupExpensesByDate([
      exp({ amount: 1, paidBy: 'a', splitAmong: ['a'], date: '2026-09-18' }),
      exp({ amount: 1, paidBy: 'a', splitAmong: ['a'], date: '2026-09-20' })
    ]);
    expect(groups.map(g => g.date)).toEqual(['2026-09-20', '2026-09-18']);
    const members = buildExpenseMembers(
      [{ id: 'a', name: 'A', avatar: '🙂', color: '#000' }],
      [exp({ amount: 2, paidBy: 'x', splitAmong: ['a', 'x'] })]
    );
    expect(members.find(m => m.id === 'x')).toEqual(jasmine.objectContaining({ name: 'Ex membro', former: true }));
  });
});
