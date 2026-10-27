# Third-party notices

The root MIT license covers original contributions, not the ownership of third-party packages, Pokémon trademarks, characters or artwork. No official affiliation or endorsement is claimed. Original geometric placeholders are used instead of game artwork.

## Pokémon Showdown damage calculator

`@smogon/calc` **0.12.0**, published source commit `d7a69cf40616057ef40faf7623df7a628e58b535`:
[source and license](https://github.com/smogon/damage-calc/tree/d7a69cf40616057ef40faf7623df7a628e58b535).

Used as the calculation dependency and source of selected demo species/move mechanics. The visible patch in `patches/` modifies this MIT software. The handwritten sample text, illustrative move lists and fabricated usage are separate demo material. Names and underlying game intellectual property are not relicensed by this notice.

> Copyright (c) 2013-2025 Honko and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Pokémon Showdown mechanics reference

The speed and mechanics implementations reference [Pokémon Showdown](https://github.com/smogon/pokemon-showdown), including fixed-point speed modifiers and rounding. Its [MIT license](https://github.com/smogon/pokemon-showdown/blob/c0845f33d381402dfcb18ce324c20a94f18af075/LICENSE) is retained here. No complete upstream dataset or artwork is copied.

> Copyright (c) 2011-2026 Guangcong Luo and other contributors http://pokemonshowdown.com/

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Other runtime dependencies

| Dependency | License |
| --- | --- |
| React / React DOM | MIT |
| Floating UI | MIT |
| Zustand | MIT |
| Zod | MIT |
| idb-keyval | Apache-2.0 |

Their full notices remain in the installed packages. Vite also emits `dependency-licenses.md` alongside the compiled application; `project-notices.txt` contains this file and the project license. Retain both files when distributing a build. The Apache 2.0 text used by idb-keyval is included in `licenses/Apache-2.0.txt` and in the build notices.

No Champions Battle Data snapshot, API response archive, PokeAPI sprite collection, PKHeX resource file or private service configuration is distributed in this repository.
