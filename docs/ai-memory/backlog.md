# What2Pick Backlog

## Known Requirements To Verify Or Extend

- Confirm whether items should remain called "games" or become generic elements/options.
- Confirm whether the current 2-to-128 bracket limit is the desired long-term cap.
- Define login/profile requirements for the web version and future app version.
- Decide whether profiles should use an external auth provider, a custom backend, or local-only named profiles.

## Proposed Technical Follow-Up

- Add more focused tests for random distribution behavior and editing/reset edge cases.
- Consider automating Playwright's Vite web server startup if Windows process shutdown behavior is resolved.
- Consider extracting bracket assignment and winner state logic from `src/App.tsx` if complexity grows.
- Consider adding focused tests for the 128-item cap and editing/reset edge cases around larger brackets.
- Add explicit reset/start-over controls for persisted local data if users need a faster way to clear saved state.

## Unknown

- Backend/auth provider requirements.
- Deployment requirements.
- Target users and visual design direction.
- Browser/device support requirements.
