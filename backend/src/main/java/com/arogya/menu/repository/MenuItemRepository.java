package com.arogya.menu.repository;

import com.arogya.menu.domain.MenuItem;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {}
