import { describe, expect, it } from "vitest";
import { estadoDe, fotoValida, MAX_FOTO, motivoDe, MOTIVOS } from "./mensajes";
import { seccionesPara } from "./panel/secciones";

describe("VD-38 · mensajes de los socios", () => {
  it("los cuatro motivos del brief, y uno desconocido cae en “otro”", () => {
    expect(MOTIVOS.map((m) => m.clave)).toEqual(["consulta", "queja", "objeto_perdido", "otro"]);
    expect(motivoDe("chisme").clave).toBe("otro");
    expect(estadoDe("en_curso").titulo).toBe("En curso");
  });
  it("la foto: solo imágenes y con tope de tamaño", () => {
    expect(fotoValida({ type: "image/png", size: 1000 })).toBeNull();
    expect(fotoValida({ type: "application/pdf", size: 1000 })).toMatch(/JPG, PNG o WEBP/);
    expect(fotoValida({ type: "image/jpeg", size: MAX_FOTO + 1 })).toMatch(/pesada/);
  });
  it("la sección Mensajes está para dueño, encargado y recepción; no para el profe; se puede apagar", () => {
    const claves = (rol: Parameters<typeof seccionesPara>[0], ap: string[] = []) => seccionesPara(rol, ap).map((s) => s.clave);
    for (const rol of ["dueno", "encargado", "recepcion"] as const) expect(claves(rol)).toContain("mensajes");
    expect(claves("profe")).not.toContain("mensajes");
    expect(claves("dueno", ["mensajes"])).not.toContain("mensajes");
  });
});
