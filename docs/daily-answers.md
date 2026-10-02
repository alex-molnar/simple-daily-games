# Daily answers

All five games use `getRandomSelectionForToday(selections, salt)` in
`shared/mathHelpers.js`. The salt is the game ID; the candidate list must keep
the same order across clients for everyone to receive the same answer.

The selector hashes the full UTC date and game ID with FNV-1a, then applies the
MurmurHash3 32-bit finalizer before mapping the result into the candidate list.
This removes the old numeric-date formula's correlated answers at month
boundaries. It is deterministic pseudorandom selection: occasional repeats are
still possible, and future answers can be computed from the source.

Changing the algorithm or candidate ordering changes the daily schedule. Deploy
such changes at a UTC day boundary to avoid changing answers during play. The
flag and country games select their answer on page load; reload an old tab to
get the current day's puzzle. Automatic tab rollover is unchanged by this fix.

Run `npm test` for schedule and calendar-boundary regression checks, and
`npm run test:e2e` for browser checks, including same-day reload consistency and
the September 30 / October 2 flag regression.
