package com.arogya.menu.domain;

import com.arogya.inventory.domain.InventoryItem;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "menu_item")
public class MenuItem {

  @Id private UUID id;
  private String name;

  @Enumerated(EnumType.STRING)
  private Category category;

  @Enumerated(EnumType.STRING)
  private MenuType type;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "resale_item_id")
  private InventoryItem resaleItem;

  @OneToMany(mappedBy = "menuItem", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<RecipeLine> recipeLines = new ArrayList<>();

  protected MenuItem() {}

  public MenuItem(
      UUID id, String name, Category category, MenuType type, InventoryItem resaleItem) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.type = type;
    this.resaleItem = resaleItem;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public Category getCategory() {
    return category;
  }

  public MenuType getType() {
    return type;
  }

  public InventoryItem getResaleItem() {
    return resaleItem;
  }

  public List<RecipeLine> getRecipeLines() {
    return recipeLines;
  }

  public void update(String name, Category category, MenuType type, InventoryItem resaleItem) {
    this.name = name;
    this.category = category;
    this.type = type;
    this.resaleItem = resaleItem;
  }

  public void replaceRecipe(List<RecipeLine> lines) {
    this.recipeLines.clear();
    this.recipeLines.addAll(lines);
  }
}
