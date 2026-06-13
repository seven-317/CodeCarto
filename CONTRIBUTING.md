# Contributing to codecarto

**[English](CONTRIBUTING.md) · [繁體中文](CONTRIBUTING.zh-tw.md)**

Thanks for your interest!

## Development setup

Node >= 20, pnpm 10.

```bash
pnpm install
pnpm build
pnpm test
```

## Easiest way to contribute: service detection rules

`BUILTIN_SERVICE_RULES` in `packages/analyzer/src/services.ts` is a pure data table —
adding a rule (e.g. `@upstash/qstash` → Queue) is a single line plus a fixture test.
These PRs get priority review and are the main source of `good-first-issue`s.

## Testing

- Analyzer behavior is verified against a fixture project: `packages/analyzer/test/fixtures/next-app/`.
  When you add parsing capabilities, extend both the fixture and `test/scan.test.ts`.
- Server API behavior: `packages/server/test/server.test.ts`.

## PR guidelines

- One PR, one thing.
- `pnpm build && pnpm typecheck && pnpm test` all green.
- Include a screenshot for UI changes.
