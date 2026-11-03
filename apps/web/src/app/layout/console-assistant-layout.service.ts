import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type {
  AssistantConversation,
  AssistantPanelMessage,
  AssistantPanelMode,
} from '../features/get-started/home-assistant.panel';
import type { AssistantComposerPlusItem } from '../features/get-started/assistant-composer';
import { ConsoleDictationSession } from '../features/get-started/console-dictation';

/**
 * Global console assistant host (Sidekick-style): floating composer + dock/full
 * panel live in the shell so they persist across every `/app/*` view.
 */
@Injectable({ providedIn: 'root' })
export class ConsoleAssistantLayoutService {
  private readonly router = inject(Router);
  private readonly dictation = new ConsoleDictationSession();
  private replyTimer: ReturnType<typeof setTimeout> | null = null;
  private messageSeq = 0;
  private openHistoryRequest: (() => void) | null = null;

  readonly open = signal(false);
  readonly mode = signal<AssistantPanelMode>('dock');
  readonly title = signal('Trabaja con tu asistente');
  readonly messages = signal<AssistantPanelMessage[]>([]);
  readonly drafting = signal(false);
  readonly prompt = signal('');
  readonly composerActive = signal(false);
  readonly plusOpen = signal(false);
  readonly generateApps = signal(false);

  readonly dictating = this.dictation.active;
  readonly dictationSupported = this.dictation.supported;
  readonly dictationError = this.dictation.error;

  /** True while the assistant sidebar sheet is open beside the main frame. */
  readonly dockOpen = computed(() => this.open() && this.mode() === 'dock');
  readonly fullOpen = computed(() => this.open() && this.mode() === 'full');

  readonly plusItems: AssistantComposerPlusItem[] = [
    { id: 'files', label: 'Archivos', icon: 'fileText', disabled: true },
    { id: 'upload', label: 'Subir desde el dispositivo', icon: 'upload', disabled: true },
    { id: 'destination', label: 'Destino', icon: 'target' },
    { id: 'mention', label: 'Mención', icon: 'users', hint: '@', submenu: true },
    { id: 'skills', label: 'Skills', icon: 'sparkles', hint: '/', submenu: true },
    { id: 'generate-apps', label: 'Generar apps', icon: 'layers', kind: 'toggle' },
    { id: 'apps', label: 'Apps', icon: 'layers', trailingIcon: 'store', submenu: true, disabled: true },
    { id: 'voice', label: 'Llamada de voz', icon: 'radio', disabled: true, dividerBefore: true },
  ];

  /** @deprecated Prefer `dockOpen` — kept for existing call sites during migration. */
  setDockOpen(open: boolean): void {
    if (!open && this.dockOpen()) this.close();
    else if (open && !this.open()) {
      this.mode.set('dock');
      this.open.set(true);
    }
  }

  registerHistoryOpener(opener: (() => void) | null): void {
    this.openHistoryRequest = opener;
  }

  openPanel(mode: AssistantPanelMode = 'dock'): void {
    this.mode.set(mode);
    this.open.set(true);
  }

  toggleDock(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.openPanel('dock');
  }

  close(): void {
    this.clearReplyTimer();
    this.open.set(false);
    this.drafting.set(false);
    this.plusOpen.set(false);
    this.mode.set('dock');
  }

  setMode(mode: AssistantPanelMode): void {
    this.mode.set(mode);
  }

  resetChat(): void {
    this.clearReplyTimer();
    this.messages.set([]);
    this.drafting.set(false);
    this.title.set('Trabaja con tu asistente');
  }

  restoreConversation(conversation: AssistantConversation): void {
    this.clearReplyTimer();
    this.drafting.set(false);
    this.title.set(conversation.title || 'Trabaja con tu asistente');
    this.messages.set(conversation.messages.map((m) => ({ ...m })));
  }

  openWith(text: string, mode: AssistantPanelMode = 'dock'): void {
    const next = text.trim();
    if (!next) return;
    this.open.set(true);
    this.mode.set(mode);
    this.title.set(next.slice(0, 72));
    this.messages.set([]);
    this.prompt.set('');
    this.plusOpen.set(false);
    this.appendUserAndReply(next);
  }

  openRecentConversations(): void {
    this.plusOpen.set(false);
    this.openPanel('full');
    queueMicrotask(() => this.openHistoryRequest?.());
  }

  onComposerSubmitted(text: string): void {
    const next = text.trim();
    if (!next) return;
    this.prompt.set('');
    this.plusOpen.set(false);
    if (!this.open()) {
      this.openWith(next, 'dock');
      return;
    }
    this.appendUserAndReply(next);
  }

  onPanelSent(text: string): void {
    this.appendUserAndReply(text);
  }

