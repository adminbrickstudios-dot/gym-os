import { describe, expect, it } from "vitest";
import { frasesDelAnio, nombreDia, nombreMes } from "./resumen";

describe("resumen del año del socio", () => {
  it("nombra meses y días (lunes = 1)", () => {
    expect(nombreMes(10)).toBe("octubre");
    expect(nombreMes(null)).toBeNull();
    expect(nombreMes(13)).toBeNull();
    expect(nombreDia(1)).toBe("lunes");
    expect(nombreDia(7)).toBe("domingo");
    expect(nombreDia(0)).toBeNull();
  });
  it("un año sin nada no inventa frases", () => {
    expect(frasesDelAnio({ anio: 2026, visitas: 0, mes_top: null, dia_top: null, clases: 0, rutina_dias: 0, mejor_racha_semanas: 0 })).toEqual([]);
  });
  it("singular y plural, y la racha solo desde 2 semanas", () => {
    const f = frasesDelAnio({ anio: 2026, visitas: 1, mes_top: 3, dia_top: 2, clases: 1, rutina_dias: 1, mejor_racha_semanas: 1 });
    expect(f).toEqual(["Viniste 1 vez en 2026.", "Tu mes más fuerte fue marzo.", "Tu día favorito para entrenar es el martes.", "Hiciste 1 clase.", "Completaste 1 día de tu rutina."]);
    const g = frasesDelAnio({ anio: 2026, visitas: 40, mes_top: 10, dia_top: 5, clases: 12, rutina_dias: 20, mejor_racha_semanas: 6 });
    expect(g[0]).toBe("Viniste 40 veces en 2026.");
    expect(g.at(-1)).toBe("Tu mejor racha: 6 semanas seguidas.");
  });
});
