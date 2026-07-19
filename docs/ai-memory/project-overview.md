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
- `npm run preview`: run `vite preview`.

## Tests

- No test command is configured in `package.json`.
- No automated test files were confirmed during the initial memory setup.

## Product Requirements

Known requirements from the user:

- The user creates a list of elements to compare through an elimination bracket.
- The user can permanently see all elements in the list.
- The user can manually assign elements to positions such as A1, A2, B1, and B2, or distribute them randomly.
- A bracket preview should update while the bracket is configured.
- The system should correctly handle winners advancing between rounds, semifinals, and final.

## Confirmed Implementation

Confirmed in `src/App.tsx`:

- Users can add up to 4 items, currently labeled as games in the UI and code.
- The current list is rendered while items exist.
- Items can be removed before the bracket starts.
- Each item has a `position` of `random`, `A1`, `A2`, `B1`, or `B2`.
- The UI prevents selecting a fixed bracket position already used by another item.
- Random items are assigned to available fixed positions using `randomOrder`.
- Random items can be shuffled before the bracket starts.
- The bracket preview renders semifinals for A1 vs A2 and B1 vs B2.
- The bracket can start only when exactly 4 items have been added.
- Starting the bracket locks item editing.
- Semifinal winners can be selected after the bracket starts.
- The final is populated from semifinal winners.
- A champion can be selected once both semifinal winners exist.
- Changing a semifinal winner clears the current champion.
- Returning to setup clears semifinal winners and champion.

## Unknown Or Not Confirmed

- Persistent storage across browser reloads is not confirmed.
- Deployment target is unknown.
- Production design goals are unknown.
- Accessibility requirements beyond current HTML semantics are unknown.
- Browser support targets are unknown.
