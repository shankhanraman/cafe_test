package com.arogya.inventory.repository;

import com.arogya.inventory.domain.InventoryItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {

  @Query(
      "select i from InventoryItem i left join fetch i.supplier "
          + "where i.quantityOnHand <= i.reorderThreshold order by i.name")
  List<InventoryItem> findLowStock();
}
