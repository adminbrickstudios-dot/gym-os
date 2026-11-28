import { describe, expect, it } from "vitest";
import { BLOQUES, REDIRECCION_BLOQUE, barraCelular, bloquesPara, menuBloques } from "./organizacion";
import { DESTINO } from "./rutas";
import { GRUPOS, SECCIONES, seccionesPara } from "./secciones";

describe("Pase 2.0 · organización: el menú en bloques", () => {
  it("12 entradas, tres por bloque, en los cuatro bloques de siempre", () => {
    expect(BLOQUES).toHaveLength(12);
    for (const g of GRUPOS) expect(BLOQUES.filter((b) => b.grupo === g)).toHaveLength(3);
    for (const b of BLOQUES) expect(b.linea.length).toBeGreaterThan(8);
  });

  it("nada se pierde: cada sección del menú de antes es pestaña de algún bloque (salvo Fichar, que pasa a botón arriba)", () => {
    const enBloques = new Set(BLOQUES.flatMap((b) => b.pestanas.map((p) => p.seccion)));
    const faltan = SECCIONES.map((s) => s.clave).filter((c) => c !== "fichar" && !enBloques.has(c as keyof typeof DESTINO));
    expect(faltan).toEqual([]);
  });

  it("cada dirección vieja de una pestaña lleva a su pestaña; Interesados queda en Socios", () => {
    for (const b of BLOQUES.filter((x) => x.pestanas.length > 1)) {
      for (const p of b.pestanas) expect(REDIRECCION_BLOQUE[DESTINO[p.seccion]], p.seccion).toMatch(/^\/panel\/bloque\/[a-z]+\?pestana=[a-z_]+$/);
    }
    expect(REDIRECCION_BLOQUE["/panel/prospectos"]).toBe("/panel/bloque/socios?pestana=prospectos");
    expect(REDIRECCION_BLOQUE["/panel/avisos"]).toBe("/panel/bloque/hoy?pestana=avisos");
    // Las de una sola pestaña no se mueven.
    for (const r of ["/panel/entrada", "/panel/clases", "/panel/mensajes", "/panel/planes", "/panel/fichar", "/panel"]) expect(REDIRECCION_BLOQUE[r]).toBeUndefined();
  });

  it("el dueño ve los 12; el profe solo lo suyo; un bloque sin pestañas no aparece", () => {
    expect(bloquesPara(seccionesPara("dueno", []))).toHaveLength(12);
    const profe = bloquesPara(seccionesPara("profe", [])).map((b) => b.clave);
    expect(profe).toContain("clases");
    expect(profe).toContain("sala");
    expect(profe).not.toContain("caja");
    expect(profe).not.toContain("resultado");
    // Sin clases ni rutinas ni máquinas ni incidentes, el profe no tiene "Sala y rutinas".
    const apagadas = ["rutinas", "maquinas", "incidentes"];
    expect(bloquesPara(seccionesPara("profe", apagadas)).map((b) => b.clave)).not.toContain("sala");
    // Un gimnasio sin PT, lockers ni eventos no ve Extras.
    expect(bloquesPara(seccionesPara("dueno", ["pt", "lockers", "eventos"])).map((b) => b.clave)).not.toContain("extras");
  });

  it("celular: Inicio · Entrada · Hoy · Socios (y Más aparte)", () => {
    expect(barraCelular(seccionesPara("recepcion", [])).map((x) => x.titulo)).toEqual(["Inicio", "Entrada", "Hoy", "Socios"]);
    const menu = menuBloques(seccionesPara("dueno", []));
    expect(menu.find((b) => b.clave === "hoy")?.ruta).toBe("/panel/bloque/hoy");
    expect(menu.find((b) => b.clave === "entrada")?.ruta).toBe("/panel/entrada");
    expect(menu.find((b) => b.clave === "socios")?.rutas).toContain("/panel/retencion");
  });
});
