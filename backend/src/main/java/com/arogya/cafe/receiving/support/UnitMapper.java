package com.arogya.cafe.receiving.support;

import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

public final class UnitMapper {

  private static final BigDecimal ONE = BigDecimal.ONE;
  private static final BigDecimal THOUSAND = new BigDecimal("1000");

  private static final Map<String, MappedUnit> TABLE =
      Map.ofEntries(
          Map.entry("ml", new MappedUnit(Unit.ML, ONE)),
          Map.entry("milliliter", new MappedUnit(Unit.ML, ONE)),
          Map.entry("millilitre", new MappedUnit(Unit.ML, ONE)),
          Map.entry("l", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("ltr", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("litre", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("liter", new MappedUnit(Unit.ML, THOUSAND)),
          Map.entry("pcs", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("pc", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("piece", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("pieces", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("nos", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("no", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("unit", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("ea", new MappedUnit(Unit.PIECE, ONE)),
          Map.entry("sachet", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("sachets", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("packet", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("packets", new MappedUnit(Unit.SACHET, ONE)),
          Map.entry("pkt", new MappedUnit(Unit.SACHET, ONE)));

  private UnitMapper() {}

  public static Optional<MappedUnit> map(String rawUnit) {
    if (rawUnit == null || rawUnit.isBlank()) {
      return Optional.empty();
    }
    return Optional.ofNullable(TABLE.get(rawUnit.trim().toLowerCase()));
  }
}
