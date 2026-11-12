import { describe, expect, it } from "vitest";
import { DESTINO, REDIRECCIONES, RUTAS_VIEJAS, rutaActual } from "./rutas";
import { ACCESOS, GRUPOS, SECCIONES, accesosElegidos, rutaDisponible, seccionesPara } from "./secciones";

describe("VD-11 · menú nuevo", () => {
  it("las secciones llevan los nombres del doc 03 y las claves de siempre", () => {
    const t = (c: string) => SECCIONES.find((s) => s.clave === c)?.titulo;
    expect(t("tareas")).toBe("Para hacer hoy");
    expect(t("vencen_hoy")).toBe("Vencen y cobrar");
    expect(t("vender")).toBe("Productos y stock");
    expect(t("prospectos")).toBe("Interesados");
    expect(t("retencion")).toBe("Retención y números");
    expect(t("planes")).toBe("Planes y servicios");
  });

  it("no se sacó ninguna sección ni ruta: toda ruta vieja sigue en el mapa o redirige", () => {
    const rutas = new Set(SECCIONES.map((s) => s.ruta));
    for (const vieja of RUTAS_VIEJAS) expect(rutas.has(rutaActual(vieja)) || vieja in REDIRECCIONES).toBe(true);
    for (const s of SECCIONES) expect(s.ruta).toBe(DESTINO[s.clave as keyof typeof DESTINO]);
  });

  it("cada grupo tiene sus secciones y el orden va Hoy, Socios, Plata, Gimnasio", () => {
    expect(GRUPOS).toEqual(["Hoy", "Socios", "Plata", "Gimnasio"]);
    const orden = SECCIONES.map((s) => GRUPOS.indexOf(s.grupo));
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it("un acceso rápido guardado con una clave de siempre sigue andando", () => {
    const { elegidos, perdidos } = accesosElegidos("dueno", [], ["vender", "vencen_hoy", "prospectos", "tareas"]);
    expect(perdidos).toEqual([]);
    expect(elegidos.map((a) => a.ruta)).toEqual(["/panel/vender", "/panel/vencen-hoy", "/panel/prospectos", "/panel/tareas"]);
    expect(ACCESOS.some((a) => a.clave === "nuevo_socio")).toBe(true);
  });

  it("cada rol ve su menú y las apagadas no aparecen", () => {
    const claves = (rol: Parameters<typeof seccionesPara>[0], ap: string[] = []) => seccionesPara(rol, ap).map((s) => s.clave);
    expect(claves("profe")).toEqual(["tareas", "fichar", "clases", "incidentes", "maquinas", "pt", "rutinas"]);
    expect(claves("recepcion")).not.toContain("gastos");
    expect(claves("recepcion")).not.toContain("control");
    expect(claves("recepcion")).toContain("prospectos");
    expect(claves("dueno")).toContain("gastos");
    expect(claves("encargado", ["gastos", "control"])).not.toContain("gastos");
    expect(claves("encargado", ["gastos", "control"])).not.toContain("control");
    expect(claves("dueno", ["vender"])).not.toContain("vender");
    expect(rutaDisponible("/panel/gastos", "encargado", ["gastos"])).toBe(false);
  });
});

describe("Z5 · el menú en cuatro secciones (DISENO.md)", () => {
  it("cada sección tiene su línea que explica qué es", async () => {
    const { LINEA_GRUPO } = await import("./secciones");
    for (const g of GRUPOS) expect(LINEA_GRUPO[g].length).toBeGreaterThan(10);
  });

  it("ningún ícono se repite en todo el menú (uno distinto por pantalla)", () => {
    const iconos = SECCIONES.map((s) => s.emoji);
    expect(iconos.filter((e, i) => iconos.indexOf(e) !== i)).toEqual([]);
  });

  it("lo de uso menos seguido va en «Más» y el dueño ve a lo sumo 7 sueltas por sección", () => {
    const sec = (c: string) => SECCIONES.find((s) => s.clave === c)!;
    for (const c of ["incidentes", "maquinas", "horas", "profes", "resumen", "eventos"]) expect(sec(c).secundaria).toBe(true);
    for (const g of GRUPOS) {
      const sueltas = seccionesPara("dueno", []).filter((s) => s.grupo === g && !s.secundaria);
      expect(sueltas.length).toBeLessThanOrEqual(7);
    }
  });

  it("Rutinas está en Gimnasio y no se repite ninguna sección", () => {
    expect(SECCIONES.find((s) => s.clave === "rutinas")?.grupo).toBe("Gimnasio");
    expect(new Set(SECCIONES.map((s) => s.clave)).size).toBe(SECCIONES.length);
  });
});
