import { describe, expect, it } from "vitest";
import {
  agruparClases, conActual, deshacer, esTipografia, estiloTipografia, etiquetaDia, hoyEnZona, mover, nuevoHistorial, puedeDeshacer, puedeRehacer,
  registrar, rehacer, MAX_HISTORIAL,
} from "@/lib/landing-estilo";

describe("tipografía", () => {
  it("cada letra tiene su variable y una rara cae en la condensada", () => {
    expect(String(estiloTipografia("clasica")["--fuente-titulo" as never])).toContain("Georgia");
    expect(String(estiloTipografia("ancha")["--fuente-titulo" as never])).not.toContain("condensed");
    expect(String(estiloTipografia("comic")["--fuente-titulo" as never])).toContain("barlow-condensed");
    expect(String(estiloTipografia(undefined)["--fuente-titulo" as never])).toContain("barlow-condensed");
  });
  it("reconoce solo las tres", () => {
    expect(esTipografia("ancha")).toBe(true);
    expect(esTipografia("comic")).toBe(false);
  });
});

describe("mover (arrastrar)", () => {
  it("sube, baja y no toca la lista original", () => {
    const l = ["a", "b", "c", "d"];
    expect(mover(l, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(mover(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(l).toEqual(["a", "b", "c", "d"]);
  });
  it("fuera de rango o al mismo lugar: igual", () => {
    expect(mover(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(mover(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(mover(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("historial", () => {
  it("registra, deshace y rehace", () => {
    let h = nuevoHistorial({ t: "a" });
    expect(puedeDeshacer(h)).toBe(false);
    h = registrar(h, { t: "b" });
    h = registrar(h, { t: "c" });
    expect(h.actual).toEqual({ t: "c" });
    h = deshacer(h);
    expect(h.actual).toEqual({ t: "b" });
    expect(puedeRehacer(h)).toBe(true);
    h = rehacer(h);
    expect(h.actual).toEqual({ t: "c" });
    expect(puedeRehacer(h)).toBe(false);
  });
  it("un cambio igual no suma un paso, y uno nuevo borra lo que se podía rehacer", () => {
    let h = registrar(nuevoHistorial({ t: "a" }), { t: "b" });
    expect(registrar(h, { t: "b" })).toBe(h);
    h = deshacer(h);
    h = registrar(h, { t: "z" });
    expect(puedeRehacer(h)).toBe(false);
  });
  it("deshacer sin pasado no hace nada y el historial tiene tope", () => {
    const h = nuevoHistorial(0);
    expect(deshacer(h)).toBe(h);
    let g = nuevoHistorial(0);
    for (let i = 1; i <= MAX_HISTORIAL + 20; i++) g = registrar(g, i);
    expect(g.pasado.length).toBe(MAX_HISTORIAL);
  });
  it("conActual reemplaza el estado sin tocar el pasado", () => {
    const h = registrar(nuevoHistorial(1), 2);
    expect(conActual(h, 3)).toEqual({ pasado: [1], actual: 3, futuro: [] });
  });
});

describe("clases de la semana", () => {
  const zona = "America/Argentina/Salta";
  it("etiqueta hoy, mañana y el resto con día y mes", () => {
    expect(etiquetaDia("2026-11-11", "2026-11-11")).toBe("Hoy");
    expect(etiquetaDia("2026-11-12", "2026-11-11")).toBe("Mañana");
    expect(etiquetaDia("2026-11-14", "2026-11-11")).toBe("Sábado 14 de noviembre");
    expect(etiquetaDia("2026-12-01", "2026-11-30")).toBe("Mañana");
  });
  it("el día de hoy se cuenta en la zona del gimnasio", () => {
    // 02:00 UTC del 12 es todavía el 11 a las 23:00 en Salta (UTC-3)
    expect(hoyEnZona(zona, new Date("2026-11-12T02:00:00Z"))).toBe("2026-11-11");
  });
  it("agrupa por día y ordena por hora; vacío si no hay clases", () => {
    const ahora = new Date("2026-11-11T15:00:00Z");
    const c = (inicio: string, dia: string, hora: string, actividad: string) => ({ inicio, dia, hora, actividad, sede: "Central", zona });
    const r = agruparClases([
      c("2026-11-12T22:00:00Z", "2026-11-12", "19:00", "Funcional"),
      c("2026-11-11T21:00:00Z", "2026-11-11", "18:00", "Yoga"),
      c("2026-11-12T10:00:00Z", "2026-11-12", "07:00", "Spinning"),
    ], ahora);
    expect(r.map((d) => d.etiqueta)).toEqual(["Hoy", "Mañana"]);
    expect(r[1].clases.map((x) => x.hora)).toEqual(["07:00", "19:00"]);
    expect(agruparClases([], ahora)).toEqual([]);
  });
});
