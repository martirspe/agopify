import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  SalesAgentToolsService,
  CatalogProductView,
} from './sales-agent-tools.service';
import { SalesAgentRuntimeService } from './sales-agent-runtime.service';
import {
  initialSalesState,
  observeBuyer,
  resolveSalesReference,
  completeSalesTurn,
} from './sales-state';
import { validateSalesResponse } from './sales-response-validator';
import { contextMessages } from './sales-context';
import {
  aggregateSalesEvaluations,
  evaluateSalesTurn,
} from './sales-evaluation';
import { createTestAiModelRouter } from './models/ai-model.test-utils';

export const shoe = (
  id: string,
  name: string,
  cents = 15000,
): CatalogProductView => ({
  id,
  handle: id,
  name,
  basePriceCents: cents,
  currency: 'PEN',
  descriptionShort: 'Para uso diario',
  categories: ['Zapatillas'],
  isAvailable: true,
  stockUnlimited: false,
  stockQty: 2,
  stockLabel: '2 en stock',
  priceLabel: `S/ ${(cents / 100).toFixed(2)}`,
  isService: false,
  productUrl: null,
  imageUrl: null,
  variants: [
    {
      id: `${id}-v40`,
      label: 'Negro / 40',
      priceCents: cents,
      priceLabel: `S/ ${(cents / 100).toFixed(2)}`,
      stockLabel: '2 en stock',
      isAvailable: true,
    },
  ],
});

