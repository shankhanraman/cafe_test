# Backend

Spring Boot backend service for the cafe_test project.

> Status: scaffolding/setup stage. The Spring Boot project itself has not been generated yet —
> what exists today is the Claude Code workspace (skills, hooks, conventions) that drives how the
> backend will be built. See **`CLAUDE.md`** for the living team rules.

## Stack

- Java 21 · Spring Boot 3.x · **Gradle** (`./gradlew`)
- PostgreSQL · Flyway (migrations applied on startup)
- JUnit 5 · Testcontainers (integration tests)

These are pinned by the Initializr skeleton — they are not re-decided per run.

## How this workspace was bootstrapped (one-time setup)

This is the **one-time setup** referenced by `CLAUDE.md`. Do not re-run it or re-scaffold an
existing project.

1. **Superpowers plugin** installed (brainstorm → write-plan → execute-plan workflow).
2. **ponytail plugin** installed (over-engineering / "laziest solution" reviewer).
3. **Project skills** placed under `.claude/skills/`:
   - `springboot-backend/` — production-grade Spring Boot conventions, with `references/` loaded per task.
   - `spring-boot-spec-driven/` — spec-driven delivery: docs first (datamodel → dataflow → architecture), then code.
4. **Hooks** wired in `.claude/settings.json` (see below).
5. (Pending) Initializr scaffold to generate the actual Gradle Spring Boot project.

## Claude Code configuration (`.claude/`)

```
.claude/
├── settings.json          # plugins, hooks, plansDirectory
├── hooks/
│   └── protect-files.sh    # PreToolUse guard for protected files (currently a stub)
└── skills/
    ├── springboot-backend/
    └── spring-boot-spec-driven/
```

**Hooks (`settings.json`):**
- `PostToolUse` (Edit|Write|MultiEdit) → `./gradlew spotlessApply` — auto-formats Java on every edit.
- `PreToolUse` (Edit|Write) → `.claude/hooks/protect-files.sh` — guards protected files.

**Other settings:**
- `plansDirectory: features` — plan/spec `.md` files land in `features/` (in-repo), not the global home dir.

## Document layout

```
backend/
├── docs/        # spec / source of truth: datamodel.md, dataflow.md, architecture.md
├── features/    # plan & spec .md files for executing tasks (Claude Code plans)
├── CLAUDE.md    # living team rules and conventions
└── .claude/     # skills, hooks, settings
```

## Build & run (once the project is scaffolded)

```bash
./gradlew test             # unit + slice tests
./gradlew integrationTest  # Testcontainers integration tests (Docker must be running)
./gradlew bootRun          # serves on http://localhost:8080
```

PostgreSQL must be reachable (and Docker up for the integration tests). Flyway applies migrations
on startup.

## Conventions (summary)

Full rules live in `CLAUDE.md`. In brief:

- Package by feature: `com.example.<feature>.{web,service,domain,repository}`.
- Thin controllers; services own logic and `@Transactional`; repositories are Spring Data interfaces only.
- Don't expose JPA entities — use `record` DTOs, map in the service.
- Domain exceptions translated centrally via `@RestControllerAdvice` (RFC 7807 ProblemDetail).
- Constructor injection with `final` fields; never edit an applied Flyway migration — add a new `V__` script.