  onPlus(id: string): void {
    this.plusOpen.set(false);
    switch (id) {
      case 'destination':
        void this.router.navigate(['/app/get-started']);
        break;
      case 'mention':
        this.prompt.update((value) => (value.includes('@') ? value : `${value}@`.trimStart()));
        this.composerActive.set(true);
        break;
      case 'skills':
        this.prompt.update((value) => (value.includes('/') ? value : `${value}/`.trimStart()));
        this.composerActive.set(true);
        break;
      case 'store':
      case 'apps':
        void this.router.navigate(['/app/store']);
        break;
      case 'channels':
        void this.router.navigate(['/app/channels']);
        break;
      default:
        break;
    }
  }

  togglePlus(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.composerActive.set(true);
    this.plusOpen.update((open) => !open);
  }

  toggleGenerateApps(): void {
    this.generateApps.update((value) => !value);
  }

  startDictation(): void {
    if (this.dictating() || this.drafting()) return;
    this.plusOpen.set(false);
    this.composerActive.set(true);
    this.dictation.start({
      getText: () => this.prompt(),
      setText: (value) => this.prompt.set(value),
    });
  }

  cancelDictation(): void {
    this.dictation.cancel();
  }

  confirmDictation(): void {
    this.dictation.confirm();
  }

  destroy(): void {
    this.clearReplyTimer();
    this.dictation.destroy();
  }

  private appendUserAndReply(text: string): void {
    const user: AssistantPanelMessage = {
      id: `u-${++this.messageSeq}`,
      role: 'user',
      text,
    };
    this.messages.update((messages) => [...messages, user]);
    this.drafting.set(true);
    this.clearReplyTimer();
    this.replyTimer = setTimeout(() => {
      this.drafting.set(false);
      this.messages.update((messages) => [...messages, this.buildReply(text)]);
      this.replyTimer = null;
    }, 700);
  }

  private buildReply(text: string): AssistantPanelMessage {
    const route = routeForPrompt(text);
    return {
      id: `a-${++this.messageSeq}`,
      role: 'assistant',
      status: 'Se consultó tu guía de la consola',
      text: 'Puedo llevarte al módulo correcto para seguir configurando o gestionando tu negocio.',
      actions: [
        {
          id: 'go',
          label: route.label,
          link: route.link,
          queryParams: route.queryParams,
        },
      ],
    };
  }

  private clearReplyTimer(): void {
    if (this.replyTimer) {
      clearTimeout(this.replyTimer);
      this.replyTimer = null;
    }
  }
}

function routeForPrompt(text: string): {
  label: string;
  link: string;
  queryParams?: Record<string, string>;
} {
  const lower = text.toLocaleLowerCase('es');
  if (/empezar|primeros pasos|configurar (mi |tu )?negocio|ayúdame a empezar/.test(lower)) {
    return { label: 'Ir a Inicio', link: '/app/get-started' };
  }
  if (/producto|catálogo|catalogo|precio|foto|descripci/.test(lower)) {
    return { label: 'Abrir productos', link: '/app/products' };
  }
  if (/tema|diseño|diseno|tienda web|personaliz|editor/.test(lower)) {
    return { label: 'Abrir tienda web', link: '/app/store' };
  }
  if (/pago|mercadopago|yape|tarjeta|billetera/.test(lower)) {
    return { label: 'Abrir pagos', link: '/app/payments' };
  }
  if (/dominio|url|dominio personalizado/.test(lower)) {
    return { label: 'Abrir dominio', link: '/app/domain' };
  }
  if (/env[ií]o|tarifa|olva|shalom|pickup|recojo/.test(lower)) {
    return { label: 'Abrir envíos', link: '/app/shipping' };
  }
  if (/whatsapp|canal|instagram|conectar/.test(lower)) {
    return { label: 'Abrir canales', link: '/app/channels' };
  }
  if (/pedido|cobro/.test(lower)) {
    return { label: 'Abrir pedidos', link: '/app/orders' };
  }
  if (/mensaje|conversaci|chat|cliente/.test(lower)) {
    return { label: 'Abrir mensajes', link: '/app/messages' };
  }
  if (/probar|playground|atiende|responde/.test(lower)) {
    return { label: 'Probar vendedor', link: '/app/seller/profile', queryParams: { playground: '1' } };
  }
  if (/vendedor|personalidad|faq|límite|limite/.test(lower)) {
    return { label: 'Abrir vendedor IA', link: '/app/seller' };
  }
  if (/plan|suscrip|factur/.test(lower)) {
    return { label: 'Abrir planes', link: '/app/plans' };
  }
  if (/ajuste|cuenta|equipo|permiso/.test(lower)) {
    return { label: 'Abrir ajustes', link: '/app/settings' };
  }
  return { label: 'Ir a Inicio', link: '/app/get-started' };
}
