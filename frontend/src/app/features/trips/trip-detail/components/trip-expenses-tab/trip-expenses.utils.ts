import { BudgetCategory, TripExpense } from '../../../../../core/models/trip.model';

/** Member as seen by the expenses UI: `former` = no longer in the group but still referenced by expenses. */
export interface ExpenseMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
  former?: boolean;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface CategoryInfo {
  key: BudgetCategory;
  label: string;
  icon: string;
  color: string;
}

export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  { key: 'transport', label: 'Spostamenti', icon: 'directions_transit', color: '#AB2F0A' },
  { key: 'accommodation', label: 'Alloggi', icon: 'hotel', color: '#2D6A4F' },
  { key: 'food', label: 'Cibo', icon: 'restaurant', color: '#D97706' },
  { key: 'activities', label: 'Attrazioni', icon: 'attractions', color: '#5A4A3B' },
  { key: 'other', label: 'Altro', icon: 'category', color: '#8B7E74' }
];

export function getCategoryInfo(key: BudgetCategory): CategoryInfo {
  return EXPENSE_CATEGORIES.find(c => c.key === key) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

export const FORMER_MEMBER_NAME = 'Ex membro';

export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function isSettlement(e: TripExpense): boolean {
  return e.type === 'settlement';
}

/** Equal split in cents: the remainder cents go one each to the first participants, so shares sum exactly. */
export function splitEqually(amount: number, memberIds: string[]): Record<string, number> {
  const shares: Record<string, number> = {};
  const n = memberIds.length;
  if (n === 0) return shares;
  const total = toCents(amount);
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  memberIds.forEach((id, i) => {
    shares[id] = fromCents(base + (i < remainder ? 1 : 0));
  });
  return shares;
}

export function sumShares(shares: Record<string, number>): number {
  return fromCents(Object.values(shares).reduce((acc, v) => acc + toCents(v), 0));
}

/** True when the shares add up to the amount, to the cent. */
export function sharesMatchAmount(amount: number, shares: Record<string, number>): boolean {
  return Object.values(shares).reduce((acc, v) => acc + toCents(v), 0) === toCents(amount);
}

/** Net balance per member (cents-exact): positive = is owed money, negative = owes money. */
export function computeBalances(expenses: TripExpense[]): Record<string, number> {
  const cents: Record<string, number> = {};
  for (const e of expenses) {
    cents[e.paidBy] = (cents[e.paidBy] ?? 0) + toCents(e.amount);
    for (const [id, share] of Object.entries(e.shares)) {
      cents[id] = (cents[id] ?? 0) - toCents(share);
    }
  }
  const result: Record<string, number> = {};
  for (const [id, c] of Object.entries(cents)) result[id] = fromCents(c);
  return result;
}

/** Greedy debt simplification: repeatedly settles the biggest debtor with the biggest creditor. */
export function simplifyDebts(balances: Record<string, number>): Transfer[] {
  const creditors: { id: string; c: number }[] = [];
  const debtors: { id: string; c: number }[] = [];
  for (const [id, b] of Object.entries(balances)) {
    const c = toCents(b);
    if (c > 0) creditors.push({ id, c });
    else if (c < 0) debtors.push({ id, c: -c });
  }
  const byAmount = (a: { id: string; c: number }, b: { id: string; c: number }) => b.c - a.c || a.id.localeCompare(b.id);
  const transfers: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const cr = creditors[0];
    const db = debtors[0];
    const pay = Math.min(cr.c, db.c);
    transfers.push({ from: db.id, to: cr.id, amount: fromCents(pay) });
    cr.c -= pay;
    db.c -= pay;
    if (cr.c === 0) creditors.shift();
    if (db.c === 0) debtors.shift();
  }
  return transfers;
}

export interface CategoryTotal {
  key: BudgetCategory;
  amount: number;
}

/** Real spending per category (settlements excluded). */
export function totalsByCategory(expenses: TripExpense[]): CategoryTotal[] {
  const cents = new Map<BudgetCategory, number>();
  for (const e of expenses) {
    if (isSettlement(e)) continue;
    cents.set(e.category, (cents.get(e.category) ?? 0) + toCents(e.amount));
  }
  return EXPENSE_CATEGORIES.map(c => ({ key: c.key, amount: fromCents(cents.get(c.key) ?? 0) }));
}

export function totalSpent(expenses: TripExpense[]): number {
  return fromCents(expenses.filter(e => !isSettlement(e)).reduce((acc, e) => acc + toCents(e.amount), 0));
}

export function totalPaidBy(expenses: TripExpense[], memberId: string): number {
  return fromCents(expenses.filter(e => !isSettlement(e) && e.paidBy === memberId).reduce((acc, e) => acc + toCents(e.amount), 0));
}

export function shareOf(expenses: TripExpense[], memberId: string): number {
  return fromCents(expenses.filter(e => !isSettlement(e)).reduce((acc, e) => acc + toCents(e.shares[memberId] ?? 0), 0));
}

export interface ExpenseImpact {
  kind: 'owe' | 'receive' | 'self' | 'none';
  amount: number;
}

/** What a single expense means for a member: how much they owe or are owed because of it. */
export function expenseImpact(e: TripExpense, memberId: string): ExpenseImpact {
  const paid = e.paidBy === memberId ? toCents(e.amount) : 0;
  const involved = e.paidBy === memberId || memberId in e.shares;
  const net = paid - toCents(e.shares[memberId] ?? 0);
  if (!involved) return { kind: 'none', amount: 0 };
  if (net > 0) return { kind: 'receive', amount: fromCents(net) };
  if (net < 0) return { kind: 'owe', amount: fromCents(-net) };
  return { kind: 'self', amount: 0 };
}

export interface ExpenseDayGroup {
  date: string;
  expenses: TripExpense[];
}

/** Groups by date, newest first; within a day the most recently added come first. */
export function groupExpensesByDate(expenses: TripExpense[]): ExpenseDayGroup[] {
  const groups = new Map<string, TripExpense[]>();
  [...expenses].reverse().forEach(e => {
    const list = groups.get(e.date) ?? [];
    list.push(e);
    groups.set(e.date, list);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, expenses: list }));
}

/** Group members plus, as "former" members, anyone still referenced by expenses but no longer in the group. */
export function buildExpenseMembers(
  groupMembers: { id: string; name: string; avatar: string; color: string }[],
  expenses: TripExpense[]
): ExpenseMember[] {
  const members: ExpenseMember[] = groupMembers.map(m => ({ id: m.id, name: m.name, avatar: m.avatar, color: m.color }));
  const known = new Set(members.map(m => m.id));
  const refs = new Set<string>();
  for (const e of expenses) {
    refs.add(e.paidBy);
    e.splitAmong.forEach(id => refs.add(id));
    Object.keys(e.shares).forEach(id => refs.add(id));
  }
  for (const id of refs) {
    if (!known.has(id)) {
      members.push({ id, name: FORMER_MEMBER_NAME, avatar: '👤', color: '#9CA3AF', former: true });
    }
  }
  return members;
}
