import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSignal = signal<Toast[]>([]);
  public readonly toasts = this.toastsSignal.asReadonly();

  public show(message: string, type: ToastType = 'info', duration: number = 4000): void {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };

    this.toastsSignal.update(current => [...current, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  public success(message: string, duration: number = 3500): void {
    this.show(message, 'success', duration);
  }

  public error(message: string, duration: number = 4500): void {
    this.show(message, 'error', duration);
  }

  public info(message: string, duration: number = 3500): void {
    this.show(message, 'info', duration);
  }

  public warning(message: string, duration: number = 4000): void {
    this.show(message, 'warning', duration);
  }

  public remove(id: string): void {
    this.toastsSignal.update(current => current.filter(t => t.id !== id));
  }
}
