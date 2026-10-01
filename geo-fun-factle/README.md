# Geo Funfactle

Geo Funfactle is the daily country game served at `geo-fun-factle.kak.im`. It uses the internal ID `geo-fun-factle` for API routes and storage while keeping the human-facing title stable.

## Rules and screens

The daily answer is selected from countries with six complete facts by `getRandomSelectionForToday(countries, 'geo-fun-factle')`. Players get six attempts. Each wrong answer or Skip consumes one attempt and reveals the next clue. A correct sixth answer wins; the sixth wrong answer or Skip ends the game. Answers come from the shared country list, with keyboard and pointer autocomplete selection. Duplicate and invalid guesses do not use attempts.

Every visit to an unfinished game opens the welcome screen. Start game restores that day's saved attempts and clues. A completed save opens its result directly. Results show the original flag, all six facts, and only the attempts actually made. Fresh completion opens the stats dialog after a short delay; a restored completion does not repeat API writes or confetti.

## Code contracts

`gameState.js` exports three pure helpers:

- `hasCompleteClues(record)` returns whether all five text facts and the positive finite population exist.
- `formatPopulation(population)` returns a rounded English display value.
- `applyAttempt(state, countryOrNull, answer)` returns `{ state, error }`. `null` means Skip; guesses must be country names from the shared dataset. It returns a new state and attempts array for accepted turns.

`game.js` owns the screens, accessible autocomplete, persistence, daily answer, and stats side effects. It validates loaded saves and rebuilds the result from attempts. The current UTC day is checked on Start, Guess, and Skip, so an idle tab resets before it can submit against yesterday's puzzle.

The daily state uses `geo-fun-factle-YYYY-MM-DD`. Local aggregate stats use `geo-fun-factle-stats`, in the shared stats helper's shape. If browser storage is unavailable, the current visit remains playable and reports that progress cannot be saved. A failed API write leaves the local result available and displays a sync message; ambiguous requests are not retried automatically.

## Local validation and release

The Passport presentation keeps the title, Daily Games link and Stats button above the notebook. Its globe artwork and dated postmark are decorative; neither identifies the answer. Playing shows six attempt dots, punched notebook edges, numbered clue rows, tinted guess/skip cards, an active clue wash, and the next clue's label. The latter disappears after the sixth clue. Welcome and results use the same paper treatment; progress appears only while playing. At narrow widths the navigation sits above the title and the notebook gutter shrinks so clues and controls retain usable space.

Local artwork lives in `art/`. `globe.webp` was generated with the built-in imagegen tool and compressed to a 512px WebP. The grain and postmark waves are SVG decorations. All labels, clue values, dates and controls remain HTML. The browser suite captures welcome, a restored three-clue state at desktop/phone sizes, and results for visual inspection, alongside keyboard, storage and reflow checks.

Globe generation prompt:

> Use case: illustration-story. Asset type: small decorative globe illustration for a vintage passport notebook web game. Create ONLY a single isolated spherical globe, centered, nearly filling square canvas, with genuinely transparent background. Fine slightly irregular navy blue pen line art (#315c87), pale blue watercolor shading mostly transparent. Show recognizable North and South America on left/center, Europe and Africa toward right edge, delicate latitude and longitude curves. Flat hand-drawn vintage atlas style like a 1940s passport stamp, not emoji, not 3D glossy. Circular globe outline with no stand, no pedestal, no orbit, no shadow outside globe, no words, no labels, no lettering, no flags. Minimal subdued wash and textured ink strokes. This is decorative world geography and must not identify a specific country.

The static image copies this directory to `/srv/geo-fun-factle`, and Nginx serves production and `test.*` hosts. Kubernetes owns their ingress and API CORS origins. Static-only game changes are included in the reusable build workflow's path filter. The fifth landing card follows the shared catalogue markup and reuses the globe at `landing/assets/geo-fun-factle.webp`, served through `/assets/landing/`.

From the repository root, run `npm test`, `npm run test:e2e`, `kubectl kustomize kube`, and `kubectl kustomize kube/test`. The browser suite uses Docker and the existing Colima socket. API database-counter coverage requires an isolated Postgres with `api/db/setup-env.sql` applied; the remaining API tests can run without Postgres.
