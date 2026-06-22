package com.arogya.cafe.receiving.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.arogya.cafe.inventory.entity.Unit;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class UnitMapperTest {

  @Test
  void mapsMlSynonyms() {
    assertThat(UnitMapper.map("ml")).get().extracting(MappedUnit::unit).isEqualTo(Unit.ML);
    assertThat(UnitMapper.map("MILLILITER")).get().extracting(MappedUnit::unit).isEqualTo(Unit.ML);
  }

  @Test
  void litreMapsToMlWithThousandMultiplier() {
    MappedUnit m = UnitMapper.map("ltr").orElseThrow();
    assertThat(m.unit()).isEqualTo(Unit.ML);
    assertThat(m.apply(new BigDecimal("2"))).isEqualByComparingTo("2000");
  }

  @Test
  void mapsPieceSynonyms() {
    for (String s : new String[] {"pcs", "pc", "piece", "nos", "unit", "ea"}) {
      assertThat(UnitMapper.map(s)).get().extracting(MappedUnit::unit).isEqualTo(Unit.PIECE);
    }
  }

  @Test
  void mapsSachetSynonyms() {
    assertThat(UnitMapper.map("packet")).get().extracting(MappedUnit::unit).isEqualTo(Unit.SACHET);
  }

  @Test
  void unknownOrNullUnitIsEmpty() {
    assertThat(UnitMapper.map("kg")).isEmpty();
    assertThat(UnitMapper.map(null)).isEmpty();
    assertThat(UnitMapper.map("  ")).isEmpty();
  }

  @Test
  void pieceAppliesQuantityUnchanged() {
    assertThat(UnitMapper.map("pcs").orElseThrow().apply(new BigDecimal("5")))
        .isEqualByComparingTo("5");
  }
}
