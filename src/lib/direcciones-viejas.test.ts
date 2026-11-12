// D3: las direcciones de los QR impresos y de los links ya compartidos no se rompen nunca.
// Se corre el proxy de verdad (src/proxy.ts) con un pedido por dirección y la resolución del gimnasio simulada,
// y se verifica adónde llega cada una: con o sin dominio propio, redirección 308 permanente, nunca 404 para un gimnasio que existe.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const PLATAFORMA = "gym-os-pied.vercel.app";
type Fila = { gimnasio_id: string; slug: string; host: string | null };
let filas: Record<string, Fila> = {};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DOMINIO_BASE", PLATAFORMA);
  vi.stubEnv("NEXT_PUBLIC_DOMINIO_PLATAFORMA", PLATAFORMA);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-de-prueba");
  filas = {};
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const slug = (JSON.parse(String(init.body)) as { p_slug?: string }).p_slug ?? "";
    // El slug cambia en cada caso para no chocar con la memoria de 60 s del proxy.
    return new Response(JSON.stringify(filas[slug] ? [filas[slug]] : []), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

let n = 0;
const nuevo = (host: string | null, base?: { base: string; plataforma: string }) => {
  const slug = `gim${++n}`;
  if (base) {
    vi.stubEnv("NEXT_PUBLIC_DOMINIO_BASE", base.base);
    vi.stubEnv("NEXT_PUBLIC_DOMINIO_PLATAFORMA", base.plataforma);
  }
  filas[slug] = { gimnasio_id: `id-${slug}`, slug, host };
  return slug;
};
const abrir = (hostDelPedido: string, ruta: string) =>
  proxy(new NextRequest(`https://${hostDelPedido}${ruta}`, { headers: { host: hostDelPedido } }));

// Las cuatro direcciones que están impresas en carteles y compartidas por WhatsApp.
const RUTAS = ["/hacete-socio", "/ingresar", "", "/privacidad"] as const;

test("sin dominio propio: cada dirección vieja /g/<slug>/… llega a su gimnasio, sin 404 ni redirección", async () => {
  for (const r of RUTAS) {
    const slug = nuevo(null);
    const res = await abrir(PLATAFORMA, `/g/${slug}${r}`);
    expect(res.status, `/g/<slug>${r}`).toBe(200);
    expect(res.headers.get("location"), `/g/<slug>${r}`).toBeNull();
    // Es una reescritura interna: la dirección del QR queda, y se sirve la página correcta con ese gimnasio marcado.
    expect(res.headers.get("x-middleware-rewrite"), `/g/<slug>${r}`).toContain(`https://${PLATAFORMA}${r === "" ? "/" : r}`);
    expect(res.headers.get("x-middleware-request-x-gimnasio-slug")).toBe(slug);
    expect(res.cookies.get("gymos_gimnasio")?.value ?? res.headers.get("set-cookie")).toBeTruthy();
  }
});

test("con subdominio que ya anda: 308 permanente al subdominio, con la misma ruta y los mismos parámetros", async () => {
  const entorno = { base: "base.ar", plataforma: "app.base.ar" };
  for (const r of RUTAS) {
    const slug = nuevo(null, entorno);
    filas[slug].host = `${slug}.base.ar`;
    const res = await abrir("app.base.ar", `/g/${slug}${r}?origen=qr`);
    expect(res.status, `/g/<slug>${r}`).toBe(308);
    expect(res.headers.get("location")).toBe(`https://${slug}.base.ar${r === "" ? "/" : r}?origen=qr`);
  }
});

test("con dominio propio (el de Temple Gym): 308 permanente al dominio, desde la dirección de la plataforma y desde app.", async () => {
  for (const desde of [PLATAFORMA, "app.base.ar"]) {
    for (const r of RUTAS) {
      const slug = nuevo("templegym.com.ar", desde === PLATAFORMA ? { base: PLATAFORMA, plataforma: PLATAFORMA } : { base: "base.ar", plataforma: "app.base.ar" });
      const res = await abrir(desde, `/g/${slug}${r}`);
      expect(res.status, `${desde}/g/<slug>${r}`).toBe(308);
      expect(res.headers.get("location")).toBe(`https://templegym.com.ar${r === "" ? "/" : r}`);
    }
  }
});

test("la barra final y las rutas del panel no se rompen: /g/<slug>/ llega a la landing, /g/<slug>/panel va a la plataforma", async () => {
  const slug = nuevo(null);
  const landing = await abrir(PLATAFORMA, `/g/${slug}/`);
  expect(landing.status).toBe(200);
  expect(landing.headers.get("x-middleware-rewrite")).toContain(`https://${PLATAFORMA}/`);
  const panel = await abrir(PLATAFORMA, `/g/${slug}/panel`);
  expect([307, 308]).toContain(panel.status);
  expect(panel.headers.get("location")).toBe(`https://${PLATAFORMA}/panel`);
});

test("un gimnasio que no existe no cae en silencio: 404 con la dirección escrita; si no se pudo preguntar, 503 (nunca un 404 falso)", async () => {
  const res = await abrir(PLATAFORMA, "/g/no-existe-nunca/hacete-socio");
  expect(res.status).toBe(404);
  expect(res.headers.get("x-middleware-rewrite")).toContain("/gimnasio-no-encontrado?host=");
  expect(decodeURIComponent(res.headers.get("x-middleware-rewrite") ?? "")).toContain("/g/no-existe-nunca");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("caído", { status: 500 })));
  const caido = await abrir(PLATAFORMA, "/g/otro-que-no-esta-en-memoria/ingresar");
  expect(caido.status).toBe(503);
});
