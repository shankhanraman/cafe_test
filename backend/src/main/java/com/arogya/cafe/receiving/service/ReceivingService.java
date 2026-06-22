package com.arogya.cafe.receiving.service;

import com.arogya.cafe.common.DuplicateReceiptException;
import com.arogya.cafe.inventory.entity.InventoryItem;
import com.arogya.cafe.inventory.repository.InventoryItemRepository;
import com.arogya.cafe.receiving.client.BillScanClient;
import com.arogya.cafe.receiving.client.BillScanResult;
import com.arogya.cafe.receiving.dto.ScanReceiptResponse;
import com.arogya.cafe.receiving.entity.GoodsReceipt;
import com.arogya.cafe.receiving.entity.GoodsReceiptLine;
import com.arogya.cafe.receiving.entity.LineStatus;
import com.arogya.cafe.receiving.entity.ReceiptStatus;
import com.arogya.cafe.receiving.repository.GoodsReceiptRepository;
import com.arogya.cafe.receiving.support.MappedUnit;
import com.arogya.cafe.receiving.support.UnitMapper;
import com.arogya.cafe.supplier.entity.Supplier;
import com.arogya.cafe.supplier.repository.SupplierRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReceivingService {

  private final BillScanClient billScanClient;
  private final InventoryItemRepository inventoryRepository;
  private final SupplierRepository supplierRepository;
  private final GoodsReceiptRepository receiptRepository;
  private final ObjectMapper objectMapper;

  public ReceivingService(
      BillScanClient billScanClient,
      InventoryItemRepository inventoryRepository,
      SupplierRepository supplierRepository,
      GoodsReceiptRepository receiptRepository,
      ObjectMapper objectMapper) {
    this.billScanClient = billScanClient;
    this.inventoryRepository = inventoryRepository;
    this.supplierRepository = supplierRepository;
    this.receiptRepository = receiptRepository;
    this.objectMapper = objectMapper;
  }

  public ScanReceiptResponse scan(
      byte[] content, String filename, String contentType, String engine, UUID supplierId) {

    BillScanResult result = billScanClient.scan(content, filename, contentType, engine);
    BillScanResult.BillData data = result.data();

    Supplier supplier = resolveSupplier(supplierId, data);
    String billNumber = data == null ? null : data.billNumber();

    if (supplier != null
        && billNumber != null
        && receiptRepository.existsBySupplierIdAndBillNumber(supplier.getId(), billNumber)) {
      throw new DuplicateReceiptException(
          "Bill '" + billNumber + "' already received for this supplier");
    }

    GoodsReceipt receipt =
        new GoodsReceipt(
            UUID.randomUUID(),
            supplier == null ? null : supplier.getId(),
            billNumber,
            data == null ? null : data.billDate(),
            result.engineUsed(),
            ReceiptStatus.UNMATCHED_SUPPLIER, // overwritten below when a supplier resolves
            toJson(result),
            OffsetDateTime.now());

    List<BillScanResult.Line> lines =
        data == null || data.lineItems() == null ? List.of() : data.lineItems();

    if (supplier == null) {
      for (BillScanResult.Line line : lines) {
        receipt.addLine(
            buildLine(receipt.getId(), line, null, LineStatus.UNMATCHED_ITEM, "no supplier resolved"));
      }
      return ScanReceiptResponse.from(receiptRepository.save(receipt));
    }

    List<InventoryItem> items = inventoryRepository.findBySupplierId(supplier.getId());

    for (BillScanResult.Line line : lines) {
      InventoryItem match = matchByName(items, line.description());
      if (match == null) {
        receipt.addLine(
            buildLine(
                receipt.getId(), line, null, LineStatus.UNMATCHED_ITEM, "no inventory item matched"));
        continue;
      }
      Optional<MappedUnit> mapped = UnitMapper.map(line.unit());
      if (line.quantity() == null || mapped.isEmpty() || mapped.get().unit() != match.getUnit()) {
        receipt.addLine(
            buildLine(
                receipt.getId(),
                line,
                match.getId(),
                LineStatus.NEEDS_REVIEW,
                "unit '" + line.unit() + "' not compatible with " + match.getUnit()));
        continue;
      }
      BigDecimal applied = mapped.get().apply(line.quantity());
      match.adjust(applied);
      receipt.addLine(
          new GoodsReceiptLine(
              UUID.randomUUID(),
              receipt.getId(),
              line.description(),
              line.quantity(),
              line.unit(),
              match.getId(),
              applied,
              LineStatus.APPLIED,
              null));
    }

    setStatus(receipt);
    return ScanReceiptResponse.from(receiptRepository.save(receipt));
  }

  private Supplier resolveSupplier(UUID supplierId, BillScanResult.BillData data) {
    if (supplierId != null) {
      return supplierRepository.findById(supplierId).orElse(null);
    }
    if (data != null && data.vendorName() != null && !data.vendorName().isBlank()) {
      return supplierRepository.findFirstByNameIgnoreCase(data.vendorName().trim()).orElse(null);
    }
    return null;
  }

  private InventoryItem matchByName(List<InventoryItem> items, String description) {
    if (description == null || description.isBlank()) {
      return null;
    }
    String needle = description.trim().toLowerCase();
    for (InventoryItem i : items) {
      if (i.getName().trim().toLowerCase().equals(needle)) {
        return i;
      }
    }
    for (InventoryItem i : items) {
      String name = i.getName().trim().toLowerCase();
      if (needle.contains(name) || name.contains(needle)) {
        return i;
      }
    }
    return null;
  }

  private GoodsReceiptLine buildLine(
      UUID receiptId, BillScanResult.Line line, UUID matchedId, LineStatus status, String note) {
    return new GoodsReceiptLine(
        UUID.randomUUID(),
        receiptId,
        line.description(),
        line.quantity(),
        line.unit(),
        matchedId,
        null,
        status,
        note);
  }

  private void setStatus(GoodsReceipt receipt) {
    boolean anyHeld =
        receipt.getLines().stream().anyMatch(l -> l.getLineStatus() != LineStatus.APPLIED);
    receipt.setStatus(anyHeld ? ReceiptStatus.PARTIAL : ReceiptStatus.APPLIED);
  }

  private String toJson(BillScanResult result) {
    try {
      return objectMapper.writeValueAsString(result);
    } catch (JsonProcessingException e) {
      return null;
    }
  }
}
