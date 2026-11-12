import { expect, test } from "vitest";
import { rutaSitioCacheable } from "./sitio-publico";

const base = { host: "demo.localhost", ruta: "/", metodo: "GET", cookies: [] as string[], busqueda: "" };

test("la landing y las páginas públicas, sin cookies, van a su ruta cacheada", () => {
  expect(rutaSitioCacheable(base)).toBe("/sitio/demo.localhost");
  expect(rutaSitioCacheable({ ...base, ruta: "/hacete-socio" })).toBe("/sitio/demo.localhost/hacete-socio");
  expect(rutaSitioCacheable({ ...base, ruta: "/hacete-socio/" })).toBe("/sitio/demo.localhost/hacete-socio");
  expect(rutaSitioCacheable({ ...base, ruta: "/terminos" })).toBe("/sitio/demo.localhost/terminos");
});

test("con sesión, con gimnasio elegido, con ?ref= o con un POST, nada se cachea", () => {
  expect(rutaSitioCacheable({ ...base, cookies: ["sb-abc-auth-token"] })).toBeNull();
  expect(rutaSitioCacheable({ ...base, cookies: ["gymos_gimnasio"] })).toBeNull();
  expect(rutaSitioCacheable({ ...base, busqueda: "?ref=ABC" })).toBeNull();
  expect(rutaSitioCacheable({ ...base, metodo: "POST" })).toBeNull();
});

test("el panel, la app, el ingreso y los hosts raros no se tocan", () => {
  for (const ruta of ["/panel", "/app", "/ingresar", "/admin", "/api/salud"]) expect(rutaSitioCacheable({ ...base, ruta })).toBeNull();
  expect(rutaSitioCacheable({ ...base, host: "../etc" })).toBeNull();
});
