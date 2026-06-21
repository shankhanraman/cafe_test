package com.arogya;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.inventory.repository.InventoryItemRepository;
import com.arogya.menu.domain.Category;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import com.arogya.menu.domain.OrderSize;
import com.arogya.menu.domain.RecipeLine;
import com.arogya.menu.repository.MenuItemRepository;
import com.arogya.sales.service.SaleRequest;
import com.arogya.sales.service.SaleService;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class SaleFlowIntegrationTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

  @Autowired InventoryItemRepository inventoryRepository;
  @Autowired MenuItemRepository menuRepository;
  @Autowired SaleService saleService;

  @Test
  void madeSaleDeductsStockAcrossTransaction() {
    InventoryItem milk =
        inventoryRepository.save(
            new InventoryItem(
                UUID.randomUUID(),
                "Milk",
                Unit.ML,
                new BigDecimal("1000"),
                new BigDecimal("200"),
                null));
    InventoryItem premix =
        inventoryRepository.save(
            new InventoryItem(
                UUID.randomUUID(),
                "Premix",
                Unit.SACHET,
                new BigDecimal("50"),
                new BigDecimal("10"),
                null));
    MenuItem tea = new MenuItem(UUID.randomUUID(), "Tea", Category.TEA_COFFEE, MenuType.MADE, null);
    tea.replaceRecipe(
        List.of(
            new RecipeLine(UUID.randomUUID(), tea, OrderSize.REGULAR, milk, new BigDecimal("180")),
            new RecipeLine(
                UUID.randomUUID(), tea, OrderSize.REGULAR, premix, new BigDecimal("1"))));
    menuRepository.save(tea);

    saleService.record(new SaleRequest(tea.getId(), OrderSize.REGULAR, 2));

    assertThat(inventoryRepository.findById(milk.getId()).orElseThrow().getQuantityOnHand())
        .isEqualByComparingTo("640");
    assertThat(inventoryRepository.findById(premix.getId()).orElseThrow().getQuantityOnHand())
        .isEqualByComparingTo("48");
  }

  @Test
  void lowStockQueryReturnsItemsAtOrBelowThreshold() {
    inventoryRepository.save(
        new InventoryItem(
            UUID.randomUUID(),
            "LowMilk",
            Unit.ML,
            new BigDecimal("10"),
            new BigDecimal("200"),
            null));
    List<String> lowNames =
        inventoryRepository.findLowStock().stream().map(InventoryItem::getName).toList();
    assertThat(lowNames).contains("LowMilk");
  }
}
