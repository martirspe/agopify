import { normalizeText, ConversationTurn } from './conversation-context';
import type { CatalogProductView } from './sales-agent-tools.service';
import type { SalesState } from './sales-state';

/**
 * Deterministic turn understanding for AI Core.
 * Priority: security/truth elsewhere; here we resolve what the buyer meant
 * relative to the seller's last ask and the products already on the table.
 */

export type AgentPendingAsk =
  | 'prepare_purchase'
  | 'choose_option'
  | 'district'
  | 'none';

export type TurnUnderstanding = {
  normalized: string;
  pendingAsk: AgentPendingAsk;
  /** Affirmative answer to "¿te lo preparo / reserve / link?". */
  confirmsPurchase: boolean;
  /** Explicit no / not that one / later. */
  declinesOffer: boolean;
  /** Parsed units when the buyer stated a quantity. */
  quantity: number | null;
  /** Short yes/dale without extra commercial content. */
  bareAffirmative: boolean;
  /** Buyer is picking among presented options (ordinal, "el solo", "ese", name fragment). */
  looksLikeOptionPick: boolean;
  /** Buyer asks the seller to choose among options already on the table. */
  asksSellerPick: boolean;
};

const QUANTITY_WORDS: Record<string, number> = {
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
};

const AFFIRMATIVE_CORE =
  /^(si+|claro|claro que si|ok|okey|oki|dale|ya|ya pues|ya dale|listo|va|de una|obvio|perfecto|bueno|porfa|por favor|si por favor|si porfa|si dale|si claro|si ya|sale|claro al toke|al toke|de una pues|vamos|hagamoslo|dale pues)$/;

const AFFIRMATIVE_WITH_TAIL =
  /^(si+|claro|dale|ya|listo|va|de una|obvio|perfecto|bueno|porfa|por favor|sale|al toke|vamos)(?:\s+(?:que\s+si|pues|porfa|por favor|al toke|estoy\s+apurad[oa]|rapido|ya))*(?:\s+(?:quiero(?:\s+(?:solo|solamente))?(?:\s+(?:un[oa]|\d{1,2}|dos|tres|cuatro|cinco|seis|ese|este|esa|esta|el|la))?|(?:solo|solamente)\s+(?:un[oa]|\d{1,2}|dos|tres|cuatro|cinco|seis)|lo\s+quiero|la\s+quiero|l[oa]\s+(?:llevo|compro|pido|reservo)|me\s+l[oa]\s+(?:llevo|compro)|asi\s+es|asi\s+mismo))?$/;

const DECLINE =
  /^(?:no+|no gracias|ahora no|luego|despues|mas tarde|dejalo|dejalo asi|paso|mejor no|no por ahora|todavia no)(?:\s+(?:gracias|luego|despues|mas tarde|por ahora|todavia|mejor))*$/;

/** Seller closed with a purchase offer. */
export const PREPARE_PURCHASE_ASK =
  /\b(te\s+(?:l[oa]s?\s+)?(prepar|separ|reserv|apart|envi|mand|pid)[oea]|l[oa]s?\s+(quieres|llevas|separo|preparo|reservo)|prepar[oe]\s+(el|tu)\s+pedido|para\s+la\s+compra|proceder\s+con\s+(la\s+compra|el\s+pago)|llevarl[oa]s?|hacer\s+(el|tu)\s+pedido|te\s+animas|pase\s+el\s+link|pasar\s+el\s+link|link\s+(?:para|de)\s+(?:que\s+)?(?:puedas\s+)?(?:hacer\s+)?(?:el\s+)?pago|te\s+paso\s+el\s+link|te\s+l[oa]\s+arm[oe]|lo\s+armamos|seguimos\s+con\s+(?:la\s+)?compra)\b/;

const CHOOSE_OPTION_ASK =
  /\b(cual\s+(?:prefieres|te\s+gusta|te\s+gustaria|elegis|eligen|quieres|te\s+queda|te\s+interesa)|cual\s+de\s+(?:estas|estos|ellos|ellas)|te\s+quedo\s+con|con\s+cual\s+te\s+quedas)\b/;

