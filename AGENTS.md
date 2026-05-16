# ai-issue-action — agents guidance

## Single source file
`src/index.ts` is the only source file. Rollup bundles it to `dist/index.js`.

**If you modify `src/index.ts`, you MUST run `npm run build` before committing.** The `dist/index.js` artifact is committed to the repo (the `action.yml` `main` field points to it). `commit-checklist.json` encodes this dependency.

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Rollup bundle `src/index.ts` → `dist/index.js` |
| `npm run build:watch` | Watch mode |
| `npm run lint` | ESLint on `src/` |
| `npm run tsc` | TypeScript check (`--noEmit`) |
| `npm run prettier:check` | Prettier formatting check |
| `npm run prettier:write` | Auto-format all files |

CI order (the `lint.yaml` workflow): `eslint` → `prettier:check` → `yamllint` → `actionlint` → verify `action.yml` main points to `dist/`.

## Codegen / build
- Rollup config at `rollup.config.mjs`: ESM output, `inlineDynamicImports: true`.
- TypeScript (`tsconfig.json`): `NodeNext` module, `ESNext` target, `noEmit` (rollup is the compiler).
- No test runner — the `test.yaml` workflow runs the action locally via `act` with real API keys.

## Framework quirks
- Uses **Vercel AI SDK** (`ai` package) with provider SDKs (`@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`).
- Model → provider routing in `getModel()` (`src/index.ts:111`): names starting with `gemini` → Google, containing `gpt` → OpenAI, everything else → Anthropic.
- Provider-level options set in `generateText()`: `{ openai: { serviceTier: 'flex', reasoningEffort: 'none' } }`.
- API keys via env vars: `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`.

## Local testing
Requires [act](https://nektosact.com/). Create `.secrets` with `GITHUB_TOKEN="ghp_xxx"`, then `act -j test`. You also need one or more API keys in `.secrets` or env. The `.secrets`, `.env`, `.vars` files are gitignored and auto-sourced by act. For custom event payloads, use `act -e event.json`.

## Code style
- **No semicolons**, single quotes, 90-char print width (Prettier).
- For HTML/YAML: double quotes, 120-char width.

## Action basics
- Runs on **Node 24** (`using: node24` in `action.yml`).
- Takes `model` (required), `instructions`, `file` (glob), `max_tokens` (default 2048), `head`, `tail`, `token` (default `github.token`).
- Outputs: `text`, `usage`, `comment`.
