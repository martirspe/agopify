import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DsIconComponent, type DsIconName } from '@agopify/ui';

export type AssistantComposerVariant = 'compact' | 'box';

export type AssistantComposerPlusItem = {
  id: string;
  label: string;
  icon: DsIconName;
  kind?: 'action' | 'toggle';
  hint?: string;
  submenu?: boolean;
  trailingIcon?: DsIconName;
  disabled?: boolean;
  dividerBefore?: boolean;
};

@Component({
  selector: 'app-assistant-composer',
  standalone: true,
  imports: [FormsModule, DsIconComponent],
  templateUrl: './assistant-composer.html',
  styleUrl: './assistant-composer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ac-host',
    '[attr.data-variant]': 'variant()',
    '[class.is-docked]': 'docked()',
  },
})
export class AssistantComposer {
  readonly variant = input<AssistantComposerVariant>('box');
  readonly value = model('');
  readonly placeholder = input('Trabaja con tu asistente');
  readonly ariaLabel = input('Asistente');
  readonly inputId = input('assistant-composer-input');
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly dictating = input(false);
  readonly dictationSupported = input(true);
  readonly dictationError = input<string | null>(null);
  readonly plusOpen = input(false);
  readonly plusItems = input<AssistantComposerPlusItem[]>([]);
  readonly generateApps = input(false);
  readonly showRecents = input(false);
  readonly plusMenuUp = input(false);
  readonly maxlength = input<number | null>(null);
  readonly active = input(false);
  /** Compact float fades when the dock panel is open. */
  readonly docked = input(false);
  /** Compact-only: show the dock open/close control after mic/send. */
  readonly showDockToggle = input(false);
  readonly dockOpen = input(false);

  readonly submitted = output<string>();
  readonly dockToggle = output<void>();
  readonly plusToggle = output<Event>();
  readonly plusAction = output<string>();
  readonly generateAppsToggle = output<void>();
  readonly dictationStart = output<void>();
  readonly dictationCancel = output<void>();
  readonly dictationConfirm = output<void>();
  readonly recentsClick = output<void>();
  readonly focused = output<void>();
  readonly blurred = output<void>();
  readonly activated = output<void>();
  readonly enter = output<KeyboardEvent>();

  private readonly inputRef = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');

  readonly canSend = computed(
    () => this.value().trim().length > 0 && !this.busy() && !this.dictating() && !this.disabled(),
  );

  focus(): void {
    queueMicrotask(() => this.inputRef()?.nativeElement.focus());
  }

  onSubmit(event?: Event): void {
    event?.preventDefault();
    const text = this.value().trim();
    if (!text || this.busy() || this.disabled() || this.dictating()) return;
    this.submitted.emit(text);
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    this.enter.emit(keyboard);
    this.onSubmit();
  }

  onPlus(item: AssistantComposerPlusItem): void {
    if (item.disabled) return;
    if (item.id === 'mention') {
      this.value.update((v) => (v.includes('@') ? v : `${v}@`.trimStart()));
      return;
    }
    if (item.id === 'skills') {
      this.value.update((v) => (v.includes('/') ? v : `${v}/`.trimStart()));
      return;
    }
    this.plusAction.emit(item.id);
  }
}
