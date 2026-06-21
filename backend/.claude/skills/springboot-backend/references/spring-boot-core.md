# Spring Boot Core

Conventions for building clean, production-grade Spring Boot applications. Adapted from
Julien Dubois' `dr-jskill` and the `spring-boot-patterns` skill in `claude-code-java`.

## Before generating: confirm requirements

Do NOT assume versions or stack details. If the user has not already specified them
earlier in this conversation, ask before writing any code:

- Java version (e.g. 17, 21, 25)
- Spring Boot version (e.g. 3.x, 4.x)
- Build tool (Maven or Gradle)
- Database (e.g. PostgreSQL, MySQL, H2)
- Whether a web/REST layer, a service layer, and security are needed

If the user already answered these earlier in the session, reuse those answers — do not
re-ask. Only ask for what is genuinely missing. Keep it to one short batch of questions.

## Architecture

Use a layered architecture, but keep it honest:

- `controller/` — REST entry points. Thin. No business logic.
- `service/` — business logic and transaction boundaries. **Only include this layer when
  it adds value.** For simple CRUD, a controller may call the repository directly rather
  than passing through a pass-through service that does nothing.
- `repository/` — Spring Data interfaces. No SQL in other layers.
- `domain/` (or `model/`) — entities and value objects.
- `config/` — `@Configuration` classes and `@ConfigurationProperties`.
- `dto/` — request/response records. Do not expose JPA entities directly over HTTP.

Recommended package root: `com.example.app` with the above subpackages, mirrored under
`src/test/java`.

## Dependency injection

Use **constructor injection**, not field injection. It makes dependencies explicit,
keeps components immutable, and is trivially testable.

**Example:**
```java
@Service
public class NoteService {
    private final NoteRepository repository;

    public NoteService(NoteRepository repository) {
        this.repository = repository;
    }
}
```

A single constructor means `@Autowired` is not required. Declare collaborators `final`.

## REST conventions

- Resource-oriented URLs, plural nouns: `/api/notes`, `/api/notes/{id}`.
- Correct HTTP verbs and status codes: 200/201/204 for success, 400 for validation,
  404 for missing resources, 409 for conflicts.
- Return DTOs, not entities. Map explicitly (a mapper class or a record's static factory).
- Validate request bodies with Bean Validation (`@Valid`, `@NotBlank`, `@Size`, etc.).
- Centralize error handling with a `@RestControllerAdvice` returning a consistent error
  body (RFC 7807 `ProblemDetail` is a good default on Boot 3+).

## Configuration

- Prefer `.properties` files; externalize secrets via environment variables, never commit
  them. Provide a `.env.sample` listing required variables.
- Use `@ConfigurationProperties` (type-safe) over scattered `@Value` annotations.
- Use Spring profiles (`application-dev.properties`, `application-prod.properties`) for
  environment differences.
- Include **Spring Boot Actuator** for health/metrics; expose a health endpoint for
  readiness checks.

## Baseline dependencies (typical web + data app)

Spring Web, Spring Data JPA, Validation, the chosen database driver, Spring Boot Actuator,
DevTools (dev only), and the test starter (JUnit 5). Add Testcontainers for integration
tests and Spring Security only when authentication/authorization is actually required.

## Quality gates before declaring done

1. Project compiles and the app starts.
2. `./mvnw test` (or `./gradlew test`) passes.
3. Endpoints return correct status codes and validated payloads.
4. No secrets in source; configuration externalized.

Run these and fix failures before moving on, rather than reporting success prematurely.

## Anti-patterns to avoid

- Field injection (`@Autowired` on fields).
- Business logic in controllers.
- Returning entities directly from controllers (leaks persistence concerns, risks
  lazy-loading serialization errors).
- A service layer that only forwards calls to the repository with no added logic.
- YAML/properties duplication instead of profiles.
- Catching exceptions just to log and swallow them.
