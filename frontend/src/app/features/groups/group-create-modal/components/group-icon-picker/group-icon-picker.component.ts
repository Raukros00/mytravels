import { ChangeDetectionStrategy, Component, computed, ElementRef, model, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ImageCropperComponent } from '../../../../../shared/components/image-cropper/image-cropper.component';

const isImageIcon = (icon: string): boolean =>
  icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');

@Component({
  selector: 'app-group-icon-picker',
  standalone: true,
  imports: [TranslatePipe, ImageCropperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'showThumbMenu.set(false)' },
  templateUrl: './group-icon-picker.component.html',
  styleUrl: './group-icon-picker.component.css'
})
export class GroupIconPickerComponent {
  /** Current icon: an emoji, an image data URL, or '' when none. */
  readonly icon = model('');

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** La foto è la copertina del dettaglio gruppo: ritaglio orizzontale 2:1, 1000×500. */
  protected readonly coverAspect = 2;
  protected readonly coverWidth = 1000;
  /** Sotto il limite del backend per l'icona (400.000 caratteri di data URL). */
  protected readonly coverMaxLength = 380_000;

  readonly emojiPresets =['✈️', '🍕', '🍜', '🍷', '🏖️', '🎒', '🏰', '🍣', '🍦', '☕', '🏕️', '🌮', '🍸', '🏔️', '🚂', '🥐'];

  readonly showEmojiPicker = signal(false);
  /** Immagine scelta, in fase di ritaglio da parte dell'utente. */
  readonly cropFile = signal<File | null>(null);
  readonly imageError = signal<string | null>(null);
  readonly showThumbMenu = signal(false);

  readonly imagePreview = computed(() => (isImageIcon(this.icon()) ? this.icon() : null));
  readonly emoji = computed(() => !!this.icon() && !isImageIcon(this.icon()));

  /** Closes the menus (used by the parent when the modal opens/closes). */
  reset(): void {
    this.showEmojiPicker.set(false);
    this.showThumbMenu.set(false);
    this.cropFile.set(null);
    this.imageError.set(null);
  }

  toggleThumbMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showThumbMenu.update(v => !v);
  }

  onPickGallery(): void {
    this.showEmojiPicker.set(false);
    this.showThumbMenu.set(false);
    this.fileInput()?.nativeElement.click();
  }

  onPickEmoji(): void {
    this.showThumbMenu.set(false);
    this.showEmojiPicker.update(v => !v);
  }

  selectEmoji(emoji: string): void {
    this.icon.set(emoji);
    this.showEmojiPicker.set(false);
  }

  clearIcon(): void {
    this.icon.set('');
    this.showEmojiPicker.set(false);
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  /** Apre l'editor di ritaglio sull'immagine scelta. */
  onImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permette di riscegliere lo stesso file
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError.set('Formato non supportato: usa un\'immagine JPG, PNG o WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.imageError.set('L\'immagine è troppo grande (massimo 10 MB).');
      return;
    }
    this.imageError.set(null);
    this.cropFile.set(file);
  }

  onCropped(dataUrl: string): void {
    this.icon.set(dataUrl);
    this.cropFile.set(null);
  }
}
