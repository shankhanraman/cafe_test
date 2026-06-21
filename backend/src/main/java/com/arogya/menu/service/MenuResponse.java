package com.arogya.menu.service;

import com.arogya.menu.domain.Category;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import java.util.List;
import java.util.UUID;

public record MenuResponse(
    UUID id,
    String name,
    Category category,
    MenuType type,
    UUID resaleItemId,
    List<RecipeLineDto> recipe) {
  static MenuResponse from(MenuItem m) {
    List<RecipeLineDto> recipe =
        m.getRecipeLines().stream()
            .map(
                l ->
                    new RecipeLineDto(
                        l.getOrderSize(), l.getInventoryItem().getId(), l.getQuantity()))
            .toList();
    return new MenuResponse(
        m.getId(),
        m.getName(),
        m.getCategory(),
        m.getType(),
        m.getResaleItem() == null ? null : m.getResaleItem().getId(),
        recipe);
  }
}