export function scrubBuyerReply(text: string): string {
  return normalizeText(text)
    .replace(/[\p{P}\p{S}\p{Extended_Pictographic}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectAgentPendingAsk(
  history: ConversationTurn[],
): AgentPendingAsk {
  const last = [...history].reverse().find((turn) => turn.role === 'agent');
  if (!last || last.paymentLink) return 'none';
  const text = normalizeText(last.text);
  if (text.includes('distrito')) return 'district';
  if (PREPARE_PURCHASE_ASK.test(text)) return 'prepare_purchase';
  if (CHOOSE_OPTION_ASK.test(text)) return 'choose_option';
  return 'none';
}

export function parseBuyerQuantity(text: string): number | null {
  const normalized = scrubBuyerReply(text);
  const match = normalized.match(
    /\b(?:quiero(?:\s+(?:solo|solamente))?|llevo|comprar|necesito|pido|solo|solamente|dame|mandame|envia(?:me)?)\s+(\d{1,2}|un[oa]|dos|tres|cuatro|cinco|seis)\b/,
  );
  if (!match) {
    const bare = normalized.match(
      /^(?:si+\s+)?(?:solo|solamente)\s+(\d{1,2}|un[oa]|dos|tres|cuatro|cinco|seis)$/,
    );
    if (!bare) return null;
    return QUANTITY_WORDS[bare[1]] ?? Number(bare[1]);
  }
  return QUANTITY_WORDS[match[1]] ?? Number(match[1]);
}

export function isPurchaseAffirmativeText(text: string): boolean {
  const reply = scrubBuyerReply(text);
  return AFFIRMATIVE_CORE.test(reply) || AFFIRMATIVE_WITH_TAIL.test(reply);
}

export function isDeclineText(text: string): boolean {
  return DECLINE.test(scrubBuyerReply(text));
}

/** Option-pick cues that should resolve against recommended products, not a new search. */
export function looksLikeOptionPick(text: string): boolean {
  const q = scrubBuyerReply(text);
  return (
    /\b(?:el|la)\s+(?:primer|segund|tercer|cuart|quint|ultim)/.test(q) ||
    /\b(?:el|la)\s+que\s+viene\s+solo\b/.test(q) ||
    /\b(?:el|la)\s+(?:individual|unitario|set|kit|pack|combo|completo|otro|otra)\b/.test(
      q,
    ) ||
    /\b(?:me\s+(?:interesa|gusta|quedo\s+con)|prefiero|voy\s+(?:con|por)|mejor\s+(?:el|la|ese|esa))\b/.test(
      q,
    ) ||
    // "quiero el/la X" after a list is selection, not checkout (unless comprar/link/llevo).
    (/\bquiero\s+(?:el|la|los|las|ese|esa|este|esta)\b/.test(q) &&
      !/\b(?:comprar|link|llevo|compro|pido|separ|reserv|apart)\b/.test(q)) ||
    /^(?:ese|esa|esto|este|esta|aquel|aquella)$/.test(q) ||
    /\bmas\s+(?:barato|caro)\b/.test(q)
  );
}

/**
 * Buyer named an option from the table ("quiero el X") without committing checkout.
 * Multinicho: structural "quiero el/la…" only — not "lo quiero" / "quiero comprarlo".
 */
export function isOptionSelectionOnly(text: string): boolean {
  const q = scrubBuyerReply(text);
  if (!q) return false;
  if (
    /\b(?:comprar(?:lo|la|los|las)?|l[oa]s?\s+quiero|l[oa]s?\s+(?:llevo|compro|pido)|dame\s+(?:el\s+)?link|pasame\s+(?:el\s+)?link)\b/.test(
      q,
    )
  ) {
    return false;
  }
  return looksLikeOptionPick(text) && /\bquiero\s+(?:el|la|los|las|ese|esa|este|esta)\b/.test(q);
}

/** Strong anaphora that already commits the current SKU (skip prepare → ask district). */
export function isPurchaseCommitAnaphora(text: string): boolean {
  const q = scrubBuyerReply(text);
  return /\b(?:l[oa]s?\s+quiero|l[oa]s?\s+(?:llevo|compro|pido)|(?:dame|pasame|mandame|enviame)\s+(?:el\s+)?link|quiero\s+comprar(?:lo|la|los|las))\b/.test(
    q,
  );
}

/**
 * Buyer starts a new catalog need ("quiero comprar un X", "busco Y", "quiero ver
 * perfumería", "muéstrame productos de…") rather than confirming the current SKU
 * ("comprarlo", "lo quiero", "dame el link", "muéstrame el producto").
 * Multinicho: structural patterns only — no category vocabulary.
 */
export function isOpenProductNeed(text: string): boolean {
  const n = scrubBuyerReply(text);
  if (!n) return false;
  if (
    /\b(?:comprar(?:lo|la|los|las)|l[oa]s?\s+quiero|l[oa]s?\s+(?:llevo|compro|pido)|dame\s+(?:el\s+)?link|pasame\s+(?:el\s+)?link|envia(?:me)?\s+(?:el\s+)?link)\b/.test(
      n,
    )
  ) {
    return false;
  }
  // Singular "muéstrame el producto" is presentation of the current SKU (E5), not a new search.
  if (
    /\b(?:muestra\w*|ensena\w*|ver|dame|manda\w*)\b.{0,40}\b(?:el\s+|la\s+|ese\s+|esta\s+|este\s+|esa\s+)?producto\b/.test(
      n,
    ) &&
    !/\bproductos\b/.test(n)
  ) {
    return false;
  }
  if (/\b(?:busco|buscando|necesito)\b/.test(n)) return true;
  if (/\bquiero\s+comprar(?:me)?\s+\S+/.test(n)) return true;
  if (/\bquiero\s+(?:unos|unas|una|un)\s+\S+/.test(n)) return true;
  if (
    /\bquiero\s+ver\b/.test(n) &&
    !/\b(?:el|la|ese|esta|este|esa)\s+producto\b/.test(n) &&
    !/\b(?:foto|fotos|fotito|fotitos|imagen|imagenes|como\s+se\s+ve|como\s+es)\b/.test(
      n,
    )
  ) {
    return true;
  }
  if (/\b(?:muestra\w*|ensena\w*|ver)\b.{0,48}\bproductos\b/.test(n)) {
    return true;
  }
  if (/\bque\s+(?:productos?\s+)?(?:tienen|tienes|hay)\b/.test(n)) return true;
  return false;
}

/** Buyer asks about discounts / offers / promotions (not a product name). */
export function asksAboutDiscount(text: string): boolean {
  return /\b(?:descuento|descuentos|oferta|ofertas|promocion|promociones|promo|promos|cupon|cupones)\b/.test(
    scrubBuyerReply(text),
  );
}

/**
 * Buyer wants to abort the unpaid order / checkout ("cancelar el pedido",
 * "ya no lo voy a comprar"). Multinicho — no category words.
 */
export function wantsCancelOrder(text: string): boolean {
  const q = scrubBuyerReply(text);
  if (!q) return false;
  return (
    /\b(?:cancela(?:r)?|anula(?:r)?)\s+(?:la\s+compra|el\s+pedido|mi\s+pedido|el\s+pago|la\s+orden)\b/.test(
      q,
    ) ||
    /\bya\s+no\s+(?:lo\s+|la\s+|los\s+|las\s+)?(?:voy\s+a\s+)?comprar\b/.test(
      q,
    ) ||
    /\bno\s+(?:lo\s+|la\s+)?voy\s+a\s+comprar\b/.test(q) ||
    /\bya\s+no\s+quiero\s+(?:comprar|el\s+pedido|ese|esa|esta|este)\b/.test(q)
  );
}

/**
 * Buyer asks the seller to choose among options already shown
 * ("cuál me recomiendas de todos", "tú cuál eliges", "cuál es mejor").
 * Niche-agnostic — does not name product categories.
 */
export function asksSellerRecommendation(text: string): boolean {
  const q = scrubBuyerReply(text);
  return (
    /\b(?:cual|que)\s+(?:me\s+)?(?:recomiend\w*|aconsej\w*|sugier\w*)\b/.test(
      q,
    ) ||
    /\b(?:me\s+)?(?:recomiend\w*|aconsej\w*|sugier\w*)\s+(?:de\s+)?(?:todos|todas|estos|estas|ellos|ellas|entre)\b/.test(
      q,
    ) ||
    /\b(?:tu|usted)\s+(?:cual|que)\s+(?:me\s+)?(?:recomiend\w*|elig\w*|elegis|eligen|dirias|pones)\b/.test(
      q,
    ) ||
    /\bcual\s+(?:es|seria|seria\s+el|seria\s+la)\s+(?:el\s+|la\s+)?mejor\b/.test(
      q,
    ) ||
    /\b(?:de\s+todos|entre\s+(?:estos|estas|ellos|ellas))\s+(?:cual|que)\b/.test(
      q,
    ) ||
    /\b(?:con\s+cual\s+te\s+quedas|tu\s+que\s+dices|que\s+me\s+conviene)\b/.test(
      q,
    )
  );
}

/**
 * Top pick from the ordered recommendation list (already ranked best-first).
 * Multinicho: no category heuristics — presentation order + sellable filter.
 */
export function pickSellerRecommendation(
  recommended: CatalogProductView[],
): CatalogProductView | null {
  const sellable = recommended.filter((p) => p.isAvailable);
  return sellable[0] ?? recommended[0] ?? null;
}

export function understandBuyerTurn(
  text: string,
  history: ConversationTurn[],
): TurnUnderstanding {
  const normalized = scrubBuyerReply(text);
  const pendingAsk = detectAgentPendingAsk(history);
  const bareAffirmative = AFFIRMATIVE_CORE.test(normalized);
  const affirms = isPurchaseAffirmativeText(text);
  const confirmsPurchase =
    pendingAsk === 'prepare_purchase' && affirms && !isDeclineText(text);
  const rejectingPackOffer =
    (pendingAsk === 'prepare_purchase' || pendingAsk === 'choose_option') &&
    /\bno\b/.test(normalized) &&
    wantsStandaloneOnly(text);
  return {
    normalized,
    pendingAsk,
    confirmsPurchase,
    declinesOffer:
      rejectingPackOffer ||
      (isDeclineText(text) &&
        (pendingAsk === 'prepare_purchase' || pendingAsk === 'choose_option')),
    quantity: parseBuyerQuantity(text),
    bareAffirmative,
    looksLikeOptionPick: looksLikeOptionPick(text),
    asksSellerPick: asksSellerRecommendation(text),
  };
}

/** Compatibility entry used by the runtime and older call sites. */
export function confirmsPurchase(
  text: string,
  history: ConversationTurn[],
): boolean {
  return understandBuyerTurn(text, history).confirmsPurchase;
}

/** Cross-vertical bundle cues in titles/descriptions (not industry-specific). */
const BUNDLE_NAME =
  /\b(set|kit|pack|packs|combo|duo|trio|estuche|paquete|paquetes|bundle|bundles|multipack|caja\s+regalo|pack\s+x\d+)\b/;
const QUANTITY_ONLY =
  /^(?:si+\s+)?(?:solo|solamente)\s+(?:\d{1,2}|un[oa]|dos|tres|cuatro|cinco|seis)$/;
const BUNDLE_STOPWORDS = new Set([
  'set',
  'kit',
  'pack',
  'packs',
  'combo',
  'duo',
  'trio',
  'estuche',
  'paquete',
  'bundle',
  'producto',
  'opcion',
  'opciones',
  'articulo',
  'item',
]);

/** Tokens that must not become a category hint after "sólo …". */
const HINT_STOPWORDS = new Set([
  ...BUNDLE_STOPWORDS,
  'para',
  'por',
  'con',
  'sin',
  'como',
  'una',
  'uno',
  'unos',
  'unas',
  'este',
  'esta',
  'estos',
  'estas',
  'ese',
  'esa',
  'esos',
  'esas',
  'aqui',
  'alla',
  'ahora',
  'mismo',
  'misma',
  'quiero',
  'queria',
  'necesito',
  'busco',
  'hay',
  'tiene',
  'tienen',
  'hombre',
  'mujer',
  'nina',
  'nino',
  'adulto',
  'adulta',
]);

export function isBundleProduct(product: {
  name: string;
  descriptionShort?: string | null;
  categories?: string[];
}): boolean {
  const haystack = normalizeText(
    [
      product.name,
      product.descriptionShort ?? '',
      ...(product.categories ?? []),
    ].join(' '),
  );
  return BUNDLE_NAME.test(haystack);
}

/** Buyer asked for a pack/set/kit explicitly (any vertical). */
export function wantsPackOnly(text: string): boolean {
  const q = scrubBuyerReply(text);
  if (/\b(?:sin|no)\b.{0,40}\b(?:set|kit|pack|combo|duo|trio|paquete|bundle)\b/.test(q)) {
    return false;
  }
  return /\b(?:(?:el|la|un|una)\s+)?(?:set|kit|pack|combo|completo|duo|trio|paquete|bundle)\b/.test(
    q,
  );
}

/**
 * Buyer wants a single SKU, not a set/kit/pack — any vertical
 * ("quiero sólo la zapatilla", "sin el set", "quiero solo", "desodorante solo").
 * Pure quantity ("sólo uno") is excluded.
 */
export function wantsStandaloneOnly(text: string): boolean {
  const q = scrubBuyerReply(text);
  if (QUANTITY_ONLY.test(q)) return false;
  // "no quiero el set / no el pack" (words may sit between no and pack marker)
  if (
    /\bno\b.{0,48}\b(?:el |la |los |las )?(?:set|kit|pack|combo|duo|trio|paquete|bundle)\b/.test(
      q,
    )
  ) {
    return true;
  }
  if (
    /\b(?:set|kit|pack|combo|completo|duo|trio|paquete|bundle)\b/.test(q) &&
    !/\bsin\b/.test(q) &&
    !/\bno\b/.test(q)
  ) {
    return false;
  }
  // Bare / trailing "solo" after declining a pack offer: "quiero solo", "no hay solo"
  if (
    /(?:^|\b)(?:no\s+)?(?:hay\s+)?(?:yo\s+)?(?:queria\s+|quiero\s+|busco\s+|necesito\s+|pido\s+|prefiero\s+)?solo(?:mente)?$/.test(
      q,
    ) ||
    /\b[a-z]{4,}\s+solo(?:mente)?$/.test(q) ||
    /\b(?:unitario|individual)\b/.test(q)
  ) {
    return true;
  }
  return /\b(?:(?:el|la) que viene solo|(?:el|la) individual|(?:el|la) unitario|solo(?:mente)?(?:\s+(?:el|la|los|las))?\s+[a-z]{4,}|sin (?:el |la )?(?:set|kit|pack|combo|duo|trio|estuche|paquete|bundle|regalo)|nada mas (?:el |la |los |las )?[a-z]{4,}|unicamente (?:el |la |los |las )?[a-z]{4,}|no hay solo)\b/.test(
    q,
  );
}

/**
 * Category/token after "sólo …" for any rubro ("desodorante", "zapatilla",
 * "mochila", "cafe"). Used to prefer matching unit products.
 */
export function standaloneCategoryHint(text: string): string | null {
  if (!wantsStandaloneOnly(text)) return null;
  const q = scrubBuyerReply(text);
  const match = q.match(
    /\b(?:solo|solamente|unicamente|nada mas)\s+(?:el |la |los |las )?([a-z]{4,})\b/,
  );
  if (!match) {
    // "desodorante solo" / "zapatilla solamente" — token before trailing solo
    const trailing = q.match(/\b([a-z]{4,})\s+solo(?:mente)?$/);
    if (
      trailing &&
      QUANTITY_WORDS[trailing[1]] === undefined &&
      !HINT_STOPWORDS.has(trailing[1])
    ) {
      return trailing[1];
    }
    return null;
  }
  if (
    QUANTITY_WORDS[match[1]] !== undefined ||
    HINT_STOPWORDS.has(match[1])
  ) {
    return null;
  }
  return match[1];
}

/**
 * Distinctive tokens of a product or buyer need (line/name), excluding pack
 * markers and generic Spanish filler. Used to keep "Set Cielo" → unit "Cielo …"
 * across any vertical. Description is ignored for product rows so a kit blurb
 * ("zapatilla + medias") does not pollute family matching onto every unit.
 */
export function productFamilyTokens(
  source:
    | string
    | {
        name?: string | null;
        descriptionShort?: string | null;
        line?: string | null;
        brand?: string | null;
      },
): string[] {
  const text =
    typeof source === 'string'
      ? source
      : [source.name, source.line, source.brand].filter(Boolean).join(' ');
  const tokens = normalizeText(text)
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(
      (token) =>
        token.length >= 4 &&
        QUANTITY_WORDS[token] === undefined &&
        !HINT_STOPWORDS.has(token) &&
        !BUNDLE_STOPWORDS.has(token) &&
        !['solo', 'solamente', 'unicamente', 'quiero', 'comprar', 'busco', 'necesito', 'tienen', 'tienes'].includes(
          token,
        ),
    );
  return [...new Set(tokens)];
}

/**
 * Search string when the buyer wants a unit SKU after (or instead of) a pack.
 * Prefer family tokens from the rejected pack + remembered need over a bare
 * category hint like "perfume" that would surface unrelated units.
 */
export function standaloneSearchQuery(params: {
  inboundText: string;
  need?: string | null;
  relatedProducts?: Array<{
    name: string;
    descriptionShort?: string | null;
    line?: string | null;
    brand?: string | null;
  }>;
  categoryHint?: string | null;
}): string {
  const family = (params.relatedProducts ?? []).flatMap(productFamilyTokens);
  const needTokens = params.need ? productFamilyTokens(params.need) : [];
  const distinctive = [...new Set([...family, ...needTokens])];
  if (distinctive.length) {
    return [...distinctive, params.categoryHint].filter(Boolean).join(' ');
  }
  const inbound = productFamilyTokens(params.inboundText);
  if (inbound.length) return inbound.join(' ');
  return (params.categoryHint || params.inboundText).trim();
}

/**
 * Prefer unit SKUs that share line/name tokens with a rejected pack (or prior
 * need). When the related pack has distinctive tokens but this pool has no
 * overlap, return empty so the caller re-searches instead of random units.
 */
export function focusRelatedStandalone(
  products: CatalogProductView[],
  related: Array<{
    name: string;
    descriptionShort?: string | null;
    line?: string | null;
    brand?: string | null;
  }>,
): CatalogProductView[] {
  if (!products.length || !related.length) return products;
  const family = new Set(related.flatMap(productFamilyTokens));
  if (!family.size) return products;
  const scored = products.map((product) => {
    const overlap = productFamilyTokens(product).filter((token) =>
      family.has(token),
    ).length;
    return { product, overlap };
  });
  const focused = scored
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .map((item) => item.product);
  return focused;
}

/**
 * Prefer unit SKUs over sets/kits unless the buyer asked for a pack.
 * Multinicho: uses structural bundle markers only.
 */
export function preferNonBundleProducts(
  text: string,
  products: CatalogProductView[],
): CatalogProductView[] {
  if (!products.length || wantsPackOnly(text)) return products;
  const singles = products.filter((p) => !isBundleProduct(p));
  if (!singles.length) return products;
  const bundles = products.filter((p) => isBundleProduct(p));
  return [...singles, ...bundles];
}

/**
 * Recommendation pool: when the buyer did not ask for a pack/set, surface only
 * unit SKUs if any match — avoids always leading with the set of a line.
 */
export function recommendSellableMatches(
  text: string,
  products: CatalogProductView[],
): CatalogProductView[] {
  const ordered = preferNonBundleProducts(text, products);
  if (!ordered.length || wantsPackOnly(text)) return ordered;
  const singles = ordered.filter((p) => !isBundleProduct(p));
  return singles.length ? singles : ordered;
}

function productMatchesHint(
  product: CatalogProductView,
  hint: string,
): boolean {
  return normalizeText(
    [
      product.name,
      product.descriptionShort ?? '',
      ...product.categories,
      ...product.variants.map((v) => v.label),
    ].join(' '),
  ).includes(hint);
}

/**
 * Unique significant token of the buyer message that appears in exactly one
 * currently recommended product (works for any catalog vocabulary).
 */
export function resolveByUniqueNameFragment(
  text: string,
  recommended: CatalogProductView[],
): CatalogProductView | null {
  if (!recommended.length) return null;
  const stop = new Set([
    'el',
    'la',
    'los',
    'las',
    'de',
    'del',
    'un',
    'una',
    'uno',
    'que',
    'viene',
    'solo',
    'solamente',
    'me',
    'interesa',
    'gusta',
    'quiero',
    'queria',
    'prefiero',
    'ese',
    'esa',
    'este',
    'esta',
    'con',
    'para',
    'por',
    'mas',
    'muy',
    'producto',
    'opcion',
    'opciones',
    'articulo',
    // Structural pack markers — resolved by resolveBundlePreference, not name fragments
    'set',
    'kit',
    'pack',
    'packs',
    'combo',
    'duo',
    'trio',
    'estuche',
    'paquete',
    'bundle',
    'completo',
  ]);
  const tokens = scrubBuyerReply(text)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token));
  for (const token of tokens) {
    const hits = recommended.filter((product) =>
      productMatchesHint(product, token),
    );
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** Bundle vs unit heuristics beyond ordinals — catalog-agnostic. */
export function resolveBundlePreference(
  text: string,
  recommended: CatalogProductView[],
): CatalogProductView | null {
  const query = scrubBuyerReply(text);
  const singles = recommended.filter((p) => !isBundleProduct(p));
  const bundles = recommended.filter((p) => isBundleProduct(p));
  const category = standaloneCategoryHint(text);
  if (wantsStandaloneOnly(text)) {
    const scoped = category
      ? singles.filter((p) => productMatchesHint(p, category))
      : singles;
    if (scoped.length === 1) return scoped[0];
    if (singles.length === 1) return singles[0];
    // Buyer rejected packs — never resolve onto the only remaining bundle.
    return null;
  }
  if (
    /\b(?:el set|la set|el kit|el pack|el combo|el completo|el duo|el trio|el paquete|el bundle|el que trae|el que incluye|con todo|el pack completo)\b/.test(
      query,
    )
  ) {
    if (bundles.length === 1) return bundles[0];
  }
  return null;
}

/** Drop sets/kits from candidates when the buyer asked for a standalone item. */
export function filterStandaloneProducts(
  text: string,
  products: CatalogProductView[],
  persistedStandalone = false,
  relatedProducts: Array<{
    name: string;
    descriptionShort?: string | null;
    line?: string | null;
    brand?: string | null;
  }> = [],
): CatalogProductView[] {
  if (!persistedStandalone && !wantsStandaloneOnly(text)) return products;
  const singles = products.filter((p) => !isBundleProduct(p));
  // Family of a rejected pack wins over a bare category hint ("perfume" would
  // drop "Cielo Eau de Parfum" while keeping unrelated "Aura … Perfume").
  if (relatedProducts.length) {
    const focused = focusRelatedStandalone(singles, relatedProducts);
    if (focused.length) return focused;
  }
  const category = standaloneCategoryHint(text);
  if (!category) return singles;
  const scoped = singles.filter((p) => productMatchesHint(p, category));
  return scoped.length ? scoped : singles;
}

/** When purchase is confirmed, lock onto the product already in play. */
export function anchorSelectedProduct(
  state: SalesState | undefined,
  products: CatalogProductView[],
  contextProducts: CatalogProductView[],
): CatalogProductView | null {
  if (!state) return null;
  if (state.selectedProduct) {
    const selected = products.find((p) => p.id === state.selectedProduct?.productId);
    if (selected) return selected;
  }
  if (contextProducts.length === 1) return contextProducts[0];
  if (state.recommendedProductIds.length === 1) {
    return products.find((p) => p.id === state.recommendedProductIds[0]) ?? null;
  }
  return null;
}
