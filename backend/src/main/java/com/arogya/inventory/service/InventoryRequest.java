package com.arogya.inventory.service;

import com.arogya.inventory.domain.Unit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.util.UUID;

public record InventoryRequest(
    @NotBlank String name,
    @NotNull Unit unit,
    @NotNull @PositiveOrZero BigDecimal quantityOnHand,
    @NotNull @PositiveOrZero BigDecimal reorderThreshold,
    UUID supplierId) {}
