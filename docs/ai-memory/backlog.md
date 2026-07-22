# What2Pick Backlog

## Known Requirements To Verify Or Extend

- Confirm whether "permanently see all elements" means visible throughout the current session only, or persisted across reloads.
- Confirm whether items should remain called "games" or become generic elements/options.
- Confirm whether the bracket should support only 4 elements or larger brackets.

## Proposed Technical Follow-Up

- Add more focused tests for random distribution behavior and editing/reset edge cases.
- Consider automating Playwright's Vite web server startup if Windows process shutdown behavior is resolved.
- Consider extracting bracket assignment and winner state logic from `src/App.tsx` if complexity grows.

## Unknown

- Persistence requirements.
- Deployment requirements.
- Target users and visual design direction.
- Browser/device support requirements.
