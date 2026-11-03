import { BadRequestException } from '@nestjs/common';
import type { ProductKind, Prisma } from '@prisma/client';

export type AttributeDefinition = {
  key: string; name: string; group?: string; required?: boolean; variant?: boolean;
  values?: string[]; maxLength?: number;
};
export type CategoryRecord = { id: string; name: string; kind: ProductKind; parentId: string | null; attributes: Prisma.JsonValue };
export type AttributeValueMap = Record<string, string | string[]>;
export type AttributeValueLists = Record<string, string[]>;

/** Resolve root to leaf, overriding by stable attribute key. Reject invalid trees. */
export function categorySchema(categories: CategoryRecord[], id: string) {
  const byId = new Map(categories.map((row) => [row.id, row]));
  const path: CategoryRecord[] = [];
  let current = byId.get(id);
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id) || path.length >= 12) throw new BadRequestException('La clasificación tiene una jerarquía inválida.');
    visited.add(current.id); path.unshift(current);
    const parent = current.parentId ? byId.get(current.parentId) : undefined;
    if (current.parentId && (!parent || parent.kind !== current.kind)) throw new BadRequestException('La clasificación tiene un padre inválido.');
    current = parent;
  }
  if (!path.length) throw new BadRequestException('La categoría seleccionada no existe.');
  const attributes = new Map<string, AttributeDefinition>();
  for (const node of path) {
    if (!Array.isArray(node.attributes)) throw new BadRequestException('La categoría no tiene una definición válida.');
    for (const raw of node.attributes) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.key !== 'string' || typeof raw.name !== 'string')
        throw new BadRequestException('La categoría contiene un atributo inválido.');
      attributes.set(raw.key, raw as unknown as AttributeDefinition);
    }
  }
  return { ...path[path.length - 1], path: path.map(({ id, name }) => ({ id, name })), attributes: [...attributes.values()] };
}

/** Shopify category metafields are lists of entries; accept string or string[]. */
export function coerceAttributeList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    return value ? [value] : [];
  }
  return [];
}

export function validateAttributeValues(
  definitions: AttributeDefinition[],
  values: AttributeValueMap,
  variantNames: string[] = [],
): AttributeValueLists {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const clean: AttributeValueLists = {};
  for (const [key, raw] of Object.entries(values)) {
    const definition = byKey.get(key);
    if (!definition) throw new BadRequestException('Hay características que no pertenecen a esta categoría.');
    if (typeof raw !== 'string' && !Array.isArray(raw)) {
      throw new BadRequestException(`Completa ${definition.name} con un texto válido.`);
    }
    const list = coerceAttributeList(raw);
    for (const value of list) {
      // Suggested taxonomy entries are open (Shopify: “Agregar entrada”).
      if (value.length > (definition.maxLength ?? 200)) {
        throw new BadRequestException(`El valor de ${definition.name} no es válido.`);
      }
    }
    if (list.length) clean[key] = list;
  }
  for (const definition of definitions) {
    const coveredByVariant =
      definition.variant &&
      variantNames.some(
        (name) => name.trim().toLocaleLowerCase('es') === definition.name.trim().toLocaleLowerCase('es'),
      );
    if (definition.required && !clean[definition.key]?.length && !coveredByVariant) {
      throw new BadRequestException(`Completa ${definition.name}.`);
    }
  }
  return clean;
}

/** Materialize validated characteristics into the existing public/agent facts contract. */
export function classificationDetails(
  raw: unknown,
  previous: AttributeDefinition[],
  definitions: AttributeDefinition[],
  values: AttributeValueLists,
): Prisma.InputJsonObject | null {
  const details = raw && typeof raw === 'object' && !Array.isArray(raw) ? JSON.parse(JSON.stringify(raw)) as Record<string, Prisma.InputJsonValue> : {};
  const names = new Set([...previous, ...definitions].map((attribute) => attribute.name.toLocaleLowerCase('es')));
  const generic = Array.isArray(details.attributes) ? details.attributes.filter((attribute) => {
    if (!attribute || typeof attribute !== 'object' || Array.isArray(attribute)) return false;
    return typeof attribute.name === 'string' && typeof attribute.value === 'string' && !names.has(attribute.name.toLocaleLowerCase('es'));
  }) : [];
  const attributes = [
    ...generic,
    ...definitions.flatMap((definition) => {
      const list = coerceAttributeList(values[definition.key]);
      return list.length ? [{ name: definition.name, value: list.join(', ') }] : [];
    }),
  ];
  if (attributes.length) details.attributes = attributes;
  else delete details.attributes;
  return Object.keys(details).length ? details : null;
}
