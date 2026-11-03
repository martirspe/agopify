import type { StoreTemplate } from "@agopify/contracts";
import { THEME_DEMO_INDEX } from '@agopify/themes/demo-index';

export const TEMPLATE_DEMO_PREFIX = "/_templates";
export const TEMPLATE_DEMO_LABELS: Record<StoreTemplate, string> = Object.fromEntries(THEME_DEMO_INDEX.map(theme => [theme.slug, theme.displayName]));

export function templateDemoFromPath(path: string): StoreTemplate | null {
  const match = /^\/_templates\/([a-z][a-z0-9-]{1,39})(?:\/|$)/.exec(path);
  return match && Object.hasOwn(TEMPLATE_DEMO_LABELS, match[1]) ? match[1] : null;
}
