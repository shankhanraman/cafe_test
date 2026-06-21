package com.arogya.supplier.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.util.UUID;

@Entity
public class Supplier {

  @Id private UUID id;
  private String name;
  private String phone;
  private String notes;

  protected Supplier() {}

  public Supplier(UUID id, String name, String phone, String notes) {
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.notes = notes;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getPhone() {
    return phone;
  }

  public String getNotes() {
    return notes;
  }

  public void update(String name, String phone, String notes) {
    this.name = name;
    this.phone = phone;
    this.notes = notes;
  }
}
