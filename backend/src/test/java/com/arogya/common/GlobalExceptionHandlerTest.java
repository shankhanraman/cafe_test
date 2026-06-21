package com.arogya.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void notFoundMapsTo404() {
    ProblemDetail pd = handler.handleNotFound(new NotFoundException("Supplier", "abc"));
    assertThat(pd.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
    assertThat(pd.getDetail()).contains("Supplier").contains("abc");
  }

  @Test
  void validationMapsTo400() {
    ProblemDetail pd = handler.handleValidation(new ValidationException("negative quantity"));
    assertThat(pd.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    assertThat(pd.getDetail()).contains("negative quantity");
  }
}
