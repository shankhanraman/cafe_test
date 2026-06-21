package com.arogya.sales.service;

import com.arogya.menu.domain.OrderSize;
import com.arogya.sales.domain.Sale;
import java.time.Instant;
import java.util.UUID;

public record SaleResponse(
    UUID id,
    UUID menuItemId,
    String menuItemName,
    OrderSize orderSize,
    int quantity,
    Instant soldAt) {
  static SaleResponse from(Sale s) {
    return new SaleResponse(
        s.getId(),
        s.getMenuItem().getId(),
        s.getMenuItem().getName(),
        s.getOrderSize(),
        s.getQuantity(),
        s.getSoldAt());
  }
}
