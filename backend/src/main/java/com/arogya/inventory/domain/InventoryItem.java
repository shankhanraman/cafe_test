package com.arogya.inventory.domain;

import com.arogya.supplier.domain.Supplier;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "inventory_item")
public class InventoryItem {

  @Id private UUID id;
  private String name;

  @Enumerated(EnumType.STRING)
  private Unit unit;

  @Column(name = "quantity_on_hand")
  private BigDecimal quantityOnHand;

  @Column(name = "reorder_threshold")
  private BigDecimal reorderThreshold;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "supplier_id")
  private Supplier supplier;

  protected InventoryItem() {}

  public InventoryItem(
      UUID id,
      String name,
      Unit unit,
      BigDecimal quantityOnHand,
      BigDecimal reorderThreshold,
      Supplier supplier) {
    this.id = id;
    this.name = name;
    this.unit = unit;
    this.quantityOnHand = quantityOnHand;
    this.reorderThreshold = reorderThreshold;
    this.supplier = supplier;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public Unit getUnit() {
    return unit;
  }

  public BigDecimal getQuantityOnHand() {
    return quantityOnHand;
  }

  public BigDecimal getReorderThreshold() {
    return reorderThreshold;
  }

  public Supplier getSupplier() {
    return supplier;
  }

  public boolean isLowStock() {
    return quantityOnHand.compareTo(reorderThreshold) <= 0;
  }

  /**
   * Add delta (may be negative for corrections); the service guards against dropping below zero.
   */
  public void adjust(BigDecimal delta) {
    this.quantityOnHand = this.quantityOnHand.add(delta);
  }

  /** Deduct used quantity from a sale; stock may go to/below zero (sales are never blocked). */
  public void deduct(BigDecimal amount) {
    this.quantityOnHand = this.quantityOnHand.subtract(amount);
  }

  public void update(String name, Unit unit, BigDecimal reorderThreshold, Supplier supplier) {
    this.name = name;
    this.unit = unit;
    this.reorderThreshold = reorderThreshold;
    this.supplier = supplier;
  }
}
