/** HTTPS is required for Meta to call webhooks in production. */
export function isMetaPublicApiReady(url: string | undefined): boolean {
  return /^https:\/\//i.test(url || '');
}

/**
 * Customer-owned credentials need a public API base for the webhook URL.
 * Outside production, Docker/local Nest uses http://localhost — keep that operable
 * so operators can configure credentials without a tunnel.
 */
export function isManualPublicApiReady(url: string | undefined, nodeEnv: string | undefined): boolean {
  if (isMetaPublicApiReady(url)) return true;
  if (nodeEnv === 'production') return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url || '');
}
