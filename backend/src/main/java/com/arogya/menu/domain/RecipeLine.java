package com.arogya.menu.domain;

import com.arogya.inventory.domain.InventoryItem;
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
@Table(name = "recipe_line")
public class RecipeLine {

  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "menu_item_id")
  private MenuItem menuItem;

  @Enumerated(EnumType.STRING)
  @Column(name = "order_size")
  private OrderSize orderSize;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "inventory_item_id")
  private InventoryItem inventoryItem;

  private BigDecimal quantity;

  protected RecipeLine() {}

  public RecipeLine(
      UUID id,
      MenuItem menuItem,
      OrderSize orderSize,
      InventoryItem inventoryItem,
      BigDecimal quantity) {
    this.id = id;
    this.menuItem = menuItem;
    this.orderSize = orderSize;
    this.inventoryItem = inventoryItem;
    this.quantity = quantity;
  }

  public UUID getId() {
    return id;
  }

  public OrderSize getOrderSize() {
    return orderSize;
  }

  public InventoryItem getInventoryItem() {
    return inventoryItem;
  }

  public BigDecimal getQuantity() {
    return quantity;
  }
}
