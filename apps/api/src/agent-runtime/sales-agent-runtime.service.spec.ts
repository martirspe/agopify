import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildAgentContext, ConversationTurn } from './conversation-context';
import { SalesAgentRuntimeService } from './sales-agent-runtime.service';
import { CatalogProductView, SalesAgentToolsService } from './sales-agent-tools.service';
import { initialSalesState } from './sales-state';
import { createTestAiModelRouter } from './models/ai-model.test-utils';

const product: CatalogProductView = {
  id: 'product-1', handle: 'perfume-prueba', name: 'Perfume de prueba',
  descriptionShort: 'Té verde · 200 ml', basePriceCents: 8400, currency: 'PEN',
  categories: [], isAvailable: true, stockUnlimited: false, stockQty: 4,
  stockLabel: '4 en stock', priceLabel: 'S/ 84.00', isService: false,
  productUrl: null, imageUrl: 'https://example.com/product.jpg', variants: [],
};
const closeScript = 'Ante señales de compra, deja de mostrar opciones: confirma cuál se lleva y pide el distrito para calcular el envío. Si duda entre dos, pregunta cuál le gustó más.';
const discoverScript = 'Antes de recomendar, descubre la necesidad del cliente y pregunta qué producto busca.';
const history: ConversationTurn[] = [
  { role: 'buyer', text: 'Busco un perfume' },
  { role: 'agent', text: 'Te recomiendo Perfume de prueba.', productIds: [product.id] },
];

