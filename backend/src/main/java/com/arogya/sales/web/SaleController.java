package com.arogya.sales.web;

import com.arogya.sales.service.SaleRequest;
import com.arogya.sales.service.SaleResponse;
import com.arogya.sales.service.SaleService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

  private final SaleService service;

  public SaleController(SaleService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SaleResponse record(@Valid @RequestBody SaleRequest req) {
    return service.record(req);
  }

  @GetMapping
  public List<SaleResponse> recent() {
    return service.recent();
  }
}
