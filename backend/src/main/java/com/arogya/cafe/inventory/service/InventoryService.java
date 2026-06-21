package com.arogya.cafe.inventory.service;

import com.arogya.cafe.common.NotFoundException;
import com.arogya.cafe.common.ValidationException;
import com.arogya.cafe.inventory.dto.*;
import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
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

  public InventoryService(
      InventoryItemRepository repository, SupplierRepository supplierRepository) {
    this.repository = repository;
    this.supplierRepository = supplierRepository;
  }

  public InventoryResponse create(InventoryRequest req) {
    InventoryItem item =
        new InventoryItem(
            UUID.randomUUID(),
            req.name(),
            req.unit(),
            req.quantityOnHand(),
            req.reorderThreshold(),
            resolveSupplier(req.supplierId()));
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
    if (supplierId == null) {
      return null;
    }
    return supplierRepository
        .findById(supplierId)
        .orElseThrow(() -> new NotFoundException("Supplier", supplierId));
  }
}
