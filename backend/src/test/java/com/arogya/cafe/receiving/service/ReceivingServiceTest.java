package com.arogya.cafe.receiving.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.receiving.client.BillScanClient;
import com.arogya.cafe.receiving.client.BillScanResult;
import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.entity.GoodsReceipt;
import com.arogya.cafe.receiving.entity.LineStatus;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import com.arogya.cafe.receiving.repository.GoodsReceiptRepository;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReceivingServiceTest {

  @Mock BillScanClient billScanClient;
  @Mock InventoryItemRepository inventoryRepository;
  @Mock SupplierRepository supplierRepository;
  @Mock GoodsReceiptRepository receiptRepository;

  ReceivingService service;
  UUID supplierId;

  @BeforeEach
  void setUp() {
    service =
        new ReceivingService(
            billScanClient,
            inventoryRepository,
            supplierRepository,
            receiptRepository,
            new ObjectMapper());
    supplierId = UUID.randomUUID();
    when(receiptRepository.save(any(GoodsReceipt.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  private BillScanResult result(BillScanResult.Line... lines) {
    return new BillScanResult(
        true,
        "tesseract",
        new BillScanResult.BillData("Acme", "999", "INV1", "01/01/26", List.of(lines)),
        List.of());
  }

  private InventoryItem item(String name, Unit unit) {
    return new InventoryItem(
        UUID.randomUUID(), name, unit, new BigDecimal("10"), new BigDecimal("5"), null);
  }

  @Test
  void matchedLineWithCompatibleUnitAppliesStock() {
    InventoryItem milk = item("Milk", Unit.ML);
    when(supplierRepository.findById(supplierId))
        .thenReturn(Optional.of(new Supplier(supplierId, "Acme", "999", null)));
    when(inventoryRepository.findBySupplierId(supplierId)).thenReturn(List.of(milk));
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Milk", new BigDecimal("2"), "ltr")));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", supplierId);

    assertThat(resp.applied()).isEqualTo(1);
    assertThat(resp.status()).isEqualTo(ReceiptStatus.APPLIED);
    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("2010"); // 10 + 2*1000
    assertThat(resp.lines().get(0).lineStatus()).isEqualTo(LineStatus.APPLIED);
  }

  @Test
  void unmatchedNameIsRecordedWithoutStockChange() {
    InventoryItem milk = item("Milk", Unit.ML);
    when(supplierRepository.findById(supplierId))
        .thenReturn(Optional.of(new Supplier(supplierId, "Acme", "999", null)));
    when(inventoryRepository.findBySupplierId(supplierId)).thenReturn(List.of(milk));
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Sugar", new BigDecimal("3"), "kg")));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", supplierId);

    assertThat(resp.unmatched()).isEqualTo(1);
    assertThat(resp.status()).isEqualTo(ReceiptStatus.PARTIAL);
    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("10");
    assertThat(resp.lines().get(0).lineStatus()).isEqualTo(LineStatus.UNMATCHED_ITEM);
  }

  @Test
  void matchedNameWithBadUnitNeedsReview() {
    InventoryItem milk = item("Milk", Unit.ML);
    when(supplierRepository.findById(supplierId))
        .thenReturn(Optional.of(new Supplier(supplierId, "Acme", "999", null)));
    when(inventoryRepository.findBySupplierId(supplierId)).thenReturn(List.of(milk));
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Milk", new BigDecimal("2"), "kg")));

    ScanReceiptResponse resp =
        service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", supplierId);

    assertThat(resp.needsReview()).isEqualTo(1);
    assertThat(milk.getQuantityOnHand()).isEqualByComparingTo("10");
    assertThat(resp.lines().get(0).lineStatus()).isEqualTo(LineStatus.NEEDS_REVIEW);
  }

  @Test
  void noSupplierResolvedYieldsUnmatchedSupplierAndNoStock() {
    when(billScanClient.scan(any(), anyString(), anyString(), anyString()))
        .thenReturn(result(new BillScanResult.Line("Milk", new BigDecimal("2"), "ltr")));
    when(supplierRepository.findFirstByNameIgnoreCase("Acme")).thenReturn(Optional.empty());

    ScanReceiptResponse resp = service.scan(new byte[] {1}, "b.jpg", "image/jpeg", "auto", null);

    assertThat(resp.status()).isEqualTo(ReceiptStatus.UNMATCHED_SUPPLIER);
    assertThat(resp.applied()).isZero();
  }
}
