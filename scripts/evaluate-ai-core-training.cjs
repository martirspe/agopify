/**
 * Offline AI Core training curriculum (gap matrix, multinicho).
 * Run after build: node scripts/evaluate-ai-core-training.cjs
 * Or: npm run train:ai-core
 *
 * No DB, network, secrets or real orders.
 */
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { Logger } = require('@nestjs/common');

const root = join(__dirname, '..');
const { SalesAgentRuntimeService } = require(join(
  root,
  'apps/api/dist/agent-runtime/sales-agent-runtime.service.js',
));
const { SalesAgentToolsService } = require(join(
  root,
  'apps/api/dist/agent-runtime/sales-agent-tools.service.js',
));
const { initialSalesState, observeBuyer } = require(join(
  root,
  'apps/api/dist/agent-runtime/sales-state.js',
));
const {
  evaluateSalesTurn,
  aggregateSalesEvaluations,
} = require(join(root, 'apps/api/dist/agent-runtime/sales-evaluation.js'));

Logger.overrideLogger(false);

const RATE_METRICS = new Set([
  'repeated_question_rate',
  'hallucination_rate',
]);

function product(id, name, cents, extra = {}) {
  return {
    id,
    handle: id,
    name,
    descriptionShort: extra.descriptionShort ?? 'Para uso diario',
    basePriceCents: cents,
    currency: 'PEN',
    categories: extra.categories ?? ['General'],
    isAvailable: extra.isAvailable !== false,
    stockUnlimited: false,
    stockQty: extra.stockQty ?? 2,
    stockLabel: extra.stockLabel ?? `${extra.stockQty ?? 2} en stock`,
    priceLabel: `S/ ${(cents / 100).toFixed(2)}`,
    isService: false,
    productUrl: null,
    imageUrl: extra.imageUrl ?? null,
    variants: extra.variants === null ? [] : (extra.variants ?? [
      {
        id: `${id}-v`,
        label: 'Único',
        isAvailable: true,
        priceCents: cents,
        priceLabel: `S/ ${(cents / 100).toFixed(2)}`,
        stockLabel: `${extra.stockQty ?? 2} en stock`,
      },
    ]),
  };
}

const CATALOGS = {
  footwear: [
    product('shoe-a', 'Zapatilla Runner A', 18000, {
      descriptionShort: 'Amortiguación para correr',
      categories: ['Zapatillas'],
      variants: null,
      imageUrl: 'https://cdn.example.test/shoe-a.jpg',
    }),
    product('shoe-b', 'Zapatilla Urbana B', 15000, {
      categories: ['Zapatillas'],
      variants: null,
      imageUrl: 'https://cdn.example.test/shoe-b.jpg',
    }),
  ],
  'footwear-oos': [
    product('shoe-a', 'Zapatilla Runner A', 18000, {
      categories: ['Zapatillas'],
      variants: null,
    }),
    product('ghost', 'Zapatilla Agotada Ghost', 12000, {
      categories: ['Zapatillas'],
      isAvailable: false,
      stockQty: 0,
      stockLabel: 'Agotado',
      variants: null,
    }),
  ],
  beauty: [
    product('perfume-a', 'Perfume Floral A', 8900, {
      descriptionShort: 'Floral amaderado de larga duración',
      categories: ['Perfumes'],
      variants: null,
      imageUrl: 'https://cdn.example.test/perfume-a.jpg',
    }),
    product('perfume-b', 'Perfume Floral B', 9200, {
      categories: ['Perfumes'],
      variants: null,
      imageUrl: 'https://cdn.example.test/perfume-b.jpg',
    }),
    product('deo-unit', 'Desodorante Roll On Hombre', 4600, {
      descriptionShort: 'Desodorante roll on',
      categories: ['Cuidado'],
      variants: null,
    }),
    product('deo-set', 'Set Cuidado Hombre', 9890, {
      descriptionShort: 'Eau de parfum + Desodorante Roll On Hombre',
      categories: ['Cuidado'],
      variants: null,
    }),
  ],
  grocery: [
    product('coffee', 'Café de Altura 250g', 2800, {
      categories: ['Café'],
      variants: null,
      imageUrl: 'https://cdn.example.test/coffee.jpg',
    }),
    product('coffee-pack', 'Pack Café + Taza', 4500, {
      categories: ['Café'],
      variants: null,
    }),
  ],
};

