/** Stored in `ProductOption.values` as strings (legacy) or `{ value, color? }` objects. */
export type OptionValueRecord = { value: string; color?: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function normalizeOptionValues(raw: unknown): OptionValueRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: OptionValueRecord[] = [];
  for (const item of raw) {
    let value = '';
    let color: string | undefined;
    if (typeof item === 'string') {
      value = item.trim();
    } else if (item && typeof item === 'object' && !Array.isArray(item) && typeof (item as { value?: unknown }).value === 'string') {
      value = (item as { value: string }).value.trim();
      const candidate = (item as { color?: unknown }).color;
      if (typeof candidate === 'string' && HEX.test(candidate.trim())) {
        color = candidate.trim().toLowerCase();
      }
    }
    if (!value || value.length > 200) continue;
    const key = value.normalize('NFKC').toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(color ? { value, color } : { value });
  }
  return out;
}

export function optionValueLabels(values: OptionValueRecord[]): string[] {
  return values.map((entry) => entry.value);
}

/** Color lookup for a named axis value (case-insensitive). */
export function colorForOptionValue(
  definitions: Array<{ name: string; values: unknown }> | undefined,
  optionName: string,
  optionValue: string,
): string | null {
  if (!definitions?.length) return null;
  const axisKey = optionName.trim().normalize('NFKC').toLocaleLowerCase('es');
  const valueKey = optionValue.trim().normalize('NFKC').toLocaleLowerCase('es');
  const axis = definitions.find(
    (definition) => definition.name.trim().normalize('NFKC').toLocaleLowerCase('es') === axisKey,
  );
  if (!axis) return null;
  const match = normalizeOptionValues(axis.values).find(
    (entry) => entry.value.normalize('NFKC').toLocaleLowerCase('es') === valueKey,
  );
  return match?.color ?? null;
}

export function isColorOptionName(name: string): boolean {
  const key = name.trim().normalize('NFKC').toLocaleLowerCase('es');
  return key === 'color' || key === 'colour' || key === 'colors' || key === 'colores' || key === 'footwear color';
}
