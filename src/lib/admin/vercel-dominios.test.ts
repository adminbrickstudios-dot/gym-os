import { describe, expect, it } from "vitest";
import { agregarDominio, configuracionVercel, dominioValido, estadoDominio, registrosParaDominio, verificarDominio, type Fetch } from "./vercel-dominios";

const C = { token: "tok-secreto-123", proyecto: "prj_base", equipo: "team_brik" };
type Llamada = { url: string; metodo: string; auth: string | undefined; cuerpo: unknown };

/** Un Vercel de mentira: responde según la ruta y guarda lo que le pidieron. */
function vercelFalso(respuestas: Record<string, { status: number; json: unknown }>) {
  const llamadas: Llamada[] = [];
  const f: Fetch = async (url, init) => {
    const metodo = init?.method ?? "GET";
    llamadas.push({ url, metodo, auth: init?.headers?.Authorization, cuerpo: init?.body ? JSON.parse(init.body) : undefined });
    const clave = Object.keys(respuestas).find((k) => `${metodo} ${new URL(url).pathname}` === k);
    const r = clave ? respuestas[clave] : { status: 404, json: { error: { code: "not_found", message: "no" } } };
    return { status: r.status, json: async () => r.json };
  };
  return { f, llamadas };
}

describe("configuración", () => {
  it("sin token ni proyecto queda ⛔ y dice qué cargar", () => {
    expect(configuracionVercel({})).toEqual({ lista: false, faltan: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"] });
    expect(configuracionVercel({ VERCEL_TOKEN: "x" })).toEqual({ lista: false, faltan: ["VERCEL_PROJECT_ID"] });
  });
  it("con los dos queda lista (y el equipo es opcional)", () => {
    expect(configuracionVercel({ VERCEL_TOKEN: " t ", VERCEL_PROJECT_ID: "p", VERCEL_TEAM_ID: "e" })).toEqual({ lista: true, config: { token: "t", proyecto: "p", equipo: "e" } });
    expect(configuracionVercel({ VERCEL_TOKEN: "t", VERCEL_PROJECT_ID: "p" })).toEqual({ lista: true, config: { token: "t", proyecto: "p" } });
  });
});

describe("dominios y registros DNS", () => {
  it("valida y limpia", () => {
    expect(dominioValido("https://Base.Com.AR/")).toBe("base.com.ar");
    expect(dominioValido("*.base.ar")).toBe("*.base.ar");
    expect(dominioValido("no es un dominio")).toBeNull();
    expect(dominioValido("localhost")).toBeNull();
  });
  it("raíz con A y www, subdominio con CNAME, comodín con CNAME *", () => {
    expect(registrosParaDominio("base.ar").map((r) => `${r.tipo} ${r.nombre}`)).toEqual(["A @", "CNAME www"]);
    expect(registrosParaDominio("olympo.com.ar")[0]).toMatchObject({ tipo: "A", nombre: "@", valor: "76.76.21.21" });
    expect(registrosParaDominio("app.base.ar")).toEqual([{ tipo: "CNAME", nombre: "app", valor: "cname.vercel-dns.com", para: "app.base.ar" }]);
    expect(registrosParaDominio("*.base.ar")[0]).toMatchObject({ tipo: "CNAME", nombre: "*" });
  });
});

describe("agregar, verificar y consultar", () => {
  it("agrega con el token y el equipo, y queda pendiente de verificación con los registros exactos", async () => {
    const { f, llamadas } = vercelFalso({ "POST /v10/projects/prj_base/domains": { status: 200, json: { name: "base.ar", verified: false, verification: [{ type: "TXT", domain: "_vercel.base.ar", value: "vc-domain-verify=abc" }] } } });
    const r = await agregarDominio(f, C, "BASE.ar");
    expect(llamadas[0]).toMatchObject({ metodo: "POST", auth: "Bearer tok-secreto-123", cuerpo: { name: "base.ar" } });
    expect(llamadas[0].url).toContain("teamId=team_brik");
    expect(r.estado).toBe("pendiente");
    expect(r.registros.map((x) => `${x.tipo} ${x.nombre} ${x.valor}`)).toContain("TXT _vercel.base.ar vc-domain-verify=abc");
    expect(r.registros.some((x) => x.tipo === "A" && x.valor === "76.76.21.21")).toBe(true);
  });
  it("un dominio verificado y bien apuntado: verde, sin registros, SSL automático", async () => {
    const { f } = vercelFalso({
      "POST /v10/projects/prj_base/domains": { status: 200, json: { name: "app.base.ar", verified: true } },
    });
    const r = await agregarDominio(f, C, "app.base.ar");
    expect(r).toMatchObject({ estado: "verificado", registros: [] });
    expect(r.mensaje).toMatch(/SSL/);
  });
  it("si ya estaba en el proyecto, lo consulta en vez de fallar; y si el DNS está mal, sigue pendiente", async () => {
    const { f, llamadas } = vercelFalso({
      "POST /v10/projects/prj_base/domains": { status: 409, json: { error: { code: "domain_already_exists", message: "ya" } } },
      "GET /v9/projects/prj_base/domains/base.ar": { status: 200, json: { name: "base.ar", verified: true } },
      "GET /v6/domains/base.ar/config": { status: 200, json: { misconfigured: true } },
    });
    const r = await agregarDominio(f, C, "base.ar");
    expect(llamadas.map((l) => l.metodo)).toEqual(["POST", "GET", "GET"]);
    expect(r.estado).toBe("pendiente");
    expect(r.mensaje).toMatch(/DNS todavía no apunta/);
  });
  it("verificar: pide la verificación y devuelve el estado nuevo", async () => {
    const { f } = vercelFalso({
      "POST /v9/projects/prj_base/domains/base.ar/verify": { status: 200, json: { name: "base.ar", verified: true } },
      "GET /v6/domains/base.ar/config": { status: 200, json: { misconfigured: false } },
    });
    expect((await verificarDominio(f, C, "base.ar")).estado).toBe("verificado");
  });
  it("estadoDominio de un comodín no consulta la configuración del DNS", async () => {
    const { f, llamadas } = vercelFalso({ "GET /v9/projects/prj_base/domains/*.base.ar": { status: 200, json: { verified: true } } });
    expect((await estadoDominio(f, C, "*.base.ar")).estado).toBe("verificado");
    expect(llamadas.length).toBe(1);
  });
});

describe("errores en palabras, sin el token", () => {
  it("token malo: dice qué hacer y no lo repite", async () => {
    const { f } = vercelFalso({ "POST /v10/projects/prj_base/domains": { status: 403, json: { error: { code: "forbidden", message: "Not authorized" } } } });
    const r = await agregarDominio(f, C, "base.ar");
    expect(r.estado).toBe("error");
    expect(r.mensaje).toMatch(/VERCEL_TOKEN/);
    expect(JSON.stringify(r)).not.toContain("tok-secreto-123");
  });
  it("proyecto que no existe, dominio en otro proyecto, dominio inválido y Vercel caído", async () => {
    const caso = async (status: number, code: string) => (await agregarDominio(vercelFalso({ "POST /v10/projects/prj_base/domains": { status, json: { error: { code, message: "x" } } } }).f, C, "base.ar")).mensaje;
    expect(await caso(404, "not_found")).toMatch(/VERCEL_PROJECT_ID/);
    expect(await caso(409, "domain_already_in_use")).toMatch(/otro proyecto/);
    expect(await caso(400, "invalid_domain")).toMatch(/no es válido/);
    expect(await caso(503, "")).toMatch(/no está respondiendo/);
    expect(await agregarDominio(vercelFalso({}).f, C, "no es un dominio")).toMatchObject({ estado: "error" });
  });
  it("si no hay conexión, el error no lleva el token", async () => {
    const f: Fetch = async () => { throw new Error("fetch failed tok-secreto-123"); };
    const mensaje = await agregarDominio(f, C, "base.ar").then(() => "", (e: Error) => e.message);
    expect(mensaje).toMatch(/No se pudo conectar con Vercel/);
    expect(mensaje).not.toContain("tok-secreto-123");
  });
});
