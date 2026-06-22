package com.arogya.cafe.receiving.dto;

import com.arogya.cafe.receiving.entity.GoodsReceiptLine;
import com.arogya.cafe.receiving.entity.LineStatus;
import java.math.BigDecimal;
import java.util.UUID;

public record ReceiptLineResult(
    String description,
    BigDecimal scannedQuantity,
    String scannedUnit,
    UUID matchedItemId,
    BigDecimal appliedQuantity,
    LineStatus lineStatus,
    String note) {
  public static ReceiptLineResult from(GoodsReceiptLine l) {
    return new ReceiptLineResult(
        l.getDescription(),
        l.getScannedQuantity(),
        l.getScannedUnit(),
        l.getMatchedItemId(),
        l.getAppliedQuantity(),
        l.getLineStatus(),
        l.getNote());
  }
}
