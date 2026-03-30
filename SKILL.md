---
name: forge
version: 1.0.0
description: |
  Engineering workflow system. Orchestrates: /plan → /arch → /implement → /test → /review → /fix → /ship.
  Full cycle: /build. Security audit: /cso. Use when asked to plan, implement, test, review, fix, ship, or build features.
---

# Forge — Available Commands

| Command | Description |
|---------|-------------|
| `/plan` | Analyze repo, generate implementation plan with task checklist |
| `/arch` | Architecture review, ADRs, interface definitions |
| `/implement` | Implement one task from plan with atomic commit |
| `/test` | Generate tests, run suite, report coverage gaps |
| `/review` | Code review: SQL safety, security, scope drift, plan completion |
| `/fix` | Fix bugs from test/review, loop until green |
| `/ship` | Changelog, version bump, PR creation |
| `/cso` | Security audit (OWASP, STRIDE, secrets, supply chain) |
| `/build` | Full orchestration: plan → implement → test → fix → review → ship |

## Skill Discovery

Each command has its own SKILL.md with detailed instructions:

- `plan/SKILL.md`
- `arch/SKILL.md`
- `implement/SKILL.md`
- `test-suite/SKILL.md`
- `review/SKILL.md`
- `fix/SKILL.md`
- `ship/SKILL.md`
- `cso/SKILL.md`
- `build/SKILL.md`

When a user invokes a specific command (e.g., `/plan`), read the corresponding
SKILL.md and follow its instructions exactly.

When the user invokes `/build`, read `build/SKILL.md` which orchestrates all others.
