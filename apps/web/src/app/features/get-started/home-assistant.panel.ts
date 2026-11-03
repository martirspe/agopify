import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsIconComponent } from '@agopify/ui';
import { ConsoleAssistantApiService } from '../../core/api/console-assistant-api.service';
import { AssistantComposer, type AssistantComposerPlusItem } from './assistant-composer';
import type {
  AssistantConversation,
  AssistantConversationGroup,
  AssistantPanelMessage,
} from './assistant-types';
import { ConsoleDictationSession } from './console-dictation';

export type AssistantPanelMode = 'full' | 'dock';
export type AssistantPanelPlusItem = AssistantComposerPlusItem;
export type {
  AssistantConversation,
  AssistantConversationGroup,
  AssistantPanelAction,
  AssistantPanelMessage,
} from './assistant-types';

@Component({
  selector: 'app-home-assistant-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, DsIconComponent, AssistantComposer],
  templateUrl: './home-assistant.panel.html',
  styleUrl: './home-assistant.panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'assistant-panel-host',
    '[attr.data-mode]': 'mode()',
    '[attr.data-view]': 'view()',
    role: 'dialog',
    '[attr.aria-modal]': 'mode() === "full" ? "true" : null',
    '[attr.aria-labelledby]': '"assistant-panel-title"',
  },
})
export class HomeAssistantPanel {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly assistantStore = inject(ConsoleAssistantApiService);
  private readonly dictation = new ConsoleDictationSession();

  readonly mode = input.required<AssistantPanelMode>();
  /** Used as the seed title when persisting the active conversation. */
  readonly title = input('Empezar a configurar tu negocio');
  readonly messages = input.required<AssistantPanelMessage[]>();
  readonly drafting = input(false);

  readonly closed = output<void>();
  readonly modeChange = output<AssistantPanelMode>();
  readonly newChat = output<void>();
  readonly sent = output<string>();
  readonly plusAction = output<string>();
  readonly restoreConversation = output<AssistantConversation>();

  readonly view = signal<'chat' | 'history'>('chat');
  readonly draft = signal('');
  readonly plusOpen = signal(false);
  readonly memoryOpen = signal(false);
  readonly memoryEnabled = this.assistantStore.memoryEnabled;
  readonly generateApps = signal(false);
  readonly copiedId = signal<string | null>(null);
  readonly conversations = this.assistantStore.conversations;
  readonly activeConversationId = signal<string | null>(null);
  readonly menuConversationId = signal<string | null>(null);
  readonly renamingId = signal<string | null>(null);
  readonly renameDraft = signal('');
  readonly dictating = this.dictation.active;
  readonly dictationSupported = this.dictation.supported;
  readonly dictationError = this.dictation.error;

  private readonly composer = viewChild(AssistantComposer);
  private readonly renameInputRef = viewChild<ElementRef<HTMLInputElement>>('renameInput');

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

  readonly conversationGroups = computed(() => groupConversations(this.conversations()));

  constructor() {
    void this.assistantStore.ensureLoaded();

    effect(() => {
      const msgs = this.messages();
      if (!msgs.length || this.drafting()) return;
      this.persistActiveConversation(msgs);
    });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (this.memoryOpen()) {
        const memory = this.host.nativeElement.querySelector('.assistant-panel__header-actions');
        if (memory && !memory.contains(target)) this.memoryOpen.set(false);
      }
      if (this.menuConversationId()) {
        const menu = this.host.nativeElement.querySelector('.assistant-panel__history-menu-anchor.is-open');
        if (menu && !menu.contains(target)) this.menuConversationId.set(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (this.memoryOpen()) {
        this.memoryOpen.set(false);
        return;
      }
      if (this.renamingId()) {
        this.cancelRename();
        return;
      }
      if (this.menuConversationId()) {
        this.menuConversationId.set(null);
        return;
      }
      if (this.view() === 'history') this.closeHistory();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    this.destroyRef.onDestroy(() => {
      this.dictation.destroy();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    });
  }

  openHistory(): void {
    this.memoryOpen.set(false);
    this.plusOpen.set(false);
    this.menuConversationId.set(null);
    this.renamingId.set(null);
    void this.assistantStore.ensureLoaded();
    this.view.set('history');
  }

  closeHistory(): void {
    this.menuConversationId.set(null);
    this.renamingId.set(null);
    this.view.set('chat');
    queueMicrotask(() => this.focusInput());
  }

  onNewChat(): void {
    this.memoryOpen.set(false);
    this.plusOpen.set(false);
    this.menuConversationId.set(null);
    this.renamingId.set(null);
    this.activeConversationId.set(null);
    this.view.set('chat');
    this.newChat.emit();
    queueMicrotask(() => this.focusInput());
  }

  selectConversation(conversation: AssistantConversation): void {
    if (this.renamingId() === conversation.id) return;
    this.menuConversationId.set(null);
    this.renamingId.set(null);
    this.activeConversationId.set(conversation.id);
    this.view.set('chat');
    this.restoreConversation.emit(conversation);
    queueMicrotask(() => this.focusInput());
  }

  toggleConversationMenu(event: Event, conversationId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.renamingId.set(null);
    this.menuConversationId.update((id) => (id === conversationId ? null : conversationId));
  }

  startRename(conversation: AssistantConversation, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.menuConversationId.set(null);
    this.renamingId.set(conversation.id);
    this.renameDraft.set(conversation.title);
    queueMicrotask(() => {
      const el = this.renameInputRef()?.nativeElement;
      if (!el) return;
      el.focus();
      el.select();
    });
  }

  confirmRename(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const id = this.renamingId();
    if (!id) return;
    const title = this.renameDraft().trim().slice(0, 72) || 'Nueva conversación';
    void this.assistantStore.renameConversation(id, title);
    this.renamingId.set(null);
    this.renameDraft.set('');
  }

  cancelRename(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.renamingId.set(null);
    this.renameDraft.set('');
  }

  onRenameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmRename();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    }
  }

