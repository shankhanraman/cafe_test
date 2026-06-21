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
