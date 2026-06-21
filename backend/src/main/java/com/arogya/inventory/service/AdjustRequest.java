package com.arogya.inventory.service;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AdjustRequest(@NotNull BigDecimal delta, String reason) {}
