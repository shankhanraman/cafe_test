package com.arogya.cafe;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.receiving.client.BillScanClient;
import com.arogya.cafe.receiving.client.BillScanResult;
import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import com.arogya.cafe.receiving.service.ReceivingService;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class ReceivingFlowIntegrationTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

  @TestConfiguration
  static class StubConfig {
    @Bean
    @Primary
    BillScanClient stubBillScanClient() {
      return (content, filename, contentType, engine) ->
          new BillScanResult(
              true,
              "tesseract",
              new BillScanResult.BillData(
                  "Acme",
                  "999",
                  "INV-IT-1",
                  "01/01/26",
                  List.of(
                      new BillScanResult.Line("Milk", new BigDecimal("2"), "ltr"),
                      new BillScanResult.Line("Sugar", new BigDecimal("3"), "kg"))),
              List.of());
    }
  }

  @Autowired SupplierRepository supplierRepository;
  @Autowired InventoryItemRepository inventoryRepository;
  @Autowired ReceivingService service;

  @Test
  void scanAppliesMatchedLineAndPersistsReceipt() {
    Supplier acme = supplierRepository.save(new Supplier(UUID.randomUUID(), "Acme", "999", null));
    InventoryItem milk =
        inventoryRepository.save(
            new InventoryItem(
                UUID.randomUUID(),
                "Milk",
                Unit.ML,
                new BigDecimal("100"),
                new BigDecimal("50"),
                acme));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", acme.getId());

    assertThat(resp.applied()).isEqualTo(1);
    assertThat(resp.unmatched()).isEqualTo(1); // Sugar not in inventory
    assertThat(resp.status()).isEqualTo(ReceiptStatus.PARTIAL);
    assertThat(inventoryRepository.findById(milk.getId()).orElseThrow().getQuantityOnHand())
        .isEqualByComparingTo("2100"); // 100 + 2*1000
  }
}
