import { normalizeText } from './conversation-context';
import { isRepeatedKnownQuestion } from './memory-policy';
import { missingSubquestionCoverage } from './multi-question';
import { CatalogProductView, moneyLabel } from './sales-agent-tools.service';
import { SalesState } from './sales-state';

const QUESTION_KEYS: Record<string, RegExp> = {
  size: /\b(talla|tamano|medida)\b/,
  color: /\bcolor\b/,
  budget: /\b(presupuesto|cuanto.+gastar|maximo.+pagar)\b/,
  name: /\b(nombre|llamas)\b/,
  quantity: /\b(cuantas? (unidades|quieres)|cantidad)\b/,
  destination: /\b(distrito|provincia|ciudad)\b/,
  address: /\b(direccion)\b/,
};

/** Reject critical ungrounded text. Fallback is built from the same authoritative tool results. */
export function validateSalesResponse(
  text: string,
  names: string[],
  products: CatalogProductView[],
  state?: SalesState,
  policyAnswers: string[] = [],
): string[] {
  const failures = new Set<string>();
  const mentioned = names.map((name) => products.find((p) => p.name === name));
  if (mentioned.some((p) => !p)) failures.add('unknown_product');
  const selected = mentioned.filter((p): p is CatalogProductView => Boolean(p));
  // Numbers must be present in current authoritative prices, with the same currency.
  const amounts =
    text.match(/(?:S\s*\/\.?|PEN|USD|\$|€)\s*\d+(?:[.,]\d{1,2})?/gi) ?? [];
  const canonical = (amount: string) =>
    normalizeText(amount).replace(/[\s.]/g, '').replace(',', '');
  const allowed = new Set(
    selected
      .flatMap((p) => [
        moneyLabel(p.currency, p.basePriceCents),
        p.priceLabel,
        p.compareAtPriceLabel ?? '',
        ...p.variants.map((v) => v.priceLabel),
      ])
      .filter(Boolean)
      .map(canonical),
  );
  for (const amount of amounts)
    if (!allowed.has(canonical(amount))) failures.add('unsupported_price');
  for (const line of text.split(/\n|(?<=[.!?])\s+/)) {
    const named = selected.filter((p) =>
      normalizeText(line).includes(normalizeText(p.name)),
    );
    const lineAmounts =
      line.match(/(?:S\s*\/\.?|PEN|USD|\$|€)\s*\d+(?:[.,]\d{1,2})?/gi) ?? [];
    if (
      named.length === 1 &&
      lineAmounts.some(
        (amount) =>
          ![
            named[0].priceLabel,
            named[0].compareAtPriceLabel,
            ...named[0].variants.map((v) => v.priceLabel),
          ]
            .filter((v): v is string => Boolean(v))
            .map(canonical)
            .includes(canonical(amount)),
      )
    )
      failures.add('price_product_mismatch');
  }
  if (
    selected.length &&
    !selected.some((p) =>
      normalizeText(text).includes(normalizeText(p.name)),
    ) &&
    /\b(recomiendo|encontre|tenemos este|este modelo se llama)\b/.test(
      normalizeText(text),
    )
  )
    failures.add('ambiguous_product_reference');
  if (/\b\d+(?:[.,]\d+)?\s*(?:soles|dolares|euros)\b/i.test(text))
    failures.add('unstructured_price');
  if (
    /\b(?:envio|entrega)\b.{0,50}(?:gratis|gratuit|\d+\s*(?:dias?|horas?))/i.test(
      normalizeText(text),
    )
  )
    failures.add('unsupported_shipping');
  if (
    /\b(?:descuento|garantia|devoluc|cambios|reembolso)\w*/i.test(
      normalizeText(text),
    )
  ) {
    const sentences = text
      .split(/(?<=[.!?])\s+|\n/)
      .filter((s) =>
        /\b(?:descuento|garantia|devoluc|cambios|reembolso)\w*/i.test(
          normalizeText(s),
        ),
      );
    const facts = [
      ...policyAnswers,
      ...selected.flatMap((p) => Object.values(p.facts ?? {}).flat()),
    ].map(normalizeText);
    if (
      sentences.some(
        (s) => !facts.some((fact) => fact.includes(normalizeText(s))),
      )
    )
      failures.add('unsupported_policy');
  }
  // Arbitrary % discounts without a published FAQ/promotion fact are never allowed.
  if (
    /\b(?:\d{1,3}\s*%|cien\s+por\s+ciento)\s*(?:de\s+)?descuento\b|\bdescuento\s+(?:del\s+)?(?:\d{1,3}|noventa)\s*%\b/.test(
      normalizeText(text),
    ) &&
    !policyAnswers.some((answer) =>
      /\bdescuento\b/i.test(answer),
    )
  ) {
    failures.add('unauthorized_discount');
  }
  const positiveInventory = text
    .split(/\n|(?<=[.!?])\s+/)
    .some(
      (sentence) =>
        /\b(?:hay stock|tenemos stock|esta disponible|estan disponibles|disponible|disponibles|en stock)\b/i.test(
          normalizeText(sentence),
        ) && !/\b(?:no|sin|agotad[oa])\b/.test(normalizeText(sentence)),
    );
  if (positiveInventory) {
    if (!selected.length || selected.some((p) => !p.isAvailable))
      failures.add('unsupported_inventory');
    if (/\btalla\b/.test(normalizeText(text))) {
      const size = normalizeText(text).match(
        /\btalla\s+(\d+|xxs|xs|s|m|l|xl|xxl)\b/,
      )?.[1];
      if (
        !size ||
        selected.some(
          (p) =>
            !p.variants.some(
              (v) =>
                v.isAvailable &&
                normalizeText(v.label)
                  .split(/\s*\/\s*/)
                  .includes(size),
            ),
        )
      )
        failures.add('unsupported_variant');
    }
  }
  // Do not volunteer OOS chatter ("el X está agotado") when recommending sellable items.
  // Honest missing-ordinal copy ("Esa opción ya no está disponible…") is allowed.
  const normalizedReply = normalizeText(text);
  const mentionsSoldOut =
    /\b(?:agotad[oa]s?|sin stock|no (?:hay|tenemos) stock)\b/.test(
      normalizedReply,
    ) ||
    (/\bno (?:esta|estan) disponibles?\b/.test(normalizedReply) &&
      !/\b(?:esa|esta) opcion ya no (?:esta|estan) disponibles?\b/.test(
        normalizedReply,
      ));
  if (mentionsSoldOut) {
    const catalogHasSoldOut = products.some((p) => !p.isAvailable);
    const askedSoldOutByName = products.some(
      (p) =>
        !p.isAvailable &&
        normalizeText(text).includes(normalizeText(p.name)),
    );
    if (!catalogHasSoldOut || !askedSoldOutByName)
      failures.add('unsupported_sold_out_mention');
  }
  for (const match of text.matchAll(
    /\b(\d+)\s+(?:unidades?\s+(?:disponibles?|en stock)|en stock)\b/gi,
  )) {
    const qty = Number(match[1]);
    if (!selected.some((p) => !p.stockUnlimited && p.stockQty === qty))
      failures.add('unsupported_inventory_quantity');
  }
  if (state) {
    for (const sentence of text.match(/¿[^?]*\?|[^.!?\n]*\?/g) ?? []) {
      const normalizedSentence = normalizeText(sentence);
      for (const [key, regex] of Object.entries(QUESTION_KEYS))
        if (
          state.answeredQuestions[key] &&
          regex.test(normalizedSentence) &&
          !/\b(confirm|cambias|cambiar|sigue|correcto)\w*/.test(
            normalizedSentence,
          )
        )
          failures.add('repeated_question');
      if (isRepeatedKnownQuestion(normalizedSentence, state))
        failures.add('repeated_question');
    }
  }  if (/\b(?:ya reserv)\w*/.test(normalizeText(text)))
    failures.add('unsupported_action');
  if (
    /\b(?:ya cree|pedido creado)\w*/.test(normalizeText(text)) &&
    !state?.orderId
  )
    failures.add('unsupported_action');
  if (
    /\b(?:pagado|pago confirmado)\w*/.test(normalizeText(text)) &&
    !['PAID', 'FULFILLING', 'SHIPPED', 'COMPLETED'].includes(
      state?.paymentStatus ?? '',
    )
  )
    failures.add('unsupported_payment');
  // Claiming the district is settled or offering a payment link without an order
  // is how the model used to loop buyers who already answered.
  if (
    state?.pendingLines.length &&
    !state.orderId &&
    /\b(?:ya\s+tengo\s+todo|distrito\s+confirmad|confirmar\s+tu\s+distrito|link\s+(?:de\s+)?pago|pase\s+el\s+link|pasar\s+el\s+link)\b/.test(
      normalizeText(text),
    )
  )
    failures.add('unsupported_checkout_claim');
  // Enforce compound inquiry coverage only (price+size+shipping, etc.), never during checkout.
  const inquiryIntents = (state?.intents ?? []).filter((intent) =>
    [
      'price_inquiry',
      'stock_inquiry',
      'product_variant',
      'shipping_inquiry',
      'payment_inquiry',
    ].includes(intent),
  );
  if (
    inquiryIntents.length >= 2 &&
    !state?.orderId &&
    state?.stage !== 'PAYMENT_PENDING' &&
    state?.stage !== 'CHECKOUT' &&
    missingSubquestionCoverage(text, inquiryIntents).length
  ) {
    failures.add('unanswered_subquestion');
  }
  return [...failures];
}
