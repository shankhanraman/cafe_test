package com.arogya.cafe.receiving.client;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class RestBillScanClient implements BillScanClient {

  private final RestClient client;

  public RestBillScanClient(RestClient billScanRestClient) {
    this.client = billScanRestClient;
  }

  @Override
  public BillScanResult scan(byte[] content, String filename, String contentType, String engine) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add(
        "file",
        new ByteArrayResource(content) {
          @Override
          public String getFilename() {
            return filename;
          }
        });
    body.add("engine", engine);
    try {
      return client
          .post()
          .uri("/scan")
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .body(body)
          .retrieve()
          .body(BillScanResult.class);
    } catch (RuntimeException ex) {
      throw new BillScanException("billscan request failed: " + ex.getMessage(), ex);
    }
  }
}
