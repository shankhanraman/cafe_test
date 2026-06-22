package com.arogya.cafe.inventory.repository;

import com.arogya.cafe.inventory.entity.InventoryItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {

  @Query(
      "select i from InventoryItem i left join fetch i.supplier "
          + "where i.quantityOnHand <= i.reorderThreshold order by i.name")
  List<InventoryItem> findLowStock();

  List<InventoryItem> findBySupplierId(UUID supplierId);
}
