package com.arogya.menu.service;

import com.arogya.menu.domain.Category;
import com.arogya.menu.domain.MenuType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record MenuRequest(
    @NotBlank String name, @NotNull Category category, @NotNull MenuType type, UUID resaleItemId) {}
