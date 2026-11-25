import { describe, expect, it, test } from "vitest";
import { fechaConEl, fechaCorta, fechaHoraHumana, fechaHumana, fechaLarga, formatearCelular, formatearNumero, formatearPesos, haceRato, leerMonto, saludo, ultimaVez, ultimoDia } from "./formato";

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

describe("leerMonto", () => {
  test("lo que se escribe en Argentina", () => {
    expect(leerMonto("84.500,50")).toBe(84500.5);
    expect(leerMonto("84500,5")).toBe(84500.5);
    expect(leerMonto("$ 84.500")).toBe(84500);
    expect(leerMonto("1.234.567")).toBe(1234567);
    expect(leerMonto("1500")).toBe(1500);
  });
  test("un punto con 1 o 2 cifras al final es decimal, no miles", () => {
    expect(leerMonto("1500.50")).toBe(1500.5);
    expect(leerMonto("1500.5")).toBe(1500.5);
    expect(leerMonto("1.500")).toBe(1500);
  });
  test("lo que no se entiende es NaN", () => {
    for (const x of ["", "abc", "1.50.0", "1,5,0", "12.34,5,6", "1.5000"]) expect(leerMonto(x)).toBeNaN();
  });
});

// Z7 · fechas "hoy", "ayer", "lun 12/11" y celular "+54 9 …": siempre en la hora del gimnasio, con un "ahora" fijo.
describe("fechaHumana y fechaHoraHumana", () => {
  const ZONA = "America/Argentina/Buenos_Aires";
  const ahora = new Date("2026-11-12T01:30:00Z");   // 11/11 22:30 en Buenos Aires, 12/11 en UTC: la hora de la compu no cuenta
  test("hoy y ayer según el día del gimnasio, no el de la compu", () => {
    expect(fechaHumana("2026-11-12T00:10:00Z", ZONA, ahora)).toBe("hoy");   // 11/11 21:10 allá
    expect(fechaHumana("2026-11-11T02:00:00Z", ZONA, ahora)).toBe("ayer");  // 10/11 23:00 allá
  });
  test("más viejo: día de la semana y fecha", () => {
    expect(fechaHumana("2026-11-09T15:00:00Z", ZONA, ahora)).toBe("lun 09/11");
  });
  test("de otro año lleva el año", () => {
    expect(fechaHumana("2025-03-03T15:00:00Z", ZONA, ahora)).toBe("lun 03/03/25");
  });
  test("con la hora del gimnasio", () => {
    expect(fechaHoraHumana("2026-11-12T00:10:00Z", ZONA, ahora)).toBe("hoy 21:10");
  });
  test("en una frase: hoy y ayer solos, el resto con el", () => {
    expect(fechaConEl("2026-11-12T00:10:00Z", ZONA, ahora)).toBe("hoy");
    expect(fechaConEl("2026-11-11T02:00:00Z", ZONA, ahora)).toBe("ayer");
    expect(fechaConEl("2026-11-09T15:00:00Z", ZONA, ahora)).toBe("el lun 09/11");
  });
});

describe("formatearCelular", () => {
  test.each([
    ["+5491123456789", "+54 9 11 2345-6789"],
    ["011 15 2345 6789", "+54 9 11 2345-6789"],
    ["11 2345-6789", "+54 9 11 2345-6789"],
    ["3515123456", "+54 9 351 512-3456"],
    ["+54 9 000 111 2222", "+54 9 000 111-2222"],
  ])("%s → %s", (entrada, salida) => expect(formatearCelular(entrada)).toBe(salida));
  test("lo que no se reconoce queda tal cual y lo vacío es vacío", () => {
    expect(formatearCelular("12345")).toBe("12345");
    expect(formatearCelular(null)).toBe("");
  });
});

describe("haceRato (25/11)", () => {
  const ahora = new Date("2026-11-25T19:42:10Z");
  it("segundos, minutos, horas y días", () => {
    expect(haceRato("2026-11-25T19:42:05Z", ahora)).toBe("hace 5 s");
    expect(haceRato("2026-11-25T19:39:10Z", ahora)).toBe("hace 3 min");
    expect(haceRato("2026-11-25T17:40:00Z", ahora)).toBe("hace 2 h");
    expect(haceRato("2026-11-23T19:00:00Z", ahora)).toBe("hace 2 días");
  });
  it("un reloj adelantado no da negativo", () => expect(haceRato("2026-11-25T19:43:00Z", ahora)).toBe("hace 0 s"));
});

describe("ultimaVez (25/11, Socios)", () => {
  const z = "America/Argentina/Buenos_Aires";
  const ahora = new Date("2026-11-25T22:50:00Z"); // 19:50 en Argentina
  it("hoy con la hora, ayer, hace N días, nunca", () => {
    expect(ultimaVez("2026-11-25T22:42:00Z", z, ahora)).toBe("Hoy 19:42");
    expect(ultimaVez("2026-11-24T12:00:00Z", z, ahora)).toBe("Ayer");
    expect(ultimaVez("2026-11-22T12:00:00Z", z, ahora)).toBe("Hace 3 días");
    expect(ultimaVez(null, z, ahora)).toBe("Nunca");
  });
  it("las 23:30 de ayer en Argentina ya es 'Ayer' aunque en UTC sea hoy", () => expect(ultimaVez("2026-11-25T02:30:00Z", z, ahora)).toBe("Ayer"));
});
