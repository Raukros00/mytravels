import { ChangeDetectionStrategy, Component, computed, ElementRef, model, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

const isImageIcon = (icon: string): boolean =>
  icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');

@Component({
  selector: 'app-group-icon-picker',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'showThumbMenu.set(false)' },
  templateUrl: './group-icon-picker.component.html',
  styleUrl: './group-icon-picker.component.css'
})
export class GroupIconPickerComponent {
  /** Current icon: an emoji, an image data URL, or '' when none. */
  readonly icon = model('');

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly emojiPresets = ['✈️', '🍕', '🍜', '🍷', '🏖️', '🎒', '🏰', '🍣', '🍦', '☕', '🏕️', '🌮', '🍸', '🏔️', '🚂', '🥐'];

  readonly showEmojiPicker = signal(false);
  readonly showThumbMenu = signal(false);

  readonly imagePreview = computed(() => (isImageIcon(this.icon()) ? this.icon() : null));
  readonly emoji = computed(() => !!this.icon() && !isImageIcon(this.icon()));

  /** Closes the menus (used by the parent when the modal opens/closes). */
  reset(): void {
    this.showEmojiPicker.set(false);
    this.showThumbMenu.set(false);
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

  onImageChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = new Image();
      raw.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 240;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const aspect = raw.width / raw.height;
        let sx = 0, sy = 0, sw = raw.width, sh = raw.height;
        if (aspect > 1) { sx = (raw.width - raw.height) / 2; sw = raw.height; }
        else { sy = (raw.height - raw.width) / 2; sh = raw.width; }
        ctx.drawImage(raw, sx, sy, sw, sh, 0, 0, size, size);
        this.icon.set(canvas.toDataURL('image/jpeg', 0.82));
      };
      raw.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
}
