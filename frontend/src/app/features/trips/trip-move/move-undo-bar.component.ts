import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StopMoveService } from './stop-move.service';

/** "Colosseo spostato al giorno 3 · Annulla" (#112), per qualche secondo dopo uno spostamento. */
@Component({
  selector: 'app-move-undo-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mover.lastMove(); as last) {
      <div class="undo-bar" role="status" data-cy="move-undo">
        <span class="undo-text">{{ last.message }}</span>
        <button type="button" class="undo-btn" (click)="mover.undo()">Annulla</button>
        <button type="button" class="undo-close" aria-label="Chiudi" (click)="mover.dismiss()">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
    }
  `,
  styles: `
    .undo-bar {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
      z-index: 60;
      width: min(560px, calc(100vw - 2rem));
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.6rem 0.6rem 1rem;
      border-radius: var(--wb-radius-lg);
      background: var(--wb-text-primary);
      color: #fff;
      box-shadow: var(--wb-shadow-lg);
    }
    @media (min-width: 768px) {
      .undo-bar { bottom: 1.5rem; }
    }
    .undo-text { flex: 1; min-width: 0; font-size: 0.95rem; }
    .undo-btn {
      min-height: 40px;
      padding: 0 0.85rem;
      border: 0;
      border-radius: var(--wb-radius-full);
      background: transparent;
      color: #FDBA74;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .undo-close {
      width: 36px; height: 36px; border: 0; background: transparent; color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
  `
})
export class MoveUndoBarComponent {
  protected readonly mover = inject(StopMoveService);
}
