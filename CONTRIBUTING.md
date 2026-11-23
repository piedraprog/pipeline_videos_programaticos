# Contributing

## Setup

```bash
bun run setup   # dependencies, Chromium, ffmpeg, Python packages, git hooks
bun test
bunx tsc --noEmit
```

You need Bun 1.3+, Node.js 24+, Python 3.10+ and Google Chrome.

## Rules

- One change per pull request, with [Conventional Commits](https://www.conventionalcommits.org/) messages.
- `bun test` and `bunx tsc --noEmit` must pass. For a visual change, also run the plan with `--qa-only` and attach the contact sheet to the pull request; a passing exit code is not visual proof.
- `src/schema.ts` is the source of truth for plan fields. Do not invent fields in a plan.
- Keep engine code generic. Brand names, copy, phone numbers and emails come from the plan or the brand kit, never from a template.

## Never commit private material

This repository is public. Client work lives in `private/` (git-ignored). The privacy guardrail runs on commit, on push and in CI; see "Private work stays out of git" in the README. Do not bypass it with `--no-verify`.

Do not add a brand kit you do not own. Brand assets are not covered by the MIT license (see `THIRD_PARTY_NOTICES.md`).

## Licensing of contributions

By contributing you agree that your code is released under the MIT license in `LICENSE`.
