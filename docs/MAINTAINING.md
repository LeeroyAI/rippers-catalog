# Maintaining Rippers

This is the operational map for keeping the Rippers repo tidy. The maintained app is the Next.js PWA in `rippers-app/`; the Swift/Xcode tree is legacy/reference unless a task says otherwise.

## Main App

Work in `rippers-app/` for product UI, PWA behavior, route handlers, and browser-facing features.

```bash
cd rippers-app
npm install
npm run sync-catalog
npm run dev
npm run build
npm run lint
```

From the repo root, the convenience wrappers are:

```bash
npm run web:sync-catalog
npm run web:dev
npm run web:build
npm run web:lint
```

## Catalog Flow

The source catalog snapshot lives at the repo root as `catalog.json`. The web app consumes `rippers-app/src/data/catalog.json`, refreshed by:

```bash
cd rippers-app
npm run sync-catalog
```

When `dashboard.html` changes, regenerate catalog data from the repo root:

```bash
node scripts/import_dashboard_data.js
```

That import may also regenerate legacy Swift data under `Rippers/Data/`.

## Deployment

For the web app, configure Vercel with `rippers-app` as the project root, or deploy the monorepo with an equivalent root-directory setting. Ensure `src/data/catalog.json` exists before `next build`; in CI, run `npm run sync-catalog` before building if needed.

The optional root `api/search.js` live-search function is separate from the Next.js app route handlers. It requires:

- `BRAVE_SEARCH_API_KEY`
- `ANTHROPIC_API_KEY`

## Agent Docs

Keep these files in sync:

- `AGENTS.md` — Codex-facing
- `CLAUDE.md` — Claude-facing

Both should describe the same app architecture and team roster. The Frankie/team section is a conversational persona layer; it should not block coding agents from making repo changes when Leeroy asks for implementation work.

## Legacy Swift

Use the Swift/Xcode tree only for legacy reference or explicit Swift tasks.

```bash
xcodebuild -project Rippers.xcodeproj -scheme Rippers -showdestinations
swift test
ruby scripts/generate_xcodeproj.rb
```

`Package.swift` is for Swift filter-core tests only. Do not add SwiftUI app files to it.

## Git Hygiene

The repo ignores Xcode `xcuserdata`, `.next`, `node_modules`, and generated local state where possible. If a user-state file is already tracked, `.gitignore` will not hide it; remove it from the index intentionally in a separate cleanup commit.
