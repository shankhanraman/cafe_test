# Supplier-Invoice Stock-In via billscan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the cafe backend accept a supplier's bill image/PDF, call the billscan service to extract line items, auto-apply them as stock increases against that supplier's inventory items, and persist a goods-receipt audit record.

**Architecture:** A new `com.arogya.cafe.receiving` module exposes `POST /api/receiving/scan` (multipart). It calls billscan over HTTP (sidecar, `http://localhost:8000`), matches each line item to the supplier's inventory items by name, maps the scanned unit to the `Unit` enum, applies stock for confident lines, and records every line's outcome in `goods_receipt` / `goods_receipt_line`. billscan is extended to emit a per-line `unit`.

**Tech Stack:** Java 21, Spring Boot 4.1 (`spring-boot-starter-webmvc`), Spring `RestClient`, JPA/Hibernate, Flyway, PostgreSQL, JUnit 5 + Mockito + Testcontainers; Python/FastAPI (billscan).

**Spec:** `docs/superpowers/specs/2026-06-22-billscan-supplier-stockin-design.md`

---

## File Structure

**billscan (Python)**
- Modify: `billscan/app/models.py` — add `unit` to `LineItem`
- Modify: `billscan/app/structurer.py` — LLM prompt/schema emits `unit`
- Modify: `billscan/app/parsing.py` — regex fallback fills `unit`

**Backend docs (spec-driven, step 0)**
- Modify: `backend/docs/datamodel.md`, `backend/docs/dataflow.md`, `backend/docs/architecture.md`, `backend/docs/api-contract.md`

**Backend (Java) — new module `com.arogya.cafe.receiving`**
- `entity/GoodsReceipt.java`, `entity/GoodsReceiptLine.java`, `entity/ReceiptStatus.java`, `entity/LineStatus.java`
- `repository/GoodsReceiptRepository.java`
- `client/BillScanClient.java` (interface), `client/RestBillScanClient.java`, `client/BillScanResult.java` (+ nested DTOs), `client/BillScanException.java`
- `support/UnitMapper.java` (+ `MappedUnit` record)
- `service/ReceivingService.java`
- `dto/ScanReceiptResponse.java`, `dto/ReceiptLineResult.java`
- `controller/ReceivingController.java`
- `config/BillScanProperties.java`, `config/RestClientConfig.java`
- Modify: `common/GlobalExceptionHandler.java`, `common/` add `DuplicateReceiptException.java`
- Modify: `src/main/resources/db/migration/V3__goods_receipt.sql`
- Modify: `src/main/resources/application.yml`

**Backend tests**
- `src/test/java/com/arogya/cafe/receiving/support/UnitMapperTest.java`
- `src/test/java/com/arogya/cafe/receiving/service/ReceivingServiceTest.java`
- `src/integrationTest/java/com/arogya/cafe/ReceivingFlowIntegrationTest.java`

**Deploy**
- `argocd`/k8s manifest: add billscan sidecar to the backend Deployment (Task 14)

---

## Task 1: Spec-driven docs (step 0 — before any code)

`backend/CLAUDE.md` requires updating the context docs before code.

**Files:**
- Modify: `backend/docs/datamodel.md`
- Modify: `backend/docs/dataflow.md`
- Modify: `backend/docs/architecture.md`
- Modify: `backend/docs/api-contract.md`

- [ ] **Step 1: Extend the E-R diagram in `datamodel.md`**

Add two entities and relationships inside the existing `erDiagram` block, and add entity notes.

Add relationships near the top of the diagram:
```
    SUPPLIER ||--o{ GOODS_RECEIPT : "delivers"
    GOODS_RECEIPT ||--o{ GOODS_RECEIPT_LINE : "contains"
    INVENTORY_ITEM ||--o{ GOODS_RECEIPT_LINE : "stocked by"
```

Add entity blocks:
```
    GOODS_RECEIPT {
        uuid id PK
        uuid supplier_id FK "nullable"
        string bill_number "nullable"
        string bill_date "nullable"
        string engine_used
        enum status "APPLIED, PARTIAL, UNMATCHED_SUPPLIER"
        jsonb raw_json
        timestamptz created_at
    }
    GOODS_RECEIPT_LINE {
        uuid id PK
        uuid receipt_id FK
        string description
        decimal scanned_quantity "nullable"
        string scanned_unit "nullable"
        uuid matched_item_id FK "nullable"
        decimal applied_quantity "nullable"
        enum line_status "APPLIED, UNMATCHED_ITEM, NEEDS_REVIEW"
        string note "nullable"
    }
```

Add an entity note:
```
- **GOODS_RECEIPT** — one per scanned supplier bill. `status = APPLIED` when every line applied,
  `PARTIAL` when some lines were held, `UNMATCHED_SUPPLIER` when no supplier could be resolved.
  Unique `(supplier_id, bill_number)` prevents re-applying the same bill.
- **GOODS_RECEIPT_LINE** — one per scanned line item. `APPLIED` lines added `applied_quantity` to
  the matched inventory item; `UNMATCHED_ITEM` (no name match) and `NEEDS_REVIEW` (unit
  missing/incompatible) lines change no stock.
```

- [ ] **Step 2: Document the flow in `dataflow.md`**

Append a section describing: `POST /api/receiving/scan` → resolve supplier (by id, else by vendor name) → call billscan `/scan` → per line: name-match within supplier items + map unit → APPLIED/UNMATCHED_ITEM/NEEDS_REVIEW → persist receipt+lines → return summary. Note that billscan is a sidecar reached at `billscan.base-url`.

- [ ] **Step 3: Document the module in `architecture.md`**

