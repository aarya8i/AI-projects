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
