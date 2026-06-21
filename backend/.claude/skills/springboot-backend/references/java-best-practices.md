# Java Best Practices

General Java discipline that complements the Spring-specific skills. Adapted from the
`clean-code`, `solid-principles`, `java-code-review`, `concurrency-review`,
`performance-smell-detection`, and `api-contract-review` skills in `claude-code-java`.

## Before reviewing or generating

If the task is version-sensitive (e.g. using records, sealed types, virtual threads,
pattern matching), confirm the Java version if it is not already known from the
conversation. Otherwise proceed; most of this guidance is version-agnostic.

## Clean code

- Names reveal intent: `elapsedDays`, not `d`. Methods are verbs, classes are nouns.
- Small methods, one level of abstraction each. If a method needs a comment to explain a
  block, extract that block into a well-named method.
- Avoid magic numbers and strings; promote them to named constants.
- Keep classes focused. A class doing persistence *and* formatting *and* validation is
  three classes wearing a trench coat.
- Comments explain *why*, not *what*. Delete commented-out code.

## SOLID, briefly

- **S**ingle responsibility — one reason to change per class.
- **O**pen/closed — extend via new types/strategies, not by editing stable code.
- **L**iskov — subtypes must honor the base type's contract.
- **I**nterface segregation — many small interfaces beat one fat one.
- **D**ependency inversion — depend on abstractions; inject collaborators.

## Immutability and null safety

- Prefer `final` fields and immutable objects. Use `record` for data carriers.
- Don't return `null` from methods that yield collections — return an empty collection.
- Use `Optional` for "may be absent" return values; do **not** use it for fields or
  parameters. Never call `.get()` without a presence check — prefer `orElseThrow`,
  `map`, `ifPresent`.
- Validate arguments early (`Objects.requireNonNull`, guard clauses) and fail fast.

## Exceptions

- Throw specific exceptions; don't `throw new RuntimeException("...")` for everything.
- Never swallow exceptions (empty `catch`) or catch `Exception`/`Throwable` broadly.
- Don't use exceptions for control flow.
- Preserve the cause when wrapping: `throw new ServiceException(msg, cause)`.
- Close resources with try-with-resources.

## Concurrency

- Prefer immutable shared state. If state is mutable and shared, it must be synchronized
  or confined to a single thread.
- Use `java.util.concurrent` (e.g. `ConcurrentHashMap`, `AtomicLong`, `ExecutorService`)
  rather than hand-rolled locking.
- `volatile` guarantees visibility, not atomicity — don't use it for compound actions.
- Watch for check-then-act races, unsafe lazy initialization, and non-thread-safe types
  (`SimpleDateFormat`, plain `HashMap`) shared across threads.
- Always shut down executors; never leak threads.

## Performance smells (flag, don't prematurely optimize)

- String concatenation in loops → use `StringBuilder`.
- Boxing/unboxing in hot loops; prefer primitive streams/collections where it matters.
- Repeated work that could be hoisted out of a loop or memoized.
- Loading entire collections when pagination or streaming would do.
- N+1 access patterns (see the persistence-jpa skill for the JPA-specific case).
- Measure before optimizing; call out the suspected hotspot rather than rewriting blindly.

## API contract hygiene

- Keep public method signatures stable; breaking changes need a deprecation path.
- Document non-obvious nullability, thread-safety, and side effects.
- Favor narrow return types the caller actually needs.

## Review output format

When reviewing code, group findings by severity and be specific:

```
## Critical   (correctness / security / data loss)
## Major      (design, concurrency, performance)
## Minor      (naming, style, readability)
```

For each finding, name the location, explain *why* it matters, and show the fix.