Append: new `receiving` module (controller/service/client/support/dto/entity/repository); `BillScanClient` interface isolates the HTTP call for testing; stock applied via existing `InventoryItem.adjust`.

- [ ] **Step 4: Document the endpoint in `api-contract.md`**

Add `POST /api/receiving/scan` (multipart: `file`, optional `supplierId`, optional `engine`) with the response shape from Task 11 and status codes 200/409/502.

- [ ] **Step 5: Commit**

```bash
git add backend/docs/datamodel.md backend/docs/dataflow.md backend/docs/architecture.md backend/docs/api-contract.md
git commit -m "docs: data model + flow for supplier-invoice stock-in"
```

---

## Task 2: billscan emits a per-line `unit`

**Files:**
- Modify: `billscan/app/models.py`
- Modify: `billscan/app/structurer.py`
- Modify: `billscan/app/parsing.py`

- [ ] **Step 1: Add `unit` to `LineItem`**

In `billscan/app/models.py`, add the field to `LineItem`:
```python
class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None          # raw unit text from the bill, e.g. "kg", "ltr", "pcs"
    unit_price: Optional[float] = None
    amount: Optional[float] = None
```

- [ ] **Step 2: Have the LLM structurer extract `unit`**

In `billscan/app/structurer.py`, find where the line-item fields are described to the LLM (the JSON schema/prompt for line items) and add the `unit` field so the model returns it. Add `"unit"` alongside `"description"`/`"quantity"` in the instruction text and any example, e.g.:
```python
# in the prompt's per-line description
'  "unit": "the unit of measure as written (e.g. kg, g, ltr, ml, pcs, packet, sachet) or null",'
```
Ensure the parsed dict is passed through to `LineItem(**line)` unchanged (the new optional field flows through automatically).

- [ ] **Step 3: Fill `unit` in the regex fallback**

In `billscan/app/parsing.py`, where line items are built, capture a trailing/leading unit token when present. Add a unit regex and set it on the line:
```python
import re
_UNIT_RE = re.compile(r"\b(kg|g|gm|gms|ltr|l|ml|pcs|pc|piece|pieces|nos|packet|sachet|sachets)\b", re.I)

def _extract_unit(text: str) -> str | None:
    m = _UNIT_RE.search(text or "")
    return m.group(1).lower() if m else None
```
Set `unit=_extract_unit(line_text)` when constructing each `LineItem` (leave `None` if not found).

- [ ] **Step 4: Verify the API still returns valid JSON**

Run (Docker easiest, from `billscan/`):
```bash
docker compose up --build -d
curl.exe -X POST "http://localhost:8000/scan" -F "file=@inv_1.jpeg"
```
Expected: HTTP 200 JSON where each `line_items[]` object now includes a `"unit"` key (value may be `null`). Then `docker compose down`.

- [ ] **Step 5: Commit**

```bash
git add billscan/app/models.py billscan/app/structurer.py billscan/app/parsing.py
git commit -m "feat(billscan): emit per-line unit in scan output"
```

---

## Task 3: Backend config — billscan properties, RestClient, application.yml

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/config/BillScanProperties.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/config/RestClientConfig.java`
- Modify: `backend/src/main/resources/application.yml`

- [ ] **Step 1: Add config properties**

`BillScanProperties.java`:
```java
package com.arogya.cafe.receiving.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "billscan")
public record BillScanProperties(String baseUrl, int timeoutSeconds) {
  public BillScanProperties {
    if (baseUrl == null || baseUrl.isBlank()) {
      baseUrl = "http://localhost:8000";
    }
    if (timeoutSeconds <= 0) {
      timeoutSeconds = 60;
    }
  }
}
```

- [ ] **Step 2: Add the RestClient bean**

`RestClientConfig.java`:
```java
package com.arogya.cafe.receiving.config;

import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.boot.web.client.ClientHttpRequestFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(BillScanProperties.class)
public class RestClientConfig {

