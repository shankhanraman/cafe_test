package com.arogya.cafe.receiving.config;

import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(BillScanProperties.class)
public class RestClientConfig {

  @Bean
  public RestClient billScanRestClient(BillScanProperties props) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(5));
    factory.setReadTimeout(Duration.ofSeconds(props.timeoutSeconds()));
    return RestClient.builder().baseUrl(props.baseUrl()).requestFactory(factory).build();
  }
}
