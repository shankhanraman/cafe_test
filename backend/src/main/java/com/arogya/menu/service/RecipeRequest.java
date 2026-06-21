package com.arogya.menu.service;

import jakarta.validation.Valid;
import java.util.List;

public record RecipeRequest(@Valid List<RecipeLineDto> lines) {}
