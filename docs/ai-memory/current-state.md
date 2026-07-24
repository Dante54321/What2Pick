# What2Pick Current State

Last updated: 2026-07-23

## Confirmed Application State

- The repository contains a small React + TypeScript + Vite app.
- The app is currently implemented mostly in `src/App.tsx`.
- The UI is a dynamic 2-to-128 item bracket workflow for choosing a champion.
- The app uses local React state only, based on the inspected code.
- The README is still the default React + TypeScript + Vite template text.
- Vitest + React Testing Library are configured for automated UI behavior tests.
- Playwright is configured for end-to-end browser tests against a running Vite dev server.

## Implemented Product Behavior

- Add named items up to a maximum of 128.
- Display all added items in a list during the current app session.
- Assign each item to `Random` or a numeric bracket slot.
- Prevent duplicate fixed position assignments through disabled `<option>` entries.
- Shuffle items assigned to `Random`.
- Show a bracket preview with dynamic rounds.
- Start the bracket with 2 to 128 items.
- Move from setup into a separate winner-selection phase when the bracket starts.
- Hide setup while the bracket is started, with an option to return to setup and clear winners.
- Use a full-width bracket panel in the winner-selection phase so more rounds are visible.
- Generate one or more reduction rounds for non-power-of-two counts, grouping all participants into two-player or three-way matches with no automatic byes.
- Continue reduction rounds until the remaining winner count is a power of 2, then use regular two-player rounds.
- Select winners for each generated match.
- Populate later-round choices from earlier winners.
- Select and display a champion from the final match.
- Automated tests cover core setup, dynamic slot assignment, two-player flow, winner reset, and three-way opening match behavior.
- End-to-end Playwright spec exists for the 4-game champion selection flow in Chromium, updated for dynamic slot labels.

## Planned Or Required But Not Confirmed As Implemented

- Persistent storage across browser reloads is not confirmed.

## Latest Session Notes

- Added Vitest, jsdom, React Testing Library, user-event, and jest-dom.
- Added `npm run test` and `npm run test:watch`.
- Added initial tests for adding four games, duplicate fixed position prevention, semifinal winner advancement, champion selection, and champion reset.
- Verified `npm run test`, `npm run build`, and `npm run lint` pass.
- Added Playwright E2E setup and scripts: `test:e2e`, `test:e2e:ui`, and `test:e2e:debug`.
- Playwright tests require Vite to be running at `http://127.0.0.1:5173`.
- Verified `npm run test:e2e` passes when Vite is running.
- Replaced the fixed 4-item A/B semifinal bracket with a dynamic 2-to-128 bracket.
- The bracket builder uses numeric slots, random assignment, repeated two-player/three-way reduction rounds without automatic byes, and regular two-player rounds after the field reaches a power of 2.
- Updated unit tests and the Playwright spec for numeric slot labels and dynamic match labels.
- Verified `npm.cmd run test`, `npm.cmd run build`, `npm.cmd run lint`, and `npm.cmd run test:e2e` pass.
- `npm.cmd run test:e2e` was verified with Vite started and stopped inside the validation script; the Playwright config remains manual-server based.
- Corrected the opening-round rule so 9 items become 3 two-player matches and 1 three-way match, producing 4 winners.
- Corrected larger non-power-of-two counts such as 100 to use repeated reduction rounds instead of automatic byes.
- Split setup and winner selection into distinct UI phases.
- Expanded the started-bracket view to a full-width panel with a horizontal round track and an edit-setup action.
- Added unit coverage for hiding setup in the started-bracket phase.
- Verified `npm.cmd run test`, `npm.cmd run build`, `npm.cmd run lint`, and `npm.cmd run test:e2e` pass.
- Fixed bracket preview overflow by moving horizontal scrolling to a dedicated `.bracket-viewport` wrapper and making the setup preview span the full main width.
- Verified with 32-game desktop and mobile Playwright measurements that the page width stays within the viewport and the last round is reachable through bracket-only horizontal scroll.
- Added a sticky, synchronized top horizontal scrollbar for the bracket preview because large previews put the native horizontal scrollbar far below the visible round headers.
- Set bracket round grid items to align at the top so later rounds do not stretch to the height of the longest opening round.
- Made the setup `Add your games` panel span the full page width and changed the participant list to a responsive multi-column grid.
- Verified the participant grid with 100 games: 4 columns on 1280px desktop, 2 columns on 820px tablet, and 1 column on 390px mobile without horizontal page overflow.
- Reworked the visual identity with an inline decision/bracket logo mark, a teal/amber/dark background grid, and updated accent colors.
- Changed bracket rendering to an arena layout: left-side rounds, centered final, and mirrored right-side rounds, with the bracket scroll position centered around the final.
- Verified the centered bracket layout with 16-game desktop and 8-game mobile Playwright checks; the page still avoids global horizontal overflow.

## Initial Memory Setup Notes

- Created project memory files under `docs/ai-memory/`.
- Created project skill at `.agents/skills/what2pick-memory/SKILL.md`.
- Created root `AGENTS.md` with memory usage rules.
- Application code was not modified.
