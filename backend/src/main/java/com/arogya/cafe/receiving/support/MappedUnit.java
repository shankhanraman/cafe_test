package com.arogya.cafe.receiving.support;

import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;

/** A resolved inventory unit plus the multiplier to convert scanned quantity into that unit. */
public record MappedUnit(Unit unit, BigDecimal multiplier) {
  public BigDecimal apply(BigDecimal scannedQuantity) {
    return scannedQuantity.multiply(multiplier);
  }
}
