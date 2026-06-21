package com.arogya.supplier.web;

import com.arogya.supplier.service.SupplierRequest;
import com.arogya.supplier.service.SupplierResponse;
import com.arogya.supplier.service.SupplierService;
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
  public List<SupplierResponse> list() {
    return service.list();
  }

  @GetMapping("/{id}")
  public SupplierResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

  @PutMapping("/{id}")
  public SupplierResponse update(@PathVariable UUID id, @Valid @RequestBody SupplierRequest req) {
    return service.update(id, req);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }
}
