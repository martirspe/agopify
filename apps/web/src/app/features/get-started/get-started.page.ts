import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { interval } from 'rxjs';
import { DsButtonComponent } from '@agopify/ui';
import { DsIconComponent, type DsIconName } from '@agopify/ui';
import { AccountApiService } from '../../core/api/account-api.service';
import { AgentsApiService } from '../../core/api/agents-api.service';
import { CatalogApiService } from '../../core/api/catalog-api.service';
import { IntegrationsApiService } from '../../core/api/integrations-api.service';
import { MessagingApiService } from '../../core/api/messaging-api.service';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { PaymentsApiService } from '../../core/api/payments-api.service';
import { ShippingApiService } from '../../core/api/shipping-api.service';
import { StoreApiService } from '../../core/api/store-api.service';
import { environment } from '../../../environments/environment';
import { ConsoleAssistantLayoutService } from '../../layout/console-assistant-layout.service';
import { ConsoleDictationSession } from './console-dictation';
import { AssistantComposer } from './assistant-composer';
import type { AssistantPanelMessage } from './home-assistant.panel';

type ChecklistItemId =
  | 'product'
  | 'theme'
  | 'payments'
  | 'domain'
  | 'shipping'
  | 'seller'
  | 'channel'
  | 'chat'
  | 'order';

type ChecklistItem = {
  id: ChecklistItemId;
  title: string;
  body: string;
  done: boolean;
  cta: string;
  link: string;
  icon: DsIconName;
};

type AssistantSuggestion = {
  id: string;
  label: string;
  link: string;
  queryParams?: Record<string, string>;
  fillPrompt?: string;
};

