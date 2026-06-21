package com.arogya.cafe.sales.service;

import com.arogya.cafe.common.NotFoundException;
import com.arogya.cafe.common.ValidationException;
import com.arogya.cafe.menu.entity.MenuItem;
import com.arogya.cafe.menu.entity.MenuType;
import com.arogya.cafe.menu.entity.RecipeLine;
import com.arogya.cafe.menu.repository.MenuItemRepository;
import com.arogya.cafe.sales.dto.*;
import com.arogya.cafe.sales.entity.Sale;
import com.arogya.cafe.sales.repository.SaleRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SaleService {

  private final SaleRepository saleRepository;
  private final MenuItemRepository menuRepository;

  public SaleService(SaleRepository saleRepository, MenuItemRepository menuRepository) {
    this.saleRepository = saleRepository;
    this.menuRepository = menuRepository;
  }

  public SaleResponse record(SaleRequest req) {
    MenuItem item =
        menuRepository
            .findById(req.menuItemId())
            .orElseThrow(() -> new NotFoundException("MenuItem", req.menuItemId()));
    BigDecimal saleQty = BigDecimal.valueOf(req.quantity());

    if (item.getType() == MenuType.MADE) {
      deductRecipe(item, req, saleQty);
    } else {
      deductResale(item, saleQty);
    }

    Sale sale = new Sale(UUID.randomUUID(), item, req.orderSize(), req.quantity(), Instant.now());
    return SaleResponse.from(saleRepository.save(sale));
  }

  private void deductRecipe(MenuItem item, SaleRequest req, BigDecimal saleQty) {
    if (req.orderSize() == null) {
      throw new ValidationException("orderSize is required for a MADE item");
    }
    List<RecipeLine> lines =
        item.getRecipeLines().stream().filter(l -> l.getOrderSize() == req.orderSize()).toList();
    if (lines.isEmpty()) {
      throw new ValidationException("No recipe for order size " + req.orderSize());
    }
    for (RecipeLine line : lines) {
      line.getInventoryItem().deduct(line.getQuantity().multiply(saleQty));
    }
  }

  private void deductResale(MenuItem item, BigDecimal saleQty) {
    if (item.getResaleItem() == null) {
      throw new ValidationException("RESALE item has no linked inventory stock");
    }
    item.getResaleItem().deduct(saleQty);
  }

  @Transactional(readOnly = true)
  public List<SaleResponse> recent() {
    return saleRepository.findTop100ByOrderBySoldAtDesc().stream().map(SaleResponse::from).toList();
  }
}
