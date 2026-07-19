# What2Pick Backlog

## Known Requirements To Verify Or Extend

- Confirm whether "permanently see all elements" means visible throughout the current session only, or persisted across reloads.
- Confirm whether items should remain called "games" or become generic elements/options.
- Confirm whether the bracket should support only 4 elements or larger brackets.

## Proposed Technical Follow-Up

- Add focused tests for bracket assignment, random distribution behavior, semifinal winner advancement, final selection, and champion reset behavior.
- Consider extracting bracket assignment and winner state logic from `src/App.tsx` if complexity grows.

## Unknown

- Persistence requirements.
- Deployment requirements.
- Target users and visual design direction.
- Browser/device support requirements.
