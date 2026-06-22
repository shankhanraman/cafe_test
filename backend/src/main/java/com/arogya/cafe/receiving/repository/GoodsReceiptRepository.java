package com.arogya.cafe.receiving.repository;

import com.arogya.cafe.receiving.entity.GoodsReceipt;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoodsReceiptRepository extends JpaRepository<GoodsReceipt, UUID> {
  boolean existsBySupplierIdAndBillNumber(UUID supplierId, String billNumber);
}
