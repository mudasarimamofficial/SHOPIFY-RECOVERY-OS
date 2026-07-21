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

## 🧠 ENGINEERING BRAIN - SELF-MAINTAINING MEMORY (MANDATORY)

This repository contains a permanent engineering brain located in `/PROJECT_BRAIN`. It is **NOT** optional documentation; it is the source of truth for the entire application.

Before making any code changes, you **MUST**:

1. Read `/PROJECT_BRAIN/00_START_HERE/03_AI_Handover.md`.
2. Read `/PROJECT_BRAIN/00_START_HERE/02_Current_Status.md` to check for blockers and tech debt.

After making any code changes, you **MUST** automatically update the brain to prevent documentation drift:

1. Update any relevant files in `02_ARCHITECTURE`, `04_DATABASE`, or `05_SHOPIFY`.
2. **CRITICAL**: If you modified a source file in `src/`, you MUST update its corresponding documentation file in `/PROJECT_BRAIN/03_CODEBASE/FILES/`.
3. Update `/PROJECT_BRAIN/00_START_HERE/02_Current_Status.md` to reflect the new state of the branch and next steps.
4. If you changed a major architectural pattern, create a new `ADR-XXXX.md` in `09_HISTORY/`.
5. If you discovered or fixed a bug, create a new `BUG-XXXX.md` in `09_HISTORY/`.

**Do not consider your task complete until the `/PROJECT_BRAIN` reflects your changes.**
