package com.arogya.sales.service;

import com.arogya.menu.domain.OrderSize;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

public record SaleRequest(@NotNull UUID menuItemId, OrderSize orderSize, @Positive int quantity) {}
