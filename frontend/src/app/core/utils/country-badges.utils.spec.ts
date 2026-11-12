import { BadgeTrip, countryBadges, countryName, flagEmoji } from './country-badges.utils';

const trip = (id: string, countryCode: string | null, startDate: string, endDate: string, decision: 'confirmed' | 'proposal' = 'confirmed'): BadgeTrip =>
  ({ id, title: id, destination: id, startDate, endDate, decision, countryCode });

describe('country-badges.utils (#123)', () => {
  // 10 maggio 2026, ora locale.
  const now = new Date(2026, 4, 10, 12, 0);

  it('una voce per nazione: visitata se c\'è un viaggio concluso, con conteggio e anno della prima visita', () => {
    const badges = countryBadges([
      trip('siviglia', 'ES', '2023-04-10', '2023-04-12'),
      trip('madrid', 'es', '2025-02-01', '2025-02-03'),
      trip('barcellona', 'ES', '2026-09-01', '2026-09-04'),
      trip('kyoto', 'JP', '2027-05-01', '2027-05-08'),
    ], now);
    expect(badges.length).toBe(2);
    const es = badges[0];
    expect(es).toEqual(jasmine.objectContaining({ code: 'ES', state: 'visited', visitedCount: 2, firstYear: 2023, nextStart: '2026-09-01' }));
    expect(es.trips.map(t => t.id)).toEqual(['barcellona', 'madrid', 'siviglia']);
    expect(badges[1]).toEqual(jasmine.objectContaining({ code: 'JP', state: 'upcoming', visitedCount: 0, firstYear: null, nextStart: '2027-05-01' }));
  });

  it('concluso = data di fine prima di oggi: un viaggio che finisce oggi o è in corso è ancora "in arrivo"', () => {
    const badges = countryBadges([
      trip('ieri', 'FR', '2026-05-01', '2026-05-09'),
      trip('oggi', 'PT', '2026-05-08', '2026-05-10'),
    ], now);
    expect(badges.find(b => b.code === 'FR')?.state).toBe('visited');
    expect(badges.find(b => b.code === 'PT')?.state).toBe('upcoming');
  });

  it('ignora proposte e viaggi senza codice nazione', () => {
    const badges = countryBadges([
      trip('proposta', 'IS', '2024-01-01', '2024-01-05', 'proposal'),
      trip('senza', null, '2024-01-01', '2024-01-05'),
      trip('errato', 'XYZ', '2024-01-01', '2024-01-05'),
    ], now);
    expect(badges).toEqual([]);
  });

  it('bandiera e nome tradotto', () => {
    expect(flagEmoji('es')).toBe('🇪🇸');
    expect(flagEmoji('?')).toBe('🏳️');
    expect(countryName('ES', 'it')).toBe('Spagna');
    expect(countryName('ES', 'en')).toBe('Spain');
  });
});
