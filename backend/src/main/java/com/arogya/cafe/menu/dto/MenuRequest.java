package com.arogya.cafe.menu.dto;

import com.arogya.cafe.menu.entity.Category;
import com.arogya.cafe.menu.entity.MenuType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record MenuRequest(
    @NotBlank String name, @NotNull Category category, @NotNull MenuType type, UUID resaleItemId) {}
