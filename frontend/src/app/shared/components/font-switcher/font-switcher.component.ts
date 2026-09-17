import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type FontTheme = 'modern' | 'serif' | 'expressive';

interface FontOption {
  key: FontTheme;
  label: string;
  heading: string;
  body: string;
}

@Component({
  selector: 'app-font-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './font-switcher.component.html',
  styleUrl: './font-switcher.component.css'
})
export class FontSwitcherComponent {
  readonly options: FontOption[] = [
    { key: 'modern',     label: 'Moderno',     heading: 'Outfit',           body: 'Plus Jakarta Sans' },
    { key: 'serif',      label: 'Editoriale',  heading: 'Playfair Display', body: 'Lora' },
    { key: 'expressive', label: 'Espressivo',  heading: 'Syne',             body: 'DM Sans' },
  ];

  isOpen = signal(false);
  active = signal<FontTheme>(this.loadSaved());

  private loadSaved(): FontTheme {
    const saved = localStorage.getItem('wb-font-theme') as FontTheme | null;
    if (saved) this.applyTheme(saved);
    return saved ?? 'modern';
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  select(key: FontTheme): void {
    this.active.set(key);
    this.applyTheme(key);
    localStorage.setItem('wb-font-theme', key);
  }

  private applyTheme(key: FontTheme): void {
    document.documentElement.setAttribute('data-font', key);
  }
}