describe('sales agent buyer replies', () => {
  let runtime: SalesAgentRuntimeService;
  let tools: SalesAgentToolsService;
  let fetchMock: jest.SpyInstance;
  let findAgent: jest.Mock;
  let aiEnabled: boolean;

  beforeEach(() => {
    aiEnabled = false;
    findAgent = jest.fn().mockResolvedValue(null);
    tools = new SalesAgentToolsService(null as never, null as never, null as never);
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([product]);
    jest.spyOn(tools, 'catalogOverview').mockResolvedValue({ total: 1, categories: [], storeUrl: null });
    jest.spyOn(tools, 'shippingRules').mockResolvedValue({
      deliveryEnabled: true, freeShippingFromCents: null, pickupEnabled: false,
      pickupAddress: null, shippingOriginUbigeo: '150122',
      carrierRates: { olva: [900, 1200, 1600, 2200, 2800] },
    });
    jest.spyOn(tools, 'createOrderWithOptionalLink').mockResolvedValue({ traces: [] });
    jest.spyOn(tools, 'listActivePublishedDiscounts').mockResolvedValue({
      discounts: [],
      trace: {
        name: 'list_promotions',
        status: 'skipped',
        summary: 'Sin descuentos publicados y activos',
        data: { count: 0, ids: [] },
      },
    });
    const config = {
      get: (key: string, fallback?: unknown) =>
        key === 'OPENAI_API_KEY' && aiEnabled ? 'fixture-key' : fallback,
    } as unknown as ConfigService;
    runtime = new SalesAgentRuntimeService(
      { salesAgent: { findFirst: findAgent } } as unknown as PrismaService,
      config,
      tools,
      { getRuntimeKnowledge: async () => ({ faqs: [], journeys: [
        { title: 'Cierre', stage: 'CLOSE', scriptText: closeScript },
        { title: 'Descubrir', stage: 'DISCOVER', scriptText: discoverScript },
      ] }) } as unknown as KnowledgeService,
      undefined,
      createTestAiModelRouter(config),
    );
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        replyText: 'Te recomiendo Perfume de prueba. ¿Te lo preparo?',
        productNames: [product.name], usedCatalog: true, escalate: false,
      }) } }] }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])('answers a greeting without repeating products or calling AI (AI enabled: %s)', async (useAi) => {
    aiEnabled = useAi;
    const earlier = JSON.parse(JSON.stringify(history));
    const reply = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: 'Hola', history });
    expect(reply.replyText).toBe('¡Hola de nuevo! ¿Qué estás buscando hoy?');
    expect(reply.usedCatalog).toBe(false);
    expect(reply.images).toEqual([]);
    expect(reply.tools).toEqual([]);
    expect(history).toEqual(earlier);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('honors the configured initial message without exposing discovery instructions', async () => {
    const initialMessage = '¡Hola! ¿Buscas algo para ti o para regalar?';
    findAgent.mockResolvedValue({ initialMessage });
    const reply = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: '¡Hola!' });
    expect(reply.replyText).toBe(initialMessage);
    findAgent.mockResolvedValue(null);
    const defaultReply = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: 'Buenos días' });
    expect(defaultReply.replyText).toContain('¿Qué estás buscando hoy?');
    expect(defaultReply.replyText).not.toContain(discoverScript);
  });

  it('asks prepare before district when the buyer names a SKU to buy', async () => {
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1', inboundText: 'Hola, quiero comprar Perfume de prueba', history,
    });
    expect(reply.replyText).toMatch(/preparo/i);
    expect(reply.replyText).toContain(product.name);
    expect(reply.replyText.toLowerCase()).not.toContain('distrito');
    expect(reply.usedCatalog).toBe(true);
    expect(reply.images).toEqual([]);
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('pins an option selection without jumping to district (B6)', async () => {
    const state = initialSalesState();
    state.recommendedProductIds = [product.id];
    state.stage = 'RECOMMENDATION';
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: `quiero el ${product.name}`,
      history: [
        {
          role: 'agent',
          text: `Tenemos tres opciones. 1. ${product.name}. ¿Cuál te interesa?`,
          productIds: [product.id],
        },
      ],
      salesState: state,
    });
    expect(reply.replyText).toContain(product.name);
    expect(reply.replyText).toMatch(/preparo/i);
    expect(reply.replyText.toLowerCase()).not.toContain('distrito');
    expect(reply.salesState?.selectedProduct?.productId).toBe(product.id);
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('keeps resolving the previous product after another greeting', async () => {
    const greeting = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: 'Hola', history });
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1', inboundText: 'Lo quiero',
      history: [...history, { role: 'buyer', text: 'Hola' }, { role: 'agent', text: greeting.replyText }],
    });
    expect(reply.replyText).toContain('distrito');
    expect(reply.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'search_catalog', data: expect.objectContaining({ matchIds: [product.id] }) }),
    ]));
  });

  it('preserves a pending delivery step across a greeting without creating an order', async () => {
    const waiting: ConversationTurn[] = [{
      role: 'agent', text: '¿A qué distrito te lo enviamos?', productIds: [product.id],
      pendingDelivery: { lines: [{ productId: product.id, variantId: null, quantity: 1 }] },
    }];
    const greeting = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: 'Hola', history: waiting });
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
    const { history: nextHistory } = buildAgentContext([
      { authorType: 'SALES_AGENT', body: greeting.replyText, metadata: { tools: greeting.tools } },
    ]);
    expect(nextHistory[0].pendingDelivery).toEqual(waiting[0].pendingDelivery);
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1', inboundText: 'Miraflores, Lima', history: nextHistory,
    });
    expect(tools.createOrderWithOptionalLink).toHaveBeenCalledWith(expect.objectContaining({
      lines: [expect.objectContaining({ product })], delivery: expect.objectContaining({ kind: 'quote' }),
    }));
    expect(reply.images).toEqual([]);
  });

  it('keeps checkout alive through SJL district wording and a later payment-link ask', async () => {
    const waiting: ConversationTurn[] = [{
      role: 'agent',
      text: 'Hay varios distritos con ese nombre:\n• Lima (Lima, Lima)\n• San Juan de Lurigancho (Lima, Lima)\n¿Cuál es el tuyo?',
      productIds: [product.id],
      pendingDelivery: { lines: [{ productId: product.id, variantId: null, quantity: 1 }] },
    }];
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.missingInformation = ['destination'];
    state.intent = 'purchase';

    jest.spyOn(tools, 'createOrderWithOptionalLink').mockResolvedValue({
      traces: [
        { name: 'create_order', status: 'ok', summary: 'Pedido creado' },
        { name: 'create_payment_link', status: 'ok', summary: 'Link listo', data: { checkoutUrl: 'https://pay.test/x' } },
      ],
      orderId: 'ord-1',
      orderRef: 'A-1',
      checkoutUrl: 'https://pay.test/x',
    });

    const confirmed = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'San Juan de Lurigancho (Lima, Lima)',
      history: waiting,
      salesState: state,
    });
    expect(tools.createOrderWithOptionalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery: expect.objectContaining({
          kind: 'quote',
          place: expect.objectContaining({ district: 'San Juan de Lurigancho' }),
        }),
      }),
    );
    expect(confirmed.checkoutUrl).toBe('https://pay.test/x');
    expect(confirmed.escalate).toBe(false);

    const afterLink = {
      ...confirmed.salesState!,
      pendingLines: [],
      orderId: 'ord-1',
      stage: 'PAYMENT_PENDING' as const,
    };
    (tools.createOrderWithOptionalLink as jest.Mock).mockClear();
    jest.spyOn(tools, 'existingOrder').mockResolvedValue({
      id: 'ord-1',
      orderRef: 'A-1',
      status: 'PENDING_PAYMENT',
      checkoutUrl: 'https://pay.test/x',
    });
    const again = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'dame el link de pago porfavor',
      history: [
        ...waiting,
        { role: 'buyer', text: 'San Juan de Lurigancho (Lima, Lima)' },
        { role: 'agent', text: 'Listo, va el perfume.', paymentLink: true, productIds: [product.id] },
      ],
      salesState: afterLink,
    });
    expect(again.escalate).toBe(false);
    expect(again.checkoutUrl).toBe('https://pay.test/x');
    expect(again.replyText.toLowerCase()).not.toContain('varios distritos');
  });

  it('starts checkout from "quiero comprarlo" without handing off', async () => {
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'perfecto quiero comprarlo',
      history,
    });
    expect(reply.escalate).toBe(false);
    expect(reply.replyText).toContain('distrito');
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('searches instead of ordering on an open product need after a prior checkout', async () => {
    const deodorant: CatalogProductView = {
      ...product,
      id: 'deo-1',
      handle: 'deo-mujer',
      name: 'Desodorante floral',
      descriptionShort: 'Para mujer · 150 ml',
      imageUrl: 'https://example.com/deo.jpg',
    };
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([product, deodorant]);
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.orderId = 'ord-old';
    state.requirements.destination = {
      value: 'San Juan de Lurigancho, Lima, Lima',
      source: 'buyer',
      confidence: 1,
      timestamp: new Date().toISOString(),
      scope: 'conversation',
    };
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'Quiero comprar un desodorante para mujer',
      history: [
        {
          role: 'agent',
          text: '¿A qué distrito te lo enviamos?',
          productIds: [product.id],
          pendingDelivery: {
            lines: [{ productId: product.id, variantId: null, quantity: 1 }],
          },
        },
      ],
      salesState: state,
    });
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
    expect(reply.escalate).toBe(false);
    expect(reply.orderId).toBeUndefined();
    expect(reply.replyText.toLowerCase()).not.toContain('pedido quedó registrado');
    expect(reply.replyText.toLowerCase()).toMatch(/desodorant|floral|preparo/);
  });

  it('releases district lock when the buyer asks to browse another category', async () => {
    const cologne: CatalogProductView = {
      ...product,
      id: 'col-1',
      handle: 'colonia-hombre',
      name: 'Colonia masculina Fresh',
      descriptionShort: 'Fresco · 100 ml',
      categories: ['Perfumería masculina'],
      imageUrl: 'https://example.com/col.jpg',
    };
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([product, cologne]);
    jest.spyOn(tools, 'browseProducts').mockResolvedValue({
      products: [cologne],
      remaining: 0,
    });
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.intent = 'purchase';
    state.missingInformation = ['destination'];
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'muestrame que productos de colonia masculina tienen',
      history: [
        {
          role: 'agent',
          text: 'Para calcular el envío, ¿a qué distrito te lo enviamos?',
          productIds: [product.id],
          pendingDelivery: {
            lines: [{ productId: product.id, variantId: null, quantity: 1 }],
          },
        },
      ],
      salesState: state,
    });
    expect(reply.replyText.toLowerCase()).not.toContain('distrito');
    expect(reply.replyText.toLowerCase()).toMatch(/colonia|masculina/);
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('cancels an unpaid pending order when the buyer asks', async () => {
    const state = initialSalesState();
    state.orderId = 'ord-pending-1';
    state.stage = 'PAYMENT_PENDING';
    state.intent = 'purchase';
    state.selectedProduct = { productId: product.id };
    const cancelSpy = jest
      .spyOn(tools, 'cancelUnpaidChatOrder')
      .mockResolvedValue({ ok: true, orderId: 'ord-pending-1', dryRun: true });
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'quiero cancelar el pedido',
      history: [
        {
          role: 'agent',
          text: 'Listo, va el perfume. Completa el pago.',
          paymentLink: true,
          productIds: [product.id],
        },
      ],
      salesState: state,
      mode: 'playground',
    });
    expect(cancelSpy).toHaveBeenCalled();
    expect(reply.replyText.toLowerCase()).toMatch(/cancel/);
    expect(reply.replyText.toLowerCase()).not.toContain(
      'ya tienes un pedido pendiente',
    );
    expect(reply.checkoutUrl).toBeUndefined();
    expect(reply.salesState?.orderId).toBeUndefined();
  });

  it('lets the buyer abandon checkout and browse after a pending order', async () => {
    const cologne: CatalogProductView = {
      ...product,
      id: 'col-2',
      handle: 'colonia-b',
      name: 'Colonia nocturna',
      categories: ['Perfumería'],
    };
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([product, cologne]);
    jest.spyOn(tools, 'cancelUnpaidChatOrder').mockResolvedValue({
      ok: true,
      orderId: 'ord-pending-2',
      dryRun: true,
    });
    const state = initialSalesState();
    state.orderId = 'ord-pending-2';
    state.stage = 'PAYMENT_PENDING';
    state.intent = 'purchase';
    state.selectedProduct = { productId: product.id };
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'ya no lo voy a comprar, quiero ver productos de perfumeria',
      history: [
        {
          role: 'agent',
          text: 'Listo, va el perfume. Completa el pago.',
          paymentLink: true,
          productIds: [product.id],
        },
      ],
      salesState: state,
      mode: 'playground',
    });
    expect(reply.replyText.toLowerCase()).not.toContain('pedido pendiente');
    expect(reply.checkoutUrl).toBeUndefined();
    expect(reply.salesState?.orderId).toBeUndefined();
    expect(reply.replyText.toLowerCase()).toMatch(/colonia|perfume|preparo|opcion/);
  });

  it('hands off after order when payment link is unavailable', async () => {
    const waiting: ConversationTurn[] = [{
      role: 'agent',
      text: '¿A qué distrito te lo enviamos?',
      productIds: [product.id],
      pendingDelivery: { lines: [{ productId: product.id, variantId: null, quantity: 1 }] },
    }];
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.missingInformation = ['destination'];
    state.intent = 'purchase';

    jest.spyOn(tools, 'createOrderWithOptionalLink').mockResolvedValue({
      traces: [
        { name: 'create_order', status: 'ok', summary: 'Pedido creado' },
        {
          name: 'create_payment_link',
          status: 'error',
          summary: 'Medios de pago no configurados: se deriva a un asesor',
          data: { checkoutUrl: null, code: 'payment_provider_missing' },
        },
      ],
      orderId: 'ord-manual-1',
      orderRef: 'M-1',
      dryRun: false,
      paymentLinkUnavailable: true,
    });

    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'Miraflores, Lima',
      history: waiting,
      salesState: state,
    });

    expect(reply.checkoutUrl).toBeUndefined();
    expect(reply.orderId).toBe('ord-manual-1');
    expect(reply.escalate).toBe(true);
    expect(reply.pauseOnHandoff).toBe(true);
    expect(reply.replyText).toContain('M-1');
    expect(reply.replyText.toLowerCase()).toContain('asesor');
    expect(reply.replyText.toLowerCase()).not.toContain('link');
    expect(reply.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'escalate',
          data: expect.objectContaining({ reason: 'payment_provider_missing' }),
        }),
      ]),
    );
    expect(reply.salesState?.stage).toBe('HUMAN_HANDOFF');
  });

  it('uses a buyer-facing closing question in fallback instead of the internal script', async () => {
    const reply = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: product.name });
    expect(reply.replyText).toContain(product.name);
    expect(reply.replyText).toContain('¿Te lo preparo?');
    expect(reply.replyText).not.toContain(closeScript);
  });

  it('sends the selected product photo while waiting for district (E5)', async () => {
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.intent = 'purchase';
    state.missingInformation = ['destination'];
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'QUiero ver foto',
      history: [
        {
          role: 'agent',
          text: 'Para calcular el envío, ¿a qué distrito te lo enviamos?',
          productIds: [product.id],
          pendingDelivery: {
            lines: [{ productId: product.id, variantId: null, quantity: 1 }],
          },
        },
      ],
      salesState: state,
    });
    expect(reply.images).toEqual([
      expect.objectContaining({
        productId: product.id,
        imageUrl: product.imageUrl,
      }),
    ]);
    expect(reply.replyText.toLowerCase()).toMatch(/foto/);
    expect(reply.replyText).toMatch(/distrito/i);
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('shows the product when asked before giving a district (E5)', async () => {
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.intent = 'purchase';
    state.missingInformation = ['destination'];
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'primero muestrame el producto',
      history: [
        {
          role: 'agent',
          text: 'Para calcular el envío, ¿a qué distrito te lo enviamos?',
          productIds: [product.id],
          pendingDelivery: {
            lines: [{ productId: product.id, variantId: null, quantity: 1 }],
          },
        },
      ],
      salesState: state,
    });
    expect(reply.images).toEqual([
      expect.objectContaining({ productId: product.id, imageUrl: product.imageUrl }),
    ]);
    expect(reply.replyText.toLowerCase()).toMatch(/foto/);
    expect(reply.replyText).toMatch(/distrito/i);
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('denies discounts when none are published and active (G2)', async () => {
    const state = initialSalesState();
    state.pendingLines = [{ productId: product.id, variantId: null, quantity: 1 }];
    state.selectedProduct = { productId: product.id };
    state.stage = 'CHECKOUT';
    state.intent = 'purchase';
    state.missingInformation = ['destination'];
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'hay algun descuento?',
      history: [
        {
          role: 'agent',
          text: 'Para calcular el envío, ¿a qué distrito te lo enviamos?',
          productIds: [product.id],
          pendingDelivery: {
            lines: [{ productId: product.id, variantId: null, quantity: 1 }],
          },
        },
      ],
      salesState: state,
    });
    expect(reply.replyText.toLowerCase()).toMatch(/no hay descuentos publicados/);
    expect(reply.replyText).toMatch(/distrito/i);
    expect(tools.listActivePublishedDiscounts).toHaveBeenCalled();
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });

  it('offers only active published discounts when the buyer asks', async () => {
    jest.spyOn(tools, 'listActivePublishedDiscounts').mockResolvedValue({
      discounts: [
        {
          id: 'c1',
          label: 'Verano 10',
          summary: 'Verano 10: 10% de descuento con el código VERANO10',
          method: 'CODE',
          code: 'VERANO10',
        },
      ],
      trace: {
        name: 'list_promotions',
        status: 'ok',
        summary: '1 descuento(s) activo(s) consultado(s)',
        data: { count: 1, ids: ['c1'] },
      },
    });
    const reply = await runtime.generateReply({
      tenantId: 'tenant-1',
      inboundText: 'tienen algun descuento o promo?',
      history,
    });
    expect(reply.replyText).toContain('VERANO10');
    expect(reply.replyText.toLowerCase()).toContain('descuento');
    expect(reply.replyText.toLowerCase()).not.toContain(
      'no hay descuentos publicados',
    );
  });

  it.each([false, true])('sends photos only on request, including repeat requests (AI enabled: %s)', async (useAi) => {
    aiEnabled = useAi;
    for (const inboundText of [product.name, 'Hola', 'No quiero fotos', 'La foto se ve borrosa']) {
      const reply = await runtime.generateReply({ tenantId: 'tenant-1', inboundText, history });
      expect(reply.images).toEqual([]);
    }
    for (const inboundText of ['Mándame una foto', 'Hola, envíame una foto', 'Quiero otra foto del perfume']) {
      const reply = await runtime.generateReply({
        tenantId: 'tenant-1', inboundText, history, shownImageProductIds: [product.id],
      });
      expect(reply.images).toEqual([expect.objectContaining({ productId: product.id })]);
    }
    if (useAi) {
      const request = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(request.messages[0].content).toContain('El cliente no solicitó fotos: no se enviará ninguna imagen');
      expect(request.messages[0].content).not.toContain('se envía automáticamente');
    }
  });

  it.each([closeScript, 'Si duda entre dos, pregunta cuál le gustó más.'])('rejects an AI reply copying a journey instruction: %s', async (leak) => {
    aiEnabled = true;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: {
      content: JSON.stringify({ replyText: `${product.name}: ${leak}`, productNames: [product.name] }),
    } }] }) } as Response);
    const reply = await runtime.generateReply({ tenantId: 'tenant-1', inboundText: product.name });
    expect(reply.replyText).not.toContain(leak);
    expect(reply.replyText).toContain('¿Te lo preparo?');
    expect(reply.usedAi).not.toBe(true);
    expect(reply.images).toEqual([]);
  });
});
