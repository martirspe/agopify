import { ExplicitFact, SalesState } from './sales-state';

/** Keys that may persist across sessions (never price/stock/payment). */
export const CUSTOMER_DURABLE_KEYS = new Set([
  'name',
  'explicitPreference',
  'destination',
  'address',
]);

/** Strip non-durable or dynamic commercial facts before persistence. */
export function durableCustomerFacts(
  facts: Record<string, ExplicitFact>,
): Record<string, ExplicitFact> {
  return Object.fromEntries(
    Object.entries(facts).filter(
      ([key, fact]) =>
        CUSTOMER_DURABLE_KEYS.has(key) &&
        fact.scope === 'customer' &&
        fact.confidence === 1 &&
        !isDynamicCommerceKey(key),
    ),
  );
}

function isDynamicCommerceKey(key: string): boolean {
  return /^(price|stock|shipping|payment|order|variant|product)/i.test(key);
}

/** Conversation-scoped commercial prefs that survive a topic change. */
const TOPIC_KEEP_REQUIREMENT_KEYS = new Set(['budget', 'destination', 'address']);

/**
 * Merge tenant-scoped customer memory into conversation state.
 * Expired facts are dropped. Dynamic catalog facts are never sourced from memory.
 */
export function mergeCustomerMemory(
  state: SalesState,
  memory: Record<string, ExplicitFact>,
  now = new Date(),
): SalesState {
  const next = structuredClone(state);
  const nowMs = now.getTime();
  for (const [key, fact] of Object.entries(durableCustomerFacts(memory))) {
    if (fact.expiresAt && new Date(fact.expiresAt).getTime() <= nowMs) continue;
    // Conversation-turn facts win over older memory for the same key.
    if (next.customerFacts[key] && !isOlderFact(next.customerFacts[key], fact))
      continue;
    next.customerFacts[key] = {
      ...fact,
      scope: 'customer',
    };
    if (!next.answeredQuestions[key]) next.answeredQuestions[key] = fact.value;
  }
  return next;
}

function isOlderFact(current: ExplicitFact, incoming: ExplicitFact): boolean {
  return (
    new Date(current.timestamp).getTime() < new Date(incoming.timestamp).getTime()
  );
}

/**
 * Topic change: start a new product thread while keeping durable customer context
 * and non-product requirements (budget/destination).
 */
export function applyTopicChange(state: SalesState): SalesState {
  const next = structuredClone(state);
  next.previousRecommendedProductIds = next.recommendedProductIds;
  next.previousSelectedProductId = next.selectedProduct?.productId;
  if (next.selectedProduct) {
    next.rejectedProducts = [
      ...next.rejectedProducts,
      {
        productId: next.selectedProduct.productId,
        reason: 'topic_change',
      },
    ].slice(-30);
  }
  next.selectedProduct = undefined;
  next.recommendedProductIds = [];
  next.pendingLines = [];
  next.requirements = Object.fromEntries(
    Object.entries(next.requirements).filter(([key]) =>
      TOPIC_KEEP_REQUIREMENT_KEYS.has(key),
    ),
  );
  delete next.requirements.need;
  delete next.answeredQuestions.need;
  delete next.answeredQuestions.size;
  delete next.answeredQuestions.color;
  next.intent = 'product_search';
  next.stage =
    next.stage === 'HUMAN_HANDOFF' || next.stage === 'LOST' || next.stage === 'WON'
      ? next.stage
      : 'DISCOVERY';
  next.nextBestAction = 'search_products';
  next.summary = {
    ...next.summary,
    situation: next.summary.situation
      ? `${next.summary.situation} · Nuevo tema de productos.`
      : 'El cliente cambió de categoría o necesidad.',
    unresolved: [
      ...new Set([...next.summary.unresolved, 'nueva_categoria']),
    ].slice(-8),
  };
  return next;
}

/** Prompt block so the model does not re-ask confirmed facts. */
export function knownFactsPromptBlock(state: SalesState | undefined): string {
  if (!state) return '';
  const facts = {
    ...Object.fromEntries(
      Object.entries(state.customerFacts).map(([k, f]) => [k, f.value]),
    ),
    ...Object.fromEntries(
      Object.entries(state.requirements).map(([k, f]) => [k, f.value]),
    ),
    ...state.answeredQuestions,
  };
  const lines = Object.entries(facts)
    .filter(([, value]) => value.trim())
    .slice(0, 12)
    .map(([key, value]) => `- ${key}: ${value}`);
  if (!lines.length) return '';
  return [
    'HECHOS YA CONFIRMADOS (no vuelvas a preguntarlos salvo contradicción explícita del cliente):',
    ...lines,
    'Si el cliente cambia un hecho, confirma el nuevo valor y descarta el anterior.',
  ].join('\n');
}

/**
 * Whether a draft agent question repeats a known fact (scenario B).
 * Allows confirmation language when the buyer just contradicted themselves.
 */
export function isRepeatedKnownQuestion(
  questionText: string,
  state: SalesState,
): boolean {
  const answered = {
    ...state.answeredQuestions,
    ...Object.fromEntries(
      Object.entries(state.requirements).map(([k, f]) => [k, f.value]),
    ),
    ...Object.fromEntries(
      Object.entries(state.customerFacts).map(([k, f]) => [k, f.value]),
    ),
  };
  const patterns: Record<string, RegExp> = {
    size: /\b(talla|tamano|medida)\b/,
    color: /\bcolor\b/,
    budget: /\b(presupuesto|cuanto.+gastar|maximo.+pagar)\b/,
    name: /\b(nombre|llamas|como te llamas)\b/,
    quantity: /\b(cuantas? (unidades|quieres)|cantidad)\b/,
    destination: /\b(distrito|provincia|ciudad|donde (?:vives|estas|envia))\b/,
    address: /\b(direccion)\b/,
  };
  for (const [key, regex] of Object.entries(patterns)) {
    if (!answered[key]) continue;
    if (!regex.test(questionText)) continue;
    if (
      /\b(confirm|cambias|cambiar|sigue|correcto|sigue siendo|aun es)\w*/.test(
        questionText,
      )
    ) {
      continue;
    }
    return true;
  }
  return false;
}
