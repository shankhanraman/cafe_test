package com.arogya.cafe.supplier.repository;

import com.arogya.cafe.supplier.entity.Supplier;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {}
