import { Logger } from '@nestjs/common';

const logger = new Logger('AiCoreSecurity');

export type SecurityEventCode =
  | 'cross_tenant_denied'
  | 'prompt_injection_blocked'
  | 'tool_tenant_mismatch'
  | 'order_scope_denied'
  | 'ai_runtime_mode_changed'
  | 'shadow_live_artifact_blocked';

/**
 * Structured security signal for scenario K/M. Never logs phones, emails,
 * message bodies or secrets — only opaque ids and codes.
 */
export function recordSecurityEvent(event: {
  code: SecurityEventCode;
  tenantId: string;
  conversationId?: string | null;
  resource?: string;
  detail?: string;
}): void {
  logger.warn(
    JSON.stringify({
      event: 'ai_core_security',
      code: event.code,
      tenantId: event.tenantId,
      conversationId: event.conversationId ?? null,
      resource: event.resource ?? null,
      detail: event.detail ?? null,
      at: new Date().toISOString(),
    }),
  );
}
