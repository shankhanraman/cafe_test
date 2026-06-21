package com.arogya.cafe.supplier.dto;

import com.arogya.cafe.supplier.entity.Supplier;
import java.util.UUID;

public record SupplierResponse(UUID id, String name, String phone, String notes) {
  public static SupplierResponse from(Supplier s) {
    return new SupplierResponse(s.getId(), s.getName(), s.getPhone(), s.getNotes());
  }
}
