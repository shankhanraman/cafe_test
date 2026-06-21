package com.arogya.cafe.inventory.controller;

import com.arogya.cafe.inventory.dto.AdjustRequest;
import com.arogya.cafe.inventory.dto.InventoryRequest;
import com.arogya.cafe.inventory.dto.InventoryResponse;
import com.arogya.cafe.inventory.dto.LowStockResponse;
import com.arogya.cafe.inventory.service.InventoryService;
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
  public List<InventoryResponse> list() {
    return service.list();
  }

  @GetMapping("/low-stock")
  public List<LowStockResponse> lowStock() {
    return service.lowStock();
  }

  @GetMapping("/{id}")
  public InventoryResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

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
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }
}
