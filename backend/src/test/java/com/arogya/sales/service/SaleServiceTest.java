package com.arogya.sales.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.menu.domain.Category;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import com.arogya.menu.domain.OrderSize;
import com.arogya.menu.domain.RecipeLine;
import com.arogya.menu.repository.MenuItemRepository;
import com.arogya.sales.domain.Sale;
import com.arogya.sales.repository.SaleRepository;
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
class SaleServiceTest {

  @Mock SaleRepository saleRepository;
  @Mock MenuItemRepository menuRepository;
  @InjectMocks SaleService service;

  private MenuItem madeTea(InventoryItem milk, InventoryItem premix) {
    MenuItem tea = new MenuItem(UUID.randomUUID(), "Tea", Category.TEA_COFFEE, MenuType.MADE, null);
    tea.replaceRecipe(
        List.of(
            new RecipeLine(UUID.randomUUID(), tea, OrderSize.REGULAR, milk, new BigDecimal("180")),
            new RecipeLine(
                UUID.randomUUID(), tea, OrderSize.REGULAR, premix, new BigDecimal("1"))));
    return tea;
  }

  private InventoryItem milk() {
    return new InventoryItem(
        UUID.randomUUID(), "Milk", Unit.ML, new BigDecimal("1000"), new BigDecimal("200"), null);
  }

  private InventoryItem premix() {
    return new InventoryItem(
        UUID.randomUUID(), "Premix", Unit.SACHET, new BigDecimal("50"), new BigDecimal("10"), null);
  }

  @Test
  void madeSaleDeductsRecipeTimesQuantity() {
    InventoryItem milk = milk();
    InventoryItem premix = premix();
    MenuItem tea = madeTea(milk, premix);
    when(menuRepository.findById(tea.getId())).thenReturn(Optional.of(tea));
    when(saleRepository.save(any(Sale.class))).thenAnswer(i -> i.getArgument(0));

    service.record(new SaleRequest(tea.getId(), OrderSize.REGULAR, 2));

    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("640"); // 1000 - 180*2
    assertThat(premix.getQuantityOnHand()).isEqualByComparingTo("48"); // 50 - 1*2
  }

  @Test
  void resaleSaleDeductsOnePerUnitFromLinkedStock() {
    InventoryItem smokes =
        new InventoryItem(
            UUID.randomUUID(),
            "Marlboro",
            Unit.PIECE,
            new BigDecimal("20"),
            new BigDecimal("5"),
            null);
    MenuItem item =
        new MenuItem(UUID.randomUUID(), "Marlboro", Category.CIGARETTES, MenuType.RESALE, smokes);
    when(menuRepository.findById(item.getId())).thenReturn(Optional.of(item));
    when(saleRepository.save(any(Sale.class))).thenAnswer(i -> i.getArgument(0));

    service.record(new SaleRequest(item.getId(), null, 3));

    assertThat(smokes.getQuantityOnHand()).isEqualByComparingTo("17"); // 20 - 3
  }

  @Test
  void madeSaleWithoutOrderSizeRejected() {
    MenuItem tea = madeTea(milk(), premix());
    when(menuRepository.findById(tea.getId())).thenReturn(Optional.of(tea));
    assertThatThrownBy(() -> service.record(new SaleRequest(tea.getId(), null, 1)))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void madeSaleWithNoRecipeForSizeRejected() {
    MenuItem tea = madeTea(milk(), premix()); // only REGULAR lines
    when(menuRepository.findById(tea.getId())).thenReturn(Optional.of(tea));
    assertThatThrownBy(() -> service.record(new SaleRequest(tea.getId(), OrderSize.LESS, 1)))
        .isInstanceOf(ValidationException.class);
  }
}
