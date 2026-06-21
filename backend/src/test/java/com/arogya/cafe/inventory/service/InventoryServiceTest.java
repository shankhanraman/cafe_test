package com.arogya.cafe.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.arogya.cafe.common.ValidationException;
import com.arogya.cafe.inventory.dto.*;
import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.entity.Unit;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

  @Mock InventoryItemRepository repository;
  @Mock com.arogya.cafe.supplier.repository.SupplierRepository supplierRepository;
  @InjectMocks InventoryService service;

  @Test
  void adjustAddsDeltaToQuantity() {
    UUID id = UUID.randomUUID();
    InventoryItem item =
        new InventoryItem(id, "Milk", Unit.ML, new BigDecimal("100"), new BigDecimal("50"), null);
    when(repository.findById(id)).thenReturn(Optional.of(item));
    InventoryResponse r = service.adjust(id, new AdjustRequest(new BigDecimal("250"), "delivery"));
    assertThat(r.quantityOnHand()).isEqualByComparingTo("350");
  }

  @Test
  void adjustBelowZeroRejected() {
    UUID id = UUID.randomUUID();
    InventoryItem item =
        new InventoryItem(id, "Milk", Unit.ML, new BigDecimal("100"), new BigDecimal("50"), null);
    when(repository.findById(id)).thenReturn(Optional.of(item));
    assertThatThrownBy(() -> service.adjust(id, new AdjustRequest(new BigDecimal("-500"), "oops")))
        .isInstanceOf(ValidationException.class);
  }
}
