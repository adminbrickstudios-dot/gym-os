import { expect, test } from "vitest";
import { accionDeGimnasio, direccionPropia, esDelGimnasioConSesion, leerRutaGimnasio, usaGimnasioElegido } from "./proxy-rutas";

test("lee /g/<slug> con y sin resto, con barra final", () => {
  expect(leerRutaGimnasio("/g/templegym1")).toEqual({ tipo: "gimnasio", slug: "templegym1", resto: null });
  expect(leerRutaGimnasio("/g/templegym1/")).toEqual({ tipo: "gimnasio", slug: "templegym1", resto: null });
  expect(leerRutaGimnasio("/g/templegym1/hacete-socio")).toEqual({ tipo: "gimnasio", slug: "templegym1", resto: "/hacete-socio" });
  expect(leerRutaGimnasio("/g/templegym1/hacete-socio/")).toEqual({ tipo: "gimnasio", slug: "templegym1", resto: "/hacete-socio" });
  expect(leerRutaGimnasio("/hacete-socio")).toEqual({ tipo: "ninguna" });
  expect(leerRutaGimnasio("/g/")).toEqual({ tipo: "ninguna" });
  expect(leerRutaGimnasio("/g/MAYUS/x")).toEqual({ tipo: "ninguna" });
});

test("el alta, la privacidad y el ingreso se quedan en la dirección del gimnasio", () => {
  expect(accionDeGimnasio("/hacete-socio")).toEqual({ accion: "publica", ruta: "/hacete-socio" });
  expect(accionDeGimnasio("/privacidad")).toEqual({ accion: "publica", ruta: "/privacidad" });
  expect(accionDeGimnasio("/terminos")).toEqual({ accion: "publica", ruta: "/terminos" });
  expect(usaGimnasioElegido("/terminos", null)).toBe(true);
  expect(accionDeGimnasio("/ingresar")).toEqual({ accion: "publica", ruta: "/ingresar" });
  expect(accionDeGimnasio(null)).toEqual({ accion: "raiz" });
  expect(accionDeGimnasio("/panel/socios")).toEqual({ accion: "redirigir", ruta: "/panel/socios" });
});

test("con gimnasio elegido: alta, privacidad e ingreso del socio; el ingreso del equipo no", () => {
  expect(usaGimnasioElegido("/hacete-socio", null)).toBe(true);
  expect(usaGimnasioElegido("/privacidad", null)).toBe(true);
  expect(usaGimnasioElegido("/ingresar", "socio")).toBe(true);
  expect(usaGimnasioElegido("/ingresar", null)).toBe(false);
  expect(usaGimnasioElegido("/", null)).toBe(false);
  expect(esDelGimnasioConSesion("/app")).toBe(true);
  expect(esDelGimnasioConSesion("/panel/caja")).toBe(true);
  expect(esDelGimnasioConSesion("/auth/google")).toBe(true);
  expect(esDelGimnasioConSesion("/hacete-socio")).toBe(false);
});

test("la dirección /g/<slug> manda a la propia solo si esa anda", () => {
  const vercel = { base: "gym-os-pied.vercel.app", plataforma: "gym-os-pied.vercel.app" };
  // Hoy: sin dominio con comodín, /g/<slug>/... es la dirección buena aunque el gimnasio tenga un subdominio cargado.
  expect(direccionPropia("templegym1.gym-os-pied.vercel.app", vercel)).toBeNull();
  expect(direccionPropia("gym-os-pied.vercel.app", vercel)).toBeNull();
  expect(direccionPropia(null, vercel)).toBeNull();
  // Dominio propio del gimnasio: la vieja dirección redirige a la nueva.
  expect(direccionPropia("templegym.com.ar", vercel)).toBe("templegym.com.ar");
  // Dominio base con comodín: el subdominio anda.
  const real = { base: "base.ar", plataforma: "app.base.ar" };
  expect(direccionPropia("templegym1.base.ar", real)).toBe("templegym1.base.ar");
  expect(direccionPropia("app.base.ar", real)).toBeNull();
  // En la compu: nunca.
  expect(direccionPropia("demo.localhost", { base: "localhost", plataforma: "localhost" })).toBeNull();
});
