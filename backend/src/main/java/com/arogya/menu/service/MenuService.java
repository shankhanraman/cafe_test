package com.arogya.menu.service;

import com.arogya.common.NotFoundException;
import com.arogya.common.ValidationException;
import com.arogya.inventory.domain.InventoryItem;
import com.arogya.inventory.repository.InventoryItemRepository;
import com.arogya.menu.domain.MenuItem;
import com.arogya.menu.domain.MenuType;
import com.arogya.menu.domain.RecipeLine;
import com.arogya.menu.repository.MenuItemRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MenuService {

  private final MenuItemRepository repository;
  private final InventoryItemRepository inventoryRepository;

  public MenuService(MenuItemRepository repository, InventoryItemRepository inventoryRepository) {
    this.repository = repository;
    this.inventoryRepository = inventoryRepository;
  }

  public MenuResponse create(MenuRequest req) {
    InventoryItem resale = resolveResale(req);
    MenuItem m = new MenuItem(UUID.randomUUID(), req.name(), req.category(), req.type(), resale);
    return MenuResponse.from(repository.save(m));
  }

  @Transactional(readOnly = true)
  public List<MenuResponse> list() {
    return repository.findAll().stream().map(MenuResponse::from).toList();
  }

  @Transactional(readOnly = true)
  public MenuResponse get(UUID id) {
    return MenuResponse.from(find(id));
  }

  public MenuResponse update(UUID id, MenuRequest req) {
    MenuItem m = find(id);
    m.update(req.name(), req.category(), req.type(), resolveResale(req));
    return MenuResponse.from(m);
  }

  public void delete(UUID id) {
    repository.delete(find(id));
  }

  @Transactional(readOnly = true)
  public MenuResponse getRecipe(UUID id) {
    return MenuResponse.from(find(id));
  }

  public MenuResponse putRecipe(UUID id, RecipeRequest req) {
    MenuItem m = find(id);
    if (m.getType() != MenuType.MADE) {
      throw new ValidationException("Only MADE items have recipes");
    }
    List<RecipeLine> lines =
        req.lines().stream()
            .map(
                dto ->
                    new RecipeLine(
                        UUID.randomUUID(),
                        m,
                        dto.orderSize(),
                        resolveInventory(dto.inventoryItemId()),
                        dto.quantity()))
            .toList();
    m.replaceRecipe(lines);
    return MenuResponse.from(m);
  }

  private MenuItem find(UUID id) {
    return repository.findById(id).orElseThrow(() -> new NotFoundException("MenuItem", id));
  }

  private InventoryItem resolveResale(MenuRequest req) {
    if (req.type() == MenuType.RESALE) {
      if (req.resaleItemId() == null) {
        throw new ValidationException("RESALE menu item requires a linked inventory item");
      }
      return resolveInventory(req.resaleItemId());
    }
    return null;
  }

  private InventoryItem resolveInventory(UUID id) {
    return inventoryRepository
        .findById(id)
        .orElseThrow(() -> new NotFoundException("InventoryItem", id));
  }
}
