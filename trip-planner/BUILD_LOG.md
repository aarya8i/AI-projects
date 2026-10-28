# Build Log

## 2026-10-27 · Step 1 + Milestone 1: Rules file and scaffold

**Asked for:** A CLAUDE.md holding the standing project rules, then a Vite + React + TypeScript scaffold with Vitest and a working typecheck.

**Built:**
- `CLAUDE.md` with the rules as given, plus a "Conventions" section recording the agreed plan decisions (shared code in `src/lib/`, `.js` import extensions, `today` computed in the location's timezone, `end ≤ today + 15`).
- Vite `react-ts` template (Vite 8.3, React 19.3, TypeScript 7.0), scaffolded into a temp folder and copied in, since the target folder wasn't empty.
- Merged `.gitignore`: the original `.env*` line stays first, followed by Vite's entries and `.vercel`.
- `tsconfig.api.json` (Node ESM / `nodenext`) for `api/` and `src/lib/`, added to the root project references. `npm run typecheck` runs `tsc -b` across the app, node and api configs.
- Vitest 5 configured in `vite.config.ts` (node environment, tests in `src/` and `api/`), with one smoke test.
- `.env.example` with empty placeholders only. Vercel CLI installed as a devDependency.

**What went wrong / how we fixed it:**
- The original `.env*` rule also ignored `.env.example`, so the example file could never be committed. Fixed by adding `!.env.example` directly after `.env*`. `git check-ignore` confirms that `.env` and `.env.local` are still ignored.
- npm reported that install scripts for `esbuild` and `fsevents` (pulled in by the Vercel CLI) were not run under npm's new allowScripts policy. Tests, typecheck and `vite build` all pass without them. Whether `vercel dev` needs them hasn't been checked yet; that happens in Milestone 3.

**Verified:** `npm test` (1 passed), `npm run typecheck` (exit 0), `npm run build` (succeeds).

## 2026-10-28 · Milestone 2: Pure lib functions + unit tests

**Asked for:** Pure, testable functions for input validation (including date edge cases), forecast summarizing, checklist merging and Claude response validation, each with unit tests.

**Built (all in `src/lib/`):**
- `types.ts`: shared request/response types, the activity/experience/verdict lists, and error codes the UI will map to friendly messages.
- `dates.ts`: YYYY-MM-DD helpers (`isValidIsoDate`, `addDays`, `daysBetween`, `todayInTimeZone`). The math runs on UTC day numbers, so results don't depend on the machine's time zone or DST.
- `validateInput.ts`: a zod schema with readable error messages, plus `checkDates(start, end, today)`. `today` is passed in, so the server can use the trip location's date and tests can pin it.
- `summarizeForecast.ts`: keeps only trip days from Open-Meteo's daily data, maps WMO weather codes to words, computes trip-wide extremes, and tolerates `null` values. It also exports `DAILY_VARIABLES` so the API requests exactly the fields this function reads.
- `checklist.ts`: hardcoded `TEN_ESSENTIALS` and `mergeChecklist`, which drops duplicates using a normalized key (case, punctuation, hyphens, simple plurals). The rule is deliberately simple: "Rain jacket" is *not* treated as a duplicate of "Rain gear".
- `validateClaudeResponse.ts`: strips an optional code fence, then `JSON.parse` and zod (exactly 3 risks, verdict enum, non-blank strings). It returns a result object and never throws.

**Tests:** 46 passing across 5 files. Date edge cases cover: start today, start yesterday, end before start, end = today+15 accepted, today+16 rejected, year rollover, leap day, a non-leap Feb 29, DST change, and time zones on either side of UTC midnight.

**What went wrong / how we fixed it:** Nothing failed in the code. One verification hiccup: `${PIPESTATUS[0]}` printed nothing because the shell is zsh, not bash. I re-ran `npm run typecheck` on its own and confirmed exit 0.

**Known limitation:** Plural stripping is naive (e.g. "matches" → "matche"). It's applied the same way to both sides of the comparison, so dedupe stays consistent, but it won't catch synonyms.

## 2026-10-28 · Milestone 3: `api/plan.ts` + handler tests

**Asked for:** The serverless function (validate → geocode → forecast → summarize → Claude → validate → respond) plus a handler test with mocked fetch and Anthropic client.

**Built:**
- `api/plan.ts`: a Web-standard `POST(req: Request)` handler.
  - Order: input validation (400) → API key check (500, generic message) → geocode with first result (404 if none) → date check against *today in the place's time zone* (400) → forecast in °F/mph/inches for exactly the trip dates → summary → Claude → zod validation of the output (502 if invalid) → merged checklist.
  - Outside responses (geocode, forecast) are also checked with zod before use. Fetches time out after 10 s.
- Claude call: `@anthropic-ai/sdk` 1.3.0, model from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `max_tokens: 1500`. It uses structured outputs (`output_config.format` built from the same zod schema via the SDK's `zodOutputFormat`) and `effort: "low"`. Thinking tokens count toward `max_tokens`, and low effort keeps thinking short. `stop_reason` is checked first: `refusal` and `max_tokens` each return a clear 502.
- `src/lib/prompt.ts`: system prompt and a pure `buildUserPrompt` (trip details, the Ten Essentials so Claude doesn't repeat them, forecast summary as JSON).
- Tests: `api/plan.test.ts` (12 cases: happy path incl. units and dedupe, `ANTHROPIC_MODEL` override, location not found, invalid model output, `max_tokens` cut-off, Anthropic throws, weather service down, invalid input, malformed JSON, dates out of range, the time-zone "today" rule, missing key) and `src/lib/prompt.test.ts`. All network calls are mocked.

**Verified:** `npm test` → 59 passed (7 files). `npm run typecheck` → exit 0. Mutation check: temporarily replacing the location time zone with `'UTC'` made exactly the time-zone test fail; reverted.

**What went wrong / notes:**
- I first tried to print the generated JSON schema by running a test file from outside the project; Vitest wouldn't pick it up. Reran it from inside the project and deleted the temp file afterwards.
- Finding: `zodOutputFormat` moves constraints the API doesn't support into schema `description` hints (verdict enum, exactly 3 risks, non-empty strings). The API enforces only the object shape (required keys, no extras). Our own zod check still enforces everything and returns a 502 on violation.
- `npm audit` reports high-severity advisories in `undici`/`@fastify/busboy`, all inside the Vercel CLI's dev-only dependency tree. Not fixed: the suggested `--force` fix downgrades the CLI to an older major version.
- The skipped esbuild install script turned out not to matter: esbuild 0.27.0 transforms TypeScript fine.
- **Not yet verified against the real services.** `npx vercel dev` needs a Vercel login and a real API key, so that end-to-end check is for Aarya to run.
- Server-side refusal fallbacks (`fallbacks: "default"`) were deliberately left out. For Sonnet 5.5 they only retry `cyber` / `frontier_llm` declines, which a trip planner shouldn't trigger. They also require the beta endpoint and would fail if `ANTHROPIC_MODEL` were set to a model that doesn't support them.
