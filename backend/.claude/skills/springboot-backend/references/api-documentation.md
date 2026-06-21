# API Documentation (OpenAPI / Swagger)

Every REST backend ships interactive API docs by default — a frontend/consumer should never have to
read controller source to learn the contract. Use **springdoc-openapi**; it generates an OpenAPI 3
spec and Swagger UI directly from your controllers and DTOs.

## Default — add it to every API project

Add the starter (pick the version matching your Spring Boot major line):

- Spring Boot 3.x → `org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.x`
- Spring Boot 4.x → `org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.x`

```gradle
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.0'
```

With zero further code you get:
- **`/swagger-ui.html`** — interactive UI to try every endpoint.
- **`/v3/api-docs`** — the OpenAPI JSON (consumers can generate typed clients from it).

springdoc auto-discovers all `@RestController` endpoints, path/query params, and request/response
record schemas. **No per-endpoint wiring is required for them to appear** — annotations only enrich
the docs (this is why docs are not "automatic" unless the dependency is present: it is an opt-in
library, so adding it is a deliberate project default, not a framework freebie).

## Annotate controllers for readable docs

Annotations are optional polish but expected on production APIs. Keep them on the controller, never
leak them into services or entities.

- `@Tag(name, description)` on each controller — groups endpoints in the UI.
- `@Operation(summary, description)` on each handler — what it does.
- `@ApiResponse(responseCode, description)` for the non-200 outcomes you deliberately return
  (e.g. 400 validation, 404 not found) so they show up alongside the success case.
- `@Schema(description=…, example=…)` on DTO record components when a field needs explanation.

```java
@Tag(name = "Sales", description = "Record sales; stock auto-deducts in one transaction")
@RestController
@RequestMapping("/api/sales")
class SaleController {

  @Operation(summary = "Record a sale", description = "Deducts stock in one transaction")
  @ApiResponse(responseCode = "400", description = "Missing orderSize for a MADE item")
  @ApiResponse(responseCode = "404", description = "Menu item not found")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  SaleResponse record(@Valid @RequestBody SaleRequest req) { ... }
}
```

Optional API-wide metadata (title/version/description) via a single `@OpenAPIDefinition` on a config
class or the application class — add only if the defaults (derived from the app name) aren't enough.

## With Spring Security

If the filter chain is locked down, permit the docs paths or they 401:
`/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**`. Consider gating Swagger UI to non-prod
profiles if the API is public.

## Confirm before generating

- Spring Boot major version (drives the springdoc version) — see core reference.
- Whether Swagger UI should be exposed in production or dev-only.

## Validate

Boot the app and confirm `GET /v3/api-docs` returns 200 and `/swagger-ui.html` loads and lists every
controller. Keep this check in the "validate before done" step for any API change.
