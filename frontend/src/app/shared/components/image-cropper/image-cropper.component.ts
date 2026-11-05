import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';

/** Lato del riquadro di ritaglio a schermo (px). */
const STAGE = 260;
/** Lato dell'immagine esportata (px): abbastanza per uno schermo retina, leggera da salvare. */
const OUTPUT = 320;
const MAX_ZOOM = 4;

/**
 * Ritaglio quadrato (mostrato come cerchio) di un'immagine: trascina per spostare,
 * rotellina o slider per lo zoom. Emette un data URL JPEG OUTPUT×OUTPUT.
 */
@Component({
  selector: 'app-image-cropper',
  templateUrl: './image-cropper.component.html',
  styleUrl: './image-cropper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCropperComponent {
  /** Immagine scelta dall'utente. */
  readonly file = input.required<File>();
  readonly cropped = output<string>();
  readonly cancelled = output<void>();

  protected readonly stageSize = STAGE;
  protected readonly maxZoom = MAX_ZOOM;

  protected readonly src = signal<string | null>(null);
  protected readonly loadError = signal(false);
  protected readonly zoom = signal(1);
  private readonly offset = signal({ x: 0, y: 0 });
  private readonly natural = signal({ w: 0, h: 0 });

  private readonly imgEl = viewChild<ElementRef<HTMLImageElement>>('img');
  private drag: { pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null = null;

  /** Scala che fa coprire all'immagine tutto il riquadro (zoom 1). */
  private readonly baseScale = computed(() => {
    const { w, h } = this.natural();
    return w && h ? Math.max(STAGE / w, STAGE / h) : 1;
  });

  protected readonly imageStyle = computed(() => {
    const { w, h } = this.natural();
    const scale = this.baseScale() * this.zoom();
    const { x, y } = this.offset();
    return {
      width: `${w * scale}px`,
      height: `${h * scale}px`,
      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
    };
  });

  constructor() {
    effect(onCleanup => {
      const url = URL.createObjectURL(this.file());
      this.src.set(url);
      this.loadError.set(false);
      this.zoom.set(1);
      this.offset.set({ x: 0, y: 0 });
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  protected onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.natural.set({ w: img.naturalWidth, h: img.naturalHeight });
  }

  protected setZoom(value: number): void {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(1, value)));
    this.offset.set(this.clamp(this.offset()));
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setZoom(this.zoom() * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  protected onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: this.offset() };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    this.offset.set(this.clamp({
      x: this.drag.origin.x + event.clientX - this.drag.startX,
      y: this.drag.origin.y + event.clientY - this.drag.startY
    }));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
  }

  /** Frecce della tastiera per spostare l'immagine (accessibilità). */
  protected onKeydown(event: KeyboardEvent): void {
    const step = 10;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step }
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const { x, y } = this.offset();
    this.offset.set(this.clamp({ x: x + move.x, y: y + move.y }));
  }

  protected confirm(): void {
    const img = this.imgEl()?.nativeElement;
    const { w, h } = this.natural();
    if (!img || !w || !h) return;

    const scale = this.baseScale() * this.zoom();
    const { x, y } = this.offset();
    // Angolo in alto a sinistra dell'immagine nelle coordinate del riquadro.
    const left = STAGE / 2 - (w * scale) / 2 + x;
    const top = STAGE / 2 - (h * scale) / 2 + y;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -left / scale, -top / scale, STAGE / scale, STAGE / scale, 0, 0, OUTPUT, OUTPUT);
    this.cropped.emit(canvas.toDataURL('image/jpeg', 0.85));
  }

  /** Impedisce di trascinare l'immagine fino a lasciare scoperto il riquadro. */
  private clamp(pos: { x: number; y: number }): { x: number; y: number } {
    const { w, h } = this.natural();
    const scale = this.baseScale() * this.zoom();
    const maxX = Math.max(0, (w * scale - STAGE) / 2);
    const maxY = Math.max(0, (h * scale - STAGE) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, pos.x)), y: Math.min(maxY, Math.max(-maxY, pos.y)) };
  }
}
