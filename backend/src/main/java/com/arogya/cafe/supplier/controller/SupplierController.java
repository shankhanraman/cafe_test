package com.arogya.cafe.supplier.controller;

import com.arogya.cafe.supplier.dto.SupplierRequest;
import com.arogya.cafe.supplier.dto.SupplierResponse;
import com.arogya.cafe.supplier.service.SupplierService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Suppliers", description = "Suppliers to reorder stock from")
@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

  private final SupplierService service;

  public SupplierController(SupplierService service) {
    this.service = service;
  }

  @Operation(summary = "Create a supplier")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SupplierResponse create(@Valid @RequestBody SupplierRequest req) {
    return service.create(req);
  }

  @Operation(summary = "List all suppliers")
  @GetMapping
  public List<SupplierResponse> list() {
    return service.list();
  }

  @Operation(summary = "Get a supplier by id")
  @ApiResponse(responseCode = "404", description = "Supplier not found")
  @GetMapping("/{id}")
  public SupplierResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

  @Operation(summary = "Update a supplier")
  @ApiResponse(responseCode = "404", description = "Supplier not found")
  @PutMapping("/{id}")
  public SupplierResponse update(@PathVariable UUID id, @Valid @RequestBody SupplierRequest req) {
    return service.update(id, req);
  }

  @Operation(summary = "Delete a supplier")
  @ApiResponse(responseCode = "404", description = "Supplier not found")
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }
}
