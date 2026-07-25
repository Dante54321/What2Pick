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
- Decision: Users should be able to save reusable choice-list templates, separate from the current active bracket progress.
- Decision: Users should be able to save named bracket snapshots, separate from reusable list templates, so bracket progress can be reopened later.
- Unknown: account recovery requirements and whether anonymous local usage remains supported.
