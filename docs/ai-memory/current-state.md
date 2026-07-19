# What2Pick Current State

Last updated: 2026-07-19

## Confirmed Application State

- The repository contains a small React + TypeScript + Vite app.
- The app is currently implemented mostly in `src/App.tsx`.
- The UI is a 4-item bracket workflow for choosing a champion.
- The app uses local React state only, based on the inspected code.
- The README is still the default React + TypeScript + Vite template text.

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

## Planned Or Required But Not Confirmed As Implemented

- Permanent persistence of the list across reloads: unknown / not confirmed.
- Automated tests for bracket assignment and winner advancement: not confirmed.
- Support for more than 4 elements: not confirmed.

## Initial Memory Setup Notes

- Created project memory files under `docs/ai-memory/`.
- Created project skill at `.agents/skills/what2pick-memory/SKILL.md`.
- Created root `AGENTS.md` with memory usage rules.
- Application code was not modified.
