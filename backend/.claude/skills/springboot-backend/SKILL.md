---
name: springboot-backend
description: Build production-grade Spring Boot backends with layered architecture, JPA/Hibernate persistence, Flyway migrations, Spring Security, and JUnit 5 + Testcontainers testing. Use when creating or modifying a Spring Boot or Java backend — scaffolding a project, designing entities or REST controllers, writing repositories, adding database migrations, configuring authentication or authorization, writing or improving tests — or when the user asks for Spring Boot best practices, a code review, or a refactor. Consult the matching file under references/ for each task area.
metadata:
  version: 1.0.0
  stack: spring-boot, java, jpa, flyway, spring-security, junit5, testcontainers
---

# Spring Boot Backend

A single skill for building clean, production-grade Spring Boot backends. The detailed
conventions live in `references/` and load only when needed — this file tells Claude when
to use the skill, the one rule that applies to every task, and which reference to open.

## When to use this skill

Use it for any Spring Boot / Java backend work: project scaffolding, domain modeling,
persistence, database migrations, REST API design, security, and testing — and for
reviewing or refactoring existing Spring Boot code. Do **not** use it for unrelated topics
(frontend-only work, non-JVM stacks, general questions with no Spring Boot involved).

## CRITICAL — confirm requirements before generating

This applies to **every** task below. Do not assume versions or stack details. If the user
has not already stated them earlier in the conversation, ask in one short batch before
writing code:

- Java version (e.g. 17, 21, 25)
- Spring Boot version (e.g. 3.x, 4.x)
- Build tool (Maven or Gradle)
- Database (e.g. PostgreSQL, MySQL, H2)
- Whether a service layer, security, and migrations are needed

Reuse answers already given earlier in the session — only ask for what is genuinely
missing, and never re-ask across later steps of the same workflow. Individual reference
files list a few extra task-specific things to confirm (e.g. the auth mechanism for
security); honor those too.

## Reference map — open the file that matches the task

Read a reference file *before* doing the matching work. Each is self-contained; load only
the one(s) you need, and you may load several for a task that spans areas.

| If the task is about… | Read |
| --- | --- |
| Project structure, layering, DI, REST conventions, configuration, profiles | `references/spring-boot-core.md` |
| Entities, Spring Data repositories, relationships, N+1, transactions, PostgreSQL mapping | `references/persistence-jpa.md` |
| Database schema changes, versioned `V__` scripts, safe/zero-downtime DDL | `references/flyway-migrations.md` |
| Authentication, authorization, filter chain, 401/403, CSRF, method security, security review | `references/spring-security.md` |
| Unit tests, `@WebMvcTest` slice tests, `@SpringBootTest` + Testcontainers integration tests | `references/spring-boot-testing.md` |
| General Java quality — clean code, SOLID, immutability, exceptions, concurrency, performance | `references/java-best-practices.md` |

If you are unsure which one applies, skim the table headers above and pick the closest; for
a code review or refactor, `java-best-practices.md` plus the relevant domain file together
give the fullest picture.

## Suggested workflow order (greenfield backend)

1. `spring-boot-core` — project structure and domain model
2. `persistence-jpa` — entities and repositories
3. `flyway-migrations` — schema
4. `spring-boot-core` — service and controller layers
5. `spring-security` — authentication and authorization
6. `spring-boot-testing` — unit, slice, and integration tests
7. `java-best-practices` — review and refactor passes

## Validate before declaring done

Regardless of task, finish by checking the build is green:

- `./mvnw test` (or `./gradlew test`) for unit and slice tests
- `./mvnw verify` for Testcontainers integration tests

If something fails, fix the cause rather than disabling or deleting the failing test.

## Sources

The reference files are authored adaptations of conventions from jdubois/dr-jskill,
decebals/claude-code-java, and affaan-m/ECC. Refine them to match your team's standards.
