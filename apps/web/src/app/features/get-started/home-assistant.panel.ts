import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsIconComponent, type DsIconName } from '@vendedoria/ui';
import { ConsoleDictationSession } from './console-dictation';

export type AssistantPanelMode = 'full' | 'dock';

export type AssistantPanelAction = {
  id: string;
  label: string;
  link: string;
  queryParams?: Record<string, string>;
};

export type AssistantPanelMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  bullets?: string[];
  actions?: AssistantPanelAction[];
};

export type AssistantPanelPlusItem = {
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
  selector: 'app-home-assistant-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, DsIconComponent],
  templateUrl: './home-assistant.panel.html',
  styleUrl: './home-assistant.panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'assistant-panel-host',
    '[attr.data-mode]': 'mode()',
    role: 'dialog',
    '[attr.aria-modal]': 'mode() === "full" ? "true" : null',
    '[attr.aria-labelledby]': '"assistant-panel-title"',
  },
})
export class HomeAssistantPanel {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dictation = new ConsoleDictationSession();

  readonly mode = input.required<AssistantPanelMode>();
  readonly title = input('Empezar a configurar tu negocio');
  readonly messages = input.required<AssistantPanelMessage[]>();
  readonly drafting = input(false);

  readonly closed = output<void>();
  readonly modeChange = output<AssistantPanelMode>();
  readonly newChat = output<void>();
  readonly sent = output<string>();
  readonly plusAction = output<string>();

  readonly draft = signal('');
  readonly plusOpen = signal(false);
  readonly generateApps = signal(false);
  readonly copiedId = signal<string | null>(null);
  readonly dictating = this.dictation.active;
  readonly dictationSupported = this.dictation.supported;
  readonly dictationError = this.dictation.error;

  private readonly inputRef = viewChild<ElementRef<HTMLTextAreaElement>>('assistantPanelInput');

  readonly placeholder = 'Trabaja con tu asistente';

  /** Composer + menu items. */
  readonly plusItems: AssistantPanelPlusItem[] = [
    { id: 'files', label: 'Archivos', icon: 'fileText', disabled: true },
    { id: 'upload', label: 'Subir desde el dispositivo', icon: 'upload', disabled: true },
    { id: 'destination', label: 'Destino', icon: 'target' },
    { id: 'mention', label: 'Mención', icon: 'users', hint: '@', submenu: true },
    { id: 'skills', label: 'Skills', icon: 'sparkles', hint: '/', submenu: true },
    { id: 'generate-apps', label: 'Generar apps', icon: 'layers', kind: 'toggle' },
    { id: 'apps', label: 'Apps', icon: 'layers', trailingIcon: 'store', submenu: true, disabled: true },
    { id: 'voice', label: 'Llamada de voz', icon: 'radio', disabled: true, dividerBefore: true },
  ];

  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.drafting() && !this.dictating());

  constructor() {
    this.destroyRef.onDestroy(() => this.dictation.destroy());
  }

  focusInput(): void {
    queueMicrotask(() => this.inputRef()?.nativeElement.focus());
  }

  startDictation(): void {
    if (this.dictating() || this.drafting()) return;
    this.plusOpen.set(false);
    this.dictation.start({
      getText: () => this.draft(),
      setText: (value) => this.draft.set(value),
    });
  }

  cancelDictation(): void {
    this.dictation.cancel();
  }

  confirmDictation(): void {
    this.dictation.confirm();
    queueMicrotask(() => this.inputRef()?.nativeElement.focus());
  }

  togglePlus(): void {
    this.plusOpen.update((open) => !open);
  }

  closePlus(): void {
    this.plusOpen.set(false);
  }

  toggleGenerateApps(): void {
    this.generateApps.update((value) => !value);
  }

  onPlus(item: AssistantPanelPlusItem): void {
    if (item.disabled) return;
    this.plusOpen.set(false);
    if (item.id === 'mention') {
      this.draft.update((value) => (value.includes('@') ? value : `${value}@`.trimStart()));
      return;
    }
    if (item.id === 'skills') {
      this.draft.update((value) => (value.includes('/') ? value : `${value}/`.trimStart()));
      return;
    }
    this.plusAction.emit(item.id);
  }

  submit(event?: Event): void {
    event?.preventDefault();
    const text = this.draft().trim();
    if (!text || this.drafting()) return;
    this.draft.set('');
    this.plusOpen.set(false);
    this.sent.emit(text);
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    this.submit();
  }

  toggleMode(): void {
    this.modeChange.emit(this.mode() === 'full' ? 'dock' : 'full');
  }

  async copyMessage(message: AssistantPanelMessage): Promise<void> {
    const body = [message.text, ...(message.bullets ?? []).map((b) => `• ${b}`)].join('\n');
    try {
      await navigator.clipboard.writeText(body);
      this.copiedId.set(message.id);
      window.setTimeout(() => {
        if (this.copiedId() === message.id) this.copiedId.set(null);
      }, 1600);
    } catch {
      /* clipboard may be denied */
    }
  }
}
