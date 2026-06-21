package com.arogya.cafe.menu.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.arogya.cafe.common.ValidationException;
import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.menu.dto.*;
import com.arogya.cafe.menu.entity.Category;
import com.arogya.cafe.menu.entity.MenuItem;
import com.arogya.cafe.menu.entity.MenuType;
import com.arogya.cafe.menu.entity.OrderSize;
import com.arogya.cafe.menu.repository.MenuItemRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MenuServiceTest {

  @Mock MenuItemRepository repository;
  @Mock InventoryItemRepository inventoryRepository;
  @InjectMocks MenuService service;

  @Test
  void resaleWithoutLinkedItemRejected() {
    MenuRequest req = new MenuRequest("Marlboro", Category.CIGARETTES, MenuType.RESALE, null);
    assertThatThrownBy(() -> service.create(req)).isInstanceOf(ValidationException.class);
  }

  @Test
  void putRecipeReplacesLines() {
    UUID menuId = UUID.randomUUID();
    UUID invId = UUID.randomUUID();
    MenuItem made = new MenuItem(menuId, "Tea", Category.TEA_COFFEE, MenuType.MADE, null);
    InventoryItem milk =
        new InventoryItem(
            invId, "Milk", Unit.ML, new BigDecimal("1000"), new BigDecimal("200"), null);
    when(repository.findById(menuId)).thenReturn(Optional.of(made));
    when(inventoryRepository.findById(invId)).thenReturn(Optional.of(milk));

    List<RecipeLineDto> lines =
        List.of(new RecipeLineDto(OrderSize.REGULAR, invId, new BigDecimal("180")));
    service.putRecipe(menuId, new RecipeRequest(lines));

    assertThat(made.getRecipeLines()).hasSize(1);
    assertThat(made.getRecipeLines().get(0).getQuantity()).isEqualByComparingTo("180");
  }
}
