import { Component, effect, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  host: { '(document:keydown.escape)': 'handleEscape()' },
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css'
})
export class ModalComponent {
  readonly isOpen = input(false);
  readonly title = input('');
  readonly icon = input('');
  readonly maxWidth = input('560px');
  readonly hasFooter = input(true);
  readonly allowOverflow = input(false);
  readonly close = output<void>();

  handleEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  constructor() {
    effect(() => this.toggleBodyScroll(this.isOpen()));
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  private toggleBodyScroll(lock: boolean): void {
    if (lock) {
      document.body.style.overflow = 'hidden';
      // Prevent iOS Safari bounce/rubber-band scrolling
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      // Restore scroll position
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
  }
}
