import { describe, expect, it } from "vitest";
import { esIcono, iconoDeEmoji } from "./Icono";
import ICONOS from "./iconos.json";
import { NOMBRES_ICONO } from "./iconos-nombres";
import { armar } from "../../../scripts/datos/iconos-sprite.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Icono (BASE-6)", () => {
  it("el sprite y la lista de nombres están al día con iconos.json (si falla: node scripts/datos/iconos-sprite.mjs)", () => {
    const { sprite, nombres } = armar();
    expect(readFileSync(join(__dirname, "..", "..", "..", "public", "iconos.svg"), "utf8")).toBe(sprite);
    expect(readFileSync(join(__dirname, "iconos-nombres.ts"), "utf8")).toBe(nombres);
    expect([...NOMBRES_ICONO].sort()).toEqual(Object.keys(ICONOS).sort());
  });
  it("cada ícono tiene al menos un trazo y ninguno repite nombre de punto", () => {
    for (const [nombre, trazos] of Object.entries(ICONOS)) {
      expect(trazos.length, nombre).toBeGreaterThan(0);
      for (const d of trazos) expect(d, nombre).toMatch(/^[Mm]/);
    }
  });
  it("conoce los nombres propios y los puntos del semáforo; un emoji del dueño no es un nombre de ícono", () => {
    expect(esIcono("candado")).toBe(true);
    expect(esIcono("punto-rojo")).toBe(true);
    expect(esIcono("🚴")).toBe(false);
  });
  it("traduce los emojis que arma la base al ícono de línea (con o sin variante de emoji)", () => {
    expect(iconoDeEmoji("🔒")).toBe("candado");
    expect(iconoDeEmoji("⚠️")).toBe("alerta");
    expect(iconoDeEmoji("🗓️")).toBe("calendario");
    expect(iconoDeEmoji("🦄")).toBeNull();
    // Todo ícono al que se traduce existe.
    for (const e of ["🔒", "⚠️", "💵", "🟢", "✅", "🚪", "📉"]) expect(esIcono(iconoDeEmoji(e)!), e).toBe(true);
  });
});
