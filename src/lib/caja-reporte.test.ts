import { describe, expect, it } from "vitest";
import { sumarBilletes, textoDia, veredictoCaja } from "./caja";

describe("veredictoCaja (VD-9)", () => {
  it("sin contar, justa, sobra y falta", () => {
    expect(veredictoCaja(null).clave).toBe("sin_contar");
    expect(veredictoCaja(0).texto).toBe("CAJA JUSTA");
    expect(veredictoCaja(250).texto).toBe("SOBRAN $250");
    expect(veredictoCaja(-1100).texto).toBe("FALTAN $1.100");
  });
});

describe("textoDia (VD-9)", () => {
  const base = { sede: "Sede principal", dia: "viernes 6 de noviembre", contados: 2, esperado_contado: 50000, contado: 49000, diferencia: -1000, sin_contar: 1, esperado_sin_contar: 26000,
    abiertos: 0, ventas: { cantidad: 12, total: 180000 }, por_medio: [{ medio: "efectivo", total: 50000 }], retiros: 1000, anuladas: 1, dejados_pasar: 2 };
  it("dice la falta y lo que quedó sin contar aparte", () => {
    const t = textoDia(base);
    expect(t).toContain("Faltaron $1.000");
    expect(t).toContain("1 caja quedó sin contar (tenían que tener $26.000)");
    expect(t).toContain("Dejaron pasar sin pagar: 2");
  });
  it("sin nada contado no dice 'caja justa'", () => {
    expect(textoDia({ ...base, contados: 0, diferencia: 0, contado: 0, esperado_contado: 0 })).not.toContain("justa");
  });
});

describe("sumarBilletes (VD-9)", () => {
  it("suma por denominación y monedas sueltas", () => {
    expect(sumarBilletes({ "1000": 2, "200": 1 }, 150)).toEqual({ total: 2350, detalle: { "1000": 2, "200": 1, otros: 150 } });
    expect(sumarBilletes({}, 0)).toEqual({ total: 0, detalle: {} });
  });
});
