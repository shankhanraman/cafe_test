package com.arogya.cafe.sales.entity;

import com.arogya.cafe.menu.entity.MenuItem;
import com.arogya.cafe.menu.entity.OrderSize;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sale")
public class Sale {

  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "menu_item_id")
  private MenuItem menuItem;

  @Enumerated(EnumType.STRING)
  @Column(name = "order_size")
  private OrderSize orderSize;

  private int quantity;

  @Column(name = "sold_at")
  private Instant soldAt;

  protected Sale() {}

  public Sale(UUID id, MenuItem menuItem, OrderSize orderSize, int quantity, Instant soldAt) {
    this.id = id;
    this.menuItem = menuItem;
    this.orderSize = orderSize;
    this.quantity = quantity;
    this.soldAt = soldAt;
  }

  public UUID getId() {
    return id;
  }

  public MenuItem getMenuItem() {
    return menuItem;
  }

  public OrderSize getOrderSize() {
    return orderSize;
  }

  public int getQuantity() {
    return quantity;
  }

  public Instant getSoldAt() {
    return soldAt;
  }
}
