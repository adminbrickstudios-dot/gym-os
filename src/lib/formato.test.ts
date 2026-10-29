import { describe, expect, test } from "vitest";
import { fechaCorta, fechaLarga, formatearNumero, formatearPesos, saludo, ultimoDia } from "./formato";

describe("formatearPesos", () => {
  test.each([
    [84500, "$84.500"],
    [84500.5, "$84.500,50"],
    [0, "$0"],
    [1234567.05, "$1.234.567,05"],
    [-1200, "-$1.200"],
    ["18000.00", "$18.000"],
    [999, "$999"],
    [0.1 + 0.2, "$0,30"],
  ])("%s → %s", (entrada, salida) => expect(formatearPesos(entrada)).toBe(salida));

  test("vacío se muestra como raya, no como $0", () => {
    expect(formatearPesos(null)).toBe("—");
  });

  test("un monto inválido es un error, no un $NaN", () => {
    expect(() => formatearPesos("abc")).toThrow();
  });
});

test("formatearNumero", () => {
  expect(formatearNumero(1234)).toBe("1.234");
  expect(formatearNumero(1234.5, 1)).toBe("1.234,5");
});

describe("fechas en la zona del gimnasio", () => {
  test("el hasta exclusivo se muestra como el último día cubierto", () => {
    // 15/11 00:00 en Argentina = 15/11 03:00 UTC
    expect(ultimoDia("2026-11-15T03:00:00Z")).toBe("14/11");
  });
  test("23:50 del 14 en Argentina sigue siendo 14 aunque en UTC ya sea 15", () => {
    expect(fechaCorta("2026-11-15T02:50:00Z")).toBe("14/11");
  });
  test("saludo según la hora local", () => {
    expect(saludo(new Date("2026-10-26T18:00:00Z"))).toBe("Buenas tardes"); // 15:00 en Argentina
    expect(saludo(new Date("2026-10-26T12:00:00Z"))).toBe("Buen día");      // 09:00
    expect(saludo(new Date("2026-10-27T01:00:00Z"))).toBe("Buenas noches"); // 22:00
  });
  test("fecha larga", () => {
    expect(fechaLarga(new Date("2026-10-26T18:00:00Z"))).toBe("Lunes 26/10");
  });
});
