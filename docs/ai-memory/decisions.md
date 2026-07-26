# What2Pick Decisions

## 2026-07-19: Lightweight Project Memory

- Decision: Use repository-local Markdown files under `docs/ai-memory/` for project memory.
- Decision: Use `.agents/skills/what2pick-memory/SKILL.md` as the project-specific memory startup skill.
- Decision: Add root `AGENTS.md` instructions so future agents read memory before What2Pick work.
- Decision: Do not create `.codex/config.toml` at this time.
- Decision: Do not copy internal Codex skills into the repository.

## Product Decisions

- Decision: What2Pick should support user profiles with login.
- Decision: User-specific choices, bracket progress, and personal configuration should be saved to the logged-in user's account, not only to browser-local storage.
- Decision: User profiles should include personal preferences; the first confirmed preference is dark mode.
- Decision: Use Supabase for authentication and user-scoped database storage.
- Decision: Anonymous guest usage should remain available, but guest choices, brackets, and saved lists should not persist.
- Decision: Small non-sensitive guest UI preferences, such as dark mode, may persist locally in `localStorage`.
- Decision: Users should be able to save reusable choice-list templates, separate from the current active bracket progress.
- Decision: Users should be able to save named bracket snapshots, separate from reusable list templates, so bracket progress can be reopened later.
- Decision: Prioritize the public web app first because it can be used across devices; a native or installable app can be considered later.
- Decision: Keep 128 choices as the current product cap unless real usage shows a need for more.
- Unknown: account recovery requirements.
