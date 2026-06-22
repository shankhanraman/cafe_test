package com.arogya.cafe.receiving.dto;

import com.arogya.cafe.receiving.entity.GoodsReceipt;
import com.arogya.cafe.receiving.entity.LineStatus;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import java.util.List;
import java.util.UUID;

public record ScanReceiptResponse(
    UUID receiptId,
    UUID supplierId,
    ReceiptStatus status,
    int applied,
    int needsReview,
    int unmatched,
    List<ReceiptLineResult> lines) {

  public static ScanReceiptResponse from(GoodsReceipt r) {
    List<ReceiptLineResult> lines = r.getLines().stream().map(ReceiptLineResult::from).toList();
    int applied = count(r, LineStatus.APPLIED);
    int needsReview = count(r, LineStatus.NEEDS_REVIEW);
    int unmatched = count(r, LineStatus.UNMATCHED_ITEM);
    return new ScanReceiptResponse(
        r.getId(), r.getSupplierId(), r.getStatus(), applied, needsReview, unmatched, lines);
  }

  private static int count(GoodsReceipt r, LineStatus status) {
    return (int) r.getLines().stream().filter(l -> l.getLineStatus() == status).count();
  }
}
