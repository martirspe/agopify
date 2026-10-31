import type { ProductKind } from '../../core/api/catalog-api.service';

export type CompletenessInput = {
  kind: ProductKind;
  categories: string[];
  photos: number;
  descriptionFull?: string | null;
};

export type CompletenessItem = { id: string; label: string; done: boolean };

/**
 * Soft coach for “vender mejor”: optional enrichment after the product is already
 * sellable. Never treat these as publish blockers.
 */
export function productCompleteness(input: CompletenessInput): {
  items: CompletenessItem[];
  score: number;
} {
  const items: CompletenessItem[] = [
    { id: 'photo', label: 'Al menos 1 foto', done: input.photos > 0 },
    { id: 'category', label: 'Categoría', done: input.categories.length > 0 },
    {
      id: 'description',
      label: 'Descripción detallada',
      done: Boolean(input.descriptionFull?.trim()),
    },
  ];
  const done = items.filter((item) => item.done).length;
  return { items, score: Math.round((done / items.length) * 100) };
}
