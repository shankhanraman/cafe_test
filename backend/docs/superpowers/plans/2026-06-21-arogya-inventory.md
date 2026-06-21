# AROGYA Cafe Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Spring Boot backend that tracks cafe stock, auto-deducts it on each recorded sale, and lists low-stock ingredients with their supplier.

**Architecture:** Package-by-feature (`com.arogya.{supplier,inventory,menu,sales}`), each split `web/service/domain/repository`. Thin controllers; `@Transactional` services own logic; Spring Data repositories. JPA entities never leave the service — `record` DTOs cross the wire. Domain exceptions translate centrally to RFC 7807 `ProblemDetail`. PostgreSQL via Flyway; tested with JUnit 5 + Testcontainers.

**Tech Stack:** Java 21, Spring Boot 3.x, Gradle, PostgreSQL, Flyway, JUnit 5, Testcontainers, Spring Boot Validation.

**Source spec:** `docs/superpowers/specs/2026-06-21-arogya-inventory-design.md` (approved). Read it before starting.

**Skill reminder:** Per `CLAUDE.md`, open the matching `.claude/skills/springboot-backend/references/*.md` before writing each layer (core, persistence, flyway, testing, etc.). Java auto-formats via Spotless on every edit (PostToolUse hook) — don't hand-format.

---

## File Structure (created across the plan)

```
backend/
├── build.gradle, settings.gradle, gradlew*, gradle/      # Task 1 scaffold
├── src/main/resources/
│   ├── application.yml, application-test.yml             # Task 1
│   └── db/migration/
│       ├── V1__schema.sql                                # Task 3
│       └── V2__seed.sql                                  # Task 9
├── src/main/java/com/arogya/
│   ├── ArogyaApplication.java                            # Task 1
│   ├── common/
│   │   ├── NotFoundException.java                        # Task 2
│   │   ├── ValidationException.java                      # Task 2
│   │   └── GlobalExceptionHandler.java                  # Task 2
│   ├── supplier/{domain,repository,service,web}/...      # Task 4
│   ├── inventory/{domain,repository,service,web}/...     # Task 5
│   ├── menu/{domain,repository,service,web}/...          # Task 6
│   └── sales/{domain,repository,service,web}/...         # Task 7
└── src/test/java/com/arogya/...                          # per task + Task 8
```

Each feature folder holds: `domain/<Entity>.java` (+ enums), `repository/<Entity>Repository.java`, `service/<Feature>Service.java` + DTO records, `web/<Feature>Controller.java`.

---

## Task 1: Scaffold the Gradle Spring Boot project

The repo has NO Gradle project yet (README "step 5 pending"). Generate it via Spring Initializr.

**Files:**
- Create: `build.gradle`, `settings.gradle`, `gradlew`, `gradlew.bat`, `gradle/wrapper/*`
- Create: `src/main/java/com/arogya/ArogyaApplication.java`
- Create: `src/main/resources/application.yml`, `src/test/resources/application-test.yml`

- [ ] **Step 1: Generate the skeleton from Initializr**

Run (from `backend/`):
```bash
curl -s https://start.spring.io/starter.zip \
  -d type=gradle-project -d language=java -d bootVersion=3.3.5 \
  -d javaVersion=21 -d groupId=com.arogya -d artifactId=inventory \
  -d packageName=com.arogya -d name=inventory \
  -d dependencies=web,data-jpa,validation,flyway,postgresql,testcontainers \
  -o starter.zip && unzip -o starter.zip -d . && rm starter.zip
```
This drops `build.gradle`, the Gradle wrapper, `ArogyaApplication.java`, and an empty `application.properties`. Delete the `.properties` file (we use YAML): `rm src/main/resources/application.properties`.

- [ ] **Step 2: Add the Testcontainers + integrationTest setup to `build.gradle`**

Append/ensure these dependencies and an `integrationTest` source set so `./gradlew test` (unit+slice) and `./gradlew integrationTest` (Testcontainers) are separable per `CLAUDE.md`:

```gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.flywaydb:flyway-core'
    implementation 'org.flywaydb:flyway-database-postgresql'
    runtimeOnly 'org.postgresql:postgresql'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.boot:spring-boot-testcontainers'
    testImplementation 'org.testcontainers:junit-jupiter'
    testImplementation 'org.testcontainers:postgresql'
}

sourceSets {
    integrationTest {
        java.srcDir 'src/integrationTest/java'
        resources.srcDir 'src/integrationTest/resources'
        compileClasspath += sourceSets.main.output + sourceSets.test.output
        runtimeClasspath += sourceSets.main.output + sourceSets.test.output
    }
}
configurations {
    integrationTestImplementation.extendsFrom testImplementation
    integrationTestRuntimeOnly.extendsFrom testRuntimeOnly
}
tasks.register('integrationTest', Test) {
    description = 'Runs Testcontainers integration tests.'
    group = 'verification'
    testClassesDirs = sourceSets.integrationTest.output.classesDirs
    classpath = sourceSets.integrationTest.runtimeClasspath
    useJUnitPlatform()
    shouldRunAfter tasks.named('test')
}
tasks.named('test') { useJUnitPlatform() }
```

- [ ] **Step 3: Write `application.yml`**

`src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/arogya
    username: arogya
    password: arogya
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
```
`ddl-auto: validate` — Flyway owns the schema; Hibernate only checks the mapping matches.

- [ ] **Step 4: Verify the skeleton compiles**

Run: `./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Gradle Spring Boot project"
```

---

## Task 2: Shared error handling (RFC 7807)

Central translation so no expected failure returns a raw 500. Built before features so every service can throw these.

**Files:**
- Create: `src/main/java/com/arogya/common/NotFoundException.java`
- Create: `src/main/java/com/arogya/common/ValidationException.java`
- Create: `src/main/java/com/arogya/common/GlobalExceptionHandler.java`
- Test: `src/test/java/com/arogya/common/GlobalExceptionHandlerTest.java`

- [ ] **Step 1: Write the failing test**

`src/test/java/com/arogya/common/GlobalExceptionHandlerTest.java`:
```java
package com.arogya.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void notFoundMapsTo404() {
        ProblemDetail pd = handler.handleNotFound(new NotFoundException("Supplier", "abc"));
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(pd.getDetail()).contains("Supplier").contains("abc");
    }

    @Test
    void validationMapsTo400() {
        ProblemDetail pd = handler.handleValidation(new ValidationException("negative quantity"));
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(pd.getDetail()).contains("negative quantity");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: FAIL — `NotFoundException` / `ValidationException` / `GlobalExceptionHandler` do not exist (compile error).

- [ ] **Step 3: Write the implementation**

`src/main/java/com/arogya/common/NotFoundException.java`:
```java
package com.arogya.common;

public class NotFoundException extends RuntimeException {
    public NotFoundException(String entity, Object id) {
        super(entity + " not found: " + id);
    }
}
```

`src/main/java/com/arogya/common/ValidationException.java`:
```java
package com.arogya.common;

