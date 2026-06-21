# Persistence (JPA / Hibernate)

Persistence-layer conventions. Adapted from `dr-jskill`'s database guidance, the
`jpa-patterns` skill in `claude-code-java`, and `postgres-patterns` in ECC.

## Before generating

If not already known from the conversation, confirm:

- Database (PostgreSQL, MySQL, H2, …) — affects column types and dialect choices.
- Whether schema is managed by migrations (Flyway/Liquibase) or Hibernate DDL. In
  production, **migrations own the schema**; set `spring.jpa.hibernate.ddl-auto=validate`,
  not `update` or `create`. (See the flyway-migrations skill.)

## Entity design

- Annotate with `@Entity`; give every entity an explicit `@Table(name = ...)`.
- Surrogate primary key: `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)` for
  PostgreSQL/MySQL auto-increment, or `SEQUENCE` with an allocation size when you need
  batching.
- Use precise types: `Long` ids, `String` with sensible `@Column(length = ...)`,
  `Instant`/`OffsetDateTime` for timestamps (not legacy `java.util.Date`),
  `BigDecimal` for money.
- Add `createdAt` / `updatedAt` audit fields. JPA auditing
  (`@CreatedDate`, `@LastModifiedDate` with `@EntityListeners(AuditingEntityListener.class)`
  and `@EnableJpaAuditing`) handles them automatically.
- Implement `equals`/`hashCode` carefully — base them on a stable business key or the id
  *after* it is assigned, never on a mutable field set. Do not use Lombok `@Data` on
  entities (it generates `equals`/`hashCode`/`toString` over all fields, including
  associations, which triggers lazy loading and recursion).

**Example:**
```java
@Entity
@Table(name = "note")
@EntityListeners(AuditingEntityListener.class)
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String content;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private Instant updatedAt;

    // protected no-arg constructor for JPA, getters, etc.
}
```

## Relationships and fetching

- Default associations to **`FetchType.LAZY`**. `@ManyToOne` and `@OneToOne` are EAGER by
  default — override them to LAZY explicitly.
- Solve `LazyInitializationException` by loading what you need *inside* the transaction,
  with a fetch join or an entity graph — **not** by switching to EAGER or
  `open-in-view`. Disable open-in-view (`spring.jpa.open-in-view=false`) and be deliberate
  about fetching.
- For the **N+1 problem**: use `JOIN FETCH` in JPQL, a `@EntityGraph` on the repository
  method, or batch fetching (`@BatchSize` / `hibernate.default_batch_fetch_size`).

## Repositories

- Extend `JpaRepository<Entity, Id>` for CRUD; add derived query methods for the rest.
- Case-insensitive search by title: `findByTitleContainingIgnoreCase(String title)`.
- Use `@Query` for anything non-trivial; prefer JPQL, drop to native SQL only when needed.
- Return `Optional<T>` for single-result lookups.
- Paginate list endpoints with `Pageable` rather than returning unbounded `List`s.

## Transactions

- Put `@Transactional` on the **service** method that defines the unit of work, not on
  repositories or controllers.
- Mark read paths `@Transactional(readOnly = true)`.
- A `@Transactional` method calling another method on the same bean bypasses the proxy —
  the inner call won't start a new transaction. Restructure rather than relying on it.
- Keep transactions short; don't make remote/HTTP calls inside them.

## PostgreSQL-specific notes

- Map `text` for large strings, `jsonb` via a converter or Hibernate type for JSON,
  `uuid` for UUID keys.
- Add indexes for columns used in WHERE/ORDER BY and for foreign keys (Postgres does not
  auto-index FKs). Define indexes in migrations, not by relying on Hibernate.
- Use connection pooling (HikariCP is the Boot default); size the pool to the database's
  capacity.

## Anti-patterns to avoid

- `ddl-auto=update`/`create` in production.
- EAGER everything / enabling open-in-view to dodge lazy errors.
- `@Data`/`@ToString` over associations on entities.
- Unbounded `findAll()` on large tables.
- Business logic inside entities' getters.
