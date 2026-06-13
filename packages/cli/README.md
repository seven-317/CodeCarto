# codecarto

> An interactive architecture map generated from your code — curated by hand, ready to present to non-technical people.

```bash
npx codecarto
```

Hand-drawn architecture diagrams go stale in three months; auto-generated dependency graphs are a 300-node hairball nobody can read. codecarto sits in between: it scans your TypeScript / Next.js project, lets you curate the result into business language, and gives you a map you can actually present.

## Quick start

```bash
# in any TS / Next.js project root (needs tsconfig.json)
npx codecarto              # scan + open the localhost map
npx codecarto map --watch  # watch sources, push changes to the browser live
npx codecarto scan --json  # print the graph as JSON for scripting
npx codecarto init         # create codecarto.config.ts (optional)

# after a global install, use the cct shorthand (cc is taken by Claude Code)
npm i -g codecarto
cct map --watch
```

- **Automatic analysis** — `import` / `export` / dynamic `import`, plus a Next.js semantic layer: Pages, API routes, `fetch('/api/…')` wiring, service nodes (Prisma, Stripe, …), `'use client'` boundaries.
- **Human curation** — rename, color, group, hide, pin, draw manual edges. Stored in `codecarto.map.json` (commit it); re-applied by stable node IDs after every rescan.
- **Communication** — highlight up/downstream chains, walk a data flow in presentation mode, export to PNG / SVG / self-contained interactive HTML.

Everything runs locally. The server binds to `127.0.0.1` only and validates the `Origin` header; your code never leaves your machine.

Full documentation, the map-file format and configuration options: **https://github.com/seven-317/CodeCarto**

## License

MIT
