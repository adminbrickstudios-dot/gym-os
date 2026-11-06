import { describe, expect, it } from "vitest";
import { accionesPara, comandoPermitido, ejemplosDe, interpretar, pareceDni, sinVerboIr, verbosPermitidos } from "./comandos";
import { seccionesPara } from "./secciones";

describe("interpretar", () => {
  it("cobrar juan → cobrar a Juan, con sinónimos y relleno", () => {
    expect(interpretar("cobrar juan")).toEqual({ verbo: "cobrar", arg: "juan" });
    expect(interpretar("  Cobrar   a  Juan Pérez ")).toEqual({ verbo: "cobrar", arg: "Juan Pérez" });
    expect(interpretar("cobrale a María")).toEqual({ verbo: "cobrar", arg: "María" });
    expect(interpretar("cobrarle al Tano")).toEqual({ verbo: "cobrar", arg: "Tano" });
  });
  it("entrada con DNI", () => {
    expect(interpretar("entrada 12345678")).toEqual({ verbo: "entrada", arg: "12345678" });
    expect(interpretar("dejar entrar 12.345.678")).toEqual({ verbo: "entrada", arg: "12.345.678" });
    expect(interpretar("ingreso de Lucía")).toEqual({ verbo: "entrada", arg: "Lucía" });
  });
  it("nuevo socio, abrir y cerrar turno, vender, gasto", () => {
    for (const t of ["nuevo socio", "alta", "dar de alta", "agregar socio", "Socio Nuevo"]) expect(interpretar(t)?.verbo).toBe("nuevo_socio");
    for (const t of ["abrir turno", "abrir caja", "iniciar turno"]) expect(interpretar(t)?.verbo).toBe("abrir_turno");
    for (const t of ["cerrar turno", "cerrar la caja", "arqueo"]) expect(interpretar(t)?.verbo).toBe("cerrar_turno");
    expect(interpretar("vender agua")).toEqual({ verbo: "vender", arg: "agua" });
    expect(interpretar("venta")).toEqual({ verbo: "vender", arg: "" });
    expect(interpretar("nuevo gasto luz")).toEqual({ verbo: "gasto", arg: "luz" });
  });
  it("ficha de un socio, con y sin acentos", () => {
    expect(interpretar("ficha juan")).toEqual({ verbo: "ficha", arg: "juan" });
    expect(interpretar("ver ficha de Lucía")).toEqual({ verbo: "ficha", arg: "Lucía" });
    expect(interpretar("perfil de pedro")).toEqual({ verbo: "ficha", arg: "pedro" });
  });
  it("tarea conserva el texto tal cual (sin sacarle el 'a')", () => {
    expect(interpretar("tarea llamar a Pedro")).toEqual({ verbo: "tarea", arg: "llamar a Pedro" });
    expect(interpretar("recordame de comprar agua")).toEqual({ verbo: "tarea", arg: "de comprar agua" });
  });
  it("lo que no es comando es una búsqueda común", () => {
    for (const t of ["juan", "12345678", "caja", "mensajes", "socios", "tareas", "vencen hoy", "entradas de hoy", "cobranzas", ""]) expect(interpretar(t)).toBeNull();
  });
  it("un nombre que empieza parecido a un verbo no lo es", () => {
    expect(interpretar("altamirano")).toBeNull();
    expect(interpretar("cobrador")).toBeNull();
    expect(interpretar("socios nuevos")).toBeNull();
  });
});

describe("pareceDni y sinVerboIr", () => {
  it("DNI con o sin puntos", () => {
    expect(pareceDni("12345678")).toBe(true);
    expect(pareceDni("12.345.678")).toBe(true);
    expect(pareceDni("juan")).toBe(false);
    expect(pareceDni("12")).toBe(false);
  });
  it("saca el 'ir a / abrir / ver'", () => {
    expect(sinVerboIr("ir a caja")).toBe("caja");
    expect(sinVerboIr("abrir la caja")).toBe("caja");
    expect(sinVerboIr("ver mensajes")).toBe("mensajes");
    expect(sinVerboIr("caja")).toBe("caja");
  });
});

