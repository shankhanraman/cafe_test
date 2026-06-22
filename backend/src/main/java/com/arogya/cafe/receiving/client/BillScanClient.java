package com.arogya.cafe.receiving.client;

public interface BillScanClient {
  /** Sends the file to billscan and returns the parsed result. */
  BillScanResult scan(byte[] content, String filename, String contentType, String engine);
}
