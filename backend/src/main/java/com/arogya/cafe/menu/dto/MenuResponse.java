package com.arogya.cafe.menu.dto;

import com.arogya.cafe.menu.entity.Category;
import com.arogya.cafe.menu.entity.MenuItem;
import com.arogya.cafe.menu.entity.MenuType;
import java.util.List;
import java.util.UUID;

public record MenuResponse(
    UUID id,
    String name,
    Category category,
    MenuType type,
    UUID resaleItemId,
    List<RecipeLineDto> recipe) {
  public static MenuResponse from(MenuItem m) {
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
