import { describe, expect, it } from "vitest";
import { crearDetectorLector, esLecturaRepetida } from "./lector";

const tipear = (d: ReturnType<typeof crearDetectorLector>, texto: string, desde: number, cada: number) => {
  let t = desde;
  for (const c of texto) { d.tecla(c, t); t += cada; }
  return t - cada;
};

describe("detector de lector USB", () => {
  it("20 caracteres a 5 ms y Enter es una lectura", () => {
    const d = crearDetectorLector();
    const fin = tipear(d, "GYMOS1.abcdefghij12345", 1000, 5);
    expect(d.enter(fin + 5)).toBe(true);
  });
  it("una persona tipeando un DNI (120 ms por tecla) no es una lectura", () => {
    const d = crearDetectorLector();
    const fin = tipear(d, "30123456", 1000, 120);
    expect(d.enter(fin + 120)).toBe(false);
  });
  it("una persona rápida (70 ms por tecla) tampoco", () => {
    const d = crearDetectorLector();
    const fin = tipear(d, "30123456", 1000, 70);
    expect(d.enter(fin + 70)).toBe(false);
  });
  it("pocas teclas rápidas no alcanzan (un doble toque)", () => {
    const d = crearDetectorLector();
    const fin = tipear(d, "123", 1000, 5);
    expect(d.enter(fin + 5)).toBe(false);
  });
  it("una pausa en el medio corta la racha: lo escrito a mano y después un lector corto no se mezclan", () => {
    const d = crearDetectorLector();
    tipear(d, "123", 1000, 5);
    const fin = tipear(d, "456", 2000, 5);
    expect(d.enter(fin + 5)).toBe(false);
  });
  it("el Enter tarde (la persona se quedó pensando) no cuenta", () => {
    const d = crearDetectorLector();
    const fin = tipear(d, "ABCDEFGHIJ", 1000, 5);
    expect(d.enter(fin + 400)).toBe(false);
  });
  it("después de un Enter vuelve a empezar: dos lecturas seguidas son dos lecturas", () => {
    const d = crearDetectorLector();
    let fin = tipear(d, "GYMOS1.uno12345", 1000, 5);
    expect(d.enter(fin + 5)).toBe(true);
    fin = tipear(d, "GYMOS1.dos12345", 1100, 5);
    expect(d.enter(fin + 5)).toBe(true);
  });
  it("el segundo Enter (doble Enter del lector) no es otra lectura", () => {
    const d = crearDetectorLector();
    const fin = tipear(d, "GYMOS1.uno12345", 1000, 5);
    expect(d.enter(fin + 5)).toBe(true);
    expect(d.enter(fin + 8)).toBe(false);
  });
  it("las teclas que no escriben (Shift, Tab) no cuentan", () => {
    const d = crearDetectorLector();
    d.tecla("Shift", 1000); d.tecla("Tab", 1002);
    expect(d.enter(1010)).toBe(false);
  });
});

describe("misma lectura dos veces", () => {
  it("el mismo código dentro de 2 s se ignora; otro código o más tarde, no", () => {
    expect(esLecturaRepetida(null, "A", 5000)).toBe(false);
    expect(esLecturaRepetida({ codigo: "A", en: 5000 }, "A", 5500)).toBe(true);
    expect(esLecturaRepetida({ codigo: "A", en: 5000 }, "B", 5500)).toBe(false);
    expect(esLecturaRepetida({ codigo: "A", en: 5000 }, "A", 7100)).toBe(false);
  });
});
