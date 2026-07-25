# What2Pick Backlog

## Known Requirements To Verify Or Extend

- Confirm whether the current 2-to-128 bracket limit is the desired long-term cap.
- Define detailed login/profile requirements for the web version and future app version.
- Set up Supabase authentication and user-scoped database storage.
- Decide whether anonymous local-only usage should remain available alongside logged-in profiles.

## Proposed Technical Follow-Up

- Add more focused tests for random distribution behavior and editing/reset edge cases.
- Consider automating Playwright's Vite web server startup if Windows process shutdown behavior is resolved.
- Consider extracting bracket assignment and winner state logic from `src/App.tsx` if complexity grows.
- Consider adding focused tests for the 128-item cap and editing/reset edge cases around larger brackets.

## Unknown

- Deployment requirements.
- Target users and visual design direction.
- Browser/device support requirements.
