package com.arogya.supplier.repository;

import com.arogya.supplier.domain.Supplier;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {}
