import { normalizeText } from './conversation-context';

/** Deterministic commercial intents detectable without an LLM. */
export const BUYER_INTENT_IDS = [
  'greeting',
  'goodbye',
  'human_request',
  'complaint',
  'purchase_intent',
  'objection',
  'confirmation',
  'rejection',
  'correction',
  'topic_change',
  'price_inquiry',
  'stock_inquiry',
  'product_variant',
  'shipping_inquiry',
  'payment_inquiry',
  'order_inquiry',
  'product_comparison',
  'product_recommendation',
  'product_search',
  'product_details',
  'general_inquiry',
] as const;

export type BuyerIntentId = (typeof BUYER_INTENT_IDS)[number];

export type BuyerIntentAnalysis = {
  /** Highest-priority intent for sales-stage routing (backward compatible). */
  primary: BuyerIntentId;
  /** All intents found in the message, primary first, unique. */
  intents: BuyerIntentId[];
  /** Rough clause count after splitting compound questions. */
  clauseCount: number;
};

const RULES: Array<{ id: BuyerIntentId; pattern: RegExp; priority: number }> = [
  {
    id: 'human_request',
    pattern: /\b(humano|asesor|persona|alguien|operador|atencion\s+humana|hablar\s+con\s+(?:una\s+)?persona)\b/,
    priority: 100,
  },
  {
    id: 'complaint',
    pattern: /\b(reclamo|queja|no\s+lleg[oa]|llego\s+mal|reembolso|estafa|denuncia)\b/,
    priority: 95,
  },
  {
    id: 'correction',
    pattern: /\b(me\s+equivoqu[eé]|queria\s+decir|mejor\s+(?:el|la|los|las)|no,?\s+el\s+otro|me\s+referia)\b/,
    priority: 90,
  },
  {
    id: 'rejection',
    pattern: /\b(no\s+quiero\s+ese|ya\s+no\s+quiero|cancela(?:r)?\s+la\s+compra|no\s+voy\s+a\s+comprar|descarta)\b/,
    priority: 88,
  },
  {
    id: 'purchase_intent',
    pattern:
      /\b(lo\s+quiero|la\s+quiero|los\s+quiero|las\s+quiero|comprar(?:lo|la|los|las)?|como\s+compro|quiero\s+pedir|quiero(?:\s+(?:solo|solamente))?\s+(?:un[oa]|\d{1,2}|dos|tres|cuatro)\b|(?:solo|solamente)\s+(?:un[oa]|\d{1,2}|dos|tres|cuatro)\b|separar(?:lo|la)?|link\s+de\s+pago|donde\s+pago)\b/,
    priority: 85,
  },
  {
    id: 'objection',
    pattern: /\b(muy\s+caro|demasiado\s+caro|carisimo|fuera\s+de\s+mi\s+presupuesto|no\s+confio|dudo)\b/,
    priority: 80,
  },
  {
    id: 'shipping_inquiry',
    pattern: /\b(envio|enviar|entrega|delivery|courier|olva|shalam|costo\s+de\s+envio|cuanto\s+(?:sale|cuesta)\s+(?:el\s+)?envio)\b/,
    priority: 70,
  },
  {
    id: 'payment_inquiry',
    pattern: /\b(yape|plin|tarjeta|transferencia|metodos?\s+de\s+pago|formas?\s+de\s+pago|pago\s+contra\s+entrega)\b/,
    priority: 68,
  },
  {
    id: 'order_inquiry',
    pattern: /\b(mi\s+pedido|estado\s+del\s+pedido|numero\s+de\s+pedido|seguimiento|tracking)\b/,
    priority: 66,
  },
  {
    id: 'price_inquiry',
    pattern: /\b(precio|cuesta|cuestan|cuanto\s+(?:vale|sale|es)|oferta|descuento|promocion)\b/,
    priority: 65,
  },
  {
    id: 'stock_inquiry',
    pattern: /\b(stock|disponib|hay\s+(?:en\s+)?(?:stock|tienda)|agotad|quedan)\b/,
    priority: 64,
  },
  {
    id: 'product_variant',
    pattern: /\b(talla|color|variante|en\s+negro|en\s+blanco|medida|tamano)\b/,
    priority: 62,
  },
  {
    id: 'product_comparison',
    pattern: /\b(compar(?:a|ar)|diferencia|cual\s+es\s+mejor|entre\s+(?:el|la|estos|esas))\b/,
    priority: 60,
  },
  {
    id: 'product_recommendation',
    pattern:
      /\b((?:cual|que)\s+(?:me\s+)?(?:recomiend\w*|aconsej\w*|sugier\w*)|recomienda|recomendarias|recomiendas|sugiere|que\s+me\s+consejas|para\s+regalar|cual\s+(?:es|seria)\s+(?:el\s+|la\s+)?mejor)\b/,
    priority: 58,
  },
  {
    id: 'topic_change',
    pattern: /\b(tambien\s+quiero\s+ver|cambiando\s+de\s+tema|ahora\s+busco|otra\s+cosa)\b/,
    priority: 55,
  },
  {
    id: 'product_search',
    // "quiero un protector" is search; "quiero uno" is quantity of the current pick (purchase_intent).
    pattern:
      /\b(?:busco|buscando|tienen|tienes|necesito|catalogo|mostrar)\b|\bquiero\s+(?:unos|unas|una|un)\s+\S/i,
    priority: 50,
  },
  {
    id: 'product_details',
    pattern: /\b(detalle|caracteristic|material|incluye|de\s+que\s+esta\s+hecho|como\s+es)\b/,
    priority: 48,
  },
  {
    id: 'confirmation',
    pattern: /^(si+|claro|dale|listo|ok|va|de\s+una)(?:\s|$)/,
    priority: 40,
  },
  {
    id: 'greeting',
    pattern: /^(?:hola+|holi|holis|hey|buenas|buen\s+dia|buenos\s+dias|buenas\s+tardes|buenas\s+noches)(?:\s|$)/,
    priority: 30,
  },
  {
    id: 'goodbye',
    pattern: /\b(chau|chao|adios|hasta\s+luego|bye|gracias(?:\s+por\s+todo)?)\b/,
    priority: 25,
  },
];

