import { describe, expect, it } from "vitest";
import { resumirHorarios, textoCierre } from "./horarios";

describe("resumirHorarios", () => {
  it("agrupa días seguidos con el mismo horario y marca los cerrados", () => {
    const f = [1, 2, 3, 4, 5].map((dia) => ({ dia, abre: "07:00", cierra: "22:00" }))
      .concat([{ dia: 6, abre: "16:00", cierra: "20:00" }, { dia: 6, abre: "09:00", cierra: "13:00" }]);
    expect(resumirHorarios(f)).toEqual([
      { dias: "Lunes a viernes", horas: "7:00 a 22:00" },
      { dias: "Sábado", horas: "9:00 a 13:00 y 16:00 a 20:00" },
      { dias: "Domingo", horas: "Cerrado" },
    ]);
  });
  it("dos días seguidos se unen con y; sin franjas, nada", () => {
    expect(resumirHorarios([{ dia: 6, abre: "10:00", cierra: "14:00" }, { dia: 7, abre: "10:00", cierra: "14:00" }]).at(-1))
      .toEqual({ dias: "Sábado y domingo", horas: "10:00 a 14:00" });
    expect(resumirHorarios([])).toEqual([]);
  });
});

describe("textoCierre", () => {
  it("un día o un rango, con el día de la semana", () => {
    expect(textoCierre({ desde: "2026-11-16", hasta: "2026-11-16" })).toBe("lun 16/11");
    expect(textoCierre({ desde: "2026-12-24", hasta: "2026-12-26" })).toBe("del jue 24/12 al sáb 26/12");
  });
});
