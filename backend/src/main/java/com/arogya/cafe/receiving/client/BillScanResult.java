package com.arogya.cafe.receiving.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BillScanResult(
    boolean success,
    @JsonProperty("engine_used") String engineUsed,
    BillData data,
    List<String> warnings) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record BillData(
      @JsonProperty("vendor_name") String vendorName,
      @JsonProperty("vendor_contact") String vendorContact,
      @JsonProperty("bill_number") String billNumber,
      @JsonProperty("bill_date") String billDate,
      @JsonProperty("line_items") List<Line> lineItems) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Line(String description, BigDecimal quantity, String unit) {}
}