function loadDataset() {
  const raw = JSON.parse(
    readFileSync(join(root, 'docs/agent/evals/ai-core-training.json'), 'utf8'),
  );
  if (!raw?.cases?.length) {
    throw new Error('Invalid ai-core-training dataset');
  }
  return raw;
}

function buildRuntime(catalog) {
  const config = { get: (_key, fallback) => fallback };
  const tools = new SalesAgentToolsService(null, null, config);
  tools.listAvailableProducts = async () => catalog.filter((p) => p.isAvailable);
  tools.getProducts = async (_t, ids) =>
    catalog.filter((p) => ids.includes(p.id));
  tools.catalogOverview = async () => ({
    total: catalog.filter((p) => p.isAvailable).length,
    categories: [],
    storeUrl: null,
  });
  tools.browseProducts = async () => ({
    products: catalog.filter((p) => p.isAvailable).slice(0, 3),
    remaining: 0,
  });
  tools.shippingRules = async () => ({
    deliveryEnabled: true,
    freeShippingFromCents: null,
    pickupEnabled: false,
    pickupAddress: null,
    shippingOriginUbigeo: '150122',
    carrierRates: { olva: [900, 1200, 1600, 2200, 2800] },
  });
  tools.createOrderWithOptionalLink = async () => ({
    traces: [{ name: 'create_order', status: 'ok', summary: 'fixture' }],
    orderId: 'order-training',
    checkoutUrl: 'https://example.test/pay',
    dryRun: true,
  });
  tools.listActivePublishedDiscounts = async () => ({
    discounts: [],
    trace: {
      name: 'list_promotions',
      status: 'skipped',
      summary: 'Sin descuentos publicados y activos',
      data: { count: 0, ids: [] },
    },
  });
  const runtime = new SalesAgentRuntimeService(
    { salesAgent: { findFirst: async () => null } },
    config,
    tools,
    { getRuntimeKnowledge: async () => ({ faqs: [], journeys: [] }) },
  );
  return runtime;
}

function seedState(fixture) {
  let state = initialSalesState();
  for (const [i, text] of (fixture.history ?? []).entries()) {
    state = observeBuyer(state, text, `train-${i}`);
  }
  if (fixture.recommended) state.recommendedProductIds = fixture.recommended;
  if (fixture.selected) state.selectedProduct = { productId: fixture.selected };
  if (fixture.seedStage) state.stage = fixture.seedStage;
  if (fixture.seedIntent) state.intent = fixture.seedIntent;
  if (fixture.pendingLines) state.pendingLines = fixture.pendingLines;
  if (fixture.seedOrderId) state.orderId = fixture.seedOrderId;
  if (fixture.missingInformation) {
    state.missingInformation = fixture.missingInformation;
  }
  if (fixture.seedNeed) {
    state.requirements.need = {
      value: fixture.seedNeed,
      source: 'train',
      confidence: 1,
      timestamp: new Date().toISOString(),
      scope: 'conversation',
    };
  }
  return state;
}

function failedMetrics(metrics) {
  if (!metrics) return true;
  return Object.entries(metrics).some(([name, score]) =>
    RATE_METRICS.has(name) ? score !== 0 : score !== 1,
  );
}

async function runSingleTurn(runtime, catalog, fixture, globalForbidden) {
  const state = seedState(fixture);
  const history = (fixture.agentHistory ?? []).map((text) => ({
    role: 'agent',
    text,
  }));
  const result = await runtime.generateReply({
    tenantId: 'fixture',
    inboundText: fixture.text,
    mode: 'playground',
    salesState: state,
    history,
    allowAi: false,
  });
  const expected = {
    ...fixture.expected,
    replyExcludes: [
      ...new Set([
        ...(globalForbidden ?? []),
        ...(fixture.expected?.replyExcludes ?? []),
      ]),
    ],
  };
  return {
    result,
    metrics: evaluateSalesTurn(result, catalog, expected),
  };
}

