package com.arogya.cafe.inventory.controller;

import com.arogya.cafe.inventory.dto.AdjustRequest;
import com.arogya.cafe.inventory.dto.InventoryRequest;
import com.arogya.cafe.inventory.dto.InventoryResponse;
import com.arogya.cafe.inventory.dto.LowStockResponse;
import com.arogya.cafe.inventory.service.InventoryService;
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

@Tag(
    name = "Inventory",
    description = "Raw materials and resale stock; adjustments and low-stock alerts")
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

  private final InventoryService service;

  public InventoryController(InventoryService service) {
    this.service = service;
  }

  @Operation(summary = "Create an inventory item")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public InventoryResponse create(@Valid @RequestBody InventoryRequest req) {
    return service.create(req);
  }

  @Operation(summary = "List all inventory items")
  @GetMapping
  public List<InventoryResponse> list() {
    return service.list();
  }

  @Operation(
      summary = "List low-stock items",
      description = "Items where quantityOnHand <= reorderThreshold, each with its supplier")
  @GetMapping("/low-stock")
  public List<LowStockResponse> lowStock() {
    return service.lowStock();
  }

  @Operation(summary = "Get an inventory item by id")
  @ApiResponse(responseCode = "404", description = "Item not found")
  @GetMapping("/{id}")
  public InventoryResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

  @Operation(summary = "Update an inventory item")
  @ApiResponse(responseCode = "404", description = "Item not found")
  @PutMapping("/{id}")
  public InventoryResponse update(@PathVariable UUID id, @Valid @RequestBody InventoryRequest req) {
    return service.update(id, req);
  }

  @Operation(
      summary = "Adjust stock (delivery or correction)",
      description =
          "Adds delta (may be negative); rejected with 400 if it would drop stock below zero")
  @ApiResponse(responseCode = "400", description = "Adjustment would drop stock below zero")
  @ApiResponse(responseCode = "404", description = "Item not found")
  @PostMapping("/{id}/adjust")
  public InventoryResponse adjust(@PathVariable UUID id, @Valid @RequestBody AdjustRequest req) {
    return service.adjust(id, req);
  }

  @Operation(summary = "Delete an inventory item")
  @ApiResponse(responseCode = "404", description = "Item not found")
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }
}
