// D1/D2: la cadena completa de direcciones cuando Mateo cambia los dominios (pasegym.com y templegymsalta.com).
// Se corre el proxy de verdad (src/proxy.ts) con la resolución del gimnasio simulada:
//   gym-os-pied.vercel.app/g/templegym1/hacete-socio  →308→  pasegym.com/g/templegym1/hacete-socio  →308→  templegymsalta.com/hacete-socio
// y lo mismo con /g/templegym1, /ingresar y /privacidad, y con www.templegymsalta.com. El QR impreso no se rompe nunca.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const VIEJO = "gym-os-pied.vercel.app", PLATAFORMA = "pasegym.com", PROPIO = "templegymsalta.com", SUBDOMINIO = "templegym1.pasegym.com";
type Fila = { gimnasio_id: string; slug: string; host: string | null };
// Temple Gym con su dominio propio y su subdominio; el slug del otro gimnasio es de otro mail/otro gimnasio.
const TEMPLE: Fila = { gimnasio_id: "id-temple", slug: "templegym1", host: PROPIO };
const OTRO: Fila = { gimnasio_id: "id-otro", slug: "otrogim", host: "otrogim.pasegym.com" };
const POR_HOST: Record<string, Fila> = { [PROPIO]: TEMPLE, [SUBDOMINIO]: TEMPLE, "otrogim.pasegym.com": OTRO };
const POR_SLUG: Record<string, Fila> = { templegym1: TEMPLE, otrogim: OTRO, sinhost: { gimnasio_id: "id-sinhost", slug: "sinhost", host: null } };

let consultas: string[] = [];
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DOMINIO_BASE", PLATAFORMA);
  vi.stubEnv("NEXT_PUBLIC_DOMINIO_PLATAFORMA", PLATAFORMA);
  vi.stubEnv("NEXT_PUBLIC_DOMINIOS_VIEJOS", VIEJO);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-de-prueba");
  consultas = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const cuerpo = JSON.parse(String(init.body)) as { p_slug?: string; p_host?: string };
    consultas.push(`${url.split("/").pop()}:${cuerpo.p_slug ?? cuerpo.p_host}`);
    const fila = url.endsWith("gimnasio_por_slug") ? POR_SLUG[cuerpo.p_slug ?? ""] : POR_HOST[cuerpo.p_host ?? ""];
    return new Response(JSON.stringify(fila ? [fila] : []), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const abrir = (host: string, ruta: string, extra: Record<string, string> = {}) =>
  proxy(new NextRequest(`https://${host}${ruta}`, { headers: { host, ...extra } }));
const RUTAS = ["/hacete-socio", "/ingresar", "", "/privacidad"] as const;
const nueva = (r: string) => (r === "" ? "/" : r);

test("la cadena completa del QR impreso: vercel.app → pasegym.com → templegymsalta.com, con la misma ruta y los mismos parámetros", async () => {
  for (const r of RUTAS) {
    const paso1 = await abrir(VIEJO, `/g/templegym1${r}?o=qr`);
    expect(paso1.status, `viejo ${r}`).toBe(308);
    expect(paso1.headers.get("location")).toBe(`https://${PLATAFORMA}/g/templegym1${r}?o=qr`);
    const paso2 = await abrir(PLATAFORMA, `/g/templegym1${r}?o=qr`);
    expect(paso2.status, `plataforma ${r}`).toBe(308);
    expect(paso2.headers.get("location")).toBe(`https://${PROPIO}${nueva(r)}?o=qr`);
    const paso3 = await abrir(PROPIO, `${nueva(r)}?o=qr`);
    expect(paso3.status, `propio ${r}`).toBe(200);
    expect(paso3.headers.get("location")).toBeNull();
    expect(paso3.headers.get("x-middleware-request-x-gimnasio-slug")).toBe("templegym1");
  }
});

test("el host viejo redirige aunque no sea una ruta de gimnasio: la raíz, el panel y el super admin van a la plataforma nueva", async () => {
  for (const ruta of ["/", "/ingresar", "/super", "/panel/socios?filtro=vencidos"]) {
    const res = await abrir(VIEJO, ruta);
    expect(res.status, ruta).toBe(308);
    expect(res.headers.get("location")).toBe(`https://${PLATAFORMA}${ruta}`);
  }
});

test("solo los hosts de la lista explícita redirigen: otro host desconocido sigue dando 404 con la dirección escrita (nunca un fallback)", async () => {
  const res = await abrir("cualquiera.vercel.app", "/g/templegym1/hacete-socio");
  expect(res.status).toBe(404);
  expect(decodeURIComponent(res.headers.get("x-middleware-rewrite") ?? "")).toContain("cualquiera.vercel.app");
});

test("antes del cambio (el host viejo sigue siendo la plataforma) no se redirige a sí mismo", async () => {
  vi.stubEnv("NEXT_PUBLIC_DOMINIO_BASE", VIEJO);
  vi.stubEnv("NEXT_PUBLIC_DOMINIO_PLATAFORMA", VIEJO);
  const res = await abrir(VIEJO, "/g/sinhost/hacete-socio");
  expect(res.status).toBe(200);
  expect(res.headers.get("location")).toBeNull();
});

test("www.templegymsalta.com va a templegymsalta.com (308); un www de un dominio que no es de nadie da 404", async () => {
  for (const r of RUTAS) {
    const res = await abrir(`www.${PROPIO}`, `${nueva(r)}?o=wa`);
    expect(res.status, r).toBe(308);
    expect(res.headers.get("location")).toBe(`https://${PROPIO}${nueva(r)}?o=wa`);
  }
  const nada = await abrir("www.nadie.com", "/hacete-socio");
  expect(nada.status).toBe(404);
});

test("D2: Temple Gym se abre desde su dominio propio y desde su subdominio, siempre con ESE gimnasio", async () => {
  for (const host of [PROPIO, SUBDOMINIO]) {
    const res = await abrir(host, "/ingresar");
    expect(res.status, host).toBe(200);
    expect(res.headers.get("x-middleware-request-x-gimnasio-slug"), host).toBe("templegym1");
    expect(res.headers.get("x-middleware-request-x-gimnasio-id"), host).toBe("id-temple");
  }
  // Los gimnasios no se mezclan: el subdominio de otro gimnasio es de ese gimnasio.
  const otro = await abrir("otrogim.pasegym.com", "/ingresar");
  expect(otro.headers.get("x-middleware-request-x-gimnasio-slug")).toBe("otrogim");
});

test("D2: la plataforma (pasegym.com) no elige gimnasio por su cuenta: /ingresar y /super son de la plataforma", async () => {
  for (const ruta of ["/ingresar", "/super"]) {
    const res = await abrir(PLATAFORMA, ruta);
    expect(res.status, ruta).toBe(200);
    expect(res.headers.get("x-middleware-request-x-gymos-contexto"), ruta).toBe("plataforma");
    expect(res.headers.get("x-middleware-request-x-gimnasio-slug"), ruta).toBeNull();
  }
});

test("nadie puede elegir su gimnasio mandando un encabezado: el proxy lo borra", async () => {
  const res = await abrir(PROPIO, "/ingresar", { "x-gimnasio-slug": "otrogim", "x-gimnasio-id": "id-otro", "x-gymos-contexto": "plataforma" });
  expect(res.headers.get("x-middleware-request-x-gimnasio-slug")).toBe("templegym1");
  expect(res.headers.get("x-middleware-request-x-gimnasio-id")).toBe("id-temple");
});
