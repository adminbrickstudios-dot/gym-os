import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// C8: el workflow de copias corre en un repo PÚBLICO, con logs públicos. Estas pruebas leen el
// archivo y fallan si alguien le suma una línea que imprima un secreto o que guarde la copia
// sin vencimiento.
const raiz = join(__dirname, "..", "..");
const yml = readFileSync(join(raiz, ".github", "workflows", "copias.yml"), "utf8");
const lineas = yml.split("\n");
const sinComentarios = lineas.filter((l) => !l.trim().startsWith("#"));

describe("workflow de copias (C8)", () => {
  it("corre todos los días y a mano", () => {
    expect(yml).toMatch(/schedule:\s*\n\s*- cron:/);
    expect(yml).toContain("workflow_dispatch:");
  });

  it("guarda el artefacto con retention-days: 30 y falla si no hay archivo", () => {
    const usos = sinComentarios.filter((l) => l.includes("actions/upload-artifact"));
    expect(usos.length).toBeGreaterThan(0);
    const retenciones = sinComentarios.filter((l) => /^\s*retention-days:/.test(l));
    expect(retenciones.length).toBe(usos.length);
    for (const r of retenciones) expect(Number(r.split(":")[1])).toBe(30);
    expect(yml).toContain("if-no-files-found: error");
    // Solo sube el archivo cifrado, nunca el esquema o los datos sueltos.
    expect(yml).toMatch(/path:\s*copias-salida\/\*\.tar\.gz\.enc/);
  });

  it("los secretos solo entran por env: nunca dentro de un comando", () => {
    const conSecreto = sinComentarios.filter((l) => l.includes("secrets."));
    expect(conSecreto.length).toBeGreaterThan(0);
    for (const l of conSecreto) {
      // Toda mención a secrets.X es la asignación de una variable de entorno ("NOMBRE: ${{ secrets.X }}").
      expect(l).toMatch(/^\s+[A-Z_]+:\s*\$\{\{\s*secrets\.[A-Z_]+\s*\}\}\s*$/);
    }
  });

  it("esconde del log cada secreto con ::add-mask::", () => {
    for (const s of ["SUPABASE_DB_URL", "COPIA_CLAVE"]) {
      expect(yml).toContain(`echo "::add-mask::$${s}"`);
    }
  });

  it("no imprime variables secretas ni activa el modo que repite cada comando", () => {
    for (const l of sinComentarios) {
      if (/^\s*echo\b/.test(l) && !l.includes("::add-mask::")) {
        expect(l).not.toMatch(/\$\{?(SUPABASE_DB_URL|COPIA_CLAVE|ORIGEN_URL)\b/);
      }
      expect(l).not.toMatch(/\bset\s+-[a-z]*x/); // set -x muestra los valores expandidos
      expect(l).not.toMatch(/\benv\s*$|\bprintenv\b/);
      expect(l).not.toMatch(/ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/);
    }
  });

  it("nunca sube la copia al repo", () => {
    for (const l of sinComentarios) {
      expect(l).not.toMatch(/\bgit\s+(add|commit|push)\b/);
    }
    expect(yml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  it("falla con un mensaje claro si falta COPIA_CLAVE", () => {
    expect(yml).toMatch(/::error::Falta el secreto COPIA_CLAVE/);
  });

  it("restaura en una base de prueba (servicio del runner) y verifica", () => {
    expect(yml).toContain("restaurar-prueba:");
    expect(yml).toContain("image: postgres:");
    expect(yml).toContain("scripts/db/restaurar-copia.sh");
    expect(yml).toContain("scripts/chequeos.mjs");
  });
});

describe("scripts de copia (C8)", () => {
  const copia = readFileSync(join(raiz, "scripts", "db", "copia.mjs"), "utf8");
  const restaurar = readFileSync(join(raiz, "scripts", "db", "restaurar-copia.sh"), "utf8");

  it("cifran con AES-256 + pbkdf2 y la clave sale de una variable de entorno, nunca de la línea de comandos", () => {
    expect(copia).toContain("aes-256-cbc");
    expect(copia).toContain("pbkdf2");
    expect(copia).toContain("env:COPIA_CLAVE");
    expect(restaurar).toContain("env:COPIA_CLAVE");
    expect(copia + restaurar).not.toMatch(/-pass\s+pass:/);
    expect(copia + restaurar).not.toMatch(/-k\s/);
  });

  it("el exportador solo lee: pg_dump y selects", () => {
    expect(copia).not.toMatch(/\b(insert into|update public|delete from|truncate|drop table|drop schema)\b/i);
  });

  it("restaurar se niega a tocar una base de Supabase", () => {
    expect(restaurar).toMatch(/supabase\.co/);
    expect(restaurar).toMatch(/no está vacía/);
  });

  it("los conteos que se imprimen son solo números, sin nombres de gimnasio", () => {
    expect(copia).toMatch(/gimnasio \$\{i \+ 1\}/);
    expect(copia).not.toMatch(/console\.log\([^)]*\.slug/);
  });
});
