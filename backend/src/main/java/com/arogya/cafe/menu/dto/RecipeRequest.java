package com.arogya.cafe.menu.dto;

import jakarta.validation.Valid;
import java.util.List;

public record RecipeRequest(@Valid List<RecipeLineDto> lines) {}
