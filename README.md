# Champions Lab — interactive portfolio

A bilingual Pokémon team-building interface demonstrating domain modelling, browser persistence, accessible pickers, and conditional battle calculations. Built with React, TypeScript and Vite.

**This repository is a standalone DEMO.** Its small catalog and fabricated rankings illustrate interactions. They are not current usage statistics, official eligibility, complete learnsets, or a replacement for live game data. No account, API key, backend or upstream connection is required.

這是獨立的求職作品展示版：保留主要網站互動，以少量範例與虛構排名展示功能。不是即時使用率、官方參賽資格或完整遊戲資料；不會連線至原正式站。

## Run locally

Use Node **24.16+ within the 24.x release line** and **pnpm 11.16.0**. Other supported Node versions are listed in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. For the compiled version:

```sh
pnpm build
pnpm preview
```

## Try the interaction

- Browse the Pokémon, move, ability and item catalogs. Combine filters, inspect details, and switch English / 繁體中文 or theme.
- Build a team with moves, abilities, held items, natures and AP. Invalid AP allocations, duplicate species/items and incompatible Mega forms are checked explicitly.
- Save a named team plan, export/import JSON with a preview, or collect alternative builds in scrapbooks. Data stays in this browser's IndexedDB; clearing browser data removes it.
- Compare speed under AP, nature, Tailwind, weather and Trick Room conditions.
- Load the damage example, change a move or defensive investment, and inspect the damage range and assumptions. This is conditional damage, not win probability or a complete battle simulator.

The interface uses original geometric placeholders instead of game artwork. Demo usage is shared across catalog ordering, detail panels and build recommendations; it does not refresh on a timer or contact an API.

## Engineering decisions

| Area | Implementation and tradeoff |
| --- | --- |
| UI | React components retain the catalog, team and calculation workflows. A persistent DEMO label separates sample values from real observations. |
| Domain | Pure TypeScript handles AP/stat validation, type effectiveness, speed comparisons and form reconciliation. Zod validates imported and persisted structures. |
| Damage | Pinned `@smogon/calc` 0.12.0 with a small, visible MIT patch; explicit conditions and unsupported cases rather than invented precision. |
| Data | Eight selected engine species, manually authored short descriptions and illustrative move lists. Fabricated usage comes from one deterministic module. |
| Persistence | Zustand plus IndexedDB for device-local teams, named plans and scrapbooks; no server account or tracking. |
| Delivery | One CI job runs types, focused tests and the static build. No scheduled synchronization, monitoring or deployment system. |

See [publication scope](docs/publication-scope.md) for what is included, excluded, rewritten and still requires permission before reuse. The private service and its infrastructure are maintained separately; this repository starts with fresh history.

## Verify and contribute

```sh
pnpm verify
```

Tests cover representative calculation boundaries, demo consistency, local persistence and UI interactions. They do not claim exhaustive validation against the proprietary game engine.

Small fixes to accessibility, interactions, calculations and tests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). A change does not need new process records.

## License

Original source, original sample text and geometric artwork: [MIT](LICENSE). Dependencies and derived mechanics retain their own notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Pokémon names and other third-party intellectual property remain with their respective owners. MIT does not grant trademark, character or game-art rights. This is an unofficial fan-made technical demonstration with no affiliation or endorsement.
