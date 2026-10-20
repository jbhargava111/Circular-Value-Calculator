<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All arithmetic lives in `src/lib/calc.ts` (pure, deterministic); the AI analyst (`src/routes/api/analyst.ts`) and rule-based fallback only call tools from `src/lib/agent-tools.ts` — keeps figures verifiable and never model-invented.
- Blank inputs are `null` and block dependent outputs; never coerce to zero — the spec requires missing data to be flagged.
- Programs persist in browser localStorage via `src/lib/store.tsx` — simplest reliable storage, no backend required for the core calculator.
- Evaluation cases in `src/lib/eval-cases.ts` power both the in-app test panel and `src/test/calc.test.ts`.
