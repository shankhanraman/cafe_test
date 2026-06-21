package com.arogya.cafe.menu.dto;

import com.arogya.cafe.menu.entity.OrderSize;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.UUID;

public record RecipeLineDto(
    @NotNull OrderSize orderSize,
    @NotNull UUID inventoryItemId,
    @NotNull @Positive BigDecimal quantity) {}
