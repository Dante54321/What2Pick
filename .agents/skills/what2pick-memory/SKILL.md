---
name: what2pick-memory
description: Maintain durable project memory for What2Pick. Use when starting or resuming work on What2Pick, after meaningful implementation progress, when recording product or technical decisions, when encountering blockers, and before ending a work session.
---

# What2Pick Memory

Use this skill for any work session related to the What2Pick project.

## Required Startup

1. Read `docs/ai-memory/index.md`.
2. Read `docs/ai-memory/current-state.md`.
3. Read additional memory files only when relevant:
   - `docs/ai-memory/project-overview.md` for stack, structure, commands, and product scope.
   - `docs/ai-memory/decisions.md` for prior decisions.
   - `docs/ai-memory/backlog.md` for planned or proposed work.

## Source Of Truth

- The current application code and tests are the source of truth.
- If memory conflicts with code, trust the code and update memory.
- Mark unconfirmed information as `unknown`.
- Separate implemented, planned, and proposed functionality.

## Memory Updates

Update the relevant file after:

- an important product or technical decision;
- meaningful implementation progress;
- a blocker;
- before ending a work session with changed understanding or code.

Keep updates concise. Do not store secrets, `.env` contents, personal data, full conversation transcripts, or detailed command logs.