describe("permisos: qué acciones ve cada rol (salen de las secciones del rol)", () => {
  const verbos = (rol: "dueno" | "encargado" | "recepcion" | "profe", apagadas: string[] = [], puedeCobrar = true) =>
    verbosPermitidos(seccionesPara(rol, apagadas), { puedeCobrar: puedeCobrar && rol !== "profe", soloVer: rol === "profe" });

  it("el dueño hace de todo; la recepción no carga gastos", () => {
    const d = verbos("dueno");
    for (const v of ["cobrar", "entrada", "ficha", "vender", "nuevo_socio", "abrir_turno", "cerrar_turno", "tarea", "gasto"] as const) expect(d.has(v)).toBe(true);
    const r = verbos("recepcion");
    expect(r.has("gasto")).toBe(false);
    expect(r.has("cobrar")).toBe(true);
    expect(r.has("abrir_turno")).toBe(true);
  });
  it("la profe solo anota tareas", () => {
    expect([...verbos("profe")]).toEqual(["tarea"]);
  });
  it("una sección apagada apaga su acción", () => {
    const v = verbos("recepcion", ["caja", "vender"], false);
    expect(v.has("abrir_turno")).toBe(false);
    expect(v.has("vender")).toBe(false);
    expect(v.has("cobrar")).toBe(false);
    expect(v.has("nuevo_socio")).toBe(true);
    expect(verbos("recepcion", ["socios"]).has("nuevo_socio")).toBe(false);
  });
  it("un comando que el rol no puede es una búsqueda común", () => {
    expect(comandoPermitido("nuevo gasto luz", verbos("recepcion"))).toBeNull();
    expect(comandoPermitido("nuevo gasto luz", verbos("dueno"))?.verbo).toBe("gasto");
    expect(comandoPermitido("cobrar juan", verbos("profe"))).toBeNull();
  });
  it("los ejemplos del campo vacío son solo de lo que puede hacer", () => {
    expect(ejemplosDe(verbos("profe"))).toEqual(["tarea llamar a Pedro"]);
    expect(ejemplosDe(verbos("recepcion"))).toContain("cobrar Juan");
  });
});

describe("accionesPara", () => {
  const todos = verbosPermitidos(seccionesPara("dueno", []), { puedeCobrar: true, soloVer: false });
  const juan = { socio_id: "s1", nombre: "Juan Pérez" };
  const baja = { socio_id: "s2", nombre: "Juan Viejo", dado_de_baja: true };

  it("cobrar juan: una acción por socio, sin los dados de baja, la primera es la más cercana", () => {
    const a = accionesPara("cobrar juan", interpretar("cobrar juan"), todos, [juan, baja]);
    expect(a.map((x) => x.titulo)).toEqual(["Cobrar a Juan Pérez"]);
    expect(a[0]).toMatchObject({ tipo: "cobrar", socioId: "s1" });
  });
  it("entrada <dni> abre la ventana con ese DNI", () => {
    const a = accionesPara("entrada 12345678", interpretar("entrada 12345678"), todos, []);
    expect(a[0]).toMatchObject({ tipo: "entrada", texto: "12345678", titulo: "Entrada del DNI 12345678" });
  });
  it("nuevo socio, turnos, ficha y vender van a su pantalla", () => {
    expect(accionesPara("nuevo socio", interpretar("nuevo socio"), todos, [])[0]).toMatchObject({ tipo: "ir", ruta: "/panel/socios/nuevo" });
    expect(accionesPara("abrir turno", interpretar("abrir turno"), todos, [])[0]).toMatchObject({ ruta: "/panel/caja", titulo: "Abrir turno" });
    expect(accionesPara("cerrar turno", interpretar("cerrar turno"), todos, [])[0]).toMatchObject({ ruta: "/panel/caja", titulo: "Cerrar turno" });
    expect(accionesPara("ficha juan", interpretar("ficha juan"), todos, [juan])[0]).toMatchObject({ ruta: "/panel/socios/s1" });
    const v = accionesPara("vender juan", interpretar("vender juan"), todos, [juan]);
    expect(v.map((x) => (x as { ruta: string }).ruta)).toEqual(["/panel/vender?socio=s1", "/panel/vender"]);
    expect(accionesPara("venta", interpretar("venta"), todos, [])[0]).toMatchObject({ ruta: "/panel/vender" });
  });
  it("tarea crea una tarea para hoy con el texto", () => {
    expect(accionesPara("tarea reponer agua", interpretar("tarea reponer agua"), todos, [])[0]).toMatchObject({ tipo: "tarea", texto: "reponer agua" });
  });
  it("sin verbo, ofrece las acciones que se llaman parecido (y solo las permitidas)", () => {
    expect(accionesPara("nuev", null, todos, []).map((a) => a.id)).toEqual(["nuevo_socio"]);
    expect(accionesPara("cerr", null, todos, []).map((a) => a.id)).toEqual(["cerrar_turno"]);
    expect(accionesPara("caja", null, todos, [])).toEqual([]);
    expect(accionesPara("nuev", null, new Set(), [])).toEqual([]);
    expect(accionesPara("ab", null, todos, [])).toEqual([]);   // dos letras no alcanzan
  });
});
