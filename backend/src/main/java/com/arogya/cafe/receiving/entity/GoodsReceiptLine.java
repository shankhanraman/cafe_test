package com.arogya.cafe.receiving.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "goods_receipt_line")
public class GoodsReceiptLine {

  @Id private UUID id;

  @Column(name = "receipt_id")
  private UUID receiptId;

  private String description;

  @Column(name = "scanned_quantity")
  private BigDecimal scannedQuantity;

  @Column(name = "scanned_unit")
  private String scannedUnit;

  @Column(name = "matched_item_id")
  private UUID matchedItemId;

  @Column(name = "applied_quantity")
  private BigDecimal appliedQuantity;

  @Enumerated(EnumType.STRING)
  @Column(name = "line_status")
  private LineStatus lineStatus;

  private String note;

  protected GoodsReceiptLine() {}

  public GoodsReceiptLine(
      UUID id,
      UUID receiptId,
      String description,
      BigDecimal scannedQuantity,
      String scannedUnit,
      UUID matchedItemId,
      BigDecimal appliedQuantity,
      LineStatus lineStatus,
      String note) {
    this.id = id;
    this.receiptId = receiptId;
    this.description = description;
    this.scannedQuantity = scannedQuantity;
    this.scannedUnit = scannedUnit;
    this.matchedItemId = matchedItemId;
    this.appliedQuantity = appliedQuantity;
    this.lineStatus = lineStatus;
    this.note = note;
  }

  public UUID getId() {
    return id;
  }

  public UUID getReceiptId() {
    return receiptId;
  }

  public String getDescription() {
    return description;
  }

  public BigDecimal getScannedQuantity() {
    return scannedQuantity;
  }

  public String getScannedUnit() {
    return scannedUnit;
  }

  public UUID getMatchedItemId() {
    return matchedItemId;
  }

  public BigDecimal getAppliedQuantity() {
    return appliedQuantity;
  }

  public LineStatus getLineStatus() {
    return lineStatus;
  }

  public String getNote() {
    return note;
  }
}
