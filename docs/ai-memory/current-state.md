# What2Pick Current State

Last updated: 2026-07-22

## Confirmed Application State

- The repository contains a small React + TypeScript + Vite app.
- The app is currently implemented mostly in `src/App.tsx`.
- The UI is a 4-item bracket workflow for choosing a champion.
- The app uses local React state only, based on the inspected code.
- The README is still the default React + TypeScript + Vite template text.
- Vitest + React Testing Library are configured for automated UI behavior tests.
- Playwright is configured for end-to-end browser tests against a running Vite dev server.

## Implemented Product Behavior

- Add named items up to a maximum of 4.
- Display all added items in a list during the current app session.
- Assign each item to `Random`, `A1`, `A2`, `B1`, or `B2`.
- Prevent duplicate fixed position assignments through disabled `<option>` entries.
- Shuffle items assigned to `Random`.
- Show a bracket preview with semifinal positions and final placeholders.
- Start the bracket only with exactly 4 items.
- Lock setup while the bracket is started.
- Select winners for Match A and Match B.
- Populate final choices from semifinal winners.
- Select and display a champion.
- Automated tests cover core setup and bracket flow behavior.
- End-to-end Playwright coverage confirms the 4-game champion selection flow in Chromium.

## Planned Or Required But Not Confirmed As Implemented

- Permanent persistence of the list across reloads: unknown / not confirmed.
- Support for more than 4 elements: not confirmed.

## Latest Session Notes

- Added Vitest, jsdom, React Testing Library, user-event, and jest-dom.
- Added `npm run test` and `npm run test:watch`.
- Added initial tests for adding four games, duplicate fixed position prevention, semifinal winner advancement, champion selection, and champion reset.
- Verified `npm run test`, `npm run build`, and `npm run lint` pass.
- Added Playwright E2E setup and scripts: `test:e2e`, `test:e2e:ui`, and `test:e2e:debug`.
- Playwright tests require Vite to be running at `http://127.0.0.1:5173`.
- Verified `npm run test:e2e` passes when Vite is running.

## Initial Memory Setup Notes

- Created project memory files under `docs/ai-memory/`.
- Created project skill at `.agents/skills/what2pick-memory/SKILL.md`.
- Created root `AGENTS.md` with memory usage rules.
- Application code was not modified.
