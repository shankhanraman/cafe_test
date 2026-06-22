package com.arogya.cafe.receiving.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "billscan")
public record BillScanProperties(String baseUrl, int timeoutSeconds) {
  public BillScanProperties {
    if (baseUrl == null || baseUrl.isBlank()) {
      baseUrl = "http://localhost:8000";
    }
    if (timeoutSeconds <= 0) {
      timeoutSeconds = 60;
    }
  }
}
