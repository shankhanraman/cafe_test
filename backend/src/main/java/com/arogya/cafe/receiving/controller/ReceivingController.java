package com.arogya.cafe.receiving.controller;

import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.service.ReceivingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Receiving", description = "Scan supplier bills and apply stock-in")
@RestController
@RequestMapping("/api/receiving")
public class ReceivingController {

  private final ReceivingService service;

  public ReceivingController(ReceivingService service) {
    this.service = service;
  }

  @Operation(summary = "Scan a supplier bill and apply stock-in")
  @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ScanReceiptResponse scan(
      @RequestParam("file") MultipartFile file,
      @RequestParam(value = "supplierId", required = false) UUID supplierId,
      @RequestParam(value = "engine", defaultValue = "auto") String engine)
      throws IOException {
    return service.scan(
        file.getBytes(),
        file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename(),
        file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
        engine,
        supplierId);
  }
}
