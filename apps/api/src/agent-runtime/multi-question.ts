import { normalizeText } from './conversation-context';
import type { CatalogProductView } from './sales-agent-tools.service';

/** Deterministic factual lines for compound buyer questions (no invented shipping quotes). */
export function factualLinesForIntents(params: {
  intents: string[];
  product: CatalogProductView | null;
  requestedSize?: string;
}): string[] {
  const { intents, product, requestedSize } = params;
  const lines: string[] = [];
  if (!intents.length) return lines;

  if (intents.includes('price_inquiry') && product) {
    lines.push(`${product.name} cuesta ${product.priceLabel}.`);
  }
  if (intents.includes('stock_inquiry') && product) {
    lines.push(`Disponibilidad: ${product.stockLabel}.`);
  }
  if (intents.includes('product_variant') && product) {
    const available = product.variants.filter((variant) => variant.isAvailable);
    if (requestedSize) {
      const match = available.find((variant) =>
        normalizeText(variant.label)
          .split(/\s*\/\s*/)
          .includes(normalizeText(requestedSize)),
      );
      lines.push(
        match
          ? `Talla ${requestedSize}: disponible (${match.label} — ${match.priceLabel}).`
          : `No veo la talla ${requestedSize} disponible en ${product.name}. Opciones: ${available
              .slice(0, 6)
              .map((variant) => variant.label)
              .join(', ') || 'sin variantes publicadas'}.`,
      );
    } else if (available.length) {
      lines.push(
        `Variantes: ${available
          .slice(0, 6)
          .map((variant) => `${variant.label} ${variant.priceLabel}`)
          .join('; ')}.`,
      );
    }
  }
  if (intents.includes('shipping_inquiry')) {
    lines.push(
      'Para cotizar el envío con las reglas reales del negocio, indícame tu distrito.',
    );
  }
  if (intents.includes('payment_inquiry')) {
    lines.push(
      'Las formas de pago publicadas las confirmo al armar tu pedido (link de pago cuando corresponda).',
    );
  }
  return lines;
}

/** True when the reply covers each commercial sub-question we can check with keywords. */
export function missingSubquestionCoverage(
  replyText: string,
  intents: string[],
): string[] {
  const normalized = normalizeText(replyText);
  const missing: string[] = [];
  if (
    intents.includes('price_inquiry') &&
    !/(?:s\s*\/|pen|usd|\$|€)\s*\d|\d\s*(?:soles|dolares)|cuesta|precio/.test(
      normalized,
    )
  ) {
    missing.push('price_inquiry');
  }
  if (
    intents.includes('stock_inquiry') &&
    !/\b(stock|disponib|agotad)\w*/.test(normalized)
  ) {
    missing.push('stock_inquiry');
  }
  if (
    intents.includes('product_variant') &&
    !/\b(talla|color|variante|opcion)\w*/.test(normalized)
  ) {
    missing.push('product_variant');
  }
  if (
    intents.includes('shipping_inquiry') &&
    !/\b(envio|entrega|distrito|courier|delivery)\b/.test(normalized)
  ) {
    missing.push('shipping_inquiry');
  }
  return missing;
}
