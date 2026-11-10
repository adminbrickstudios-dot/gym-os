import { describe, expect, it } from "vitest";
import { crearUrls, esquemaDe, ruta } from "./urls";

const conDominio = crearUrls({ base: "base.ar", plataforma: "app.base.ar" });
const sinDominio = crearUrls({ base: "gym-os-pied.vercel.app", plataforma: "gym-os-pied.vercel.app" });
const local = crearUrls({ base: "localhost", plataforma: "localhost" });

describe("direcciones de la plataforma", () => {
  it("con dominio comprado: cada gimnasio en su subdominio, la plataforma en app.", () => {
    expect(conDominio.urlPlataforma("/ingresar")).toBe("https://app.base.ar/ingresar");
    expect(conDominio.urlPlataforma()).toBe("https://app.base.ar");
    expect(conDominio.urlGimnasio("olympo")).toBe("https://olympo.base.ar");
    expect(conDominio.urlGimnasio("olympo", "/hacete-socio")).toBe("https://olympo.base.ar/hacete-socio");
    expect(conDominio.hostGimnasio("Olympo")).toBe("olympo.base.ar");
    expect(conDominio.urlPanel("olympo", "dueno")).toBe("https://olympo.base.ar/dueno");
    expect(conDominio.urlPanel("olympo")).toBe("https://olympo.base.ar/panel");
    expect(conDominio.urlIngreso({ slug: "olympo", modo: "socio" })).toBe("https://olympo.base.ar/ingresar?modo=socio");
    expect(conDominio.urlIngreso({ rol: "recepcion" })).toBe("https://app.base.ar/ingresar?rol=recepcion");
    expect(conDominio.urlIngreso()).toBe("https://app.base.ar/ingresar");
  });
  it("sin dominio (vercel.app no tiene comodín): todo cae en la plataforma como /g/<slug>", () => {
    expect(sinDominio.conSubdominios).toBe(false);
    expect(sinDominio.urlGimnasio("olympo")).toBe("https://gym-os-pied.vercel.app/g/olympo");
    expect(sinDominio.urlGimnasio("olympo", "/app")).toBe("https://gym-os-pied.vercel.app/g/olympo/app");
    expect(sinDominio.urlPanel("olympo", "dueno")).toBe("https://gym-os-pied.vercel.app/ingresar");
    expect(sinDominio.urlIngreso({ slug: "olympo" })).toBe("https://gym-os-pied.vercel.app/g/olympo/ingresar");
  });
  it("en la compu, http", () => {
    expect(esquemaDe("localhost")).toBe("http");
    expect(esquemaDe("demo.localhost")).toBe("http");
    expect(esquemaDe("127.0.0.1")).toBe("http");
    expect(esquemaDe("base.ar")).toBe("https");
    expect(local.urlGimnasio("demo")).toBe("http://demo.localhost");
  });
  it("el dominio propio de un gimnasio se arma desde el host que ya se conoce", () => {
    expect(conDominio.urlDeHost("https://WWW.Olympo.com.ar/", "/dueno")).toBe("https://www.olympo.com.ar/dueno");
    expect(conDominio.urlDeHost("", "/x")).toBe("/x");
  });
  it("sin ninguna variable cargada devuelve rutas relativas, nunca una dirección inventada", () => {
    const vacio = crearUrls({ base: "", plataforma: "" });
    expect(vacio.urlPlataforma("/ingresar")).toBe("/ingresar");
    expect(vacio.urlGimnasio("olympo")).toBe("/g/olympo");
  });
  it("un slug raro no rompe el link ni se cuela una barra", () => {
    expect(conDominio.urlGimnasio("a/b?x")).toBe("https://a%2Fb%3Fx.base.ar");
    expect(ruta("//panel///socios")).toBe("/panel/socios");
    expect(ruta("")).toBe("/");
  });
  it("la ruta interna de la plataforma para ver la web de un gimnasio", () => {
    expect(conDominio.rutaGimnasio("olympo")).toBe("/g/olympo");
    expect(conDominio.rutaGimnasio("olympo", "/app")).toBe("/g/olympo/app");
  });
});
