package com.arogya.menu.web;

import com.arogya.menu.service.MenuRequest;
import com.arogya.menu.service.MenuResponse;
import com.arogya.menu.service.MenuService;
import com.arogya.menu.service.RecipeRequest;
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

@RestController
@RequestMapping("/api/menu")
public class MenuController {

  private final MenuService service;

  public MenuController(MenuService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public MenuResponse create(@Valid @RequestBody MenuRequest req) {
    return service.create(req);
  }

  @GetMapping
  public List<MenuResponse> list() {
    return service.list();
  }

  @GetMapping("/{id}")
  public MenuResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

  @PutMapping("/{id}")
  public MenuResponse update(@PathVariable UUID id, @Valid @RequestBody MenuRequest req) {
    return service.update(id, req);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }

  @GetMapping("/{id}/recipe")
  public MenuResponse getRecipe(@PathVariable UUID id) {
    return service.getRecipe(id);
  }

  @PutMapping("/{id}/recipe")
  public MenuResponse putRecipe(@PathVariable UUID id, @Valid @RequestBody RecipeRequest req) {
    return service.putRecipe(id, req);
  }
}