public class ValidationException extends RuntimeException {
    public ValidationException(String message) {
        super(message);
    }
}
```

`src/main/java/com/arogya/common/GlobalExceptionHandler.java`:
```java
package com.arogya.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(NotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ValidationException.class)
    public ProblemDetail handleValidation(ValidationException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/arogya/common src/test/java/com/arogya/common
git commit -m "feat: central RFC 7807 error handling"
```

---

## Task 3: Database schema (Flyway V1)

One migration creates every table — written up front so all feature repositories validate against it. Never edit this file after it is applied; new changes get a new `V__` script.

**Files:**
- Create: `src/main/resources/db/migration/V1__schema.sql`

- [ ] **Step 1: Write the schema**

`src/main/resources/db/migration/V1__schema.sql`:
```sql
create table supplier (
    id    uuid primary key,
    name  varchar(200) not null,
    phone varchar(50),
    notes text
);

create table inventory_item (
    id                 uuid primary key,
    name               varchar(200) not null,
    unit               varchar(20)  not null,   -- SACHET, ML, PIECE
    quantity_on_hand   numeric(12,2) not null default 0,
    reorder_threshold  numeric(12,2) not null default 0,
    supplier_id        uuid references supplier(id)
);

create table menu_item (
    id              uuid primary key,
    name            varchar(200) not null,
    category        varchar(30)  not null,       -- CIGARETTES, TEA_COFFEE, ...
    type            varchar(10)  not null,       -- MADE, RESALE
    resale_item_id  uuid references inventory_item(id)
);

create table recipe_line (
    id                uuid primary key,
    menu_item_id      uuid not null references menu_item(id),
    order_size        varchar(20) not null,      -- REGULAR, LESS, SERVING
    inventory_item_id uuid not null references inventory_item(id),
    quantity          numeric(12,2) not null
);

create table sale (
    id           uuid primary key,
    menu_item_id uuid not null references menu_item(id),
    order_size   varchar(20),                    -- null for resale
    quantity     int not null default 1,
    sold_at      timestamptz not null
);

create index idx_inventory_low_stock on inventory_item (quantity_on_hand, reorder_threshold);
create index idx_recipe_menu_item on recipe_line (menu_item_id);
create index idx_sale_sold_at on sale (sold_at);
```

- [ ] **Step 2: Verify it parses (build still compiles; migration runs in later integration tests)**

Run: `./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`. (The migration is exercised end-to-end in Task 8's Testcontainers run.)

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V1__schema.sql
git commit -m "feat: Flyway V1 schema"
```

---

## Task 4: Supplier feature (full CRUD vertical slice)

Simplest aggregate — establishes the per-feature pattern (entity → repo → service+DTOs → controller) reused by every later feature.

**Files:**
- Create: `src/main/java/com/arogya/supplier/domain/Supplier.java`
- Create: `src/main/java/com/arogya/supplier/repository/SupplierRepository.java`
- Create: `src/main/java/com/arogya/supplier/service/SupplierService.java` (with `SupplierRequest`, `SupplierResponse` records)
- Create: `src/main/java/com/arogya/supplier/web/SupplierController.java`
- Test: `src/test/java/com/arogya/supplier/service/SupplierServiceTest.java`

- [ ] **Step 1: Write the failing service test**

`src/test/java/com/arogya/supplier/service/SupplierServiceTest.java`:
```java
package com.arogya.supplier.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.arogya.common.NotFoundException;
import com.arogya.supplier.domain.Supplier;
import com.arogya.supplier.repository.SupplierRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SupplierServiceTest {

    @Mock SupplierRepository repository;
    @InjectMocks SupplierService service;

    @Test
    void createReturnsResponseWithGeneratedId() {
        when(repository.save(any(Supplier.class))).thenAnswer(i -> i.getArgument(0));
        SupplierResponse r = service.create(new SupplierRequest("Acme", "123", "note"));
        assertThat(r.id()).isNotNull();
        assertThat(r.name()).isEqualTo("Acme");
    }

    @Test
    void getMissingThrowsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests '*SupplierServiceTest'`
Expected: FAIL — types do not exist (compile error).

- [ ] **Step 3: Write the entity**

`src/main/java/com/arogya/supplier/domain/Supplier.java`:
```java
package com.arogya.supplier.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.util.UUID;

@Entity
public class Supplier {

    @Id
    private UUID id;
    private String name;
    private String phone;
    private String notes;

    protected Supplier() {}

    public Supplier(UUID id, String name, String phone, String notes) {
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.notes = notes;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getNotes() { return notes; }

    public void update(String name, String phone, String notes) {
        this.name = name;
        this.phone = phone;
        this.notes = notes;
    }
}
```

- [ ] **Step 4: Write the repository**

`src/main/java/com/arogya/supplier/repository/SupplierRepository.java`:
```java
package com.arogya.supplier.repository;

import com.arogya.supplier.domain.Supplier;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {}
```

- [ ] **Step 5: Write the service + DTO records**

`src/main/java/com/arogya/supplier/service/SupplierRequest.java`:
```java
package com.arogya.supplier.service;

import jakarta.validation.constraints.NotBlank;

public record SupplierRequest(@NotBlank String name, String phone, String notes) {}
```

`src/main/java/com/arogya/supplier/service/SupplierResponse.java`:
```java
package com.arogya.supplier.service;

import com.arogya.supplier.domain.Supplier;
import java.util.UUID;

public record SupplierResponse(UUID id, String name, String phone, String notes) {
    static SupplierResponse from(Supplier s) {
        return new SupplierResponse(s.getId(), s.getName(), s.getPhone(), s.getNotes());
    }
}
```

`src/main/java/com/arogya/supplier/service/SupplierService.java`:
```java
package com.arogya.supplier.service;

import com.arogya.common.NotFoundException;
import com.arogya.supplier.domain.Supplier;
import com.arogya.supplier.repository.SupplierRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SupplierService {

    private final SupplierRepository repository;

    public SupplierService(SupplierRepository repository) {
        this.repository = repository;
    }

    public SupplierResponse create(SupplierRequest req) {
        Supplier s = new Supplier(UUID.randomUUID(), req.name(), req.phone(), req.notes());
        return SupplierResponse.from(repository.save(s));
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> list() {
        return repository.findAll().stream().map(SupplierResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse get(UUID id) {
        return SupplierResponse.from(find(id));
    }

    public SupplierResponse update(UUID id, SupplierRequest req) {
        Supplier s = find(id);
        s.update(req.name(), req.phone(), req.notes());
        return SupplierResponse.from(s);
    }

    public void delete(UUID id) {
        repository.delete(find(id));
    }

    private Supplier find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Supplier", id));
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `./gradlew test --tests '*SupplierServiceTest'`
Expected: PASS.

- [ ] **Step 7: Write the controller**

`src/main/java/com/arogya/supplier/web/SupplierController.java`:
```java
package com.arogya.supplier.web;

import com.arogya.supplier.service.SupplierRequest;
import com.arogya.supplier.service.SupplierResponse;
import com.arogya.supplier.service.SupplierService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService service;

    public SupplierController(SupplierService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierResponse create(@Valid @RequestBody SupplierRequest req) {
        return service.create(req);
    }

    @GetMapping
    public List<SupplierResponse> list() { return service.list(); }

    @GetMapping("/{id}")
    public SupplierResponse get(@PathVariable UUID id) { return service.get(id); }

    @PutMapping("/{id}")
    public SupplierResponse update(@PathVariable UUID id, @Valid @RequestBody SupplierRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
```

- [ ] **Step 8: Run the full unit suite + commit**

Run: `./gradlew test`
Expected: PASS.
```bash
git add src/main/java/com/arogya/supplier src/test/java/com/arogya/supplier
git commit -m "feat: supplier CRUD"
```

---

## Task 5: Inventory feature (CRUD + adjust + low-stock)

Holds raw materials and resale goods. Adds the `adjust` (manual replenish) action and the low-stock query.

**Files:**
- Create: `src/main/java/com/arogya/inventory/domain/InventoryItem.java`, `domain/Unit.java`
- Create: `src/main/java/com/arogya/inventory/repository/InventoryItemRepository.java`
- Create: `src/main/java/com/arogya/inventory/service/InventoryService.java` + DTO records (`InventoryRequest`, `InventoryResponse`, `AdjustRequest`, `LowStockResponse`)
- Create: `src/main/java/com/arogya/inventory/web/InventoryController.java`
- Test: `src/test/java/com/arogya/inventory/service/InventoryServiceTest.java`
- Test (slice): `src/test/java/com/arogya/inventory/repository/InventoryItemRepositoryTest.java`

- [ ] **Step 1: Write the failing service test (adjust + low-stock predicate)**

`src/test/java/com/arogya/inventory/service/InventoryServiceTest.java`:
```java
package com.arogya.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.inventory.repository.InventoryItemRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock InventoryItemRepository repository;
    @InjectMocks InventoryService service;

    @Test
    void adjustAddsDeltaToQuantity() {
        UUID id = UUID.randomUUID();
        InventoryItem item = new InventoryItem(id, "Milk", Unit.ML,
                new BigDecimal("100"), new BigDecimal("50"), null);
        when(repository.findById(id)).thenReturn(Optional.of(item));
        InventoryResponse r = service.adjust(id, new AdjustRequest(new BigDecimal("250"), "delivery"));
        assertThat(r.quantityOnHand()).isEqualByComparingTo("350");
    }

    @Test
    void adjustBelowZeroRejected() {
        UUID id = UUID.randomUUID();
        InventoryItem item = new InventoryItem(id, "Milk", Unit.ML,
                new BigDecimal("100"), new BigDecimal("50"), null);
        when(repository.findById(id)).thenReturn(Optional.of(item));
        assertThatThrownBy(() ->
                service.adjust(id, new AdjustRequest(new BigDecimal("-500"), "oops")))
            .isInstanceOf(ValidationException.class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests '*InventoryServiceTest'`
Expected: FAIL — types missing.

- [ ] **Step 3: Write the `Unit` enum and entity**

`src/main/java/com/arogya/inventory/domain/Unit.java`:
```java
package com.arogya.inventory.domain;

public enum Unit { SACHET, ML, PIECE }
```

`src/main/java/com/arogya/inventory/domain/InventoryItem.java`:
```java
package com.arogya.inventory.domain;

import com.arogya.supplier.domain.Supplier;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "inventory_item")
public class InventoryItem {

    @Id
    private UUID id;
    private String name;

    @Enumerated(EnumType.STRING)
    private Unit unit;

    @Column(name = "quantity_on_hand")
    private BigDecimal quantityOnHand;

    @Column(name = "reorder_threshold")
    private BigDecimal reorderThreshold;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    protected InventoryItem() {}

    public InventoryItem(UUID id, String name, Unit unit, BigDecimal quantityOnHand,
                         BigDecimal reorderThreshold, Supplier supplier) {
        this.id = id;
        this.name = name;
        this.unit = unit;
        this.quantityOnHand = quantityOnHand;
        this.reorderThreshold = reorderThreshold;
        this.supplier = supplier;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public Unit getUnit() { return unit; }
    public BigDecimal getQuantityOnHand() { return quantityOnHand; }
    public BigDecimal getReorderThreshold() { return reorderThreshold; }
    public Supplier getSupplier() { return supplier; }

    public boolean isLowStock() {
        return quantityOnHand.compareTo(reorderThreshold) <= 0;
    }

    /** Add delta (may be negative for corrections); stock is allowed to reach 0 but not go below. */
    public void adjust(BigDecimal delta) {
        this.quantityOnHand = this.quantityOnHand.add(delta);
    }

    /** Deduct used quantity from a sale; stock may go to/below zero (sales are never blocked). */
    public void deduct(BigDecimal amount) {
        this.quantityOnHand = this.quantityOnHand.subtract(amount);
    }

    public void update(String name, Unit unit, BigDecimal reorderThreshold, Supplier supplier) {
        this.name = name;
        this.unit = unit;
        this.reorderThreshold = reorderThreshold;
        this.supplier = supplier;
    }
}
```
Note: `adjust(delta)` mutates; the negative-floor guard lives in the service (it knows the resulting value and throws `ValidationException`). `deduct` has no floor — sales are never blocked (spec §6).

- [ ] **Step 4: Write the repository with the low-stock query**

`src/main/java/com/arogya/inventory/repository/InventoryItemRepository.java`:
```java
package com.arogya.inventory.repository;

import com.arogya.inventory.domain.InventoryItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {

    @Query("select i from InventoryItem i left join fetch i.supplier "
         + "where i.quantityOnHand <= i.reorderThreshold order by i.name")
    List<InventoryItem> findLowStock();
}
```

- [ ] **Step 5: Write the DTO records**

`src/main/java/com/arogya/inventory/service/InventoryRequest.java`:
```java
package com.arogya.inventory.service;

import com.arogya.inventory.domain.Unit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.util.UUID;

public record InventoryRequest(
        @NotBlank String name,
        @NotNull Unit unit,
        @NotNull @PositiveOrZero BigDecimal quantityOnHand,
        @NotNull @PositiveOrZero BigDecimal reorderThreshold,
        UUID supplierId) {}
```

`src/main/java/com/arogya/inventory/service/AdjustRequest.java`:
```java
package com.arogya.inventory.service;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AdjustRequest(@NotNull BigDecimal delta, String reason) {}
```

`src/main/java/com/arogya/inventory/service/InventoryResponse.java`:
```java
package com.arogya.inventory.service;

import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import java.math.BigDecimal;
import java.util.UUID;

public record InventoryResponse(UUID id, String name, Unit unit, BigDecimal quantityOnHand,
                                BigDecimal reorderThreshold, UUID supplierId) {
    static InventoryResponse from(InventoryItem i) {
        return new InventoryResponse(i.getId(), i.getName(), i.getUnit(), i.getQuantityOnHand(),
                i.getReorderThreshold(), i.getSupplier() == null ? null : i.getSupplier().getId());
    }
}
```

`src/main/java/com/arogya/inventory/service/LowStockResponse.java`:
```java
package com.arogya.inventory.service;

import com.arogya.inventory.domain.InventoryItem;
import java.math.BigDecimal;
import java.util.UUID;

public record LowStockResponse(UUID id, String name, BigDecimal quantityOnHand,
                               BigDecimal reorderThreshold, UUID supplierId, String supplierName) {
    static LowStockResponse from(InventoryItem i) {
        return new LowStockResponse(i.getId(), i.getName(), i.getQuantityOnHand(),
                i.getReorderThreshold(),
                i.getSupplier() == null ? null : i.getSupplier().getId(),
                i.getSupplier() == null ? null : i.getSupplier().getName());
    }
}
```

- [ ] **Step 6: Write the service**

`src/main/java/com/arogya/inventory/service/InventoryService.java`:
```java
package com.arogya.inventory.service;

import com.arogya.common.NotFoundException;
import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.repository.InventoryItemRepository;
import com.arogya.supplier.domain.Supplier;
import com.arogya.supplier.repository.SupplierRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InventoryService {

    private final InventoryItemRepository repository;
    private final SupplierRepository supplierRepository;

    public InventoryService(InventoryItemRepository repository, SupplierRepository supplierRepository) {
        this.repository = repository;
        this.supplierRepository = supplierRepository;
    }

    public InventoryResponse create(InventoryRequest req) {
        InventoryItem item = new InventoryItem(UUID.randomUUID(), req.name(), req.unit(),
                req.quantityOnHand(), req.reorderThreshold(), resolveSupplier(req.supplierId()));
        return InventoryResponse.from(repository.save(item));
    }

    @Transactional(readOnly = true)
    public List<InventoryResponse> list() {
        return repository.findAll().stream().map(InventoryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public InventoryResponse get(UUID id) {
        return InventoryResponse.from(find(id));
    }

    public InventoryResponse update(UUID id, InventoryRequest req) {
        InventoryItem item = find(id);
        item.update(req.name(), req.unit(), req.reorderThreshold(), resolveSupplier(req.supplierId()));
        return InventoryResponse.from(item);
    }

    public void delete(UUID id) {
        repository.delete(find(id));
    }

    public InventoryResponse adjust(UUID id, AdjustRequest req) {
        InventoryItem item = find(id);
        if (item.getQuantityOnHand().add(req.delta()).compareTo(BigDecimal.ZERO) < 0) {
            throw new ValidationException("Adjustment would drop stock below zero");
        }
        item.adjust(req.delta());
        return InventoryResponse.from(item);
    }

    @Transactional(readOnly = true)
    public List<LowStockResponse> lowStock() {
        return repository.findLowStock().stream().map(LowStockResponse::from).toList();
    }

    private InventoryItem find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("InventoryItem", id));
    }

    private Supplier resolveSupplier(UUID supplierId) {
        if (supplierId == null) return null;
        return supplierRepository.findById(supplierId)
                .orElseThrow(() -> new NotFoundException("Supplier", supplierId));
    }
}
```

- [ ] **Step 7: Run service test to verify it passes**

Run: `./gradlew test --tests '*InventoryServiceTest'`
Expected: PASS.

- [ ] **Step 8: Write the low-stock repository slice test (Testcontainers `@DataJpaTest`)**

`src/test/java/com/arogya/inventory/repository/InventoryItemRepositoryTest.java`:
```java
package com.arogya.inventory.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@Testcontainers
class InventoryItemRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void flyway(DynamicPropertyRegistry r) {
        r.add("spring.flyway.enabled", () -> true);
    }

    @Autowired InventoryItemRepository repository;

    @Test
    void findLowStockReturnsOnlyItemsAtOrBelowThreshold() {
        repository.save(new InventoryItem(UUID.randomUUID(), "Low", Unit.ML,
                new BigDecimal("10"), new BigDecimal("50"), null));
        repository.save(new InventoryItem(UUID.randomUUID(), "OK", Unit.ML,
                new BigDecimal("100"), new BigDecimal("50"), null));
        assertThat(repository.findLowStock()).extracting(InventoryItem::getName).containsExactly("Low");
    }
}
```
Note: `@DataJpaTest` disables Flyway by default and would try to auto-create tables; we keep `ddl-auto=validate` and re-enable Flyway so the real `V1__schema.sql` builds the schema. This test needs Docker — it runs under `./gradlew test` only if Docker is up; otherwise move it to `integrationTest` (Task 8). If Docker is not guaranteed for unit runs, place this file under `src/integrationTest/java/...` instead.

- [ ] **Step 9: Write the controller**

`src/main/java/com/arogya/inventory/web/InventoryController.java`:
```java
package com.arogya.inventory.web;

import com.arogya.inventory.service.*;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService service;

    public InventoryController(InventoryService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryResponse create(@Valid @RequestBody InventoryRequest req) {
        return service.create(req);
    }

    @GetMapping
    public List<InventoryResponse> list() { return service.list(); }

    @GetMapping("/low-stock")
    public List<LowStockResponse> lowStock() { return service.lowStock(); }

    @GetMapping("/{id}")
    public InventoryResponse get(@PathVariable UUID id) { return service.get(id); }

    @PutMapping("/{id}")
    public InventoryResponse update(@PathVariable UUID id, @Valid @RequestBody InventoryRequest req) {
        return service.update(id, req);
    }

    @PostMapping("/{id}/adjust")
    public InventoryResponse adjust(@PathVariable UUID id, @Valid @RequestBody AdjustRequest req) {
        return service.adjust(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
```
`/low-stock` is declared before `/{id}` so it is not swallowed by the path variable.

- [ ] **Step 10: Run unit suite + commit**

Run: `./gradlew test` (Docker up so the slice test passes; else it's deferred to `integrationTest`).
Expected: PASS.
```bash
git add src/main/java/com/arogya/inventory src/test/java/com/arogya/inventory
git commit -m "feat: inventory CRUD, adjust, low-stock"
```

---

## Task 6: Menu feature (items + recipe lines)

`MADE` items carry recipe lines keyed by order size; `RESALE` items link to one inventory item.

**Files:**
- Create: `src/main/java/com/arogya/menu/domain/MenuItem.java`, `domain/RecipeLine.java`, `domain/Category.java`, `domain/MenuType.java`, `domain/OrderSize.java`
- Create: `src/main/java/com/arogya/menu/repository/MenuItemRepository.java`
- Create: `src/main/java/com/arogya/menu/service/MenuService.java` + DTO records (`MenuRequest`, `MenuResponse`, `RecipeLineDto`, `RecipeRequest`)
- Create: `src/main/java/com/arogya/menu/web/MenuController.java`
- Test: `src/test/java/com/arogya/menu/service/MenuServiceTest.java`

- [ ] **Step 1: Write the failing service test**

`src/test/java/com/arogya/menu/service/MenuServiceTest.java`:
```java
package com.arogya.menu.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.inventory.repository.InventoryItemRepository;
import com.arogya.menu.domain.*;
import com.arogya.menu.repository.MenuItemRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MenuServiceTest {

    @Mock MenuItemRepository repository;
    @Mock InventoryItemRepository inventoryRepository;
    @InjectMocks MenuService service;

    @Test
    void resaleWithoutLinkedItemRejected() {
        MenuRequest req = new MenuRequest("Marlboro", Category.CIGARETTES, MenuType.RESALE, null);
        assertThatThrownBy(() -> service.create(req)).isInstanceOf(ValidationException.class);
    }

    @Test
    void putRecipeReplacesLines() {
        UUID menuId = UUID.randomUUID();
        UUID invId = UUID.randomUUID();
        MenuItem made = new MenuItem(menuId, "Tea", Category.TEA_COFFEE, MenuType.MADE, null);
        InventoryItem milk = new InventoryItem(invId, "Milk", Unit.ML,
                new BigDecimal("1000"), new BigDecimal("200"), null);
        when(repository.findById(menuId)).thenReturn(Optional.of(made));
        when(inventoryRepository.findById(invId)).thenReturn(Optional.of(milk));

        List<RecipeLineDto> lines = List.of(
                new RecipeLineDto(OrderSize.REGULAR, invId, new BigDecimal("180")));
        service.putRecipe(menuId, new RecipeRequest(lines));

        assertThat(made.getRecipeLines()).hasSize(1);
        assertThat(made.getRecipeLines().get(0).getQuantity()).isEqualByComparingTo("180");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests '*MenuServiceTest'`
Expected: FAIL — types missing.

- [ ] **Step 3: Write the enums**

`src/main/java/com/arogya/menu/domain/Category.java`:
```java
package com.arogya.menu.domain;

public enum Category {
    CIGARETTES, TEA_COFFEE, MILK_SHAKES, JUICES, COLD_DRINKS, SNACKS, KULHAD
}
```

`src/main/java/com/arogya/menu/domain/MenuType.java`:
```java
package com.arogya.menu.domain;

public enum MenuType { MADE, RESALE }
```

`src/main/java/com/arogya/menu/domain/OrderSize.java`:
```java
package com.arogya.menu.domain;

public enum OrderSize { REGULAR, LESS, SERVING }
```

- [ ] **Step 4: Write the `RecipeLine` and `MenuItem` entities**

`src/main/java/com/arogya/menu/domain/RecipeLine.java`:
```java
package com.arogya.menu.domain;

import com.arogya.inventory.domain.InventoryItem;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "recipe_line")
public class RecipeLine {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id")
    private MenuItem menuItem;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_size")
    private OrderSize orderSize;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    private InventoryItem inventoryItem;

    private BigDecimal quantity;

    protected RecipeLine() {}

    public RecipeLine(UUID id, MenuItem menuItem, OrderSize orderSize,
                      InventoryItem inventoryItem, BigDecimal quantity) {
        this.id = id;
        this.menuItem = menuItem;
        this.orderSize = orderSize;
        this.inventoryItem = inventoryItem;
        this.quantity = quantity;
    }

    public UUID getId() { return id; }
    public OrderSize getOrderSize() { return orderSize; }
    public InventoryItem getInventoryItem() { return inventoryItem; }
    public BigDecimal getQuantity() { return quantity; }
}
```

`src/main/java/com/arogya/menu/domain/MenuItem.java`:
```java
package com.arogya.menu.domain;

import com.arogya.inventory.domain.InventoryItem;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "menu_item")
public class MenuItem {

    @Id
    private UUID id;
    private String name;

    @Enumerated(EnumType.STRING)
    private Category category;

    @Enumerated(EnumType.STRING)
    private MenuType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resale_item_id")
    private InventoryItem resaleItem;

    @OneToMany(mappedBy = "menuItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeLine> recipeLines = new ArrayList<>();

    protected MenuItem() {}

    public MenuItem(UUID id, String name, Category category, MenuType type, InventoryItem resaleItem) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.type = type;
        this.resaleItem = resaleItem;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public Category getCategory() { return category; }
    public MenuType getType() { return type; }
    public InventoryItem getResaleItem() { return resaleItem; }
    public List<RecipeLine> getRecipeLines() { return recipeLines; }

    public void update(String name, Category category, MenuType type, InventoryItem resaleItem) {
        this.name = name;
        this.category = category;
        this.type = type;
        this.resaleItem = resaleItem;
    }

    public void replaceRecipe(List<RecipeLine> lines) {
        this.recipeLines.clear();
        this.recipeLines.addAll(lines);
    }
}
```

- [ ] **Step 5: Write the repository**

`src/main/java/com/arogya/menu/repository/MenuItemRepository.java`:
```java
package com.arogya.menu.repository;

import com.arogya.menu.domain.MenuItem;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {}
```

- [ ] **Step 6: Write the DTO records**

`src/main/java/com/arogya/menu/service/MenuRequest.java`:
```java
package com.arogya.menu.service;

import com.arogya.menu.domain.Category;
import com.arogya.menu.domain.MenuType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record MenuRequest(@NotBlank String name, @NotNull Category category,
                          @NotNull MenuType type, UUID resaleItemId) {}
```

`src/main/java/com/arogya/menu/service/RecipeLineDto.java`:
```java
package com.arogya.menu.service;

import com.arogya.menu.domain.OrderSize;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.UUID;

public record RecipeLineDto(@NotNull OrderSize orderSize, @NotNull UUID inventoryItemId,
                            @NotNull @Positive BigDecimal quantity) {}
```

`src/main/java/com/arogya/menu/service/RecipeRequest.java`:
```java
package com.arogya.menu.service;

import jakarta.validation.Valid;
import java.util.List;

public record RecipeRequest(@Valid List<RecipeLineDto> lines) {}
```

`src/main/java/com/arogya/menu/service/MenuResponse.java`:
```java
package com.arogya.menu.service;

import com.arogya.menu.domain.Category;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import java.util.List;
import java.util.UUID;

public record MenuResponse(UUID id, String name, Category category, MenuType type,
                           UUID resaleItemId, List<RecipeLineDto> recipe) {
    static MenuResponse from(MenuItem m) {
        List<RecipeLineDto> recipe = m.getRecipeLines().stream()
                .map(l -> new RecipeLineDto(l.getOrderSize(), l.getInventoryItem().getId(), l.getQuantity()))
                .toList();
        return new MenuResponse(m.getId(), m.getName(), m.getCategory(), m.getType(),
                m.getResaleItem() == null ? null : m.getResaleItem().getId(), recipe);
    }
}
```

- [ ] **Step 7: Write the service**

`src/main/java/com/arogya/menu/service/MenuService.java`:
```java
package com.arogya.menu.service;

import com.arogya.common.NotFoundException;
import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.repository.InventoryItemRepository;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import com.arogya.menu.domain.RecipeLine;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MenuService {

    private final MenuItemRepository repository;
    private final InventoryItemRepository inventoryRepository;

    public MenuService(MenuItemRepository repository, InventoryItemRepository inventoryRepository) {
        this.repository = repository;
        this.inventoryRepository = inventoryRepository;
    }

    public MenuResponse create(MenuRequest req) {
        InventoryItem resale = resolveResale(req);
        MenuItem m = new MenuItem(UUID.randomUUID(), req.name(), req.category(), req.type(), resale);
        return MenuResponse.from(repository.save(m));
    }

    @Transactional(readOnly = true)
    public List<MenuResponse> list() {
        return repository.findAll().stream().map(MenuResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public MenuResponse get(UUID id) {
        return MenuResponse.from(find(id));
    }

    public MenuResponse update(UUID id, MenuRequest req) {
        MenuItem m = find(id);
        m.update(req.name(), req.category(), req.type(), resolveResale(req));
        return MenuResponse.from(m);
    }

    public void delete(UUID id) {
        repository.delete(find(id));
    }

    @Transactional(readOnly = true)
    public MenuResponse getRecipe(UUID id) {
        return MenuResponse.from(find(id));
    }

    public MenuResponse putRecipe(UUID id, RecipeRequest req) {
        MenuItem m = find(id);
        if (m.getType() != MenuType.MADE) {
            throw new ValidationException("Only MADE items have recipes");
        }
        List<RecipeLine> lines = req.lines().stream()
                .map(dto -> new RecipeLine(UUID.randomUUID(), m, dto.orderSize(),
                        resolveInventory(dto.inventoryItemId()), dto.quantity()))
                .toList();
        m.replaceRecipe(lines);
        return MenuResponse.from(m);
    }

    private MenuItem find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("MenuItem", id));
    }

    private InventoryItem resolveResale(MenuRequest req) {
        if (req.type() == MenuType.RESALE) {
            if (req.resaleItemId() == null) {
                throw new ValidationException("RESALE menu item requires a linked inventory item");
            }
            return resolveInventory(req.resaleItemId());
        }
        return null;
    }

    private InventoryItem resolveInventory(UUID id) {
        return inventoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("InventoryItem", id));
    }
}
```

- [ ] **Step 8: Run service test to verify it passes**

Run: `./gradlew test --tests '*MenuServiceTest'`
Expected: PASS.

- [ ] **Step 9: Write the controller**

`src/main/java/com/arogya/menu/web/MenuController.java`:
```java
package com.arogya.menu.web;

import com.arogya.menu.service.*;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/menu")
public class MenuController {

    private final MenuService service;

    public MenuController(MenuService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MenuResponse create(@Valid @RequestBody MenuRequest req) {
        return service.create(req);
    }

    @GetMapping
    public List<MenuResponse> list() { return service.list(); }

    @GetMapping("/{id}")
    public MenuResponse get(@PathVariable UUID id) { return service.get(id); }

    @PutMapping("/{id}")
    public MenuResponse update(@PathVariable UUID id, @Valid @RequestBody MenuRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { service.delete(id); }

    @GetMapping("/{id}/recipe")
    public MenuResponse getRecipe(@PathVariable UUID id) { return service.getRecipe(id); }

    @PutMapping("/{id}/recipe")
    public MenuResponse putRecipe(@PathVariable UUID id, @Valid @RequestBody RecipeRequest req) {
        return service.putRecipe(id, req);
    }
}
```

- [ ] **Step 10: Run unit suite + commit**

Run: `./gradlew test`
Expected: PASS.
```bash
git add src/main/java/com/arogya/menu src/test/java/com/arogya/menu
git commit -m "feat: menu items and recipes"
```

---

## Task 7: Sales feature (core auto-deduction)

The heart of the system: one transaction records the sale and deducts stock — recipe-based for `MADE`, one-for-one for `RESALE`. Sales are never blocked on low stock.

**Files:**
- Create: `src/main/java/com/arogya/sales/domain/Sale.java`
- Create: `src/main/java/com/arogya/sales/repository/SaleRepository.java`
- Create: `src/main/java/com/arogya/sales/service/SaleService.java` + DTO records (`SaleRequest`, `SaleResponse`)
- Create: `src/main/java/com/arogya/sales/web/SaleController.java`
- Test: `src/test/java/com/arogya/sales/service/SaleServiceTest.java`

- [ ] **Step 1: Write the failing service test (the deduction rules)**

`src/test/java/com/arogya/sales/service/SaleServiceTest.java`:
```java
package com.arogya.sales.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.menu.domain.*;
import com.arogya.menu.repository.MenuItemRepository;
import com.arogya.sales.domain.Sale;
import com.arogya.sales.repository.SaleRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SaleServiceTest {

    @Mock SaleRepository saleRepository;
    @Mock MenuItemRepository menuRepository;
    @InjectMocks SaleService service;

    private MenuItem madeTea(InventoryItem milk, InventoryItem premix) {
        MenuItem tea = new MenuItem(UUID.randomUUID(), "Tea", Category.TEA_COFFEE, MenuType.MADE, null);
        tea.replaceRecipe(List.of(
                new RecipeLine(UUID.randomUUID(), tea, OrderSize.REGULAR, milk, new BigDecimal("180")),
                new RecipeLine(UUID.randomUUID(), tea, OrderSize.REGULAR, premix, new BigDecimal("1"))));
        return tea;
    }

    @Test
    void madeSaleDeductsRecipeTimesQuantity() {
        InventoryItem milk = new InventoryItem(UUID.randomUUID(), "Milk", Unit.ML,
                new BigDecimal("1000"), new BigDecimal("200"), null);
        InventoryItem premix = new InventoryItem(UUID.randomUUID(), "Premix", Unit.SACHET,
                new BigDecimal("50"), new BigDecimal("10"), null);
        MenuItem tea = madeTea(milk, premix);
        when(menuRepository.findById(tea.getId())).thenReturn(Optional.of(tea));
        when(saleRepository.save(any(Sale.class))).thenAnswer(i -> i.getArgument(0));

        service.record(new SaleRequest(tea.getId(), OrderSize.REGULAR, 2));

        assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("640");   // 1000 - 180*2
        assertThat(premix.getQuantityOnHand()).isEqualByComparingTo("48");  // 50 - 1*2
    }

    @Test
    void resaleSaleDeductsOnePerUnitFromLinkedStock() {
        InventoryItem smokes = new InventoryItem(UUID.randomUUID(), "Marlboro", Unit.PIECE,
                new BigDecimal("20"), new BigDecimal("5"), null);
        MenuItem item = new MenuItem(UUID.randomUUID(), "Marlboro", Category.CIGARETTES,
                MenuType.RESALE, smokes);
        when(menuRepository.findById(item.getId())).thenReturn(Optional.of(item));
        when(saleRepository.save(any(Sale.class))).thenAnswer(i -> i.getArgument(0));

        service.record(new SaleRequest(item.getId(), null, 3));

        assertThat(smokes.getQuantityOnHand()).isEqualByComparingTo("17"); // 20 - 3
    }

    @Test
    void madeSaleWithoutOrderSizeRejected() {
        InventoryItem milk = new InventoryItem(UUID.randomUUID(), "Milk", Unit.ML,
                new BigDecimal("1000"), new BigDecimal("200"), null);
        InventoryItem premix = new InventoryItem(UUID.randomUUID(), "Premix", Unit.SACHET,
                new BigDecimal("50"), new BigDecimal("10"), null);
        MenuItem tea = madeTea(milk, premix);
        when(menuRepository.findById(tea.getId())).thenReturn(Optional.of(tea));
        assertThatThrownBy(() -> service.record(new SaleRequest(tea.getId(), null, 1)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void madeSaleWithNoRecipeForSizeRejected() {
        InventoryItem milk = new InventoryItem(UUID.randomUUID(), "Milk", Unit.ML,
                new BigDecimal("1000"), new BigDecimal("200"), null);
        InventoryItem premix = new InventoryItem(UUID.randomUUID(), "Premix", Unit.SACHET,
                new BigDecimal("50"), new BigDecimal("10"), null);
        MenuItem tea = madeTea(milk, premix); // only REGULAR lines
        when(menuRepository.findById(tea.getId())).thenReturn(Optional.of(tea));
        assertThatThrownBy(() -> service.record(new SaleRequest(tea.getId(), OrderSize.LESS, 1)))
                .isInstanceOf(ValidationException.class);
    }
}
```
Sales mutate the managed `InventoryItem` entities reachable through the recipe lines / resale link, so no `InventoryItemRepository.save` is needed — JPA dirty-checking flushes them in the same transaction. The test asserts directly on the entity quantities.

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests '*SaleServiceTest'`
Expected: FAIL — types missing.

- [ ] **Step 3: Write the `Sale` entity**

`src/main/java/com/arogya/sales/domain/Sale.java`:
```java
package com.arogya.sales.domain;

import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.OrderSize;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sale")
public class Sale {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id")
    private MenuItem menuItem;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_size")
    private OrderSize orderSize;

    private int quantity;

    @Column(name = "sold_at")
    private Instant soldAt;

    protected Sale() {}

    public Sale(UUID id, MenuItem menuItem, OrderSize orderSize, int quantity, Instant soldAt) {
        this.id = id;
        this.menuItem = menuItem;
        this.orderSize = orderSize;
        this.quantity = quantity;
        this.soldAt = soldAt;
    }

    public UUID getId() { return id; }
    public MenuItem getMenuItem() { return menuItem; }
    public OrderSize getOrderSize() { return orderSize; }
    public int getQuantity() { return quantity; }
    public Instant getSoldAt() { return soldAt; }
}
```

- [ ] **Step 4: Write the repository**

`src/main/java/com/arogya/sales/repository/SaleRepository.java`:
```java
package com.arogya.sales.repository;

import com.arogya.sales.domain.Sale;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleRepository extends JpaRepository<Sale, UUID> {
    List<Sale> findTop100ByOrderBySoldAtDesc();
}
```

- [ ] **Step 5: Write the DTO records**

`src/main/java/com/arogya/sales/service/SaleRequest.java`:
```java
package com.arogya.sales.service;

import com.arogya.menu.domain.OrderSize;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

public record SaleRequest(@NotNull UUID menuItemId, OrderSize orderSize,
                          @Positive int quantity) {}
```

`src/main/java/com/arogya/sales/service/SaleResponse.java`:
```java
package com.arogya.sales.service;

import com.arogya.menu.domain.OrderSize;
import com.arogya.sales.domain.Sale;
import java.time.Instant;
import java.util.UUID;

public record SaleResponse(UUID id, UUID menuItemId, String menuItemName,
                           OrderSize orderSize, int quantity, Instant soldAt) {
    static SaleResponse from(Sale s) {
        return new SaleResponse(s.getId(), s.getMenuItem().getId(), s.getMenuItem().getName(),
                s.getOrderSize(), s.getQuantity(), s.getSoldAt());
    }
}
```

- [ ] **Step 6: Write the service (deduction logic)**

`src/main/java/com/arogya/sales/service/SaleService.java`:
```java
package com.arogya.sales.service;

import com.arogya.common.NotFoundException;
import com.arogya.common.ValidationException;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import com.arogya.menu.domain.RecipeLine;
import com.arogya.menu.repository.MenuItemRepository;
import com.arogya.sales.domain.Sale;
import com.arogya.sales.repository.SaleRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SaleService {

    private final SaleRepository saleRepository;
    private final MenuItemRepository menuRepository;

    public SaleService(SaleRepository saleRepository, MenuItemRepository menuRepository) {
        this.saleRepository = saleRepository;
        this.menuRepository = menuRepository;
    }

    public SaleResponse record(SaleRequest req) {
        MenuItem item = menuRepository.findById(req.menuItemId())
                .orElseThrow(() -> new NotFoundException("MenuItem", req.menuItemId()));
        BigDecimal saleQty = BigDecimal.valueOf(req.quantity());

        if (item.getType() == MenuType.MADE) {
            deductRecipe(item, req, saleQty);
        } else {
            deductResale(item, saleQty);
        }

        Sale sale = new Sale(UUID.randomUUID(), item, req.orderSize(), req.quantity(), Instant.now());
        return SaleResponse.from(saleRepository.save(sale));
    }

    private void deductRecipe(MenuItem item, SaleRequest req, BigDecimal saleQty) {
        if (req.orderSize() == null) {
            throw new ValidationException("orderSize is required for a MADE item");
        }
        List<RecipeLine> lines = item.getRecipeLines().stream()
                .filter(l -> l.getOrderSize() == req.orderSize())
                .toList();
        if (lines.isEmpty()) {
            throw new ValidationException("No recipe for order size " + req.orderSize());
        }
        for (RecipeLine line : lines) {
            line.getInventoryItem().deduct(line.getQuantity().multiply(saleQty));
        }
    }

    private void deductResale(MenuItem item, BigDecimal saleQty) {
        if (item.getResaleItem() == null) {
            throw new ValidationException("RESALE item has no linked inventory stock");
        }
        item.getResaleItem().deduct(saleQty);
    }

    @Transactional(readOnly = true)
    public List<SaleResponse> recent() {
        return saleRepository.findTop100ByOrderBySoldAtDesc().stream()
                .map(SaleResponse::from).toList();
    }
}
```
`deduct` never floors at zero — stock can go negative and the low-stock list surfaces it (spec §6). The whole method is `@Transactional`: a multi-line deduction fully applies or fully rolls back.

- [ ] **Step 7: Run service test to verify it passes**

Run: `./gradlew test --tests '*SaleServiceTest'`
Expected: PASS (all four cases).

- [ ] **Step 8: Write the controller**

`src/main/java/com/arogya/sales/web/SaleController.java`:
```java
package com.arogya.sales.web;

import com.arogya.sales.service.SaleRequest;
import com.arogya.sales.service.SaleResponse;
import com.arogya.sales.service.SaleService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

    private final SaleService service;

    public SaleController(SaleService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse record(@Valid @RequestBody SaleRequest req) {
        return service.record(req);
    }

    @GetMapping
    public List<SaleResponse> recent() { return service.recent(); }
}
```

- [ ] **Step 9: Run unit suite + commit**

Run: `./gradlew test`
Expected: PASS.
```bash
git add src/main/java/com/arogya/sales src/test/java/com/arogya/sales
git commit -m "feat: sales recording with stock auto-deduction"
```

---

## Task 8: Integration test — full sale flow + rollback (Testcontainers)

Proves the schema, deduction, rollback, and low-stock endpoint work against real PostgreSQL.

**Files:**
- Create: `src/integrationTest/java/com/arogya/SaleFlowIntegrationTest.java`
- Create: `src/integrationTest/resources/application.yml` (if needed for test profile — optional)

- [ ] **Step 1: Write the integration test**

`src/integrationTest/java/com/arogya/SaleFlowIntegrationTest.java`:
```java
package com.arogya;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.inventory.repository.InventoryItemRepository;
import com.arogya.menu.domain.*;
import com.arogya.menu.repository.MenuItemRepository;
import com.arogya.sales.service.SaleRequest;
import com.arogya.sales.service.SaleService;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
class SaleFlowIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired MenuItemRepository menuRepository;
    @Autowired SaleService saleService;

    @Test
    void madeSaleDeductsStockAcrossTransaction() {
        InventoryItem milk = inventoryRepository.save(new InventoryItem(UUID.randomUUID(),
                "Milk", Unit.ML, new BigDecimal("1000"), new BigDecimal("200"), null));
        InventoryItem premix = inventoryRepository.save(new InventoryItem(UUID.randomUUID(),
                "Premix", Unit.SACHET, new BigDecimal("50"), new BigDecimal("10"), null));
        MenuItem tea = new MenuItem(UUID.randomUUID(), "Tea", Category.TEA_COFFEE, MenuType.MADE, null);
        tea.replaceRecipe(List.of(
                new RecipeLine(UUID.randomUUID(), tea, OrderSize.REGULAR, milk, new BigDecimal("180")),
                new RecipeLine(UUID.randomUUID(), tea, OrderSize.REGULAR, premix, new BigDecimal("1"))));
        menuRepository.save(tea);

        saleService.record(new SaleRequest(tea.getId(), OrderSize.REGULAR, 2));

        assertThat(inventoryRepository.findById(milk.getId()).orElseThrow().getQuantityOnHand())
                .isEqualByComparingTo("640");
        assertThat(inventoryRepository.findById(premix.getId()).orElseThrow().getQuantityOnHand())
                .isEqualByComparingTo("48");
    }

    @Test
    void lowStockEndpointReturnsItemsAtOrBelowThreshold() {
        inventoryRepository.save(new InventoryItem(UUID.randomUUID(), "LowMilk", Unit.ML,
                new BigDecimal("10"), new BigDecimal("200"), null));
        List<String> lowNames = inventoryRepository.findLowStock().stream()
                .map(InventoryItem::getName).toList();
        assertThat(lowNames).contains("LowMilk");
    }
}
```

- [ ] **Step 2: Run the integration test (Docker must be running)**

Run: `./gradlew integrationTest`
Expected: PASS — Flyway applies `V1__schema.sql` against the container, the sale deducts stock, low-stock query works.

- [ ] **Step 3: Commit**

```bash
git add src/integrationTest
git commit -m "test: Testcontainers integration test for sale flow + low-stock"
```

---

## Task 9: Seed data (Flyway V2) from the spreadsheet

Seed menu, recipes, and inventory from `MENU_AROGYA_Organized.xlsx`. **Lazy choice:** a hand-derived `V2__seed.sql` (deterministic, no runtime Apache POI dependency) rather than an xlsx parser. `// ponytail: SQL seed over a POI loader; if the menu changes often, swap to a CSV-driven loader.`

**Files:**
- Create: `src/main/resources/db/migration/V2__seed.sql`
- (throwaway) a one-off script to dump the xlsx so the SQL can be written accurately

- [ ] **Step 1: Dump the spreadsheet to read its rows**

Run (one-off, not committed):
```bash
python -c "import openpyxl,csv,sys; wb=openpyxl.load_workbook('MENU_AROGYA_Organized.xlsx'); [print('##',ws.title) or [print(list(r)) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets]"
```
(If `openpyxl` is missing: `pip install openpyxl`.) Read the output to learn the exact menu items, categories, order sizes, and per-size milk amounts.

- [ ] **Step 2: Write `V2__seed.sql` from the dumped rows**

Structure (fill rows from the dump — `gen_random_uuid()` needs `pgcrypto`, available by default on PG 13+; if not, use literal UUIDs):

```sql
-- Raw materials
insert into inventory_item (id, name, unit, quantity_on_hand, reorder_threshold)
values
  (gen_random_uuid(), 'Tea/Coffee Premix', 'SACHET', 0, 0),
  (gen_random_uuid(), 'Milk', 'ML', 0, 0);

-- Resale goods (one row per cigarette brand / cold drink / snack from the sheet)
-- insert into inventory_item (...) values (gen_random_uuid(), 'Marlboro', 'PIECE', 0, 0), ... ;

-- MADE menu items (Tea & Coffee / Milk & Shakes / Juices / Kulhad)
-- insert into menu_item (id, name, category, type) values (gen_random_uuid(), 'Tea', 'TEA_COFFEE', 'MADE'), ... ;

-- RESALE menu items, linking resale_item_id to the matching inventory_item
-- insert into menu_item (id, name, category, type, resale_item_id)
--   select gen_random_uuid(), i.name, 'CIGARETTES', 'RESALE', i.id from inventory_item i where i.unit='PIECE' and ...;

-- Recipe lines for MADE items: premix 1 sachet + milk by order size
-- REGULAR ~180ml, LESS ~120ml, some 60ml (per spec §3). One block per MADE item.
```
Keep `quantity_on_hand`/`reorder_threshold` at 0 — the owner sets real levels and suppliers after seeding (spec §7). Write the actual rows from the Step 1 dump; do not leave the comment placeholders in the final file.

- [ ] **Step 3: Verify the seed applies (re-run integration test against a fresh container)**

Run: `./gradlew integrationTest`
Expected: PASS — both V1 and V2 apply cleanly on the fresh Testcontainers database.

- [ ] **Step 4: Commit**

```bash
git add src/main/resources/db/migration/V2__seed.sql
git commit -m "feat: Flyway V2 seed from AROGYA menu"
```

---

## Task 10: Final verification + run

- [ ] **Step 1: Full green build**

Run: `./gradlew test integrationTest`
Expected: BUILD SUCCESSFUL (Docker running for integration).

- [ ] **Step 2: Boot the app and smoke-test the core flow**

Run (PostgreSQL `arogya/arogya` reachable on 5432):
```bash
./gradlew bootRun
```
Then in another shell:
```bash
curl -s localhost:8080/api/menu | head           # seeded menu present
curl -s localhost:8080/api/inventory/low-stock    # everything is low (0 stock) until adjusted
```
Expected: menu list non-empty; low-stock returns seeded items.

- [ ] **Step 3: Commit any config fixes**

```bash
git add -A && git commit -m "chore: final verification fixes"   # only if changes were needed
```

---

## Self-Review (performed against the spec)

- **Spec coverage:** Suppliers CRUD (T4 §5), Inventory CRUD + adjust + low-stock (T5 §5), Menu + recipes (T6 §5), Sales + deduction MADE/RESALE (T7 §5/§6), transactional rollback (T7+T8 §6), manual replenish via adjust (T5 §6), low-stock = `qty <= threshold` (T5 §3), seeding (T9 §7), RFC 7807 errors incl. NotFound/Validation cases (T2 §8), unit+slice+integration tests (T2–T8 §9), build order matches §10. ✅
- **Out-of-scope respected:** no purchase orders, no auth, no analytics, no frontend. ✅
- **Type consistency:** `deduct()`/`adjust()` on `InventoryItem`, `replaceRecipe()` on `MenuItem`, `findLowStock()`, `record()`/`recent()` on `SaleService`, DTO record names — all used consistently across tasks. ✅
- **Known gap (honest):** Task 9 Step 2's exact rows depend on reading the spreadsheet at execution time (Step 1 dump) — the only legitimately data-dependent step; the structure and rules are fully specified so it is fillable, not a placeholder.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-arogya-inventory.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
