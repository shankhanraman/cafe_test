package com.arogya.cafe.menu.repository;

import com.arogya.cafe.menu.entity.MenuItem;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {}
