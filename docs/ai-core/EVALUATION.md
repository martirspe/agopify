# Evaluation

## Dataset

- Path: `docs/agent/evals/sales-engine.json`
- Shape: `{ version, dataset, description, cases[] }` (legacy bare arrays still load)
- Current version: see `version` field in the JSON (`2026.10.30`)
- Runner: `npm run eval:sales` (after `npm run build:api`)
- Latest report: `docs/agent/evals/sales-engine-report.json` (generated, not a source of truth)

## Scoring

- Scorer: `apps/api/src/agent-runtime/sales-evaluation.ts`
- Gate: `repeated_question_rate === 0`, `hallucination_rate === 0`, and every annotated metric equals `1`
- Offline fixtures are **regression**, not a live-model quality guarantee

## CI

`.github/workflows/ci.yml` runs `eval:sales` after `build:api`. A failing golden case blocks the pipeline.

## Improvement cycle

Collect → Evaluate → Diagnose → Propose → Test → Approve → Deploy. Production never rewrites its own prompts or permissions from eval output alone.

## E2E

`apps/api/test/sales-engine.e2e-spec.ts` covers locks, memory isolation and retrieval with the isolated Docker test DB.