/** Split compound buyer messages into clauses without dropping short answers. */
export function splitBuyerClauses(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const parts = normalized
    .split(/\?+|!+|(?:\s+y\s+(?=cuanto|tienes|tienen|hay|envio|precio|talla|color))|(?:\s+(?:ademas|tambien)\s+)/)
    .map((part) => part.replace(/^[,.\s]+|[,.\s]+$/g, '').trim())
    .filter((part) => part.length >= 2);
  return parts.length ? parts : [normalized];
}

function matchIntents(clause: string): BuyerIntentId[] {
  const hits = RULES.filter((rule) => rule.pattern.test(clause)).sort(
    (a, b) => b.priority - a.priority,
  );
  return hits.map((hit) => hit.id);
}

/**
 * Detects one or more commercial intents in a single buyer message.
 * Never invents intents; defaults to general_inquiry when nothing matches.
 */
export function extractBuyerIntents(text: string): BuyerIntentAnalysis {
  const clauses = splitBuyerClauses(text);
  const found: BuyerIntentId[] = [];
  for (const clause of clauses) {
    for (const intent of matchIntents(clause)) {
      if (!found.includes(intent)) found.push(intent);
    }
  }
  if (!found.length) {
    return {
      primary: 'general_inquiry',
      intents: ['general_inquiry'],
      clauseCount: clauses.length || 1,
    };
  }
  const ranked = [...found].sort((a, b) => {
    const pa = RULES.find((rule) => rule.id === a)?.priority ?? 0;
    const pb = RULES.find((rule) => rule.id === b)?.priority ?? 0;
    return pb - pa;
  });
  return {
    primary: ranked[0],
    intents: ranked,
    clauseCount: clauses.length,
  };
}

/** Maps detailed buyer intents onto the compact sales-state intent string. */
export function toSalesStateIntent(primary: BuyerIntentId): string {
  switch (primary) {
    case 'purchase_intent':
    case 'confirmation':
      return 'purchase';
    case 'objection':
      return 'price_objection';
    case 'rejection':
      return 'cancel';
    case 'human_request':
    case 'complaint':
      return 'handoff';
    case 'price_inquiry':
    case 'stock_inquiry':
    case 'product_variant':
    case 'shipping_inquiry':
    case 'payment_inquiry':
    case 'order_inquiry':
    case 'product_details':
    case 'product_comparison':
      return 'product_question';
    case 'product_search':
    case 'product_recommendation':
    case 'topic_change':
      return 'product_search';
    default:
      return 'unknown';
  }
}
