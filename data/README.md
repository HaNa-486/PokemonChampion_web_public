# Public demonstration data

This directory contains a newly authored miniature fixture, not exported production data.

- `demo-catalog.ts` selects eight Pokémon/forms, twenty moves, twelve abilities and six items. Species names, types, base stats and damage-related move fields are read from the pinned `@smogon/calc` 0.12.0 dependency. Short explanations and Chinese labels are authored for this demo.
- Species move lists and ability selections are illustrative subsets. Catalog membership means selectable in this demo; it does not certify current competitive eligibility or complete learnsets.
- `demo-usage.ts` fabricates every percentage, rank, teammate and example spread. Values are deterministic across dates. There are no game samples, source collection dates, live checks, upstream requests or automatic refreshes.
- `damage-ability-coverage.json` records the supported scope for the fixture's twelve abilities. It was checked against the pinned engine branches and the local damage adapter; it is not exhaustive game validation.
- Move accuracy and PP are not supplied by the damage dependency and are omitted from this fixture. `accuracy: null` and `pp: 0` mean unavailable.
- All images use one original local demo token. No game artwork, remote sprite cache, official roster, localization dump, production statistics or release history is included.

`@smogon/calc` is MIT-licensed: [upstream repository](https://github.com/smogon/damage-calc). Its data is used through the installed dependency rather than copied into a snapshot. See the repository's third-party notices for the dependency's license and trademark boundaries.
