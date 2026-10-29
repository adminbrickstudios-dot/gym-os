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
