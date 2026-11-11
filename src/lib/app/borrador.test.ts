import { describe, expect, it } from "vitest";
import { VENCE_BORRADOR_MS, borrarBorrador, camposGuardables, guardarBorrador, leerBorrador } from "./borrador";

const falso = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k), _: d };
};

describe("borrador automático (FA-17)", () => {
  it("guarda lo escrito y lo devuelve; sin nada escrito no deja borrador", () => {
    const a = falso();
    expect(guardarBorrador(a, "alta", { nombre: "Ana", apellido: " ", dni: "" }, 1000)).toBe(true);
    expect(leerBorrador(a, "alta", 2000)).toEqual({ guardado: 1000, campos: { nombre: "Ana" } });
    expect(guardarBorrador(a, "alta", { nombre: "" }, 3000)).toBe(false);
    expect(leerBorrador(a, "alta", 3000)).toBeNull();
  });
  it("nunca guarda contraseñas, códigos ni el 'acepto' del reglamento", () => {
    expect(camposGuardables({ nombre: "Ana", acepto: "si", contrasena: "x", repetir: "x", sitio: "robot", codigo: "123456" })).toEqual({ nombre: "Ana" });
  });
  it("vence a los 7 días", () => {
    const a = falso();
    guardarBorrador(a, "plan", { nombre: "Mensual" }, 0);
    expect(leerBorrador(a, "plan", VENCE_BORRADOR_MS)).not.toBeNull();
    expect(leerBorrador(a, "plan", VENCE_BORRADOR_MS + 1)).toBeNull();
    expect(a._.size).toBe(0);   // el vencido se limpia solo
  });
  it("un borrador roto o sin almacenamiento no rompe nada", () => {
    const a = falso();
    a.setItem("base:borrador:x", "{no es json");
    expect(leerBorrador(a, "x")).toBeNull();
    expect(leerBorrador(null, "x")).toBeNull();
    expect(guardarBorrador(null, "x", { nombre: "Ana" })).toBe(false);
    const lleno = { getItem: () => null, setItem: () => { throw new Error("cuota"); }, removeItem: () => {} };
    expect(guardarBorrador(lleno, "x", { nombre: "Ana" })).toBe(false);
  });
  it("borrar saca el borrador", () => {
    const a = falso();
    guardarBorrador(a, "alta", { nombre: "Ana" });
    borrarBorrador(a, "alta");
    expect(leerBorrador(a, "alta")).toBeNull();
  });
});