async function runMultiTurn(runtime, catalog, fixture, globalForbidden) {
  let state = seedState(fixture);
  let history = (fixture.agentHistory ?? []).map((text) => ({
    role: 'agent',
    text,
  }));
  let result = null;
  for (const turn of fixture.turns) {
    if (turn.role === 'agent') {
      history = [...history, { role: 'agent', text: turn.text }];
      continue;
    }
    result = await runtime.generateReply({
      tenantId: 'fixture',
      inboundText: turn.text,
      mode: 'playground',
      salesState: state,
      history,
      allowAi: false,
    });
    if (result.salesState) state = result.salesState;
    history = [
      ...history,
      { role: 'buyer', text: turn.text },
      { role: 'agent', text: result.replyText },
    ];
  }
  if (!result) throw new Error(`No buyer turns in ${fixture.id}`);
  const expected = {
    ...fixture.expected,
    replyExcludes: [
      ...new Set([
        ...(globalForbidden ?? []),
        ...(fixture.expected?.replyExcludes ?? []),
      ]),
    ],
  };
  return {
    result,
    metrics: evaluateSalesTurn(result, catalog, expected),
  };
}

async function main() {
  const dataset = loadDataset();
  const cases = [];
  const gapsSeen = new Set();

  for (const fixture of dataset.cases) {
    if (fixture.gap) gapsSeen.add(fixture.gap);
    const catalogKey = fixture.catalog ?? 'footwear';
    const catalog = CATALOGS[catalogKey];
    if (!catalog) {
      throw new Error(`Unknown catalog ${catalogKey} in ${fixture.id}`);
    }
    const runtime = buildRuntime(catalog);
    const { result, metrics } = fixture.turns?.length
      ? await runMultiTurn(
          runtime,
          catalog,
          fixture,
          dataset.forbiddenPhrases,
        )
      : await runSingleTurn(
          runtime,
          catalog,
          fixture,
          dataset.forbiddenPhrases,
        );

    const failed = failedMetrics(metrics);
    cases.push({
      id: fixture.id,
      gap: fixture.gap ?? null,
      vertical: fixture.vertical ?? null,
      failed,
      replyPreview: result.replyText.slice(0, 160),
      selectedProductId: result.salesState?.selectedProduct?.productId ?? null,
      metrics,
    });
  }

  const failures = cases.filter((c) => c.failed);
  const report = {
    mode: 'ai-core-training-offline',
    datasetVersion: dataset.version,
    dataset: dataset.dataset,
    fixtureCount: dataset.cases.length,
    gapsCovered: [...gapsSeen].sort(),
    verticals: [
      ...new Set(cases.map((c) => c.vertical).filter(Boolean)),
    ].sort(),
    passCount: cases.length - failures.length,
    failCount: failures.length,
    metrics: aggregateSalesEvaluations(
      cases.flatMap((c) => (c.metrics ? [c.metrics] : [])),
    ),
    failures: failures.map((c) => ({
      id: c.id,
      gap: c.gap,
      vertical: c.vertical,
      selectedProductId: c.selectedProductId,
      replyPreview: c.replyPreview,
      metrics: c.metrics,
    })),
    cases,
  };

  const reportPath = join(
    root,
    'docs/agent/evals/ai-core-training-report.json',
  );
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const summary = {
    pass: report.passCount,
    fail: report.failCount,
    gapsCovered: report.gapsCovered,
    verticals: report.verticals,
    report: 'docs/agent/evals/ai-core-training-report.json',
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (failures.length) {
    process.stderr.write(
      `AI Core training failed (${failures.length}): ${failures
        .map((c) => c.id)
        .join(', ')}\n`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `AI Core training crashed: ${error instanceof Error ? error.stack ?? error.message : error}\n`,
  );
  process.exitCode = 1;
});
