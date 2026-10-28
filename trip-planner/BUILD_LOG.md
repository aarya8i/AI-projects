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
