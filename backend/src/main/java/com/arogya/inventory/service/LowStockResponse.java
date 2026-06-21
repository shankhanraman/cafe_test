package com.arogya.inventory.service;

import com.arogya.inventory.domain.InventoryItem;
import java.math.BigDecimal;
import java.util.UUID;

public record LowStockResponse(
    UUID id,
    String name,
    BigDecimal quantityOnHand,
    BigDecimal reorderThreshold,
    UUID supplierId,
    String supplierName) {
  static LowStockResponse from(InventoryItem i) {
    return new LowStockResponse(
        i.getId(),
        i.getName(),
        i.getQuantityOnHand(),
        i.getReorderThreshold(),
        i.getSupplier() == null ? null : i.getSupplier().getId(),
        i.getSupplier() == null ? null : i.getSupplier().getName());
  }
}
