import type { ShippingMode } from '@agopify/contracts';

export const isCarrier = (mode: ShippingMode | null) => mode === 'OLVA' || mode === 'SHALOM';
