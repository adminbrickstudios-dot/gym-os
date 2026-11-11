import { expect, test } from "vitest";
import { clasificarHost, normalizarHost } from "./host";

const BASE = "gymos.com.ar";
const PLAT = "app.gymos.com.ar";

test("normaliza mayúsculas, puerto y punto final", () => {
  expect(normalizarHost("Olympo.GymOS.com.ar:3000")).toBe("olympo.gymos.com.ar");
  expect(normalizarHost("olympo.gymos.com.ar.")).toBe("olympo.gymos.com.ar");
  expect(normalizarHost(null)).toBe("");
});

test("la plataforma, el dominio raíz y www son la plataforma", () => {
  expect(clasificarHost("app.gymos.com.ar", BASE, PLAT)).toEqual({ tipo: "plataforma" });
  expect(clasificarHost("gymos.com.ar", BASE, PLAT)).toEqual({ tipo: "plataforma" });
  expect(clasificarHost("www.gymos.com.ar", BASE, PLAT)).toEqual({ tipo: "plataforma" });
});

test("subdominio y dominio propio son gimnasios, por host exacto", () => {
  expect(clasificarHost("olympo.gymos.com.ar", BASE, PLAT)).toEqual({ tipo: "gimnasio", host: "olympo.gymos.com.ar" });
  expect(clasificarHost("olympogym.com.ar", BASE, PLAT)).toEqual({ tipo: "gimnasio", host: "olympogym.com.ar" });
});

test("desarrollo local: demo.localhost es un gimnasio", () => {
  expect(clasificarHost("demo.localhost:3000", "localhost", "localhost")).toEqual({ tipo: "gimnasio", host: "demo.localhost" });
  expect(clasificarHost("localhost:3000", "localhost", "localhost")).toEqual({ tipo: "plataforma" });
});

test("las variables de dominio aceptan protocolo y barra final (como se suelen pegar en Vercel)", () => {
  expect(normalizarHost("https://gym-os-pied.vercel.app/")).toBe("gym-os-pied.vercel.app");
  expect(clasificarHost("gym-os-pied.vercel.app", "https://gym-os-pied.vercel.app/", " gym-os-pied.vercel.app ")).toEqual({ tipo: "plataforma" });
});

test("U5: con el dominio nuevo, la raíz es la plataforma, gimnasio.dominio es el gimnasio y un dominio propio sigue andando", () => {
  // En desarrollo: base.localhost (plataforma), gim.base.localhost (gimnasio) y un dominio propio.
  expect(clasificarHost("base.localhost:3123", "base.localhost", "base.localhost")).toEqual({ tipo: "plataforma" });
  expect(clasificarHost("www.base.localhost:3123", "base.localhost", "base.localhost")).toEqual({ tipo: "plataforma" });
  expect(clasificarHost("gim.base.localhost:3123", "base.localhost", "base.localhost")).toEqual({ tipo: "gimnasio", host: "gim.base.localhost" });
  expect(clasificarHost("migimnasio.com.ar", "base.localhost", "base.localhost")).toEqual({ tipo: "gimnasio", host: "migimnasio.com.ar" });
  // En producción con dominio propio de Base (sin vercel.app por ningún lado).
  expect(clasificarHost("midominio.com", "midominio.com", "midominio.com")).toEqual({ tipo: "plataforma" });
  expect(clasificarHost("gim.midominio.com", "midominio.com", "midominio.com")).toEqual({ tipo: "gimnasio", host: "gim.midominio.com" });
});
