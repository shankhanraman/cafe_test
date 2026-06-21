package com.arogya.cafe.inventory.dto;

import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;
import java.util.UUID;

public record InventoryResponse(
    UUID id,
    String name,
    Unit unit,
    BigDecimal quantityOnHand,
    BigDecimal reorderThreshold,
    UUID supplierId) {
  public static InventoryResponse from(InventoryItem i) {
    return new InventoryResponse(
        i.getId(),
        i.getName(),
        i.getUnit(),
        i.getQuantityOnHand(),
        i.getReorderThreshold(),
        i.getSupplier() == null ? null : i.getSupplier().getId());
  }
}