describe('AI Sales Engine regression/evaluation', () => {
  let runtime: SalesAgentRuntimeService;
  let tools: SalesAgentToolsService;
  const products = [
    shoe('one', 'Zapatilla negra Uno'),
    shoe('two', 'Zapatilla negra Dos', 16000),
  ];
  beforeEach(() => {
    tools = new SalesAgentToolsService(
      null as never,
      null as never,
      null as never,
    );
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue(products);
    jest
      .spyOn(tools, 'getProducts')
      .mockImplementation(async (_tenant, ids) =>
        products.filter((product) => ids.includes(product.id)),
      );
    jest
      .spyOn(tools, 'catalogOverview')
      .mockResolvedValue({ total: 2, categories: [], storeUrl: null });
    jest.spyOn(tools, 'shippingRules').mockResolvedValue(null);
    jest
      .spyOn(tools, 'createOrderWithOptionalLink')
      .mockResolvedValue({
        traces: [{ name: 'create_order', status: 'ok', summary: 'fixture' }],
        orderId: 'order',
        checkoutUrl: 'https://example.test/pay',
        dryRun: true,
      });
    const config = { get: (_key: string, value: unknown) => value } as ConfigService;
    runtime = new SalesAgentRuntimeService(
      {
        salesAgent: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      config,
      tools,
      {
        getRuntimeKnowledge: async () => ({ faqs: [], journeys: [] }),
      } as unknown as KnowledgeService,
      undefined,
      createTestAiModelRouter(config),
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('B: observeBuyer remembers need on “quiero comprar un X” (first turn)', () => {
    const state = observeBuyer(
      initialSalesState(),
      'Quiero comprar un perfume cielo para mujer',
      'm1',
    );
    expect(state.requirements.need?.value.toLowerCase()).toContain('cielo');
    const shoes = observeBuyer(
      initialSalesState(),
      'Quiero comprar unas zapatillas runner',
      'm2',
    );
    expect(shoes.requirements.need?.value.toLowerCase()).toContain('zapatillas');
  });

  it('B: validator rejects re-asking destination already in customer memory', () => {
    const state = observeBuyer(
      initialSalesState(),
      'Me llamo Ana. Vivo en Miraflores, Lima',
      'm1',
    );
    expect(state.answeredQuestions.destination).toContain('Miraflores');
    expect(
      validateSalesResponse(
        '¿Para qué distrito te envío?',
        [products[0].name],
        products,
        state,
      ),
    ).toContain('repeated_question');
  });

  it('E: topic change keeps name/destination while clearing product selection', () => {
    let state = observeBuyer(
      initialSalesState(),
      'Me llamo Ana. Busco zapatillas talla 40. Vivo en Miraflores, Lima',
      'm1',
    );
    state.selectedProduct = { productId: 'one' };
    state.recommendedProductIds = ['one', 'two'];
    state = observeBuyer(state, 'Ahora busco mochilas', 'm2');
    expect(state.selectedProduct).toBeUndefined();
    expect(state.customerFacts.name?.value).toBe('Ana');
    expect(state.customerFacts.destination?.value).toContain('Miraflores');
    expect(state.requirements.size).toBeUndefined();
    expect(state.requirements.need?.value.toLowerCase()).toContain('mochilas');
  });

  it('A/F: retains size, color and budget without history and without asking them again', async () => {
    const state = observeBuyer(
      initialSalesState(),
      'Busco zapatillas negras talla 40 máximo 180',
      'old-message',
    );
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: '¿Qué tienes?',
      salesState: state,
      history: [],
    });
    expect(result.salesState?.requirements.size.value).toBe('40');
    expect(result.salesState?.requirements.budget.value).toBe('18000');
    expect(
      validateSalesResponse(
        result.replyText,
        products.map((p) => p.name),
        products,
        result.salesState,
      ),
    ).not.toContain('repeated_question');
    expect(tools.listAvailableProducts).toHaveBeenCalledWith(
      'tenant-a',
      [],
      [],
      'Busco zapatillas negras talla 40 máximo 180',
      undefined,
    );
    expect(result.salesState?.recommendedProductIds).toEqual(['one', 'two']);
    const evaluation = evaluateSalesTurn(result, products, {
      facts: { size: '40', budget: '18000', color: 'negra' },
      productIds: ['one', 'two'],
      stage: 'RECOMMENDATION',
      handoff: false,
      progressed: true,
      allowedTools: [
        'search_catalog',
        'get_product_availability',
        'lookup_faq',
      ],
    });
    expect(evaluation.context_retention).toBe(1);
    expect(evaluation.repeated_question_rate).toBe(0);
    expect(
      aggregateSalesEvaluations([evaluation]).reference_resolution_accuracy
        .value,
    ).toBeNull();
  });
  it('B: resolves the second previously shown product after recent history eviction', async () => {
    const state = initialSalesState();
    state.recommendedProductIds = ['one', 'two'];
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Me gusta el segundo',
      salesState: state,
    });
    expect(result.salesState?.selectedProduct?.productId).toBe('two');
    expect(result.salesState?.stage).toBe('PRODUCT_SELECTED');
    expect(result.replyText).toContain(products[1].name);
  });
  it('B: “sí, sólo uno” after prepare/reserve keeps selection and advances checkout', async () => {
    const deo = shoe('deo', 'Temptation Desodorante Roll on', 4600);
    deo.variants = [];
    const bundle = shoe('set', 'Set Temptation Hombre', 12000);
    bundle.variants = [];
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([deo, bundle]);
    const state = initialSalesState();
    state.recommendedProductIds = ['deo', 'set'];
    state.selectedProduct = { productId: 'deo' };
    state.stage = 'PRODUCT_SELECTED';
    const afterQty = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Si, sólo uno',
      salesState: state,
      history: [
        {
          role: 'agent',
          text: 'Perfecto, el desodorante cuesta S/ 46. ¿Quieres que te lo prepare para la compra?',
        },
      ],
    });
    expect(afterQty.replyText).not.toContain('Cuéntame qué producto buscas');
    expect(afterQty.salesState?.selectedProduct?.productId).toBe('deo');
    expect(afterQty.salesState?.requirements.quantity?.value).toBe('1');

    const afterYes = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Si',
      salesState: {
        ...afterQty.salesState!,
        selectedProduct: { productId: 'deo' },
        stage: 'PRODUCT_SELECTED',
      },
      history: [
        {
          role: 'agent',
          text: 'Te preparo el desodorante. ¿Quieres que te lo reserve para la compra?',
        },
      ],
    });
    expect(afterYes.replyText).not.toContain('Cuéntame qué producto buscas');
    expect(afterYes.salesState?.selectedProduct?.productId).toBe('deo');
  });

  it('B: soft decline after prepare does not checkout (multinicho)', async () => {
    const runner = { ...products[0], variants: [] };
    const perfume = shoe('perfume', 'Perfume Floral A', 8900);
    perfume.variants = [];
    jest
      .spyOn(tools, 'listAvailableProducts')
      .mockResolvedValue([runner, perfume]);

    const declinedShoe = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'No gracias, después',
      salesState: {
        ...initialSalesState(),
        selectedProduct: { productId: 'one' },
        recommendedProductIds: ['one'],
        stage: 'PRODUCT_SELECTED',
      },
      history: [
        { role: 'agent', text: 'La zapatilla cuesta S/ 150. ¿Te lo preparo?' },
      ],
    });
    expect(declinedShoe.checkoutUrl).toBeUndefined();
    expect(declinedShoe.salesState?.selectedProduct).toBeUndefined();
    expect(declinedShoe.replyText).toMatch(/Sin problema/i);

    const declinedPerfume = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Luego',
      salesState: {
        ...initialSalesState(),
        selectedProduct: { productId: 'perfume' },
        recommendedProductIds: ['perfume'],
        stage: 'PRODUCT_SELECTED',
      },
      history: [
        {
          role: 'agent',
          text: 'El perfume está listo. ¿Quieres que te lo prepare para la compra?',
        },
      ],
    });
    expect(declinedPerfume.checkoutUrl).toBeUndefined();
    expect(declinedPerfume.replyText).toMatch(/Sin problema/i);
  });

  it('B: price + shipping multi-intent keeps selection (multinicho)', async () => {
    const simple = { ...products[0], variants: [] };
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([simple]);
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Cuánto cuesta y cuánto sale el envío?',
      salesState: {
        ...initialSalesState(),
        selectedProduct: { productId: 'one' },
        recommendedProductIds: ['one'],
        stage: 'PRODUCT_SELECTED',
      },
    });
    expect(result.salesState?.selectedProduct?.productId).toBe('one');
    expect(result.salesState?.intents).toEqual(
      expect.arrayContaining(['price_inquiry', 'shipping_inquiry']),
    );
    expect(result.replyText).toMatch(/S\//);
    expect(result.replyText).toMatch(/distrito/i);
    expect(result.replyText).not.toContain('Cuéntame qué producto buscas');
  });

  it('B: “cuál me recomiendas de todos” picks among recommended (multinicho)', async () => {
    const aura = shoe('aura', 'Aura Lila Perfume de Mujer', 8900);
    aura.variants = [];
    aura.descriptionShort = 'Floral amaderado de larga duración';
    const vibranza = shoe('vibranza', 'Vibranza Blanc Perfume', 9200);
    vibranza.variants = [];
    const runner = shoe('runner', 'Zapatilla Runner Pro', 18000);
    runner.variants = [];
    runner.descriptionShort = 'Amortiguación para correr';
    const urban = shoe('urban', 'Zapatilla Urbana', 15000);
    urban.variants = [];
    jest
      .spyOn(tools, 'listAvailableProducts')
      .mockResolvedValue([aura, vibranza, runner, urban]);

    const perfume = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Cual me recomiendas de todos?',
      salesState: {
        ...initialSalesState(),
        recommendedProductIds: ['aura', 'vibranza'],
        stage: 'RECOMMENDATION',
        requirements: {
          need: {
            value: 'perfume fuerte para novia',
            source: 'buyer',
            confidence: 1,
            timestamp: new Date().toISOString(),
            scope: 'conversation',
          },
        },
      },
      history: [
        {
          role: 'agent',
          text: 'Te recomiendo Aura Lila y Vibranza Blanc. ¿Cuál te gustaría que te prepare?',
        },
      ],
    });
    expect(perfume.replyText).not.toContain('Cuéntame qué producto buscas');
    expect(perfume.replyText).toMatch(/Aura Lila/i);
    expect(perfume.salesState?.selectedProduct?.productId).toBe('aura');

    const shoes = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Cuál es el mejor de estos?',
      salesState: {
        ...initialSalesState(),
        recommendedProductIds: ['runner', 'urban'],
        stage: 'RECOMMENDATION',
      },
      history: [
        {
          role: 'agent',
          text: 'Te muestro Runner Pro y Urbana. ¿Cuál prefieres?',
        },
      ],
    });
    expect(shoes.replyText).not.toContain('Cuéntame qué producto buscas');
    expect(shoes.replyText).toMatch(/Runner Pro/i);
    expect(shoes.salesState?.selectedProduct?.productId).toBe('runner');
  });

  it('B: “no, quiero solo” after set prepare switches to unit SKU (multinicho)', async () => {
    const deo = shoe('deo', 'Temptation Desodorante Roll on Hombre', 4600);
    deo.variants = [];
    deo.descriptionShort = 'Desodorante roll on';
    const set = shoe('set', 'Set Temptation Hombre', 9890);
    set.variants = [];
    set.descriptionShort =
      'Temptation Eau de Parfum + Temptation Desodorante Roll on Hombre';
    const coffee = shoe('coffee', 'Café de Altura 250g', 2800);
    coffee.variants = [];
    const pack = shoe('pack', 'Pack Café + Taza', 4500);
    pack.variants = [];
    const cielo = shoe('cielo', 'Cielo Eau de Parfum 50 ml', 8900);
    cielo.variants = [];
    cielo.categories = ['Perfumes'];
    const cieloSet = shoe('cielo-set', 'Set Cielo', 12900);
    cieloSet.variants = [];
    cieloSet.categories = ['Perfumes'];
    cieloSet.descriptionShort = 'Cielo Eau de Parfum + desodorante y jabón';
    const aura = shoe('aura', 'Aura Lila Perfume', 7800);
    aura.variants = [];
    aura.categories = ['Perfumes'];
    const catalog = [deo, set, coffee, pack, cielo, cieloSet, aura];
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue(catalog);
    jest
      .spyOn(tools, 'getProducts')
      .mockImplementation(async (_tenant, ids) =>
        catalog.filter((product) => ids.includes(product.id)),
      );

    const afterSet = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'No, quiero solo',
      salesState: {
        ...initialSalesState(),
        recommendedProductIds: ['set'],
        selectedProduct: { productId: 'set' },
        stage: 'PRODUCT_SELECTED',
        requirements: {
          need: {
            value: 'desodorante',
            source: 'buyer',
            confidence: 1,
            timestamp: new Date().toISOString(),
            scope: 'conversation',
          },
        },
      },
      history: [
        {
          role: 'agent',
          text: 'Te recomiendo el Set Temptation Hombre. ¿Te lo preparo?',
        },
      ],
    });
    expect(afterSet.replyText).not.toMatch(/Encontré esto en el catálogo/i);
    expect(afterSet.replyText).not.toMatch(/Set Temptation/i);
    expect(afterSet.salesState?.selectedProduct?.productId).not.toBe('set');
    expect(afterSet.salesState?.requirements.packaging?.value).toBe(
      'standalone',
    );
    expect(afterSet.replyText).toMatch(/Desodorante|suelta|unitari/i);

    const afterCoffee = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'No quiero el pack, solo el cafe',
      salesState: {
        ...initialSalesState(),
        recommendedProductIds: ['pack'],
        selectedProduct: { productId: 'pack' },
        stage: 'PRODUCT_SELECTED',
      },
      history: [
        {
          role: 'agent',
          text: 'Tenemos el Pack Café + Taza. ¿Te lo preparo?',
        },
      ],
    });
    expect(afterCoffee.replyText).not.toMatch(/Pack Café/i);
    expect(afterCoffee.salesState?.requirements.packaging?.value).toBe(
      'standalone',
    );

    // Transcript gap: after offering the set, "sólo el perfume" must resolve the
    // unit of the same line — never unrelated featured fragrances.
    const afterCielo = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'No, quiero sólo el perfume',
      salesState: {
        ...initialSalesState(),
        recommendedProductIds: ['cielo-set'],
        selectedProduct: { productId: 'cielo-set' },
        stage: 'PRODUCT_SELECTED',
        requirements: {
          need: {
            value: 'Quiero comprar un perfume cielo para mujer',
            source: 'buyer',
            confidence: 1,
            timestamp: new Date().toISOString(),
            scope: 'conversation',
          },
        },
      },
      history: [
        {
          role: 'agent',
          text: 'Te recomiendo el Set Cielo. ¿Quieres que te lo prepare?',
        },
      ],
    });
    expect(afterCielo.replyText).toMatch(/Cielo Eau de Parfum/i);
    expect(afterCielo.replyText).not.toMatch(/Aura Lila/i);
    expect(afterCielo.replyText).not.toMatch(/Set Cielo/i);
    expect(afterCielo.salesState?.requirements.packaging?.value).toBe(
      'standalone',
    );

    const firstAsk = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Quiero comprar un perfume cielo para mujer',
      salesState: initialSalesState(),
      history: [],
    });
    expect(firstAsk.replyText).toMatch(/Cielo Eau de Parfum/i);
    expect(firstAsk.replyText).not.toMatch(/Set Cielo/i);
    expect(firstAsk.salesState?.requirements.need?.value).toMatch(/cielo/i);
  });

  it('B: “sí, quiero uno” after “¿te lo preparo?” keeps the selected product', async () => {
    const simple = {
      ...products[0],
      variants: [],
    };
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([simple]);
    const state = initialSalesState();
    state.selectedProduct = { productId: 'one' };
    state.recommendedProductIds = ['one'];
    state.stage = 'PRODUCT_SELECTED';
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Si, quiero uno',
      salesState: state,
      history: [
        {
          role: 'agent',
          text: 'El Total Block cuesta S/ 46.00. ¿Quieres que te lo prepare para comprar?',
        },
      ],
    });
    expect(result.replyText).not.toContain('Cuéntame qué producto buscas');
    expect(result.salesState?.selectedProduct?.productId).toBe('one');
    expect(result.salesState?.requirements.quantity?.value).toBe('1');
    expect(result.salesState?.intent).toBe('purchase');
    expect(
      result.salesState?.stage === 'CHECKOUT' ||
        result.salesState?.stage === 'PAYMENT_PENDING' ||
        Boolean(result.checkoutUrl) ||
        /distrito/i.test(result.replyText),
    ).toBe(true);
  });

  it('B: resolves “el último” / “me interesa el último” against presentation order', async () => {
    const three = [
      products[0],
      products[1],
      shoe('three', 'Zapatilla blanca Tres', 17000),
    ];
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue(three);
    const state = initialSalesState();
    state.recommendedProductIds = ['one', 'two', 'three'];
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Me interesa el último',
      salesState: state,
    });
    expect(result.salesState?.selectedProduct?.productId).toBe('three');
    expect(result.salesState?.stage).toBe('PRODUCT_SELECTED');
    expect(result.replyText).toContain('Zapatilla blanca Tres');
    expect(result.replyText).not.toContain(
      'Cuéntame qué producto buscas',
    );
  });
  it('J: an immediate purchase with size skips discovery and uses backend commerce', async () => {
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Quiero comprar Zapatilla negra Uno talla 40',
      salesState: initialSalesState(),
      assertOwned: jest.fn(),
    });
    expect(tools.createOrderWithOptionalLink).toHaveBeenCalled();
    expect(result.salesState?.stage).toBe('PAYMENT_PENDING');
    expect(result.salesState?.selectedProduct?.variantId).toBe('one-v40');
  });

  it('I: completeSalesTurn keeps orderDraftHash so retries reuse the same draft', () => {
    const state = observeBuyer(
      initialSalesState(),
      'Quiero comprar Zapatilla negra Uno talla 40',
      'm1',
    );
    const hash = 'a'.repeat(64);
    const next = completeSalesTurn(
      state,
      {
        tools: [
          {
            name: 'create_order',
            status: 'ok',
            summary: 'Pedido',
            data: { orderId: 'ord-1', orderDraftHash: hash, replayed: false },
          },
        ],
        escalate: false,
        orderId: 'ord-1',
        checkoutUrl: 'https://pay.example/1',
        orderDraftHash: hash,
      },
      5,
    );
    expect(next.orderId).toBe('ord-1');
    expect(next.orderDraftHash).toBe(hash);
    expect(next.stage).toBe('PAYMENT_PENDING');
  });
  it('H: never creates an order for an exhausted product', async () => {
    const exhausted = {
      ...products[0],
      isAvailable: false,
      stockQty: 0,
      stockLabel: 'Agotado',
      variants: [],
    };
    jest.spyOn(tools, 'listAvailableProducts').mockResolvedValue([exhausted]);
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Quiero comprar Zapatilla negra Uno',
      salesState: initialSalesState(),
    });
    expect(result.replyText).toContain('Agotado');
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });
  it('H: recommendations omit sold-out products from the offer list', async () => {
    const exhausted = {
      ...products[0],
      id: 'sold-out',
      handle: 'sold-out',
      name: 'Zapatilla agotada',
      isAvailable: false,
      stockQty: 0,
      stockLabel: 'Agotado',
      variants: [],
    };
    jest
      .spyOn(tools, 'listAvailableProducts')
      .mockResolvedValue([exhausted, products[0], products[1]]);
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Quiero comprar zapatillas',
      salesState: initialSalesState(),
    });
    expect(result.replyText).not.toMatch(/agotada|Agotado/i);
    expect(result.salesState?.recommendedProductIds ?? []).not.toContain(
      'sold-out',
    );
  });
  it('does not require a budget and preserves explicit changes of variant', () => {
    let state = observeBuyer(
      initialSalesState(),
      'Busco un perfume talla M',
      'm1',
    );
    expect(state.requirements.budget).toBeUndefined();
    state = observeBuyer(state, 'Mejor talla L', 'm2');
    expect(state.requirements.size.value).toBe('l');
  });
  it('does not promote a negated or ambiguous size into a confirmed choice', () => {
    expect(
      observeBuyer(
        initialSalesState(),
        'No talla 40, talla 41; no negro, rojo',
        'm',
      ).requirements.size.value,
    ).toBe('41');
    expect(
      observeBuyer(
        initialSalesState(),
        'No talla 40, talla 41; no negro, rojo',
        'm',
      ).requirements.color.value,
    ).toBe('rojo');
    expect(
      observeBuyer(initialSalesState(), 'Talla 40 o 41', 'm').requirements.size,
    ).toBeUndefined();
  });
  it('never substitutes the only available size for the requested unavailable size', async () => {
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Quiero comprar Zapatilla negra Uno talla 41',
      salesState: initialSalesState(),
    });
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
    expect(result.replyText).toContain('no está disponible');
  });
  it('handles price objections and rejects a changed selection', () => {
    const state = initialSalesState();
    state.selectedProduct = { productId: 'one' };
    const next = observeBuyer(state, 'Muy caro, cambio de opinión', 'm2');
    expect(next.stage).toBe('OBJECTION_HANDLING');
    expect(next.selectedProduct).toBeUndefined();
    expect(next.rejectedProducts[0].productId).toBe('one');
  });
  it('explicit human requests skip commerce and persist the reason', async () => {
    const result = await runtime.generateReply({
      tenantId: 'tenant-a',
      inboundText: 'Quiero hablar con un humano',
      salesState: initialSalesState(),
    });
    expect(result.escalate).toBe(true);
    expect(result.salesState?.stage).toBe('HUMAN_HANDOFF');
    expect(tools.createOrderWithOptionalLink).not.toHaveBeenCalled();
  });
  it('product removal cannot shift an ordinal onto another product', () => {
    const state = initialSalesState();
    state.recommendedProductIds = ['one', 'two'];
    expect(
      resolveSalesReference('el primero', state, [products[1]]),
    ).toBeNull();
    expect(resolveSalesReference('el segundo', state, [products[1]])?.id).toBe(
      'two',
    );
    state.recommendedProductIds = ['one', 'two', 'three'];
    expect(
      resolveSalesReference('el último', state, [products[0], products[1]]),
    ).toBeNull();
  });
  it('does not guess an ambiguous reference and resolves the cheapest from current prices', () => {
    const state = initialSalesState();
    state.recommendedProductIds = ['one', 'two'];
    expect(resolveSalesReference('ese', state, products)).toBeNull();
    expect(
      resolveSalesReference('el más barato', state, [
        products[0],
        { ...products[1], basePriceCents: 10000 },
      ])?.id,
    ).toBe('two');
  });
  it('incremental summaries keep decisions/facts without summarizing every turn', () => {
    const state = observeBuyer(initialSalesState(), 'Talla 40', 'm1');
    const result = { tools: [], escalate: false };
    const next = completeSalesTurn(state, result, 2);
    expect(next.summary.updatedAtTurn).toBe(0);
    const summarized = completeSalesTurn(next, result, 2);
    expect(summarized.summary.confirmedFacts.size).toBe('40');
    expect(summarized.summary.updatedAtTurn).toBe(2);
  });
  it.each([
    ['Tiene un precio de S/ 1.00', 'unsupported_price'],
    ['Está disponible en talla 41', 'unsupported_variant'],
    ['Tenemos 99 unidades en stock', 'unsupported_inventory_quantity'],
    ['El envío es gratis y llega en 2 días', 'unsupported_shipping'],
    ['Tienes garantía de por vida', 'unsupported_policy'],
    ['¿Qué talla buscas?', 'repeated_question'],
    ['Ya reservé tu pedido', 'unsupported_action'],
    [
      'Te recomiendo Cielo. El Ccori está agotado por ahora.',
      'unsupported_sold_out_mention',
    ],
  ])('rejects an ungrounded answer: %s', (text, failure) => {
    const state = observeBuyer(initialSalesState(), 'Talla 40', 'm1');
    expect(
      validateSalesResponse(text, [products[0].name], products, state),
    ).toContain(failure);
  });

  it('rejects invented payment-link offers and unpaid thank-yous', () => {
    const state = observeBuyer(initialSalesState(), 'Lo quiero', 'm1');
    state.selectedProduct = { productId: products[0].id };
    state.stage = 'CHECKOUT';
    state.orderId = 'ord-1';
    expect(
      validateSalesResponse(
        'Perfecto, te envío el link para que puedas pagar.',
        [products[0].name],
        products,
        state,
      ),
    ).toContain('unsupported_checkout_claim');
    expect(
      validateSalesResponse(
        '¿Quieres que te envíe el link para pagar?',
        [products[0].name],
        products,
        state,
      ),
    ).toContain('unsupported_checkout_claim');
    expect(
      validateSalesResponse(
        'Perfecto, muchas gracias por tu compra.',
        [products[0].name],
        products,
        state,
      ),
    ).toContain('unsupported_payment');
  });
  it('retains critical state/current message and drops whole history turns to meet the budget', () => {
    const state = observeBuyer(initialSalesState(), 'Talla 40', 'm1');
    const messages = contextMessages(
      'rules',
      { inboundText: '¿Qué tienes?' },
      state,
      Array.from({ length: 40 }, () => ({
        role: 'buyer' as const,
        text: 'long '.repeat(200),
      })),
      1500,
      20,
    );
    expect(messages.at(-1)?.content).toContain('40');
    expect(messages.length).toBeLessThan(20);
    expect(() =>
      contextMessages('critical'.repeat(1000), {}, state, [], 100, 20),
    ).toThrow('SALES_CONTEXT_BUDGET_EXCEEDED');
  });
});
