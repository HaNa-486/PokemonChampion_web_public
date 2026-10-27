# Public edition scope

This is an independent, static portfolio edition. It preserves representative application code and meaningful tests while replacing the private service's data and delivery infrastructure. It does not change or deploy that service.

## File inventory

| Material | Public disposition | Location / reason |
| --- | --- | --- |
| Catalog, pickers, tooltips, bilingual interface, team editor, type chart, speed, damage, scrapbooks | Retain and adapt | `components/`; remove server routes and real-source claims; preserve local interactions. |
| Stat/AP rules, validation, type matchups, speed and damage adapters, form transitions, import/export, persistence | Retain | `lib/`; original implementation, with third-party mechanics attribution. |
| Catalog/release/provenance/history/usage adapters | Rewrite | `lib/` and `data/`; one fixed demo catalog and fabricated usage, no live provider or claim of official eligibility. |
| Small demonstration catalog | Newly prepare | `data/`; selected MIT calculator records plus original short text. Move lists and usage are illustrative, not copied game/upstream dumps. |
| Calculator corrections | Retain with notices | `patches/@smogon__calc@0.12.0.patch`; readable changes to the pinned MIT dependency. |
| Calculation, storage and interaction tests | Select and adapt | `tests/`; tests of observable behavior and data boundaries, not production pipeline procedures. |
| Build and dependency settings | Newly prepare | Vite, TypeScript, Vitest, pnpm lockfile and one read-only CI workflow. No deployment, secrets or schedules. |
| Artwork | Replace | `public/demo-token.svg`; original geometry. No game sprites, scraped images, logos or production screenshots. |
| Game/API snapshots, real rankings, raw responses and historical data | Exclude | Permission to use an API does not automatically permit a public database dump or permanent mirror. |
| Bulk translations and extracted game strings | Exclude | No imported PKHeX or unreviewed translation dataset. Small demo text is manually authored. |
| Server/admin endpoints, authentication, database schema/migrations, worker and hosting configuration | Exclude | Not needed for the browser demo; avoid exposing private environment and access assumptions. |
| Sync/review/monitoring/release scripts and operational tests | Exclude | No services to operate here. CI only checks the demo's code, tests and build. |
| Private Git history, issues, PR discussions, logs, artifacts, screenshots and `.pdos` | Exclude | Fresh history avoids exposing deleted files, personal email, machine paths and internal incident/deployment detail. |
| Personal identity and browser storage names | Anonymize / isolate | Public author identity is the GitHub handle; new history uses GitHub noreply email. Browser keys use a demo namespace. |

The repository's actual tracked tree is the authoritative public file list. Do not copy an entire private checkout into it; explicitly choose the source or asset needed for a contribution.

## Permission boundaries

- Original source is MIT under the owner's choice. Keep license and attribution in redistributions.
- `@smogon/calc` and the referenced Showdown mechanics are MIT software; their copyright notices are retained. Selected records are examples from the pinned engine, not an independent grant of rights over Pokémon intellectual property.
- **Not included; permission needed before adding:** complete Champions Battle Data exports or mirrors. Its [API rules](https://championsbattledata.com/api-rules/) distinguish application use/caching from redistributing raw data or a data service.
- **Not included; asset rights need separate confirmation:** Pokémon sprites, artwork and logos. A repository software license is not necessarily a license to the depicted characters or images. See the [PokeAPI sprites notice](https://github.com/PokeAPI/sprites/blob/7a7d66b1620e646f69afd48dc1273da9033ede9c/LICENCE.txt).
- **Not included; review obligations before adding:** extracted game/localization resources and GPL software. Do not assume the project's MIT license overrides their original terms.

## Portfolio and community focus

This edition exposes the interaction design, domain boundaries, calculation adapters, persistence and tests. That makes it useful for a reviewer to run and inspect, and gives contributors a small reproducible environment.

MIT also allows others to copy and commercially reuse the original code with its notice. A public codebase is therefore not an exclusivity barrier. Ongoing value comes from useful product decisions, accurate maintained data, testing and user trust; private credentials or undocumented infrastructure are not a meaningful product advantage.

Community work should improve one visible capability or correctness boundary at a time. Use one pull request with the reason, relevant checks and any user-visible limit. No PDOS records, additional approval ledger or maintenance framework is needed.
