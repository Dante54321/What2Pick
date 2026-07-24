# What2Pick Project Overview

## Confirmed Stack

- Frontend app built with React, TypeScript, and Vite.
- Package manager state is npm-based, with `package-lock.json` present.
- Main app entry: `src/main.tsx`.
- Main UI and bracket logic: `src/App.tsx`.
- Styling: `src/App.css` and `src/index.css`.
- Static assets are in `public/` and `src/assets/`.

## Available Commands

Confirmed from `package.json`:

- `npm run dev`: start Vite dev server.
- `npm run build`: run `tsc -b` and `vite build`.
- `npm run lint`: run `oxlint`.
- `npm run test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:e2e`: run Playwright end-to-end tests against a running Vite server.
- `npm run test:e2e:ui`: open Playwright UI mode against a running Vite server.
- `npm run test:e2e:debug`: run Playwright debug mode against a running Vite server.
- `npm run preview`: run `vite preview`.

## Tests

- Vitest is configured through `vite.config.ts` with the `jsdom` environment.
- React Testing Library setup lives in `src/setupTests.ts`.
- Initial app behavior tests live in `src/App.test.tsx`.
- Playwright is configured through `playwright.config.ts`.
- End-to-end specs live under `tests/e2e/`.
- Playwright expects Vite at `http://127.0.0.1:5173`.

## Product Requirements

Known requirements from the user:

- The user creates a list of elements to compare through an elimination bracket.
- The user can keep the list, positions, and bracket progress across browser reloads on the same device/browser.
- The user can manually assign elements to numeric bracket slots, or distribute them randomly.
- A bracket preview should update while the bracket is configured.
- The system should correctly handle winners advancing between rounds, semifinals, and final.

## Confirmed Implementation

Confirmed in `src/App.tsx`:

- Users can add 2 to 128 items, currently labeled as games in the UI and code.
- The current list is rendered while items exist during the setup phase.
- Items can be removed before the bracket starts.
- Each item has a `position` of `random` or a numeric bracket slot.
- The UI prevents selecting a fixed bracket slot already used by another item.
- Random items are assigned to available numeric slots using `randomOrder`.
- Random items can be shuffled before the bracket starts.
- The bracket preview renders dynamic rounds for the current item count.
- The bracket can start when at least 2 items have been added.
- Starting the bracket moves the UI into a separate winner-selection phase.
- Non-power-of-two counts use one or more reduction rounds with two-player or three-way matches and no automatic byes.
- Winner selections populate later-round choices, and changing a prior winner clears dependent later winners.
- A champion is displayed after the final winner is selected.
- Returning to setup clears selected winners and the champion.
- Browser `localStorage` persists games, positions, started state, selected winners, and champion.
- Automated tests cover core setup, dynamic slot assignment, winner advancement, winner reset, three-way opening matches, and E2E champion selection.

## Unknown Or Not Confirmed

- Login/profile support is not implemented.
- Deployment target is unknown.
- Production design goals are unknown.
- Accessibility requirements beyond current HTML semantics are unknown.
- Browser support targets are unknown.
