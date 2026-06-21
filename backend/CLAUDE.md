# CLAUDE.md

Living team memory — checked into git, kept under ~100 lines. **Golden rule:** when Claude
does something wrong, add a one-line correction here so it doesn't repeat. Advisory rules in
this file are followed ~80% of the time; anything that must happen *every* time is a hook
(see `.claude/settings.json`), not a line here.

## Project

Spring Boot backend. <!-- ← EDIT: one line on what this service does -->
Java 21 · Spring Boot 3.x · Gradle (`./gradlew`) · PostgreSQL · Flyway.  <!-- ← EDIT to match scaffold -->
These are pinned by the Initializr skeleton — do **not** re-ask for them during any run.

How the skeleton was bootstrapped (Superpowers install + Initializr scaffold) lives in
`README.md`. That is **one-time setup** — don't re-run it or re-scaffold an existing project.

## Skill

For all Spring/Java backend work, use the **`springboot-backend`** skill at
`.claude/skills/springboot-backend/`. Its SKILL.md maps each task to a `references/` file —
open the matching reference *before* writing that code rather than working from memory.
Don't inline those references here; the skill loads them on demand.

For ticket/feature delivery, the **`spring-boot-spec-driven`** skill at
`.claude/skills/spring-boot-spec-driven/` drives the order: load the context docs, update
`datamodel.md` (with the Mermaid E-R diagram) first, then `dataflow.md` and `architecture.md`,
and only then write code.

## Workflow

Build every feature through Superpowers, in order:
1. `/superpowers:brainstorm` — agree the spec (entities, endpoints, auth, domain rules; plus the
   skill's open questions: service layer? security? migrations?).
2. `/superpowers:write-plan` — order tasks as core → persistence → flyway → service/controller →
   security → testing → review, and tag each task with its `references/` file.
3. `/superpowers:execute-plan` — TDD build; the skill fires per task and the reviewer subagent
   checks against `java-best-practices.md` plus the relevant domain reference.

Doc layout: spec docs (`datamodel.md`, `dataflow.md`, `architecture.md`) live in `docs/`; plan/spec
`.md` files for executing tasks land in `features/` (set via `plansDirectory` in `.claude/settings.json`).

## Working principles

- Make every change as simple as possible — prefer deleting lines over adding them.
- Find the root cause; no band-aids.
- Touch only what the task requires.

## House conventions

State the wanted behavior, not just a ban. <!-- ← EDIT to your team's standards -->
- Package by feature: `com.example.<feature>.{web,service,domain,repository}`.
- Controllers stay thin (no logic); services own logic and `@Transactional`; repositories are
  Spring Data interfaces only.
- Don't expose JPA entities over the wire — use `record` request/response DTOs and map in the service.
- Don't return raw 500s for expected failures — throw domain exceptions, translate centrally in a
  `@RestControllerAdvice` (RFC 7807 ProblemDetail).
- Constructor injection with `final` fields; no field injection.
- Never edit an applied Flyway migration — add a new `V__` script.

## Enforced by hooks (not advisory)

- Java files auto-format on every edit via Spotless (`./gradlew spotlessApply`, PostToolUse) —
  see `.claude/settings.json`.
- Protected files are guarded on edit via `.claude/hooks/protect-files.sh` (PreToolUse).

## Validation gate

A task isn't done until the build is green. Fix the cause of a failure; never delete or disable
the test.
```
./gradlew test            # unit + slice tests
./gradlew integrationTest  # Testcontainers integration tests (Docker must be running)
```

## Run locally

Once the build is green, start the app from the project root:
```
./gradlew bootRun   # serves on http://localhost:8080
```
PostgreSQL must be reachable (and Docker up for the `verify` gate above). Flyway applies
migrations on startup.

## Learnings

<!-- Append one line each time Claude makes a mistake worth not repeating. -->
- Write/update `docs/datamodel.md` (+Mermaid E-R), `dataflow.md`, `architecture.md` **before** code — even when executing a plan; make it Task 0, don't let the plan track skip the docs-first rule.
