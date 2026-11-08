import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';

/** Lato del riquadro di ritaglio quadrato a schermo (px). */
const SQUARE_STAGE = 260;
/** Larghezza del riquadro di ritaglio orizzontale a schermo (px): sta anche nelle modali su telefono. */
const WIDE_STAGE = 288;
const MAX_ZOOM = 4;
const START_QUALITY = 0.85;
const MIN_QUALITY = 0.55;

/**
 * Ritaglio di un'immagine: trascina per spostare, rotellina o slider per lo zoom.
 * Di default il ritaglio è quadrato (mostrato come cerchio, per la foto profilo) ed emette
 * un data URL JPEG 320×320; con `aspect` > 1 il riquadro è orizzontale (es. copertina del gruppo).
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
  /** Rapporto larghezza/altezza del ritaglio (1 = quadrato, 2 = 2:1 orizzontale). */
  readonly aspect = input(1);
  /** Larghezza dell'immagine esportata (px); l'altezza segue `aspect`. */
  readonly outputWidth = input(320);
  /** Forma della maschera: cerchio (foto profilo) o rettangolo arrotondato (copertina). */
  readonly shape = input<'circle' | 'rect'>('circle');
  /**
   * Lunghezza massima del data URL (caratteri). Se il JPEG supera il limite si riduce la qualità
   * e poi le dimensioni, così l'immagine rientra nei limiti del backend.
   */
  readonly maxLength = input<number | null>(null);

  readonly cropped = output<string>();
  readonly cancelled = output<void>();

  protected readonly maxZoom = MAX_ZOOM;

  /** Dimensioni del riquadro a schermo (px). */
  protected readonly stage = computed(() => {
    const aspect = this.aspect() > 0 ? this.aspect() : 1;
    const w = aspect === 1 ? SQUARE_STAGE : WIDE_STAGE;
    return { w, h: Math.round(w / aspect) };
  });

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
    const stage = this.stage();
    return w && h ? Math.max(stage.w / w, stage.h / h) : 1;
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

    const stage = this.stage();
    const scale = this.baseScale() * this.zoom();
    const { x, y } = this.offset();
    // Angolo in alto a sinistra dell'immagine nelle coordinate del riquadro.
    const left = stage.w / 2 - (w * scale) / 2 + x;
    const top = stage.h / 2 - (h * scale) / 2 + y;
    const source = { x: -left / scale, y: -top / scale, w: stage.w / scale, h: stage.h / scale };

    const limit = this.maxLength();
    let outW = this.outputWidth();
    let dataUrl = '';
    // Riduce qualità e poi dimensioni finché il JPEG non rientra nel limite (se c'è).
    for (let attempt = 0; attempt < 4; attempt++) {
      const outH = Math.round((outW * stage.h) / stage.w);
      for (let quality = START_QUALITY; quality >= MIN_QUALITY - 1e-9; quality -= 0.1) {
        dataUrl = this.render(img, source, outW, outH, quality);
        if (!dataUrl || !limit || dataUrl.length <= limit) break;
      }
      if (!dataUrl || !limit || dataUrl.length <= limit) break;
      outW = Math.round(outW * 0.8);
    }
    if (dataUrl) this.cropped.emit(dataUrl);
  }

  private render(
    img: HTMLImageElement, src: { x: number; y: number; w: number; h: number },
    outW: number, outH: number, quality: number
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, outW, outH);
    return canvas.toDataURL('image/jpeg', quality);
  }

  /** Impedisce di trascinare l'immagine fino a lasciare scoperto il riquadro. */
  private clamp(pos: { x: number; y: number }): { x: number; y: number } {
    const { w, h } = this.natural();
    const stage = this.stage();
    const scale = this.baseScale() * this.zoom();
    const maxX = Math.max(0, (w * scale - stage.w) / 2);
    const maxY = Math.max(0, (h * scale - stage.h) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, pos.x)), y: Math.min(maxY, Math.max(-maxY, pos.y)) };
  }
}
