import type { BuyerIntentId } from './buyer-intents';

/** Cheap orchestration lanes (v2): no extra LLM call to choose. */
export type ProcessingLane = 'fast' | 'standard' | 'complex';

export type LaneSignals = {
  conversationalIntent: 'greeting' | 'closing' | 'acknowledgement' | null;
  intents: string[];
  /** Ordinal / "ese" already resolved in code. */
  hasResolvedReference: boolean;
  pendingDeliveryQuestion: boolean;
  buying: boolean;
  humanOrComplaint: boolean;
};

const COMPLEX_INTENTS = new Set<string>([
  'objection',
  'purchase_intent',
  'negotiation',
  'product_comparison',
  'complaint',
  'human_request',
]);

/**
 * Picks the minimum viable processing lane from deterministic signals.
 * Fast: social / ordinal / pending yes-no style. Complex: multi-tool commercial.
 */
export function selectProcessingLane(signals: LaneSignals): ProcessingLane {
  if (signals.humanOrComplaint) return 'complex';
  if (
    signals.conversationalIntent === 'greeting' ||
    signals.conversationalIntent === 'closing' ||
    signals.conversationalIntent === 'acknowledgement'
  ) {
    return 'fast';
  }
  if (signals.pendingDeliveryQuestion && !signals.buying) return 'fast';
  if (
    signals.hasResolvedReference &&
    signals.intents.length <= 2 &&
    !signals.intents.some((intent) => COMPLEX_INTENTS.has(intent))
  ) {
    return 'fast';
  }
  const multi =
    signals.intents.filter((intent) =>
      [
        'price_inquiry',
        'stock_inquiry',
        'product_variant',
        'shipping_inquiry',
        'payment_inquiry',
        'order_inquiry',
      ].includes(intent),
    ).length >= 2;
  if (
    multi ||
    signals.buying ||
    signals.intents.some((intent) => COMPLEX_INTENTS.has(intent)) ||
    signals.intents.length >= 3
  ) {
    return 'complex';
  }
  return 'standard';
}

/** Spanish checklist injected into the model so compound questions are not dropped. */
export function multiQuestionPromptGuide(
  intents: Array<BuyerIntentId | string>,
): string {
  const labels: Partial<Record<string, string>> = {
    price_inquiry: 'precio actual',
    stock_inquiry: 'disponibilidad/stock',
    product_variant: 'talla/color/variante pedida',
    shipping_inquiry: 'envío (o pedir distrito si falta)',
    payment_inquiry: 'formas de pago publicadas',
    order_inquiry: 'estado del pedido de esta conversación',
    product_details: 'detalles del producto en catálogo',
    product_comparison: 'comparación entre opciones presentadas',
  };
  const needed = intents
    .map((intent) => labels[intent])
    .filter((label): label is string => Boolean(label));
  if (needed.length < 2) return '';
  return `El cliente hizo varias preguntas en este mensaje. Responde TODAS en el mismo mensaje, sin omitir ninguna: ${needed.join('; ')}.`;
}
