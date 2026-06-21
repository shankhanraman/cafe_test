package com.arogya.supplier.service;

import jakarta.validation.constraints.NotBlank;

public record SupplierRequest(@NotBlank String name, String phone, String notes) {}
