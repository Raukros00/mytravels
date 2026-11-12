import { MIN_COLOR_DISTANCE, USER_COLOR_PALETTE, colorDistance, distinctMemberColors } from './user-color.utils';

/** Contrasto WCAG tra un colore e il bianco. */
function contrastWithWhite(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (l + 0.05);
}

describe('user-color.utils (#122)', () => {
  it('la tavolozza è leggibile con il testo bianco e i colori sono distinti tra loro', () => {
    for (const c of USER_COLOR_PALETTE) {
      expect(contrastWithWhite(c)).withContext(c).toBeGreaterThanOrEqual(4.5);
    }
    for (let i = 0; i < USER_COLOR_PALETTE.length; i++) {
      for (let j = i + 1; j < USER_COLOR_PALETTE.length; j++) {
        expect(colorDistance(USER_COLOR_PALETTE[i], USER_COLOR_PALETTE[j]))
          .withContext(`${USER_COLOR_PALETTE[i]} / ${USER_COLOR_PALETTE[j]}`)
          .toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
      }
    }
  });

  it('mantiene i colori già distinti', () => {
    const colors = distinctMemberColors([
      { id: 'a', color: '#4f46e5' }, { id: 'b', color: '#c2410c' }, { id: 'c', color: '#047857' }
    ]);
    expect([...colors.values()]).toEqual(['#4f46e5', '#c2410c', '#047857']);
  });

  it('cambia solo in visualizzazione il colore di chi è uguale o troppo simile a un altro membro', () => {
    const colors = distinctMemberColors([
      { id: 'a', color: '#10b981' }, { id: 'b', color: '#10b981' }, { id: 'c', color: '#12b886' }, { id: 'd', color: '#be123c' }
    ]);
    expect(colors.get('a')).toBe('#10b981');
    expect(colors.get('d')).toBe('#be123c');
    const all = [...colors.values()];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(colorDistance(all[i], all[j])).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
      }
    }
  });

  it('assegna un colore anche a chi non ne ha uno valido', () => {
    const colors = distinctMemberColors([{ id: 'a', color: '' }, { id: 'b', color: null }]);
    expect(colors.get('a')).toMatch(/^#[0-9a-f]{6}$/);
    expect(colors.get('b')).not.toBe(colors.get('a'));
  });
});
