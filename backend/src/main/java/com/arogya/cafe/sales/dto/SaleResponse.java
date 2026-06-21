package com.arogya.cafe.sales.dto;

import com.arogya.cafe.menu.entity.OrderSize;
import com.arogya.cafe.sales.entity.Sale;
import java.time.Instant;
import java.util.UUID;

public record SaleResponse(
    UUID id,
    UUID menuItemId,
    String menuItemName,
    OrderSize orderSize,
    int quantity,
    Instant soldAt) {
  public static SaleResponse from(Sale s) {
    return new SaleResponse(
        s.getId(),
        s.getMenuItem().getId(),
        s.getMenuItem().getName(),
        s.getOrderSize(),
        s.getQuantity(),
        s.getSoldAt());
  }
}
