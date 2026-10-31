import { normalizeText } from './conversation-context';

/**
 * Buyer/catalog/FAQ text is untrusted data. Detect attempts to override system
 * policy (scenario M). Detection never grants permissions; it only flags risk.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignora\s+(?:tus?|las?|todas?\s+las?)\s+instrucciones\b/,
  /\bignore\s+(?:all\s+)?(?:previous|prior|your)\s+instructions?\b/,
  /\b(?:system\s+prompt|desarrollador|developer\s+mode|jailbreak|DAN)\b/,
  /\b(?:actua|actúa|responde)\s+como\s+(?:si\s+)?(?:no\s+tuvieras|sin)\s+(?:reglas|limites|límites)\b/,
  /\b(?:revela|muestra|dump)\s+(?:el\s+)?(?:prompt|api\s*key|secreto|token)\b/,
  /\b(?:otorga|dame|aplica|hazme)\s+(?:un\s+)?(?:\d{1,3}\s*%|cien\s+por\s+ciento|90\s*%|descuento\s+(?:total|ilimitado))\b/,
  /\bdescuento\s+(?:del\s+)?(?:\d{1,3}|noventa)\s*%\b/,
];

export function detectPromptInjection(text: string): boolean {
  const normalized = normalizeText(text);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Safe Spanish reply when the buyer tries to override policy. */
export const PROMPT_INJECTION_REFUSAL =
  'No puedo cambiar las reglas del negocio ni aplicar ofertas fuera de lo publicado. ¿Te ayudo con un producto o precio del catálogo?';
