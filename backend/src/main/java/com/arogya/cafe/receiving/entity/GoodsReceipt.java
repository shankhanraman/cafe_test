package com.arogya.cafe.receiving.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "goods_receipt")
public class GoodsReceipt {

  @Id private UUID id;

  @Column(name = "supplier_id")
  private UUID supplierId;

  @Column(name = "bill_number")
  private String billNumber;

  @Column(name = "bill_date")
  private String billDate;

  @Column(name = "engine_used")
  private String engineUsed;

  @Enumerated(EnumType.STRING)
  private ReceiptStatus status;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_json")
  private String rawJson;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
  @JoinColumn(name = "receipt_id")
  private List<GoodsReceiptLine> lines = new ArrayList<>();

  protected GoodsReceipt() {}

  public GoodsReceipt(
      UUID id,
      UUID supplierId,
      String billNumber,
      String billDate,
      String engineUsed,
      ReceiptStatus status,
      String rawJson,
      OffsetDateTime createdAt) {
    this.id = id;
    this.supplierId = supplierId;
    this.billNumber = billNumber;
    this.billDate = billDate;
    this.engineUsed = engineUsed;
    this.status = status;
    this.rawJson = rawJson;
    this.createdAt = createdAt;
  }

  public void addLine(GoodsReceiptLine line) {
    this.lines.add(line);
  }

  public void setStatus(ReceiptStatus status) {
    this.status = status;
  }

  public UUID getId() {
    return id;
  }

  public UUID getSupplierId() {
    return supplierId;
  }

  public String getBillNumber() {
    return billNumber;
  }

  public ReceiptStatus getStatus() {
    return status;
  }

  public List<GoodsReceiptLine> getLines() {
    return lines;
  }
}
