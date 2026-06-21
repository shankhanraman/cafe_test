package com.arogya.cafe.menu.controller;

import com.arogya.cafe.menu.dto.MenuRequest;
import com.arogya.cafe.menu.dto.MenuResponse;
import com.arogya.cafe.menu.dto.RecipeRequest;
import com.arogya.cafe.menu.service.MenuService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Menu", description = "Menu items (MADE vs RESALE) and recipes")
@RestController
@RequestMapping("/api/menu")
public class MenuController {

  private final MenuService service;

  public MenuController(MenuService service) {
    this.service = service;
  }

  @Operation(summary = "Create a menu item")
  @ApiResponse(responseCode = "400", description = "RESALE item missing a linked inventory item")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public MenuResponse create(@Valid @RequestBody MenuRequest req) {
    return service.create(req);
  }

  @Operation(summary = "List all menu items")
  @GetMapping
  public List<MenuResponse> list() {
    return service.list();
  }

  @Operation(summary = "Get a menu item by id")
  @ApiResponse(responseCode = "404", description = "Menu item not found")
  @GetMapping("/{id}")
  public MenuResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

  @Operation(summary = "Update a menu item")
  @ApiResponse(responseCode = "404", description = "Menu item not found")
  @PutMapping("/{id}")
  public MenuResponse update(@PathVariable UUID id, @Valid @RequestBody MenuRequest req) {
    return service.update(id, req);
  }

  @Operation(summary = "Delete a menu item")
  @ApiResponse(responseCode = "404", description = "Menu item not found")
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }

  @Operation(summary = "Get a menu item's recipe")
  @ApiResponse(responseCode = "404", description = "Menu item not found")
  @GetMapping("/{id}/recipe")
  public MenuResponse getRecipe(@PathVariable UUID id) {
    return service.getRecipe(id);
  }

  @Operation(
      summary = "Replace a menu item's recipe (MADE only)",
      description = "Replaces all recipe lines; 400 if the item is not MADE")
  @ApiResponse(responseCode = "400", description = "Item is not MADE")
  @ApiResponse(
      responseCode = "404",
      description = "Menu item or referenced inventory item not found")
  @PutMapping("/{id}/recipe")
  public MenuResponse putRecipe(@PathVariable UUID id, @Valid @RequestBody RecipeRequest req) {
    return service.putRecipe(id, req);
  }
}
