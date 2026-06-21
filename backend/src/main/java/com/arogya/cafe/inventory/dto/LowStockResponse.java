package com.arogya.cafe.inventory.dto;

import com.arogya.cafe.inventory.entity.InventoryItem;
import java.math.BigDecimal;
import java.util.UUID;

public record LowStockResponse(
    UUID id,
    String name,
    BigDecimal quantityOnHand,
    BigDecimal reorderThreshold,
    UUID supplierId,
    String supplierName) {
  public static LowStockResponse from(InventoryItem i) {
    return new LowStockResponse(
        i.getId(),
        i.getName(),
        i.getQuantityOnHand(),
        i.getReorderThreshold(),
        i.getSupplier() == null ? null : i.getSupplier().getId(),
        i.getSupplier() == null ? null : i.getSupplier().getName());
  }
}
