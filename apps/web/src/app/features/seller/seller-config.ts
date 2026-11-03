import type { DsIconName } from '@agopify/ui';

export type SellerSectionId =
  | 'profile'
  | 'personality'
  | 'sales'
  | 'knowledge'
  | 'rules'
  | 'advanced';

export type SellerSection = {
  id: SellerSectionId;
  label: string;
  hint: string;
  icon: DsIconName;
};

export const SELLER_SECTIONS: SellerSection[] = [
  { id: 'profile', label: 'Perfil y canales', hint: 'Nombre, negocio, cliente ideal y dónde atiende', icon: 'user' },
  { id: 'personality', label: 'Personalidad', hint: 'Tono, estilo y mensajes clave', icon: 'sparkles' },
  { id: 'sales', label: 'Técnicas de venta', hint: 'Técnicas opcionales de venta', icon: 'target' },
  { id: 'knowledge', label: 'Conocimiento', hint: 'Políticas del negocio (envíos, cambios, pagos…)', icon: 'bookOpen' },
  { id: 'rules', label: 'Reglas y derivación', hint: 'Límites y paso a un asesor', icon: 'shieldCheck' },
  { id: 'advanced', label: 'Avanzado', hint: 'Actividad, instrucciones y opciones avanzadas', icon: 'slidersHorizontal' },
];

export function asSellerSection(value: string | null): SellerSectionId | null {
  return SELLER_SECTIONS.some((section) => section.id === value)
    ? (value as SellerSectionId)
    : null;
}

export type SalesTechniqueGroup = 'discover' | 'persuade' | 'close';

/**
 * Console-only subset. The runtime still understands the full playbook ids
 * (presets may set extras); merchants only toggle the ones that change behaviour
 * beyond the hard-coded sales method.
 */
export const SALES_TECHNIQUES: Array<{
  id: string;
  group: SalesTechniqueGroup;
  label: string;
  description: string;
}> = [
  { id: 'discovery', group: 'discover', label: 'Preguntas de descubrimiento', description: 'Hace una pregunta a la vez para entender la necesidad.' },
  { id: 'benefits', group: 'persuade', label: 'Beneficios, no características', description: 'Habla de beneficios, no solo de características.' },
  { id: 'objections', group: 'persuade', label: 'Manejo de objeciones', description: 'Responde dudas con datos del catálogo o tus FAQ.' },
  { id: 'alternative_close', group: 'close', label: 'Cierre por alternativa', description: 'Ofrece una elección concreta para cerrar.' },
  { id: 'cross_sell', group: 'close', label: 'Venta cruzada', description: 'Sugiere un complemento del catálogo tras el sí.' },
];

export const TECHNIQUE_GROUPS: Array<{ id: SalesTechniqueGroup; label: string; hint: string }> = [
  { id: 'discover', label: 'Descubrir', hint: 'Entender qué necesita' },
  { id: 'persuade', label: 'Persuadir', hint: 'Destacar beneficios' },
  { id: 'close', label: 'Cerrar', hint: 'Llevar al pago sin presionar' },
];

export type SellerPreset = {
  id: string;
  label: string;
  description: string;
  communicationStyle: string;
  salesStyle: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  salesTechniques: string[];
};

export const SELLER_PRESETS: SellerPreset[] = [
  {
    id: 'consultative',
    label: 'Asesor consultivo',
    description: 'Escucha, pregunta y propone la mejor opción.',
    communicationStyle: 'Cercano y profesional; escucha antes de recomendar',
    salesStyle: 'Consultivo: pregunta, entiende la necesidad y recomienda la opción que mejor encaja',
    responseLength: 'balanced',
    salesTechniques: ['discovery', 'benefits', 'objections', 'alternative_close', 'cross_sell'],
  },
  {
    id: 'friendly',
    label: 'Amigo que sabe',
    description: 'Cálido y espontáneo, como un amigo que conoce el catálogo.',
    communicationStyle: 'Cálido, juvenil y espontáneo, como un amigo que sabe del tema',
    salesStyle: 'Entusiasta y claro: recomienda lo que encaja y lo dice con confianza',
    responseLength: 'concise',
    salesTechniques: ['discovery', 'benefits', 'alternative_close', 'cross_sell'],
  },
  {
    id: 'premium',
    label: 'Especialista premium',
    description: 'Elegante y experto; destaca calidad y valor.',
    communicationStyle: 'Elegante, preciso y seguro, con vocabulario cuidado',
    salesStyle: 'Experto que asesora con autoridad y justifica el valor antes que el precio',
    responseLength: 'detailed',
    salesTechniques: ['discovery', 'benefits', 'objections', 'alternative_close'],
  },
  {
    id: 'fast',
    label: 'Cierre rápido',
    description: 'Directo y ágil; lleva al pago en pocos mensajes.',
    communicationStyle: 'Directo, ágil y amable',
    salesStyle: 'Va al grano: confirma lo que busca y lo lleva al pago en pocos mensajes',
    responseLength: 'concise',
    salesTechniques: ['benefits', 'alternative_close'],
  },
];

/** A profile is selected only while all the settings it applies still match. */
export function resolveSellerPreset(values: {
  personalityPreset?: string;
  communicationStyle: string;
  salesStyle: string;
  responseLength: string;
  salesTechniques: string[];
  promptMode: string;
}): string {
  if (values.promptMode === 'custom') return 'custom';
  if (values.personalityPreset === 'custom') return 'custom';
  const match = SELLER_PRESETS.find(
    (preset) =>
      preset.id === values.personalityPreset &&
      preset.communicationStyle === values.communicationStyle &&
      preset.responseLength === values.responseLength &&
      preset.salesTechniques.length === values.salesTechniques.length &&
      preset.salesTechniques.every((id) => values.salesTechniques.includes(id)),
  );
  return match?.id ?? 'custom';
}
