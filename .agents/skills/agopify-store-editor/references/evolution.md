# Leveling up the editor (without a free page builder)

Modern AI site tools win on **intent → structured result → live preview → human refine**. Agopify already has the skeleton (iframe preview, schemas, draft, text/section/page/image AI). “Next level” means deepening that loop, not replacing it with unbounded canvas editing.

## North-star experience

Shell (shipped): **same home `home-assistant` floating composer** → opens **`app-home-assistant-panel` dock** (parallel column); **dominant real-store preview**; Structure/Inspector drawers on demand. Chat styles shared via `home-assistant.composer.scss` — do not fork. Schema-bounded — not Aloja free code/project files.

A merchant should feel:

1. **I see my real store** while editing (preview dominates).
2. **I ask AI with the same chat as Inicio** (sticky composer → dock panel; section/field chrome opens Inspector).
3. **I change it myself or apply an AI proposal**, always with undo and draft safety.
4. **I understand draft vs published** and can restore versions.
5. **The template still looks like the chosen family** (Classic / Selecta / Stride / Rosaline…), not a generic AI layout.

Competitors to learn *patterns* from (never copy naming/UI): Webflow AI (system-bound generation), Framer (editable result + review), Shopify theme editor (sections/blocks), Framer/Webflow CMS modeling (atomic fields). Reject: absolute free-form positioning, arbitrary code components for merchants, ZIP upload themes.

## Leverage ranking (prefer higher when the ask is open-ended)

### L1 — Clarity & speed of the existing loop (usually first)

- Selection sync host ↔ frame; inspector scrolls to the active section.
- Empty/error/loading states for preview frame timeouts.
- Keyboard: save, undo, escape clear selection (preserve existing shortcuts).
- Search in structure library; compact `ds-choice-card` density already in DSM.
- Honest save/publish/schedule/version labels (§38).

### L2 — Canvas editing quality

- Stronger in-canvas affordances for text/image (still schema keys).
- Device preview fidelity; avoid double scroll traps on mobile console.
- Highlight + “edit in inspector” for complex fields (FAQ, choice).
- Section recipes: one-click add of validated block combos (e.g. benefits + CTA) within `MAX_BLOCKS`.

### L3 — AI copilot depth

- Intent chips tied to real actions (fill empty home, tone passes, section refresh).
- Multi-field patch preview / partial apply.
- Industry-aware first-run generator that only fills empty fields.
- Image generation with alt/text siblings updated together when schema allows.
- Guardrails evals for hallucinations (prices, fake reviews).

### L4 — Composition intelligence (still bounded)

- Suggest reorder/hide based on missing catalog/hero/CTA — as **layout patches**, merchant confirms.
- Per-template capability awareness (don’t suggest Selecta-only blocks on Classic).
- Safe mode / recovery composition already in themes: editor must explain and recover, not corrupt drafts.

### L5 — Multi-surface coherence

- Fixed sections on product/announcement/footer stay editable with `openPage`.
- Shared blocks keep `--store-*` styling; no one-off editor-only CSS that buyers never see.
- Align generated FAQ with real shipping/payments settings.

### Out of scope unless product explicitly expands contracts

- Free-form page builder / absolute DnD pixel layout.
- Merchant-uploaded themes, custom CSS/JS, third-party section marketplaces.
- Replacing declarative `packages/themes` with runtime plugin execution.
- Training the **sales agent** from editor copy sessions (different runtime).

## Design principles for new affordances

1. **One job per region** — Chat = intent + patch review; Preview = truth; Structure = composition drawer; Inspector = fields + section AI.
2. **Progressive disclosure** — advanced theme/ABI only when needed; defaults stay simple.
3. **Tokens only** — console uses `--ds-*`; preview uses store theme. No Agopify brand paint on tenant canvas.
4. **Measure before claiming** — performance/a11y/SEO statements need evidence (`verification.md`).
5. **Ship vertical slices** — one intent or one schema family end-to-end beats a half-built “AI chat”.

## Suggested phased roadmap (adapt to the user’s ask)

```
Phase A  L1+L2  Selection, inspector sync, empty/preview resilience     ✅
Phase B  L3     Intent AI + patch preview + empty-store generator      ✅
Shell      Chat rail + drawers (AI-first chrome over A/B)                 ✅
Phase C  L4     Layout suggestions within HOME_BLOCKS + template caps
Phase D  L5     Cross-page fixed sections + settings-aware FAQ/CTA
```

When the user says “siguiente nivel” without detail: propose **Phase C** (bounded layout suggestions) unless a concrete canvas/AI gap remains — confirm in one short plan, then implement.
