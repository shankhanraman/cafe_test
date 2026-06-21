package com.arogya.supplier.service;

import com.arogya.supplier.domain.Supplier;
import java.util.UUID;

public record SupplierResponse(UUID id, String name, String phone, String notes) {
  static SupplierResponse from(Supplier s) {
    return new SupplierResponse(s.getId(), s.getName(), s.getPhone(), s.getNotes());
  }
}
