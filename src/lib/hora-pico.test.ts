import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// D4: no se aplican migraciones entre las 16 y las 22 h de Argentina salvo urgente. Se corre el script de verdad con una hora falsa.
const raiz = join(__dirname, "..", "..");
const correr = (hora: string, urgente = "") =>
  spawnSync("bash", ["scripts/base/hora-pico.sh"], { cwd: raiz, encoding: "utf8", env: { ...process.env, HORA_FALSA: hora, URGENTE: urgente } });

test("fuera de 16 a 22 h se puede aplicar (15:59 y 22:00 en punto)", () => {
  for (const h of ["00", "08", "15", "22", "23"]) expect(correr(h).status, `hora ${h}`).toBe(0);
});

test("de 16 a 21:59 no se aplica, y el mensaje explica por qué y cómo seguir si es urgente", () => {
  for (const h of ["16", "17", "19", "21"]) {
    const r = correr(h);
    expect(r.status, `hora ${h}`).toBe(1);
    expect(r.stdout).toContain("Son las");
    expect(r.stdout).toContain("URGENTE");
  }
});

test("con urgente = URGENTE pasa en hora pico (con aviso); cualquier otra cosa no", () => {
  expect(correr("19", "URGENTE").status).toBe(0);
  expect(correr("19", "urgente").status).toBe(1);
  expect(correr("19", "si").status).toBe(1);
});

test("la hora que cuenta es la de Argentina: sin HORA_FALSA el script usa America/Argentina/Buenos_Aires", () => {
  expect(readFileSync(join(raiz, "scripts", "base", "hora-pico.sh"), "utf8")).toContain("TZ=America/Argentina/Buenos_Aires");
});

test("el workflow de la base corre el guardia antes de copiar y aplicar, y tiene el campo urgente", () => {
  const yml = readFileSync(join(raiz, ".github", "workflows", "base-de-datos.yml"), "utf8");
  expect(yml).toMatch(/urgente:\s*\n\s+description:/);
  const guardia = yml.indexOf("scripts/base/hora-pico.sh");
  expect(guardia).toBeGreaterThan(0);
  expect(guardia).toBeLessThan(yml.indexOf("Copia cifrada ANTES de aplicar"));
  expect(guardia).toBeLessThan(yml.indexOf("node scripts/db/aplicar.mjs"));
  expect(yml.slice(yml.lastIndexOf("- name:", guardia), guardia)).toContain("inputs.accion == 'aplicar'");
});
