package com.arogya.inventory.service;

import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import java.math.BigDecimal;
import java.util.UUID;

public record InventoryResponse(
    UUID id,
    String name,
    Unit unit,
    BigDecimal quantityOnHand,
    BigDecimal reorderThreshold,
    UUID supplierId) {
  static InventoryResponse from(InventoryItem i) {
    return new InventoryResponse(
        i.getId(),
        i.getName(),
        i.getUnit(),
        i.getQuantityOnHand(),
        i.getReorderThreshold(),
        i.getSupplier() == null ? null : i.getSupplier().getId());
  }
}