  @Bean
  public RestClient billScanRestClient(BillScanProperties props) {
    var settings =
        ClientHttpRequestFactorySettings.defaults()
            .withConnectTimeout(Duration.ofSeconds(5))
            .withReadTimeout(Duration.ofSeconds(props.timeoutSeconds()));
    return RestClient.builder()
        .baseUrl(props.baseUrl())
        .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
        .build();
  }
}
```

- [ ] **Step 3: Add config to `application.yml`**

Append at the root level:
```yaml
billscan:
  base-url: ${BILLSCAN_BASE_URL:http://localhost:8000}
  timeout-seconds: 60
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/config backend/src/main/resources/application.yml
git commit -m "feat(receiving): billscan RestClient + config properties"
```

---

## Task 4: billscan client — response DTOs + interface + impl

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/client/BillScanResult.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/client/BillScanClient.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/client/BillScanException.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/client/RestBillScanClient.java`

- [ ] **Step 1: Response DTOs**

`BillScanResult.java` (maps billscan's JSON; only the fields we use):
```java
package com.arogya.cafe.receiving.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BillScanResult(
    boolean success,
    @JsonProperty("engine_used") String engineUsed,
    BillData data,
    List<String> warnings) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record BillData(
      @JsonProperty("vendor_name") String vendorName,
      @JsonProperty("vendor_contact") String vendorContact,
      @JsonProperty("bill_number") String billNumber,
      @JsonProperty("bill_date") String billDate,
      @JsonProperty("line_items") List<Line> lineItems) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Line(
      String description, BigDecimal quantity, String unit) {}
}
```

- [ ] **Step 2: Client interface + exception**

`BillScanClient.java`:
```java
package com.arogya.cafe.receiving.client;

public interface BillScanClient {
  /** Sends the file to billscan and returns the parsed result. */
  BillScanResult scan(byte[] content, String filename, String contentType, String engine);
}
```

`BillScanException.java`:
```java
package com.arogya.cafe.receiving.client;

public class BillScanException extends RuntimeException {
  public BillScanException(String message, Throwable cause) {
    super(message, cause);
  }
}
```

- [ ] **Step 3: RestClient implementation**

`RestBillScanClient.java`:
```java
package com.arogya.cafe.receiving.client;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class RestBillScanClient implements BillScanClient {

  private final RestClient client;

  public RestBillScanClient(RestClient billScanRestClient) {
    this.client = billScanRestClient;
  }

  @Override
  public BillScanResult scan(byte[] content, String filename, String contentType, String engine) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add(
        "file",
        new ByteArrayResource(content) {
          @Override
          public String getFilename() {
            return filename;
          }
        });
    body.add("engine", engine);
    try {
      return client
          .post()
          .uri("/scan")
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .body(body)
          .retrieve()
          .body(BillScanResult.class);
    } catch (RuntimeException ex) {
      throw new BillScanException("billscan request failed: " + ex.getMessage(), ex);
    }
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/client
git commit -m "feat(receiving): billscan HTTP client + response DTOs"
```

---

## Task 5: UnitMapper (synonym table + litre→ML conversion) — TDD

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/support/UnitMapper.java`
- Test: `backend/src/test/java/com/arogya/cafe/receiving/support/UnitMapperTest.java`

- [ ] **Step 1: Write the failing test**

`UnitMapperTest.java`:
```java
package com.arogya.cafe.receiving.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class UnitMapperTest {

  @Test
  void mapsMlSynonyms() {
    assertThat(UnitMapper.map("ml")).get().extracting(MappedUnit::unit).isEqualTo(Unit.ML);
    assertThat(UnitMapper.map("MILLILITER")).get().extracting(MappedUnit::unit).isEqualTo(Unit.ML);
  }

  @Test
  void litreMapsToMlWithThousandMultiplier() {
    MappedUnit m = UnitMapper.map("ltr").orElseThrow();
    assertThat(m.unit()).isEqualTo(Unit.ML);
    assertThat(m.apply(new BigDecimal("2"))).isEqualByComparingTo("2000");
  }

  @Test
  void mapsPieceSynonyms() {
    for (String s : new String[] {"pcs", "pc", "piece", "nos", "unit", "ea"}) {
      assertThat(UnitMapper.map(s)).get().extracting(MappedUnit::unit).isEqualTo(Unit.PIECE);
    }
  }

  @Test
  void mapsSachetSynonyms() {
    assertThat(UnitMapper.map("packet")).get().extracting(MappedUnit::unit).isEqualTo(Unit.SACHET);
  }

  @Test
  void unknownOrNullUnitIsEmpty() {
    assertThat(UnitMapper.map("kg")).isEmpty();
    assertThat(UnitMapper.map(null)).isEmpty();
    assertThat(UnitMapper.map("  ")).isEmpty();
  }

  @Test
  void pieceAppliesQuantityUnchanged() {
    assertThat(UnitMapper.map("pcs").orElseThrow().apply(new BigDecimal("5")))
        .isEqualByComparingTo("5");
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.arogya.cafe.receiving.support.UnitMapperTest"`
Expected: FAIL — `UnitMapper`/`MappedUnit` do not exist (compilation error).

- [ ] **Step 3: Implement `MappedUnit` and `UnitMapper`**

`MappedUnit.java` (same package):
```java
package com.arogya.cafe.receiving.support;

import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;

/** A resolved inventory unit plus the multiplier to convert scanned quantity into that unit. */
public record MappedUnit(Unit unit, BigDecimal multiplier) {
  public BigDecimal apply(BigDecimal scannedQuantity) {
    return scannedQuantity.multiply(multiplier);
  }
}
```

`UnitMapper.java`:
```java
package com.arogya.cafe.receiving.support;

import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

public final class UnitMapper {

  private static final BigDecimal ONE = BigDecimal.ONE;
  private static final BigDecimal THOUSAND = new BigDecimal("1000");

  private static final Map<String, MappedUnit> TABLE =
      Map.ofEntries(
          Map.entry("ml", new MappedUnit(Unit.ML, ONE)),
          Map.entry("milliliter", new MappedUnit(Unit.ML, ONE)),
          Map.entry("millilitre", new MappedUnit(Unit.ML, ONE)),
          Map.entry("l", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("ltr", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("litre", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("liter", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("pcs", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("pc", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("piece", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("pieces", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("nos", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("no", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("unit", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("ea", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("sachet", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("sachets", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("packet", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("packets", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("pkt", new MappedUnit(Unit.SACHET, ONE)));

  private UnitMapper() {}

  public static Optional<MappedUnit> map(String rawUnit) {
    if (rawUnit == null || rawUnit.isBlank()) {
      return Optional.empty();
    }
    return Optional.ofNullable(TABLE.get(rawUnit.trim().toLowerCase()));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.arogya.cafe.receiving.support.UnitMapperTest"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/support backend/src/test/java/com/arogya/cafe/receiving/support
git commit -m "feat(receiving): unit synonym mapper with litre->ml conversion"
```

---

## Task 6: Flyway migration for goods_receipt tables

**Files:**
- Create: `backend/src/main/resources/db/migration/V3__goods_receipt.sql`

- [ ] **Step 1: Write the migration**

```sql
create table goods_receipt (
    id           uuid primary key,
    supplier_id  uuid references supplier(id),
    bill_number  varchar(100),
    bill_date    varchar(50),
    engine_used  varchar(50),
    status       varchar(30) not null,        -- APPLIED, PARTIAL, UNMATCHED_SUPPLIER
    raw_json     jsonb,
    created_at   timestamptz not null,
    constraint uq_goods_receipt_supplier_bill unique (supplier_id, bill_number)
);

create table goods_receipt_line (
    id               uuid primary key,
    receipt_id       uuid not null references goods_receipt(id),
    description      varchar(500),
    scanned_quantity numeric(12,2),
    scanned_unit     varchar(50),
    matched_item_id  uuid references inventory_item(id),
    applied_quantity numeric(12,2),
    line_status      varchar(30) not null,    -- APPLIED, UNMATCHED_ITEM, NEEDS_REVIEW
    note             varchar(500)
);

create index idx_goods_receipt_supplier on goods_receipt (supplier_id);
create index idx_goods_receipt_line_receipt on goods_receipt_line (receipt_id);
```

- [ ] **Step 2: Verify migration applies (integration test bootstrap)**

Run (Docker must be up): `./gradlew integrationTest --tests "com.arogya.cafe.SaleFlowIntegrationTest"`
Expected: PASS — confirms Flyway applies V3 cleanly against a fresh Postgres container.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V3__goods_receipt.sql
git commit -m "feat(receiving): flyway migration for goods_receipt tables"
```

---

## Task 7: JPA entities + enums

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/entity/ReceiptStatus.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/entity/LineStatus.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/entity/GoodsReceipt.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/entity/GoodsReceiptLine.java`

- [ ] **Step 1: Enums**

`ReceiptStatus.java`:
```java
package com.arogya.cafe.receiving.entity;

public enum ReceiptStatus {
  APPLIED,
  PARTIAL,
  UNMATCHED_SUPPLIER
}
```

`LineStatus.java`:
```java
package com.arogya.cafe.receiving.entity;

public enum LineStatus {
  APPLIED,
  UNMATCHED_ITEM,
  NEEDS_REVIEW
}
```

- [ ] **Step 2: `GoodsReceiptLine` entity**

```java
package com.arogya.cafe.receiving.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "goods_receipt_line")
public class GoodsReceiptLine {

  @Id private UUID id;

  @Column(name = "receipt_id")
  private UUID receiptId;

  private String description;

  @Column(name = "scanned_quantity")
  private BigDecimal scannedQuantity;

  @Column(name = "scanned_unit")
  private String scannedUnit;

  @Column(name = "matched_item_id")
  private UUID matchedItemId;

  @Column(name = "applied_quantity")
  private BigDecimal appliedQuantity;

  @Enumerated(EnumType.STRING)
  @Column(name = "line_status")
  private LineStatus lineStatus;

  private String note;

  protected GoodsReceiptLine() {}

  public GoodsReceiptLine(
      UUID id,
      UUID receiptId,
      String description,
      BigDecimal scannedQuantity,
      String scannedUnit,
      UUID matchedItemId,
      BigDecimal appliedQuantity,
      LineStatus lineStatus,
      String note) {
    this.id = id;
    this.receiptId = receiptId;
    this.description = description;
    this.scannedQuantity = scannedQuantity;
    this.scannedUnit = scannedUnit;
    this.matchedItemId = matchedItemId;
    this.appliedQuantity = appliedQuantity;
    this.lineStatus = lineStatus;
    this.note = note;
  }

  public UUID getId() {
    return id;
  }

  public UUID getReceiptId() {
    return receiptId;
  }

  public String getDescription() {
    return description;
  }

  public BigDecimal getScannedQuantity() {
    return scannedQuantity;
  }

  public String getScannedUnit() {
    return scannedUnit;
  }

  public UUID getMatchedItemId() {
    return matchedItemId;
  }

  public BigDecimal getAppliedQuantity() {
    return appliedQuantity;
  }

  public LineStatus getLineStatus() {
    return lineStatus;
  }

  public String getNote() {
    return note;
  }
}
```

- [ ] **Step 3: `GoodsReceipt` entity**

```java
package com.arogya.cafe.receiving.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "goods_receipt")
public class GoodsReceipt {

  @Id private UUID id;

  @Column(name = "supplier_id")
  private UUID supplierId;

  @Column(name = "bill_number")
  private String billNumber;

  @Column(name = "bill_date")
  private String billDate;

  @Column(name = "engine_used")
  private String engineUsed;

  @Enumerated(EnumType.STRING)
  private ReceiptStatus status;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_json")
  private String rawJson;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
  @JoinColumn(name = "receipt_id")
  private List<GoodsReceiptLine> lines = new ArrayList<>();

  protected GoodsReceipt() {}

  public GoodsReceipt(
      UUID id,
      UUID supplierId,
      String billNumber,
      String billDate,
      String engineUsed,
      ReceiptStatus status,
      String rawJson,
      OffsetDateTime createdAt) {
    this.id = id;
    this.supplierId = supplierId;
    this.billNumber = billNumber;
    this.billDate = billDate;
    this.engineUsed = engineUsed;
    this.status = status;
    this.rawJson = rawJson;
    this.createdAt = createdAt;
  }

  public void addLine(GoodsReceiptLine line) {
    this.lines.add(line);
  }

  public UUID getId() {
    return id;
  }

  public UUID getSupplierId() {
    return supplierId;
  }

  public String getBillNumber() {
    return billNumber;
  }

  public ReceiptStatus getStatus() {
    return status;
  }

  public List<GoodsReceiptLine> getLines() {
    return lines;
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/entity
git commit -m "feat(receiving): goods receipt JPA entities + enums"
```

---

## Task 8: Repositories

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/repository/GoodsReceiptRepository.java`
- Modify: `backend/src/main/java/com/arogya/cafe/inventory/repository/InventoryItemRepository.java`
- Modify: `backend/src/main/java/com/arogya/cafe/supplier/repository/SupplierRepository.java`

- [ ] **Step 1: GoodsReceiptRepository**

```java
package com.arogya.cafe.receiving.repository;

import com.arogya.cafe.receiving.entity.GoodsReceipt;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoodsReceiptRepository extends JpaRepository<GoodsReceipt, UUID> {
  boolean existsBySupplierIdAndBillNumber(UUID supplierId, String billNumber);
}
```

- [ ] **Step 2: Add supplier-scoped finder to InventoryItemRepository**

Add this method inside the existing interface:
```java
  java.util.List<InventoryItem> findBySupplierId(UUID supplierId);
```

- [ ] **Step 3: Add name finder to SupplierRepository**

```java
package com.arogya.cafe.supplier.repository;

import com.arogya.cafe.supplier.entity.Supplier;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {
  Optional<Supplier> findFirstByNameIgnoreCase(String name);
}
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/repository backend/src/main/java/com/arogya/cafe/inventory/repository backend/src/main/java/com/arogya/cafe/supplier/repository
git commit -m "feat(receiving): repositories + supplier/inventory finders"
```

---

## Task 9: Response DTOs

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/dto/ReceiptLineResult.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/dto/ScanReceiptResponse.java`

- [ ] **Step 1: Line result DTO**

`ReceiptLineResult.java`:
```java
package com.arogya.cafe.receiving.dto;

import com.arogya.cafe.receiving.entity.GoodsReceiptLine;
import com.arogya.cafe.receiving.entity.LineStatus;
import java.math.BigDecimal;
import java.util.UUID;

public record ReceiptLineResult(
    String description,
    BigDecimal scannedQuantity,
    String scannedUnit,
    UUID matchedItemId,
    BigDecimal appliedQuantity,
    LineStatus lineStatus,
    String note) {
  public static ReceiptLineResult from(GoodsReceiptLine l) {
    return new ReceiptLineResult(
        l.getDescription(),
        l.getScannedQuantity(),
        l.getScannedUnit(),
        l.getMatchedItemId(),
        l.getAppliedQuantity(),
        l.getLineStatus(),
        l.getNote());
  }
}
```

- [ ] **Step 2: Receipt response DTO**

`ScanReceiptResponse.java`:
```java
package com.arogya.cafe.receiving.dto;

import com.arogya.cafe.receiving.entity.GoodsReceipt;
import com.arogya.cafe.receiving.entity.LineStatus;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import java.util.List;
import java.util.UUID;

public record ScanReceiptResponse(
    UUID receiptId,
    UUID supplierId,
    ReceiptStatus status,
    int applied,
    int needsReview,
    int unmatched,
    List<ReceiptLineResult> lines) {

  public static ScanReceiptResponse from(GoodsReceipt r) {
    List<ReceiptLineResult> lines = r.getLines().stream().map(ReceiptLineResult::from).toList();
    int applied = count(r, LineStatus.APPLIED);
    int needsReview = count(r, LineStatus.NEEDS_REVIEW);
    int unmatched = count(r, LineStatus.UNMATCHED_ITEM);
    return new ScanReceiptResponse(
        r.getId(), r.getSupplierId(), r.getStatus(), applied, needsReview, unmatched, lines);
  }

  private static int count(GoodsReceipt r, LineStatus status) {
    return (int) r.getLines().stream().filter(l -> l.getLineStatus() == status).count();
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/dto
git commit -m "feat(receiving): scan receipt response DTOs"
```

---

## Task 10: ReceivingService (core logic) — TDD

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/common/DuplicateReceiptException.java`
- Create: `backend/src/main/java/com/arogya/cafe/receiving/service/ReceivingService.java`
- Test: `backend/src/test/java/com/arogya/cafe/receiving/service/ReceivingServiceTest.java`

- [ ] **Step 1: Write the failing test**

`ReceivingServiceTest.java`:
```java
package com.arogya.cafe.receiving.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.receiving.client.BillScanClient;
import com.arogya.cafe.receiving.client.BillScanResult;
import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.entity.GoodsReceipt;
import com.arogya.cafe.receiving.entity.LineStatus;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import com.arogya.cafe.receiving.repository.GoodsReceiptRepository;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReceivingServiceTest {

  @Mock BillScanClient billScanClient;
  @Mock InventoryItemRepository inventoryRepository;
  @Mock SupplierRepository supplierRepository;
  @Mock GoodsReceiptRepository receiptRepository;

  ReceivingService service;
  UUID supplierId;

  @BeforeEach
  void setUp() {
    service =
        new ReceivingService(
            billScanClient,
            inventoryRepository,
            supplierRepository,
            receiptRepository,
            new ObjectMapper());
    supplierId = UUID.randomUUID();
    when(receiptRepository.save(any(GoodsReceipt.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  private BillScanResult result(BillScanResult.Line... lines) {
    return new BillScanResult(
        true,
        "tesseract",
        new BillScanResult.BillData("Acme", "999", "INV1", "01/01/26", List.of(lines)),
        List.of());
  }

  private InventoryItem item(String name, Unit unit) {
    return new InventoryItem(
        UUID.randomUUID(), name, unit, new BigDecimal("10"), new BigDecimal("5"), null);
  }

  @Test
  void matchedLineWithCompatibleUnitAppliesStock() {
    InventoryItem milk = item("Milk", Unit.ML);
    when(supplierRepository.findById(supplierId))
        .thenReturn(Optional.of(new Supplier(supplierId, "Acme", "999", null)));
    when(inventoryRepository.findBySupplierId(supplierId)).thenReturn(List.of(milk));
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Milk", new BigDecimal("2"), "ltr")));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", supplierId);

    assertThat(resp.applied()).isEqualTo(1);
    assertThat(resp.status()).isEqualTo(ReceiptStatus.APPLIED);
    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("2010"); // 10 + 2*1000
    assertThat(resp.lines().get(0).lineStatus()).isEqualTo(LineStatus.APPLIED);
  }

  @Test
  void unmatchedNameIsRecordedWithoutStockChange() {
    InventoryItem milk = item("Milk", Unit.ML);
    when(supplierRepository.findById(supplierId))
        .thenReturn(Optional.of(new Supplier(supplierId, "Acme", "999", null)));
    when(inventoryRepository.findBySupplierId(supplierId)).thenReturn(List.of(milk));
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Sugar", new BigDecimal("3"), "kg")));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", supplierId);

    assertThat(resp.unmatched()).isEqualTo(1);
    assertThat(resp.status()).isEqualTo(ReceiptStatus.PARTIAL);
    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("10");
    assertThat(resp.lines().get(0).lineStatus()).isEqualTo(LineStatus.UNMATCHED_ITEM);
  }

  @Test
  void matchedNameWithBadUnitNeedsReview() {
    InventoryItem milk = item("Milk", Unit.ML);
    when(supplierRepository.findById(supplierId))
        .thenReturn(Optional.of(new Supplier(supplierId, "Acme", "999", null)));
    when(inventoryRepository.findBySupplierId(supplierId)).thenReturn(List.of(milk));
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Milk", new BigDecimal("2"), "kg")));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", supplierId);

    assertThat(resp.needsReview()).isEqualTo(1);
    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("10");
    assertThat(resp.lines().get(0).lineStatus()).isEqualTo(LineStatus.NEEDS_REVIEW);
  }

  @Test
  void noSupplierResolvedYieldsUnmatchedSupplierAndNoStock() {
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Milk", new BigDecimal("2"), "ltr")));
    when(supplierRepository.findFirstByNameIgnoreCase("Acme")).thenReturn(Optional.empty());

    ScanReceiptResponse resp = service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", null);

    assertThat(resp.status()).isEqualTo(ReceiptStatus.UNMATCHED_SUPPLIER);
    assertThat(resp.applied()).isZero();
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.arogya.cafe.receiving.service.ReceivingServiceTest"`
Expected: FAIL — `ReceivingService`/`DuplicateReceiptException` not defined.

- [ ] **Step 3: Implement `DuplicateReceiptException`**

```java
package com.arogya.cafe.common;

public class DuplicateReceiptException extends RuntimeException {
  public DuplicateReceiptException(String message) {
    super(message);
  }
}
```

- [ ] **Step 4: Implement `ReceivingService`**

```java
package com.arogya.cafe.receiving.service;

import com.arogya.cafe.common.DuplicateReceiptException;
import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.receiving.client.BillScanClient;
import com.arogya.cafe.receiving.client.BillScanResult;
import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.entity.GoodsReceipt;
import com.arogya.cafe.receiving.entity.GoodsReceiptLine;
import com.arogya.cafe.receiving.entity.LineStatus;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import com.arogya.cafe.receiving.repository.GoodsReceiptRepository;
import com.arogya.cafe.receiving.support.MappedUnit;
import com.arogya.cafe.receiving.support.UnitMapper;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReceivingService {

  private final BillScanClient billScanClient;
  private final InventoryItemRepository inventoryRepository;
  private final SupplierRepository supplierRepository;
  private final GoodsReceiptRepository receiptRepository;
  private final ObjectMapper objectMapper;

  public ReceivingService(
      BillScanClient billScanClient,
      InventoryItemRepository inventoryRepository,
      SupplierRepository supplierRepository,
      GoodsReceiptRepository receiptRepository,
      ObjectMapper objectMapper) {
    this.billScanClient = billScanClient;
    this.inventoryRepository = inventoryRepository;
    this.supplierRepository = supplierRepository;
    this.receiptRepository = receiptRepository;
    this.objectMapper = objectMapper;
  }

  public ScanReceiptResponse scan(
      byte[] content, String filename, String contentType, String engine, UUID supplierId) {

    BillScanResult result = billScanClient.scan(content, filename, contentType, engine);
    BillScanResult.BillData data = result.data();

    Supplier supplier = resolveSupplier(supplierId, data);
    String billNumber = data == null ? null : data.billNumber();

    if (supplier != null
        && billNumber != null
        && receiptRepository.existsBySupplierIdAndBillNumber(supplier.getId(), billNumber)) {
      throw new DuplicateReceiptException(
          "Bill '" + billNumber + "' already received for this supplier");
    }

    GoodsReceipt receipt =
        new GoodsReceipt(
            UUID.randomUUID(),
            supplier == null ? null : supplier.getId(),
            billNumber,
            data == null ? null : data.billDate(),
            result.engineUsed(),
            ReceiptStatus.UNMATCHED_SUPPLIER, // overwritten below if a supplier resolved
            toJson(result),
            OffsetDateTime.now());

    List<BillScanResult.Line> lines =
        data == null || data.lineItems() == null ? List.of() : data.lineItems();

    if (supplier == null) {
      // No supplier — record every line as unmatched, change no stock.
      for (BillScanResult.Line line : lines) {
        receipt.addLine(buildLine(receipt.getId(), line, null, LineStatus.UNMATCHED_ITEM,
            "no supplier resolved"));
      }
      return ScanReceiptResponse.from(receiptRepository.save(receipt));
    }

    List<InventoryItem> items = inventoryRepository.findBySupplierId(supplier.getId());

    for (BillScanResult.Line line : lines) {
      InventoryItem match = matchByName(items, line.description());
      if (match == null) {
        receipt.addLine(buildLine(receipt.getId(), line, null, LineStatus.UNMATCHED_ITEM,
            "no inventory item matched"));
        continue;
      }
      Optional<MappedUnit> mapped = UnitMapper.map(line.unit());
      if (line.quantity() == null || mapped.isEmpty() || mapped.get().unit() != match.getUnit()) {
        receipt.addLine(buildLine(receipt.getId(), line, match.getId(), LineStatus.NEEDS_REVIEW,
            "unit '" + line.unit() + "' not compatible with " + match.getUnit()));
        continue;
      }
      BigDecimal applied = mapped.get().apply(line.quantity());
      match.adjust(applied);
      GoodsReceiptLine recorded =
          new GoodsReceiptLine(
              UUID.randomUUID(), receipt.getId(), line.description(), line.quantity(),
              line.unit(), match.getId(), applied, LineStatus.APPLIED, null);
      receipt.addLine(recorded);
    }

    setStatus(receipt);
    return ScanReceiptResponse.from(receiptRepository.save(receipt));
  }

  private Supplier resolveSupplier(UUID supplierId, BillScanResult.BillData data) {
    if (supplierId != null) {
      return supplierRepository.findById(supplierId).orElse(null);
    }
    if (data != null && data.vendorName() != null && !data.vendorName().isBlank()) {
      return supplierRepository.findFirstByNameIgnoreCase(data.vendorName().trim()).orElse(null);
    }
    return null;
  }

  private InventoryItem matchByName(List<InventoryItem> items, String description) {
    if (description == null || description.isBlank()) {
      return null;
    }
    String needle = description.trim().toLowerCase();
    // exact (normalized) first, then contains either direction
    for (InventoryItem i : items) {
      if (i.getName().trim().toLowerCase().equals(needle)) {
        return i;
      }
    }
    for (InventoryItem i : items) {
      String name = i.getName().trim().toLowerCase();
      if (needle.contains(name) || name.contains(needle)) {
        return i;
      }
    }
    return null;
  }

  private GoodsReceiptLine buildLine(
      UUID receiptId, BillScanResult.Line line, UUID matchedId, LineStatus status, String note) {
    return new GoodsReceiptLine(
        UUID.randomUUID(), receiptId, line.description(), line.quantity(), line.unit(),
        matchedId, null, status, note);
  }

  private void setStatus(GoodsReceipt receipt) {
    boolean anyHeld =
        receipt.getLines().stream().anyMatch(l -> l.getLineStatus() != LineStatus.APPLIED);
    receipt =
        // status is set via a fresh instance only conceptually; mutate through reflection-free path
        receipt;
    receipt.setStatus(anyHeld ? ReceiptStatus.PARTIAL : ReceiptStatus.APPLIED);
  }

  private String toJson(BillScanResult result) {
    try {
      return objectMapper.writeValueAsString(result);
    } catch (JsonProcessingException e) {
      return null;
    }
  }
}
```

> Note: `setStatus` calls `receipt.setStatus(...)`. Add a package-visible setter to `GoodsReceipt`:
> ```java
> public void setStatus(ReceiptStatus status) {
>   this.status = status;
> }
> ```
> Add this method to `GoodsReceipt` (Task 7 file). Remove the no-op reassignment lines — final body:
> ```java
> private void setStatus(GoodsReceipt receipt) {
>   boolean anyHeld =
>       receipt.getLines().stream().anyMatch(l -> l.getLineStatus() != LineStatus.APPLIED);
>   receipt.setStatus(anyHeld ? ReceiptStatus.PARTIAL : ReceiptStatus.APPLIED);
> }
> ```

- [ ] **Step 5: Run test to verify it passes**

Run: `./gradlew test --tests "com.arogya.cafe.receiving.service.ReceivingServiceTest"`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/service backend/src/main/java/com/arogya/cafe/common/DuplicateReceiptException.java backend/src/main/java/com/arogya/cafe/receiving/entity/GoodsReceipt.java backend/src/test/java/com/arogya/cafe/receiving/service
git commit -m "feat(receiving): scan-to-stock service with name/unit matching"
```

---

## Task 11: Controller

**Files:**
- Create: `backend/src/main/java/com/arogya/cafe/receiving/controller/ReceivingController.java`

- [ ] **Step 1: Write the controller**

```java
package com.arogya.cafe.receiving.controller;

import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.service.ReceivingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Receiving", description = "Scan supplier bills and apply stock-in")
@RestController
@RequestMapping("/api/receiving")
public class ReceivingController {

  private final ReceivingService service;

  public ReceivingController(ReceivingService service) {
    this.service = service;
  }

  @Operation(summary = "Scan a supplier bill and apply stock-in")
  @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ScanReceiptResponse scan(
      @RequestParam("file") MultipartFile file,
      @RequestParam(value = "supplierId", required = false) UUID supplierId,
      @RequestParam(value = "engine", defaultValue = "auto") String engine)
      throws IOException {
    return service.scan(
        file.getBytes(),
        file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename(),
        file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
        engine,
        supplierId);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/receiving/controller
git commit -m "feat(receiving): POST /api/receiving/scan controller"
```

---

## Task 12: Exception handling (502 + 409)

**Files:**
- Modify: `backend/src/main/java/com/arogya/cafe/common/GlobalExceptionHandler.java`

- [ ] **Step 1: Add handlers**

Add imports and two methods to the existing class:
```java
import com.arogya.cafe.receiving.client.BillScanException;
```
```java
  @ExceptionHandler(DuplicateReceiptException.class)
  public ProblemDetail handleDuplicate(DuplicateReceiptException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
  }

  @ExceptionHandler(BillScanException.class)
  public ProblemDetail handleBillScan(BillScanException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, ex.getMessage());
  }
```
(`DuplicateReceiptException` is in the same `com.arogya.cafe.common` package — no import needed.)

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/arogya/cafe/common/GlobalExceptionHandler.java
git commit -m "feat(receiving): map billscan failure to 502, duplicate to 409"
```

---

## Task 13: Integration test (Testcontainers + stubbed client)

**Files:**
- Test: `backend/src/integrationTest/java/com/arogya/cafe/ReceivingFlowIntegrationTest.java`

- [ ] **Step 1: Write the integration test**

```java
package com.arogya.cafe;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.receiving.client.BillScanClient;
import com.arogya.cafe.receiving.client.BillScanResult;
import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import com.arogya.cafe.receiving.service.ReceivingService;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class ReceivingFlowIntegrationTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

  @TestConfiguration
  static class StubConfig {
    @Bean
    @Primary
    BillScanClient stubBillScanClient() {
      return (content, filename, contentType, engine) ->
          new BillScanResult(
              true,
              "tesseract",
              new BillScanResult.BillData(
                  "Acme",
                  "999",
                  "INV-IT-1",
                  "01/01/26",
                  List.of(
                      new BillScanResult.Line("Milk", new BigDecimal("2"), "ltr"),
                      new BillScanResult.Line("Sugar", new BigDecimal("3"), "kg"))),
              List.of());
    }
  }

  @Autowired SupplierRepository supplierRepository;
  @Autowired InventoryItemRepository inventoryRepository;
  @Autowired ReceivingService service;

  @Test
  void scanAppliesMatchedLineAndPersistsReceipt() {
    Supplier acme = supplierRepository.save(new Supplier(UUID.randomUUID(), "Acme", "999", null));
    InventoryItem milk =
        inventoryRepository.save(
            new InventoryItem(
                UUID.randomUUID(), "Milk", Unit.ML, new BigDecimal("100"),
                new BigDecimal("50"), acme));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", acme.getId());

    assertThat(resp.applied()).isEqualTo(1);
    assertThat(resp.unmatched()).isEqualTo(1); // Sugar not in inventory
    assertThat(resp.status()).isEqualTo(ReceiptStatus.PARTIAL);
    assertThat(inventoryRepository.findById(milk.getId()).orElseThrow().getQuantityOnHand())
        .isEqualByComparingTo("2100"); // 100 + 2*1000
  }
}
```

- [ ] **Step 2: Run the integration test (Docker must be running)**

Run: `./gradlew integrationTest --tests "com.arogya.cafe.ReceivingFlowIntegrationTest"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrationTest/java/com/arogya/cafe/ReceivingFlowIntegrationTest.java
git commit -m "test(receiving): integration test for scan-to-stock flow"
```

---

## Task 14: Deploy billscan as a sidecar

**Files:**
- Modify: the backend Deployment manifest (locate under `argocd/` or `infra/`; the backend Deployment that runs the `com.arogya.cafe` image).

- [ ] **Step 1: Locate the backend Deployment**

Run: `grep -rl "kind: Deployment" argocd infra 2>/dev/null` and identify the one running the backend container.

- [ ] **Step 2: Add the billscan sidecar container**

In that Deployment's `spec.template.spec.containers`, add alongside the backend container:
```yaml
        - name: billscan
          image: <billscan-image>      # built from billscan/Dockerfile, pushed to your registry
          ports:
            - containerPort: 8000
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
```
The backend already defaults `BILLSCAN_BASE_URL` to `http://localhost:8000`, so no extra env is needed (sidecars share the pod network namespace). If billscan needs an image build in CI, add a build/push step mirroring the backend's existing workflow.

- [ ] **Step 3: Commit**

```bash
git add argocd infra
git commit -m "deploy: run billscan as sidecar in backend pod"
```

---

## Final verification

- [ ] **Run the full unit + slice suite**

Run: `./gradlew test`
Expected: BUILD SUCCESSFUL.

- [ ] **Run the integration suite (Docker up)**

Run: `./gradlew integrationTest`
Expected: BUILD SUCCESSFUL.

- [ ] **Confirm the app boots** (Postgres reachable)

Run: `./gradlew bootRun` and open `http://localhost:8080/swagger-ui.html` — confirm `POST /api/receiving/scan` appears. Stop the app.

---

## Self-Review Notes

- **Spec coverage:** sidecar deploy (Task 14, §Architecture), billscan unit field (Task 2, §billscan change), supplier resolution by id/vendor-name (Task 10 `resolveSupplier`, §flow step 1), name-match scoped to supplier items (Task 10 `matchByName`), unit mapping incl. litre→ML (Task 5, §flow step 3), APPLIED/UNMATCHED_ITEM/NEEDS_REVIEW (Task 10), goods_receipt + lines with unique constraint (Tasks 6/7), duplicate→409 & billscan-down→502 (Task 12), response DTO with counts (Task 9), unit + integration tests (Tasks 5/10/13). All spec sections map to a task.
- **Type consistency:** `BillScanResult.Line(description, quantity, unit)`, `UnitMapper.map(...)→Optional<MappedUnit>`, `MappedUnit.apply(BigDecimal)`, `GoodsReceipt.setStatus(...)` (added in Task 10 note), `existsBySupplierIdAndBillNumber`, `findBySupplierId`, `findFirstByNameIgnoreCase` are used consistently across tasks.
- **No placeholders:** the only `<...>` tokens are the billscan image ref and the manifest path in Task 14, which are environment-specific and resolved by the locate step.
