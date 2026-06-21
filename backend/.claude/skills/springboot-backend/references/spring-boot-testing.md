# Spring Boot Testing

Testing conventions across the pyramid. Adapted from the `test-quality` skill in
`claude-code-java` and `dr-jskill`'s testing guidance.

## Before generating

If not already known from the conversation, confirm:

- Whether **Testcontainers** is available/desired for integration tests (it needs Docker),
  or whether an in-memory DB (H2) is acceptable as a fallback.
- The database, so the Testcontainers image / dialect matches production.

Default stack: **JUnit 5 (Jupiter) + AssertJ + Mockito**, which ship with
`spring-boot-starter-test`.

## Test pyramid — pick the right level

1. **Unit tests** — pure logic (services), dependencies mocked. Fast, most numerous.
2. **Slice tests** — one layer with a minimal context (`@WebMvcTest`, `@DataJpaTest`).
3. **Integration tests** — full context (`@SpringBootTest`) with real infrastructure via
   Testcontainers. Fewest, slowest, highest confidence.

Don't spin up the whole `@SpringBootTest` context to test logic a unit test could cover.

## Quality rules (what makes a test good)

- One behavior per test; assert outcomes, not implementation details.
- **Structure with Given–When–Then** (Arrange–Act–Assert).
- Descriptive names: `createNote_whenTitleBlank_throwsValidationException`.
- Use **AssertJ** fluent assertions: `assertThat(result.getTitle()).isEqualTo("…")`.
- Cover edge cases and failure paths, not just the happy path: not-found, validation
  failure, empty/boundary inputs.
- Tests must be deterministic and independent — no shared mutable state, no ordering
  dependencies, no reliance on wall-clock or external network.
- Avoid asserting on mock internals when an output assertion would do. Don't over-mock.

## Unit test (service) — JUnit 5 + Mockito + AssertJ

```java
@ExtendWith(MockitoExtension.class)
class NoteServiceTest {

    @Mock NoteRepository repository;
    @InjectMocks NoteService service;

    @Test
    void getById_whenMissing_throwsNotFound() {
        // given
        given(repository.findById(1L)).willReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> service.getById(1L))
            .isInstanceOf(NoteNotFoundException.class);
    }
}
```

Cover create, get-by-id, update, delete, plus their edge cases (missing id, invalid input).

## Controller slice test — @WebMvcTest

Loads only the web layer; mock the service with `@MockitoBean` (Boot 3.4+) or `@MockBean`.

```java
@WebMvcTest(NoteController.class)
class NoteControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean NoteService service;

    @Test
    void getNote_returns200() throws Exception {
        given(service.getById(1L)).willReturn(new NoteResponse(1L, "Hi", "..."));

        mvc.perform(get("/api/notes/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.title").value("Hi"));
    }
}
```

Verify status codes, response shape, and validation responses (e.g. 400 on bad input).
If security is enabled, add `spring-security-test` and `@WithMockUser` / authority setup.

## Integration test — @SpringBootTest + Testcontainers

Use a real database in a container, wired via `@ServiceConnection` (Boot 3.1+) so no manual
datasource properties are needed.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class NoteApiIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired TestRestTemplate rest;

    @Test
    void fullCrudFlow() {
        // create → fetch → update → delete, asserting status + body at each step
    }
}
```

Exercise the full flow end-to-end (create → fetch → update → delete) against the container.

## Validation before declaring done

- `./mvnw test` (unit + slice) passes.
- `./mvnw verify` (integration, Testcontainers) passes.
- If tests fail, fix the cause — don't delete or `@Disabled` the test to make the build go
  green.

## Anti-patterns to avoid

- `@SpringBootTest` for everything (slow, brittle).
- Asserting on logs or private state instead of behavior.
- Over-mocking until the test just restates the implementation.
- Tests that depend on run order or leave data behind.
- Skipping failure-path coverage.
