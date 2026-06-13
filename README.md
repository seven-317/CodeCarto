# codecarto

> An interactive architecture map generated from your code, curated by hand, and built to be presented to non-technical people.

**[English](README.md) · [繁體中文](README.zh-tw.md)** · **[Live demo](https://seven-317.github.io/CodeCarto/)**

```bash
npx codecarto
```

Engineers constantly have to explain how a system is wired to people who don't read code — clients, PMs, managers. Hand-drawn architecture diagrams go stale within three months; auto-generated dependency graphs are a 300-node hairball nobody can read. codecarto sits between the two with a three-layer model:

1. **Automatic analysis** — ts-morph scans `import` / `export` / dynamic `import`, plus a Next.js semantic layer: Pages, API routes (with HTTP methods), `fetch('/api/…')` wiring, service nodes (Prisma, Stripe, …), and `'use client'` boundaries. Always in sync with the code.
2. **Human curation** — rename into business language ("Member login"), color, group, hide, pin, draw manual edges. Curation lives in `codecarto.map.json` (commit it) and is re-applied by **stable node IDs** after every rescan, so renaming a file never loses your work.
3. **Communication** — click a node to highlight its up/downstream chain, search to fly to a node, walk a data flow in presentation mode, and export to PNG / SVG / self-contained interactive HTML to hand straight to a client.

Everything runs locally. The server binds to `127.0.0.1` only and validates the `Origin` header (DNS-rebinding protection); your code never leaves your machine.

## Quick start

```bash
# in any TS / Next.js project root (needs tsconfig.json)
npx codecarto              # scan + open the localhost map
npx codecarto map --watch  # watch sources, push changes to the browser live
npx codecarto scan --json  # print the graph as JSON for scripting
npx codecarto init         # create codecarto.config.ts (entirely optional)

# after a global install, use the cct shorthand (cc is taken by Claude Code)
npm i -g codecarto
cct map --watch
```

The first run scans your project, opens the browser, and writes nothing except — once you start curating — `codecarto.map.json` in the project root.

## CLI reference

| Command | Description |
| --- | --- |
| `codecarto [map] [dir]` | Scan `dir` (default: cwd) and open the localhost map. `map` is the default command, so `codecarto` alone works. |
| `codecarto scan [dir]` | Scan only; prints a kind/edge summary. With `--json`, writes the full graph JSON to stdout. |
| `codecarto init [dir]` | Write a `codecarto.config.ts` template. Config is entirely optional — zero-config works. |

**`map` options**

| Flag | Default | Description |
| --- | --- | --- |
| `-p, --port <port>` | `4870` | Preferred port; the next free port is used if taken. |
| `-w, --watch` | off | Watch source files and push rescans to the browser live; new nodes flash green. |
| `--no-open` | opens | Don't open the browser automatically. |

`cct` is an alias for `codecarto` — every command and flag is identical.

## Using the map

| Action | How |
| --- | --- |
| Highlight a chain | Click a node — its up/downstream chain stays lit, everything else dims. |
| Rename | Double-click a node, or right-click → Rename. Empty value restores the auto label. |
| Color / hide / pin / group | Right-click a node for the context menu. Pinned nodes keep their position across rescans. |
| Manual edge | Right-click → Connect to…, then click the target node. |
| Move | Drag a node; it follows the cursor and the position is saved on drop. |
| Search | Type in the toolbar search box; Enter flies to the first match. |
| Externals / Hidden | Toolbar chips toggle visibility of external packages and hidden nodes. |
| Relayout | Recompute the automatic layout; pinned nodes stay put. |

**Keyboard** — `Esc` exits one layer at a time (walk → presentation → selection/menu). In presentation mode, `←` / `→` / `Space` step along the path.

### Presentation mode

Click **Present** to hide all chrome (toolbar, legend, minimap, controls), enlarge node labels, and drop file-path metadata. Click any node to start a **walk**: its chain is ordered left-to-right (Page → … → Service) and the arrow keys step through it, panning the camera node by node like presentation slides.

### NamedView

The **Views** dropdown saves the current subset (an active filter, a highlighted chain, or the whole map) plus the current viewport as a named view. Apply one to filter the canvas down to that subset and fly to the saved camera; switch back to **Full map** any time. Views are stored in `codecarto.map.json`.

### Stale curation & rename migration

When a curated node no longer exists in the graph (a file was renamed or deleted), an amber **Stale N** chip appears. For each stale entry it suggests a migration target — a node of the same kind with the same basename — and migrating moves the label, color, position, annotations, and view references over in one atomic write. You can also drop entries individually or all at once.

### Export

| Format | What you get |
| --- | --- |
| **PNG** | Bitmap at 2× device pixels, framing the whole graph regardless of the current zoom/pan. |
| **SVG** | Hand-built vector: bezier edges, per-color arrow markers, striped service nodes — not a DOM screenshot. |
| **HTML** | A single self-contained file: the SVG plus an inline vanilla-JS viewer with pan/zoom and click-to-highlight. Opens offline, no dependencies. |

Edge **flow animation** (packet dots traveling source → target) is a host-browser affordance only; it is hidden during PNG export and at far zoom, and never embedded in SVG/HTML exports.

## Configuration (optional)

```ts
// codecarto.config.ts
import { defineConfig } from 'codecarto'

export default defineConfig({
  include: ['src', 'app'],          // globs to scan (default: inferred)
  exclude: ['**/*.stories.tsx'],    // globs to skip
  tsconfig: 'tsconfig.json',        // override tsconfig location
  services: [
    // stack custom service rules on top of the built-ins
    { match: 'import:@upstash/redis', label: 'Redis', icon: 'database' },
  ],
})
```

Service rules match by module specifier prefix (`import:<prefix>`). Built-in rules cover Prisma, Drizzle, Mongoose, Supabase, Stripe, Resend, Nodemailer, AWS SDK, Upstash/ioredis, Firebase, OpenAI, and Anthropic. The rule table — [`packages/analyzer/src/services.ts`](packages/analyzer/src/services.ts) — is the best entry point for community contributions; PRs welcome.

## The `codecarto.map.json` format

A single JSON file at the project root, written with stable key ordering for clean diffs. Commit it. Every entry is keyed by a **stable node ID** (relative file path or route path), so curation re-applies after a rescan.

```jsonc
{
  "version": 1,
  "nodes": {
    "src/components/UserList.tsx": { "label": "Member list", "color": "#d71921", "pinned": true },
    "service:payments-stripe":     { "label": "Billing", "hidden": false, "groupId": "payments" }
  },
  "groups":  { "payments": { "label": "Payments", "color": "#4a9e5c" } },
  "layout2d": { "src/components/UserList.tsx": { "x": 120, "y": 80 } },
  "annotations": [
    { "type": "edge", "id": "a1", "from": "page:/", "to": "service:payments-stripe", "label": "checkout" }
  ],
  "views": [
    { "id": "v1", "label": "Member flow", "nodeIds": ["page:/", "src/components/UserList.tsx"] }
  ]
}
```

| Key | Meaning |
| --- | --- |
| `nodes` | Per-node curation: `label`, `color`, `icon`, `hidden`, `pinned`, `groupId`. |
| `groups` | Group definitions: `label`, `color`, `collapsed`. |
| `layout2d` | Manual node positions; absent nodes use the automatic layout. |
| `annotations` | Manual `edge` / `text` / `frame` overlays. |
| `views` | NamedViews: a node subset (empty = all) plus an optional viewport. |

## Architecture

pnpm workspace + turborepo. Published as a single package, `codecarto`, with internal packages bundled in at build time.

| Package | Responsibility |
| --- | --- |
| `packages/shared` | Graph / MapFile / Config types and zod schemas — the single source of truth. |
| `packages/analyzer` | ts-morph scan, Next.js semantic extraction, service rule table, graph cache. |
| `packages/server` | localhost HTTP + WebSocket, atomic `codecarto.map.json` writes, Origin/Host validation. |
| `packages/ui` | Vite + React 19 + xyflow + elkjs 2D canvas and curation UI. |
| `packages/cli` | commander entry point; copies the UI build into `dist/ui` at package time. |
| `site` | Next.js (App Router, static export) docs site + embedded live demo; bilingual via next-intl, theming via next-themes. |

## Development

```bash
pnpm install
pnpm build        # build everything (cli copies the ui build into dist/ui)
pnpm test         # vitest (analyzer fixture tests + server integration tests)
pnpm typecheck
pnpm build:site   # assemble the docs site + demo into site/dist

# run against a real project from source
node packages/cli/dist/cli.js map <some-next-app>
```

The docs site (`site/`) builds to a static export and deploys to GitHub Pages via `.github/workflows/pages.yml` on push to `main`. The hosted demo embeds the real UI in a demo build (`VITE_CARTO_DEMO=1`): graph and curation load from static JSON, the WebSocket is disabled, and curation lives in memory only.

## Privacy & security

- Scanning runs entirely on your machine.
- The server binds to `127.0.0.1` only and validates the `Host` and `Origin` headers (DNS-rebinding protection).
- The analysis cache goes to `node_modules/.cache/codecarto/`, not your source tree.
- The only file ever written to your project is `codecarto.map.json`.

## Roadmap

- **M1 — Foundation** ✅ — analyzer, server, CLI, 2D canvas + curation, Nothing-style UI (light + dark).
- **M2 — Communication** ✅ — presentation mode & path walk, SVG / self-contained HTML export, NamedView, stale-curation cleanup & rename migration.
- **M3 — Experience & reach** ✅ — large-graph virtualization (viewport culling + low-zoom LOD, ELK fallback for dense graphs), docs site + hosted demo.
- Dropped: 3D view — looks impressive, isn't useful; 2D + curation + presentation already covers the communication need.

## License

MIT
