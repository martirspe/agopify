# Multi-niche rules for AI Core training

VendedorIA tenants sell across verticals. Conversation hardening must work for **any** catalog.

## Allowed signals (structural / universal)

- Spanish deixis and ordinals: primero…quinto, último, ese, este, el otro.
- Affirmatives / declines: sí, dale, ok, listo, no, después…
- Pack markers in **name or category** (case-insensitive):  
  `set|kit|pack|combo|paquete|bundle|duo|trío|trio|colección|coleccion`.
- Buyer packing language: “sólo / solo”, “sin el set/kit/pack”, “el completo”, “el pack”,
  “viene sólo / solo”.
- Generic “sólo + \<token\>” where `<token>` is taken from the **current recommended product
  names** (tenant vocabulary), not from a hardcoded industry glossary.
- Sellability: `stock === 0` or `isAvailable === false` → out of sellable pool.
- Money: integer cents; never invent amounts.

## Forbidden signals (niche leaks)

Do **not** put in production Understanding / validators / prompts:

- Brand names of a single demo tenant.
- Vertical-only product nouns as the *only* match rule (desodorante, labial, zapatilla, café…).
- Category trees that assume beauty, fashion, food, etc.
- Golden cases that only use one vertical for a structural rule.

## Fixture pattern (required)

For every structural change, ship tests with **at least two verticals**, e.g.:

| Vertical | Unit SKU (example shape) | Pack SKU (example shape) |
| --- | --- | --- |
| Beauty | “Crema facial 50ml” | “Set crema + serum” |
| Footwear | “Zapatilla urbana 40” | “Pack zapatilla + medias” |
| Home | “Vaso vidrio 300ml” | “Kit 6 vasos” |
| Grocery | “Café molido 250g” | “Combo café + taza” |

Names are illustrative for tests only; rules must still fire if the tenant uses different wording
as long as pack markers / ordinals / affirmatives match.

## Prompt & copy

- System/prompt rules: Spanish, no industry examples that look like product advice.
- Prefer “producto / opción / pack del catálogo” over naming a sample SKU in instructions.
- Deterministic intros: short and human; never “Encontré N resultados en el catálogo”.

## Review checklist (before merge)

- [ ] No production regex anchored to a single niche noun.
- [ ] Unit tests cover ≥2 verticals when the change is lexical/structural.
- [ ] Golden eval uses abstract product names or multiple niches across the suite.
- [ ] Sold-out / pack / ordinal behaviour documented as niche-agnostic in `UNDERSTANDING.md`.
- [ ] CHANGELOG does not imply the fix is “for deodorant / beauty only”.
