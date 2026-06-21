package com.arogya.cafe.sales.controller;

import com.arogya.cafe.sales.dto.SaleRequest;
import com.arogya.cafe.sales.dto.SaleResponse;
import com.arogya.cafe.sales.service.SaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Sales", description = "Record sales; stock auto-deducts in one transaction")
@RestController
@RequestMapping("/api/sales")
public class SaleController {

  private final SaleService service;

  public SaleController(SaleService service) {
    this.service = service;
  }

  @Operation(
      summary = "Record a sale",
      description =
          "Deducts stock: recipe-based for MADE (orderSize required), one-for-one for RESALE."
              + " Never blocked on low stock.")
  @ApiResponse(
      responseCode = "400",
      description = "Missing/unknown orderSize for MADE, or RESALE with no linked stock")
  @ApiResponse(responseCode = "404", description = "Menu item not found")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SaleResponse record(@Valid @RequestBody SaleRequest req) {
    return service.record(req);
  }

  @Operation(summary = "List recent sales (latest 100)")
  @GetMapping
  public List<SaleResponse> recent() {
    return service.recent();
  }
}