type HomePlusItem = {
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

const PLACEHOLDERS = [
  'Trabaja con tu asistente',
  'Ayúdame a empezar',
  'Agregar mi primer producto',
  'Ayúdame a configurar mi vendedor',
  'Conectar WhatsApp de mi negocio',
  'Escribir una descripción de producto',
] as const;

@Component({
  selector: 'app-get-started-page',
  standalone: true,
  imports: [RouterLink, FormsModule, DsButtonComponent, DsIconComponent, AssistantComposer],
  templateUrl: './get-started.page.html',
  styleUrls: ['./home-assistant.composer.scss', './get-started.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetStartedPage implements OnInit {
  private readonly agents = inject(AgentsApiService);
  private readonly catalog = inject(CatalogApiService);
  private readonly messaging = inject(MessagingApiService);
  private readonly orders = inject(OrdersApiService);
  private readonly account = inject(AccountApiService);
  private readonly storeApi = inject(StoreApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly shippingApi = inject(ShippingApiService);
  private readonly integrationsApi = inject(IntegrationsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly assistant = inject(ConsoleAssistantLayoutService);
  private readonly homeDictation = new ConsoleDictationSession();
  private replyTimer: ReturnType<typeof setTimeout> | null = null;
  private messageSeq = 0;

  readonly homeDictating = this.homeDictation.active;
  readonly homeDictationSupported = this.homeDictation.supported;
  readonly homeDictationError = this.homeDictation.error;

  readonly onboardingUrl = environment.onboardingUrl;
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly agentReady = signal(false);
  readonly hasProduct = signal(false);
  readonly themeReady = signal(false);
  readonly paymentsReady = signal(false);
  readonly domainReady = signal(false);
  readonly shippingReady = signal(false);
  readonly channelReady = signal(false);
  readonly hasConversation = signal(false);
  readonly hasOrder = signal(false);
  readonly agentScore = signal(0);
  readonly agentMaxScore = signal(0);
  readonly prompt = signal('');
  readonly placeholderIndex = signal(0);
  readonly composerActive = signal(false);
  /** Suggestions only while the prompt field itself is focused for typing. */
  readonly promptFocused = signal(false);
  readonly homePlusOpen = signal(false);
  readonly generateApps = signal(false);

  constructor() {
    // Reply timers write into the shell-owned assistant service — do not cancel on leave.
    this.destroyRef.onDestroy(() => this.homeDictation.destroy());
  }

  startHomeDictation(): void {
    if (this.homeDictating() || this.assistant.open()) return;
    this.homePlusOpen.set(false);
    this.composerActive.set(true);
    this.homeDictation.start({
      getText: () => this.prompt(),
      setText: (value) => this.prompt.set(value),
    });
  }

  cancelHomeDictation(): void {
    this.homeDictation.cancel();
  }

  confirmHomeDictation(): void {
    this.homeDictation.confirm();
  }

  readonly businessName = computed(
    () => this.account.profile()?.business.name?.trim() || 'Tu negocio',
  );

  readonly placeholder = computed(
    () => PLACEHOLDERS[this.placeholderIndex() % PLACEHOLDERS.length],
  );

  /**
 * Home onboarding order : product → theme → payments →
 * domain → shipping, then Agopify channel proof (seller → WhatsApp → chat →
 * order). Optimiza stays last in the template. Completed cards drop out.
 */
  readonly items = computed<ChecklistItem[]>(() => [
    {
      id: 'product',
      title: 'Agrega tu primer producto',
      body: 'Comienza con un título, un precio y una foto. Siempre puedes agregar más detalles más adelante.',
      done: this.hasProduct(),
      cta: 'Agregar producto',
      link: '/app/products',
      icon: 'package',
    },
    {
      id: 'theme',
      title: 'Elige el diseño de tu tienda',
      body: 'Elige un tema que se ajuste a tu marca y personalízalo.',
      done: this.themeReady(),
      cta: 'Elegir tema',
      link: '/app/store',
      icon: 'palette',
    },
    {
      id: 'payments',
      title: 'Configura los pagos',
      body: 'Elige un proveedor de pagos para que los clientes paguen con tarjeta o billetera digital.',
      done: this.paymentsReady(),
      cta: 'Activar pagos',
      link: '/app/payments',
      icon: 'creditCard',
    },
    {
      id: 'domain',
      title: 'Obtén un dominio personalizado',
      body: 'Dale a tu tienda una URL con tu marca que sea fácil de encontrar, recordar y genere confianza.',
      done: this.domainReady(),
      cta: 'Configurar dominio',
      link: '/app/domain',
      icon: 'globe',
    },
    {
      id: 'shipping',
      title: 'Revisa las tarifas de envío',
      body: 'Revisa los valores predeterminados que se configuraron según tu sucursal.',
      done: this.shippingReady(),
      cta: 'Revisar tarifas',
      link: '/app/shipping',
      icon: 'truck',
    },
    {
      id: 'seller',
      title: 'Configura tu vendedor IA',
      body: 'Define su personalidad, preguntas frecuentes y límites, y pruébalo antes de activarlo.',
      done: this.agentReady(),
      cta: 'Configurar vendedor',
      link: '/app/seller',
      icon: 'bot',
    },
    {
      id: 'channel',
      title: 'Conecta WhatsApp',
      body: 'Conecta el número de tu negocio para que los clientes te escriban y tu vendedor responda.',
      done: this.channelReady(),
      cta: 'Conectar WhatsApp',
      link: '/app/channels',
      icon: 'smartphone',
    },
    {
      id: 'chat',
      title: 'Recibe tu primera conversación',
      body: 'Escribe al WhatsApp de tu negocio y revisa cómo responde tu vendedor IA.',
      done: this.hasConversation(),
      cta: 'Ver mensajes',
      link: '/app/messages',
      icon: 'message',
    },
    {
      id: 'order',
      title: 'Recibe tu primer pedido',
      body: 'Crea un pedido desde una conversación o desde Pedidos y revisa su estado de pago.',
      done: this.hasOrder(),
      cta: 'Ver pedidos',
      link: '/app/orders',
      icon: 'shoppingBag',
    },
  ]);

  /** Up to 5 incomplete cards (console grid) + Optimiza in the template. */
  readonly featuredCards = computed(() =>
    this.items().filter((item) => !item.done).slice(0, 5),
  );

 /** Home prompt list (→ rows); adapted to Agopify modules. */
  readonly suggestions = computed<AssistantSuggestion[]>(() => {
    const pending = this.items().filter((item) => !item.done);
    const catalog: AssistantSuggestion[] = [
      {
        id: 'product-pub',
        label: 'Crear una publicación de producto',
        link: '/app/products',
        fillPrompt: 'Ayúdame a crear una publicación de producto',
      },
      {
        id: 'product-search',
        label: 'Ayúdame a buscar productos',
        link: '/app/products',
        fillPrompt: 'Ayúdame a buscar productos en mi catálogo',
      },
      {
        id: 'start',
        label: 'Ayúdame a empezar',
        link: '/app/get-started',
        fillPrompt: 'Ayúdame a empezar',
      },
      {
        id: 'product-images',
        label: 'Generar imágenes de productos',
        link: '/app/products',
        fillPrompt: 'Ayúdame a generar imágenes de productos',
      },
      {
        id: 'product-desc',
        label: 'Escribir una descripción de producto',
        link: '/app/products',
        fillPrompt: 'Ayúdame a escribir una descripción de producto',
      },
      {
        id: 'business-idea',
        label: 'Ayúdame a encontrar una idea de negocio',
        link: '/app/seller',
        fillPrompt: 'Ayúdame a encontrar una idea de negocio',
      },
    ];
    if (!pending.length) {
      return [
        {
          id: 'playground',
          label: 'Probar cómo responde mi vendedor',
          link: '/app/seller/profile',
          queryParams: { playground: '1' },
          fillPrompt: 'Probar cómo responde mi vendedor',
        },
        ...catalog.slice(2),
      ].slice(0, 6);
    }
    const nextHints = pending.slice(0, 2).map((item) => ({
      id: item.id,
      label: item.title,
      link: item.link,
      fillPrompt: item.title,
    }));
    return [...nextHints, ...catalog.filter((item) => !nextHints.some((h) => h.id === item.id))].slice(0, 6);
  });

 /** asistente + menu : Archivos → … → Llamada de voz. */
  readonly homePlusItems: HomePlusItem[] = [
    { id: 'files', label: 'Archivos', icon: 'fileText', disabled: true },
    { id: 'upload', label: 'Subir desde el dispositivo', icon: 'upload', disabled: true },
    { id: 'destination', label: 'Destino', icon: 'target' },
    { id: 'mention', label: 'Mención', icon: 'users', hint: '@', submenu: true },
    { id: 'skills', label: 'Skills', icon: 'sparkles', hint: '/', submenu: true },
    { id: 'generate-apps', label: 'Generar apps', icon: 'layers', kind: 'toggle' },
    { id: 'apps', label: 'Apps', icon: 'layers', trailingIcon: 'store', submenu: true, disabled: true },
    { id: 'voice', label: 'Llamada de voz', icon: 'radio', disabled: true, dividerBefore: true },
  ];

  readonly completedCount = computed(
    () => this.items().filter((item) => item.done).length,
  );

  readonly progressPercent = computed(() => {
    const total = this.items().length;
    if (!total) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  readonly nextStepId = computed(() => this.items().find((item) => !item.done)?.id);
  readonly nextItem = computed(() => this.items().find((item) => !item.done));
  readonly readyToSell = computed(() => this.agentReady() && this.hasProduct() && this.channelReady());

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.clearReplyTimer());
    interval(4200)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.prompt().trim()) {
          this.placeholderIndex.update((index) => index + 1);
        }
      });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [agent, products, channels, conversations, orders, store, payments, shipping, domain] =
        await Promise.all([
          this.agents.getPrimary().catch((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 404) return null;
            throw error;
          }),
          this.catalog.list(),
          this.messaging.listChannels(),
          this.messaging.listConversations(),
          this.orders.list({ tab: 'all' }),
          this.storeApi.get().catch(() => null),
          this.paymentsApi.get().catch(() => null),
          this.shippingApi.get().catch(() => null),
          this.integrationsApi.getCustomDomain().catch(() => null),
          this.account.profile() ? Promise.resolve(null) : this.account.load().catch(() => null),
        ]);

      this.agentScore.set(agent?.quality.score ?? 0);
      this.agentMaxScore.set(agent?.quality.max ?? 0);
      this.agentReady.set(
        Boolean(agent?.isActive && agent.quality.score >= 80 &&
          agent.initialMessage?.trim() && agent.handoffMessage?.trim()),
      );
      this.hasProduct.set(products.some((product) => product.isAvailable));
      this.themeReady.set(
        Boolean(
          store &&
            (store.storefront.status === 'PUBLISHED' ||
              store.storefront.logoUrl ||
              store.checklist.some((item) => item.id === 'logo' && item.done)),
        ),
      );
      this.paymentsReady.set(Boolean(payments?.connected));
      this.domainReady.set(domain?.status === 'active');
      this.shippingReady.set(
        Boolean(
          shipping &&
            (shipping.shippingOriginUbigeo ||
              (shipping.pickupEnabled && shipping.pickupAddress?.trim()) ||
              (shipping.deliveryEnabled && shipping.carrierRates)),
        ),
      );
      this.channelReady.set(
        channels.some(
          (channel) =>
            channel.type === 'WHATSAPP' &&
            channel.healthStatus === 'CONNECTED',
        ),
      );
      this.hasConversation.set(conversations.length > 0);
      this.hasOrder.set(orders.length > 0);
    } catch {
      this.errorMessage.set(
        'No pudimos cargar tu avance. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  openSearch(): void {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }),
    );
  }

  /** Home composer “Recientes” → full assistant panel on the Conversaciones list. */
  openRecentConversations(): void {
    this.homePlusOpen.set(false);
    this.promptFocused.set(false);
    this.assistant.openRecentConversations();
  }

  onComposerActivate(): void {
    this.composerActive.set(true);
  }

  onComposerFocusIn(): void {
    this.composerActive.set(true);
  }

  onComposerFocusOut(event: FocusEvent): void {
    const root = event.currentTarget as HTMLElement | null;
    // Delay past the next focus target so + / suggestions don't flash-close.
    window.setTimeout(() => {
      if (!root?.contains(document.activeElement)) {
        this.composerActive.set(false);
        this.promptFocused.set(false);
        this.homePlusOpen.set(false);
      }
    }, 0);
  }

  onPromptFocus(): void {
    this.promptFocused.set(true);
    this.composerActive.set(true);
    this.homePlusOpen.set(false);
  }

  onPromptBlur(): void {
    // Defer so clicking a suggestion still counts as inside the composer.
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active?.id === 'home-assistant-input') return;
      if (active?.closest?.('.home-assistant__suggestions')) return;
      this.promptFocused.set(false);
    }, 0);
  }

  toggleHomePlus(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.composerActive.set(true);
    this.promptFocused.set(false);
    this.homePlusOpen.update((open) => !open);
  }

  toggleGenerateApps(): void {
    this.generateApps.update((value) => !value);
  }

  onHomePlus(id: string): void {
    this.homePlusOpen.set(false);
    this.handlePlusAction(id);
  }

  applySuggestion(suggestion: AssistantSuggestion): void {
    const text = suggestion.fillPrompt ?? suggestion.label;
    this.openAssistantWith(text);
  }

  onPromptEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    this.submitPrompt();
  }

  onHomeComposerSubmitted(text: string): void {
    const next = text.trim() || this.placeholder();
    this.prompt.set('');
    this.homePlusOpen.set(false);
    this.openAssistantWith(next);
  }

  submitPrompt(event?: Event): void {
    event?.preventDefault();
    const text = this.prompt().trim() || this.placeholder();
    this.prompt.set('');
    this.homePlusOpen.set(false);
    this.openAssistantWith(text);
  }

  private openAssistantWith(text: string): void {
    const next = text.trim();
    if (!next) return;
    this.clearReplyTimer();
    this.assistant.open.set(true);
    this.assistant.mode.set('dock');
    this.assistant.title.set(next.slice(0, 72));
    this.assistant.messages.set([]);
    this.assistant.drafting.set(false);
    this.assistant.plusOpen.set(false);
    this.appendUserAndReply(next);
  }

  private appendUserAndReply(text: string): void {
    const user: AssistantPanelMessage = {
      id: `u-${++this.messageSeq}`,
      role: 'user',
      text,
    };
    this.assistant.messages.update((messages) => [...messages, user]);
    this.assistant.drafting.set(true);
    this.clearReplyTimer();
    this.replyTimer = setTimeout(() => {
      this.assistant.drafting.set(false);
      this.assistant.messages.update((messages) => [...messages, this.buildAssistantReply(text)]);
      this.replyTimer = null;
    }, 700);
  }

  private buildAssistantReply(text: string): AssistantPanelMessage {
    const lower = text.toLocaleLowerCase('es');
    const next = this.nextItem();
    const pending = this.items().filter((item) => !item.done);

    if (/empezar|primeros pasos|configurar (mi |tu )?negocio|ayúdame a empezar/.test(lower)) {
      return {
        id: `a-${++this.messageSeq}`,
        role: 'assistant',
        status: 'Se revisó tu avance de configuración',
        text: `Perfecto. Para dejar ${this.businessName()} listo para vender, te recomiendo este orden:`,
        bullets: [
          'Agrega tu primer producto (título, precio y foto).',
          'Configura la personalidad de tu vendedor IA y pruébalo.',
          'Conecta WhatsApp para atender clientes reales.',
          'Revisa tu primera conversación y confirma un pedido de prueba.',
        ],
        actions: [
          {
            id: 'guide',
            label: 'Primeros pasos para configurar tu negocio',
            link: next?.link ?? '/app/seller/profile',
            queryParams: next ? undefined : { playground: '1' },
          },
          ...pending.slice(0, 2).map((item) => ({
            id: item.id,
            label: item.cta,
            link: item.link,
          })),
        ].filter(
          (action, index, list) => list.findIndex((item) => item.link === action.link) === index,
        ),
      };
    }

    const route = this.routeForPrompt(text);
    const matched = this.items().find((item) => item.link === route.link);
    return {
      id: `a-${++this.messageSeq}`,
      role: 'assistant',
      status: 'Se consultó tu guía de configuración',
      text: matched
        ? `${matched.body} Cuando quieras, abre el módulo y avanza este paso.`
        : 'Puedo llevarte al módulo correcto de la consola para seguir configurando tu negocio.',
      actions: [
        {
          id: 'go',
          label: matched?.cta ?? 'Abrir módulo',
          link: route.link,
          queryParams: route.queryParams,
        },
      ],
    };
  }

  private handlePlusAction(id: string): void {
    const next = this.nextItem();
    if (id === 'destination') {
      if (next) this.openAssistantWith(next.title);
      else void this.router.navigate(['/app/seller/profile'], { queryParams: { playground: '1' } });
      return;
    }
    this.assistant.onPlus(id);
  }

  private clearReplyTimer(): void {
    if (this.replyTimer) {
      clearTimeout(this.replyTimer);
      this.replyTimer = null;
    }
  }

  private routeForPrompt(text: string): { link: string; queryParams?: Record<string, string> } {
    const lower = text.toLocaleLowerCase('es');
    if (/producto|catálogo|catalogo|precio|foto|descripci/.test(lower)) return { link: '/app/products' };
    if (/tema|diseño|diseno|tienda web|personaliz/.test(lower)) return { link: '/app/store' };
    if (/pago|mercadopago|yape|tarjeta|billetera/.test(lower)) return { link: '/app/payments' };
    if (/dominio|url|dominio personalizado/.test(lower)) return { link: '/app/domain' };
    if (/env[ií]o|tarifa|olva|shalom|pickup|recojo/.test(lower)) return { link: '/app/shipping' };
    if (/whatsapp|canal|instagram|conectar/.test(lower)) return { link: '/app/channels' };
    if (/pedido|cobro/.test(lower)) return { link: '/app/orders' };
    if (/mensaje|conversaci|chat|cliente/.test(lower)) return { link: '/app/messages' };
    if (/probar|playground|atiende|responde/.test(lower)) {
      return { link: '/app/seller/profile', queryParams: { playground: '1' } };
    }
    if (/vendedor|personalidad|faq|límite|limite/.test(lower)) return { link: '/app/seller' };
    const next = this.nextItem();
    if (next) return { link: next.link };
    return { link: '/app/seller/profile', queryParams: { playground: '1' } };
  }
}
