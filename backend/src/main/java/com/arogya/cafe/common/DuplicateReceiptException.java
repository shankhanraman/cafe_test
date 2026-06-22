package com.arogya.cafe.common;

public class DuplicateReceiptException extends RuntimeException {
  public DuplicateReceiptException(String message) {
    super(message);
  }
}
