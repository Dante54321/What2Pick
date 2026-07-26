# What2Pick Backlog

## Known Requirements To Verify Or Extend

- Define detailed login/profile requirements for the web version and future app version.
- Validate Supabase authentication and user-scoped database storage over continued real usage.
- Revisit the 128-choice cap only if real usage shows the need for larger brackets.

## Proposed Technical Follow-Up

- Add more focused tests for random distribution behavior and editing/reset edge cases.
- Consider automating Playwright's Vite web server startup if Windows process shutdown behavior is resolved.
- Consider extracting bracket assignment and winner state logic from `src/App.tsx` if complexity grows.
- Consider adding focused tests for the 128-item cap and editing/reset edge cases around larger brackets.

## Unknown

- Deployment requirements.
- Target users and visual design direction.
- Browser/device support requirements.