  deleteConversation(conversation: AssistantConversation, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.menuConversationId.set(null);
    void this.assistantStore.deleteConversation(conversation.id);
    if (this.activeConversationId() === conversation.id) {
      this.activeConversationId.set(null);
      this.newChat.emit();
    }
  }

  relativeTime(updatedAt: number): string {
    return formatRelativeShort(updatedAt);
  }

  toggleMemoryMenu(event?: Event): void {
    event?.stopPropagation();
    this.plusOpen.set(false);
    this.memoryOpen.update((open) => !open);
  }

  toggleMemory(): void {
    void this.assistantStore.setMemoryEnabled(!this.memoryEnabled());
  }

  focusInput(): void {
    this.composer()?.focus();
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
    this.composer()?.focus();
  }

  togglePlus(): void {
    this.memoryOpen.set(false);
    this.plusOpen.update((open) => !open);
  }

  closePlus(): void {
    this.plusOpen.set(false);
  }

  toggleGenerateApps(): void {
    this.generateApps.update((value) => !value);
  }

  onComposerPlus(id: string): void {
    this.plusOpen.set(false);
    this.plusAction.emit(id);
  }

  onComposerSubmitted(text: string): void {
    if (!text || this.drafting()) return;
    this.draft.set('');
    this.plusOpen.set(false);
    this.sent.emit(text);
  }

  toggleMode(): void {
    this.memoryOpen.set(false);
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

  private persistActiveConversation(messages: AssistantPanelMessage[]): void {
    const firstUser = messages.find((m) => m.role === 'user');
    const title = (firstUser?.text || this.title()).trim().slice(0, 72) || 'Nueva conversación';
    const id = this.activeConversationId() ?? `c-${Date.now()}`;
    if (!this.activeConversationId()) this.activeConversationId.set(id);

    const next: AssistantConversation = {
      id,
      title,
      updatedAt: Date.now(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        ...(m.status ? { status: m.status } : {}),
        ...(m.bullets?.length ? { bullets: [...m.bullets] } : {}),
        // Actions are UI affordances for the live thread; history keeps text only.
      })),
    };

    this.assistantStore.scheduleUpsert(next);
  }
}

function groupConversations(items: AssistantConversation[]): AssistantConversationGroup[] {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;
  const twoWeeksAgo = today - 14 * 86_400_000;

  const buckets: Record<string, AssistantConversation[]> = {
    today: [],
    yesterday: [],
    week: [],
    lastWeek: [],
    older: [],
  };

  for (const item of items) {
    const t = item.updatedAt || now;
    if (t >= today) buckets['today']!.push(item);
    else if (t >= yesterday) buckets['yesterday']!.push(item);
    else if (t >= weekAgo) buckets['week']!.push(item);
    else if (t >= twoWeeksAgo) buckets['lastWeek']!.push(item);
    else buckets['older']!.push(item);
  }

  const labels: Array<[keyof typeof buckets, string]> = [
    ['today', 'Hoy'],
    ['yesterday', 'Ayer'],
    ['week', 'Esta semana'],
    ['lastWeek', 'La semana pasada'],
    ['older', 'Anteriores'],
  ];

  return labels
    .map(([id, label]) => ({ id, label, items: buckets[id]! }))
    .filter((group) => group.items.length > 0);
}

function formatRelativeShort(updatedAt: number): string {
  const delta = Math.max(0, Date.now() - updatedAt);
  const min = Math.floor(delta / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.floor(days / 30);
  return `${months} mes${months === 1 ? '' : 'es'}`;
}
