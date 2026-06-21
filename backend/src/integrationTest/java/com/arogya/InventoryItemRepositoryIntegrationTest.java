package com.arogya;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.domain.Unit;
import com.arogya.inventory.repository.InventoryItemRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@Testcontainers
class InventoryItemRepositoryIntegrationTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

  @Autowired InventoryItemRepository repository;

  @Test
  void findLowStockReturnsOnlyItemsAtOrBelowThreshold() {
    repository.save(
        new InventoryItem(
            UUID.randomUUID(), "Low", Unit.ML, new BigDecimal("10"), new BigDecimal("50"), null));
    repository.save(
        new InventoryItem(
            UUID.randomUUID(), "OK", Unit.ML, new BigDecimal("100"), new BigDecimal("50"), null));
    assertThat(repository.findLowStock()).extracting(InventoryItem::getName).containsExactly("Low");
  }
}
