import { describe, expect, it } from "vitest";
import { csvGimnasios, enlacesPorRol, haceCuanto, whatsappDueno, type FilaGimnasio } from "./lista";

const fila: FilaGimnasio = { gimnasio_id: "1", slug: "olympo", nombre: "Olympo, Centro", es_demo: false, alta: "2026-11-01", favorito: false, suspendido: false,
  socios_activos: 120, entradas_hoy: 40, ultimo_uso: null, abono: "por_vencer", plan: "Básico", color: "amarillo", motivos: ["El abono a BRIK está por vencer"],
  dueno: "=Ana", dueno_telefono: "+54 9 000 1234", hosts: ["olympo.base.app"] };

describe("lista del super admin", () => {
  it("arma el link de cada rol", () => {
    expect(enlacesPorRol("olympo.base.app").map((e) => e.url)).toEqual(["https://olympo.base.app/dueno", "https://olympo.base.app/recepcion", "https://olympo.base.app/profe", "https://olympo.base.app/socio"]);
    expect(enlacesPorRol(undefined)).toEqual([]);
  });
  it("whatsapp solo con celular válido", () => {
    expect(whatsappDueno("+54 9 000 1234", "Hola Ana")).toBe("https://wa.me/5490001234?text=Hola%20Ana");
    expect(whatsappDueno(null, "x")).toBeNull();
    expect(whatsappDueno("123", "x")).toBeNull();
  });
  it("fechas relativas", () => {
    const ahora = new Date("2026-11-09T12:00:00Z").getTime();
    expect(haceCuanto(null, ahora)).toBe("nunca");
    expect(haceCuanto("2026-11-09T01:00:00Z", ahora)).toBe("hoy");
    expect(haceCuanto("2026-11-08T01:00:00Z", ahora)).toBe("ayer");
    expect(haceCuanto("2026-11-06T01:00:00Z", ahora)).toBe("hace 3 días");
  });
  it("el CSV escapa comas y fórmulas", () => {
    const csv = csvGimnasios([fila]);
    expect(csv.startsWith("﻿Gimnasio,Slug")).toBe(true);
    expect(csv).toContain('"Olympo, Centro"');
    expect(csv).toContain("'=Ana");
    expect(csv).toContain("Por vencer");
  });
});
