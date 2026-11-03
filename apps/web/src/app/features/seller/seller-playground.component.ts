import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DsButtonComponent, DsIconComponent, DsModalDirective } from '@agopify/ui';
import {
  AgentsApiService,
  AgentToolTrace,
  PlaygroundMessageDto,
  PlaygroundSessionDto,
} from '../../core/api/agents-api.service';

@Component({
  selector: 'app-seller-playground',
  standalone: true,
  imports: [DsButtonComponent, DsIconComponent, DsModalDirective],
  templateUrl: './seller-playground.component.html',
  styleUrl: './seller-playground.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerPlaygroundComponent implements OnInit {
  private readonly api = inject(AgentsApiService);

  readonly agentId = input<string | null>(null);
  readonly agentName = input('tu vendedor');
  readonly closed = output<void>();

  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly session = signal<PlaygroundSessionDto | null>(null);
  readonly draft = signal('');
  readonly lastTools = signal<AgentToolTrace[]>([]);

  readonly messages = computed(() => this.session()?.messages ?? []);
  readonly canCompose = computed(
    () => Boolean(this.session()) && !this.loading() && !this.sending(),
  );

  readonly suggestions = [
    { label: 'Hola', text: 'Hola' },
    { label: 'Busco un regalo', text: 'Busco un regalo, ¿qué me recomiendas?' },
    { label: 'Me parece caro', text: 'Me parece un poco caro' },
    { label: 'Quiero una persona', text: 'Quiero hablar con una persona' },
  ];

  async ngOnInit(): Promise<void> {
    await this.loadSession();
  }

  async loadSession(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const session = await this.api.getPlaygroundSession();
      this.session.set(session);
      const lastAgent = [...session.messages]
        .reverse()
        .find((message) => message.authorType === 'SALES_AGENT');
      this.lastTools.set(this.asToolTraces(lastAgent?.toolTraces));
    } catch (error) {
      this.session.set(null);
      this.error.set(this.describeError(error, 'No pudimos abrir la prueba. Guarda el vendedor y reintenta.'));
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }

  async reset(): Promise<void> {
    const session = this.session();
    if (!session || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      this.session.set(await this.api.resetPlaygroundSession(session.id));
      this.lastTools.set([]);
      this.draft.set('');
    } catch (error) {
      this.error.set(this.describeError(error, 'No se pudo reiniciar la prueba.'));
    } finally {
      this.sending.set(false);
    }
  }

  onDraft(value: string): void {
    this.draft.set(value);
  }

  async send(rawText?: string): Promise<void> {
    const session = this.session();
    const text = (rawText ?? this.draft()).trim();
    if (!session || !text || this.sending() || this.loading()) return;

    this.sending.set(true);
    this.error.set(null);
    try {
      const result = await this.api.sendPlaygroundMessage(
        session.id,
        text,
        this.agentId() ?? undefined,
      );
      if (result?.session) {
        this.session.set(result.session);
      }
      this.lastTools.set(this.asToolTraces(result?.lastAgentReply?.tools));
      this.draft.set('');
    } catch (error) {
      this.error.set(
        this.describeError(
          error,
          'No se pudo enviar. Revisa tu conexión e inténtalo otra vez.',
        ),
      );
    } finally {
      this.sending.set(false);
    }
  }

  sendSuggestion(text: string): void {
    void this.send(text);
  }

  isBuyer(message: PlaygroundMessageDto): boolean {
    return message.authorType === 'BUYER';
  }

  /** The reply carried a (simulated) payment link, shown to the buyer as a button. */
  hasPaymentButton(message: PlaygroundMessageDto): boolean {
    return this.asToolTraces(message.toolTraces).some(
      (tool) => tool.name === 'create_payment_link' && typeof tool.data?.['checkoutUrl'] === 'string',
    );
  }

  toolLabel(name: string): string {
    switch (name) {
      case 'search_catalog':
      case 'search_products':
        return 'Catálogo';
      case 'get_product_availability':
        return 'Precio / stock';
      case 'lookup_faq':
        return 'Pregunta frecuente';
      case 'create_order':
        return 'Pedido (prueba)';
      case 'create_payment_link':
        return 'Link de pago (prueba)';
      case 'quote_shipping':
        return 'Envío';
      case 'send_product_image':
        return 'Foto de producto';
      case 'escalate':
        return 'Derivó a asesor';
      default:
        return 'Consulta del vendedor';
    }
  }

  /** Product photos the agent would send on WhatsApp after the text. */
  messageImages(message: PlaygroundMessageDto): Array<{
    url: string;
    caption: string;
  }> {
    return this.asToolTraces(message.toolTraces).flatMap((tool) => {
      if (tool.name !== 'send_product_image') return [];
      const url = tool.data?.['imageUrl'];
      if (typeof url !== 'string' || !url) return [];
      const caption =
        typeof tool.data?.['caption'] === 'string'
          ? tool.data['caption']
          : tool.summary;
      return [{ url, caption }];
    });
  }

  paymentFooter(message: PlaygroundMessageDto): string | null {
    if (!this.hasPaymentButton(message)) return null;
    const dry = this.asToolTraces(message.toolTraces).some(
      (tool) =>
        (tool.name === 'create_order' || tool.name === 'create_payment_link') &&
        tool.data?.['dryRun'] === true,
    );
    return dry ? 'Pedido de prueba · no se cobra' : null;
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 0) return 'Sin conexión con el servidor. ¿Está levantado el entorno?';
    if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (error.status === 404) return 'No encontramos la sesión de prueba. Pulsa Reintentar.';
    if (error.status === 429) return 'Demasiados mensajes seguidos. Espera un momento.';
    if (error.status >= 500) return 'El servidor no pudo responder. Inténtalo otra vez.';
    const body = error.error;
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
      if (Array.isArray(message) && message.length) return String(message[0]);
    }
    return fallback;
  }

  private asToolTraces(value: unknown): AgentToolTrace[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is AgentToolTrace =>
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        'summary' in item,
    );
  }
}
