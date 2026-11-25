import { describe, expect, it } from "vitest";

import {
  compactMoney,
  dateLabel,
  decimal,
  integer,
  money,
  money4,
  monthLabel,
  percent,
  percentFromString,
  weekLabel,
} from "./formatters";

describe("formatters", () => {
  it("formatea moneda con dos decimales", () => {
    expect(money("17999.6033")).toBe("$17,999.60");
    expect(money4("17999.6033")).toBe("$17,999.6033");
    expect(compactMoney("9108.9505")).toBe("$9.1K");
  });

  it("formatea porcentajes y enteros", () => {
    expect(percent(0.624)).toBe("62.4%");
    expect(percentFromString("0.5061")).toBe("50.61%");
    expect(integer(1795)).toBe("1,795");
    expect(decimal("14.898022")).toBe("14.90");
  });

  it("formatea meses, semanas y fechas", () => {
    expect(monthLabel("2026-05")).toBe("may-26");
    expect(weekLabel(40)).toBe("S40");
    expect(dateLabel("2026-11-23")).toBe("23/11/2026");
  });
});
