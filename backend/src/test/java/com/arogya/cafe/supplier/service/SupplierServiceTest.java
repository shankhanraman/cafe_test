package com.arogya.cafe.supplier.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.arogya.cafe.common.NotFoundException;
import com.arogya.cafe.supplier.dto.*;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SupplierServiceTest {

  @Mock SupplierRepository repository;
  @InjectMocks SupplierService service;

  @Test
  void createReturnsResponseWithGeneratedId() {
    when(repository.save(any(Supplier.class))).thenAnswer(i -> i.getArgument(0));
    SupplierResponse r = service.create(new SupplierRequest("Acme", "123", "note"));
    assertThat(r.id()).isNotNull();
    assertThat(r.name()).isEqualTo("Acme");
  }

  @Test
  void getMissingThrowsNotFound() {
    UUID id = UUID.randomUUID();
    when(repository.findById(id)).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
  }
}
