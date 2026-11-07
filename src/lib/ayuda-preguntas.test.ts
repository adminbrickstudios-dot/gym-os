import { describe, expect, it } from "vitest";
import { PREGUNTAS, buscarPreguntas, preguntasPara } from "./ayuda-preguntas";
import { AYUDAS, RUTAS_APP, RUTAS_PANEL } from "./ayuda";
import { SECCIONES, rutaDisponible, seccionesPara, type Rol } from "./panel/secciones";

const ROLES: Rol[] = ["dueno", "encargado", "recepcion", "profe"];
const panel = (rol: Rol, apagadas: string[] = []) => preguntasPara("panel", { rol, secciones: seccionesPara(rol, apagadas) });

describe("VD-63 · centro de ayuda", () => {
  it("cada pregunta tiene id único, respuesta corta y un destino interno", () => {
    expect(new Set(PREGUNTAS.map((p) => p.id)).size).toBe(PREGUNTAS.length);
    for (const p of PREGUNTAS) {
      expect(p.respuesta.length, p.id).toBeLessThan(260);
      expect(p.destino.ruta, p.id).toMatch(p.ambito === "panel" ? /^\/panel/ : /^\/app/);
      expect(p.destino.boton.length, p.id).toBeGreaterThan(3);
    }
  });

  it("las secciones que nombra existen (panel) o son de la app", () => {
    const claves = new Set(SECCIONES.map((s) => s.clave));
    for (const p of PREGUNTAS.filter((x) => x.ambito === "panel" && x.seccion)) expect(claves.has(p.seccion!), p.id).toBe(true);
    for (const p of PREGUNTAS.filter((x) => x.ambito === "app" && x.seccion)) expect(["clases", "rutina"]).toContain(p.seccion);
  });

  it("el rol solo ve preguntas de pantallas que puede abrir, y el botón nunca lleva a una pantalla que no ve", () => {
    for (const rol of ROLES) {
      for (const p of panel(rol)) expect(rutaDisponible(p.destino.ruta, rol, []), `${rol}: ${p.id}`).toBe(true);
    }
    expect(panel("recepcion").some((p) => p.id === "anular-cobro")).toBe(true);
    expect(panel("recepcion").some((p) => p.id === "gasto")).toBe(false);
    expect(panel("profe").some((p) => p.id === "anular-cobro")).toBe(false);
  });

  it("una sección apagada por el gimnasio saca sus preguntas", () => {
    expect(panel("dueno").some((p) => p.id === "caja-turno")).toBe(true);
    expect(panel("dueno", ["caja"]).some((p) => p.id === "caja-turno")).toBe(false);
    expect(panel("dueno", ["clases"]).some((p) => p.id === "clases-reservas")).toBe(false);
  });

  it("la app no ofrece clases ni rutina si el gimnasio no las tiene", () => {
    const sin = preguntasPara("app", { seccionesApp: [] }).map((p) => p.id);
    expect(sin).not.toContain("app-reservar");
    expect(sin).not.toContain("app-rutina");
    expect(sin).toContain("app-info");
    expect(preguntasPara("app", { seccionesApp: ["clases", "rutina"] }).map((p) => p.id)).toEqual(expect.arrayContaining(["app-reservar", "app-rutina"]));
  });

  it("las tres preguntas del pedido se encuentran como las escribe la gente", () => {
    const lista = panel("dueno");
    expect(buscarPreguntas(lista, "¿cómo anulo un cobro?")[0].id).toBe("anular-cobro");
    expect(buscarPreguntas(lista, "anular cobro")[0].id).toBe("anular-cobro");
    expect(buscarPreguntas(lista, "¿cómo pauso a un socio?")[0].id).toBe("pausar-socio");
    expect(buscarPreguntas(lista, "pausar")[0].id).toBe("pausar-socio");
    expect(buscarPreguntas(lista, "¿qué es día fijo?")[0].id).toBe("dia-fijo");
    expect(buscarPreguntas(lista, "dia fijo")[0].id).toBe("dia-fijo");
  });

  it("buscar algo que no existe no inventa resultados", () => {
    expect(buscarPreguntas(panel("dueno"), "xyzzy plugh")).toEqual([]);
    expect(buscarPreguntas(panel("dueno"), "   ")).toEqual([]);
  });

  it("los textos de ayuda por pantalla son una línea clara (no más de 130 letras) y cada pantalla tiene el suyo", () => {
    for (const [k, a] of Object.entries(AYUDAS)) {
      expect(a.texto.length, k).toBeLessThan(135);
      for (const t of Object.values(a.porRol ?? {})) expect((t ?? "").length, k).toBeLessThan(135);
    }
    for (const clave of [...Object.values(RUTAS_PANEL), ...Object.values(RUTAS_APP)]) expect(AYUDAS[clave], clave).toBeDefined();
  });
});
