import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type PaletteTheme = 'viola' | 'terra' | 'foresta' | 'oceano';

interface PaletteOption {
  key: PaletteTheme;
  label: string;
  primary: string;
  accent: string;
  description: string;
}

@Component({
  selector: 'app-palette-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './palette-switcher.component.html',
  styleUrl: './palette-switcher.component.css'
})
export class PaletteSwitcherComponent {
  readonly options: PaletteOption[] = [
    { key: 'viola',    label: 'Viola',       primary: '#7c3aed', accent: '#f97316', description: 'Viola + Arancio' },
    { key: 'terra',    label: 'Terra Rossa', primary: '#ea580c', accent: '#d97706', description: 'Terracotta + Oro' },
    { key: 'foresta',  label: 'Foresta',     primary: '#16a34a', accent: '#d97706', description: 'Verde + Ambra' },
    { key: 'oceano',   label: 'Oceano',      primary: '#0d9488', accent: '#e11d48', description: 'Teal + Corallo' },
  ];

  isOpen = signal(false);
  active = signal<PaletteTheme>(this.loadSaved());

  private loadSaved(): PaletteTheme {
    const saved = localStorage.getItem('wb-palette-theme') as PaletteTheme | null;
    if (saved) this.applyTheme(saved);
    return saved ?? 'viola';
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  select(key: PaletteTheme): void {
    this.active.set(key);
    this.applyTheme(key);
    localStorage.setItem('wb-palette-theme', key);
  }

  private applyTheme(key: PaletteTheme): void {
    document.documentElement.setAttribute('data-palette', key);
  }

  activeOption(): PaletteOption {
    return this.options.find(o => o.key === this.active())!;
  }
}
