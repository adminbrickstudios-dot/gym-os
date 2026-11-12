import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// N0 y H4: los workflows nuevos corren en un repo público. Estas pruebas leen los archivos y fallan si el ensayo
// llega a tocar producción o si el recorrido de Temple Gym deja de ser de solo lectura.
const raiz = join(__dirname, "..", "..");
const leer = (f: string) => readFileSync(join(raiz, ".github", "workflows", f), "utf8");
const sinComentarios = (t: string) => t.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");

describe("workflow del ensayo (N0)", () => {
  const yml = leer("ensayo.yml");
  const codigo = sinComentarios(yml);
  it("es manual y nunca corre solo", () => {
    expect(yml).toContain("workflow_dispatch:");
    expect(codigo).not.toMatch(/\n\s*(push|schedule|pull_request):/);
  });
  it("aplica a SUPABASE_ENSAYO_DB_URL y nunca usa la de producción como destino", () => {
    expect(codigo).toContain("SUPABASE_ENSAYO_DB_URL");
    const usosProduccion = codigo.split("\n").filter((l) => l.includes("secrets.SUPABASE_DB_URL"));
    // Solo se usa para compararla (que el ensayo no sea producción), nunca para aplicar.
    expect(usosProduccion.every((l) => /PRODUCCION: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/.test(l))).toBe(true);
    expect(codigo).toMatch(/aplicar\.mjs --url "\$SUPABASE_ENSAYO_DB_URL"/);
  });
  it("si falta el secreto, falla con los pasos", () => {
    expect(codigo).toMatch(/SUPABASE_ENSAYO_DB_URL == ''/);
    expect(codigo).toContain("exit 1");
  });
});

describe("workflow botones Temple (H4)", () => {
  const yml = leer("botones-temple.yml");
  const codigo = sinComentarios(yml);
  it("es manual y el recorrido va en modo mirar sobre el clon", () => {
    expect(yml).toContain("workflow_dispatch:");
    expect(codigo).not.toMatch(/\n\s*(schedule|pull_request):/);
    // El push (mientras el archivo no esté en main) solo corre con la marca en el mensaje del commit.
    expect(codigo).toContain("contains(github.event.head_commit.message, '[botones-temple]')");
    expect(codigo).toMatch(/botones\.mjs --slug "\$SLUG_CLON" --mirar/);
  });
  it("la base de producción solo entra como origen del clon, nunca como destino", () => {
    const lineas = codigo.split("\n").filter((l) => l.includes("SUPABASE_DB_URL"));
    expect(lineas.length).toBeGreaterThan(0);
    expect(codigo).not.toMatch(/aplicar\.mjs/);
    expect(codigo).toMatch(/--origen "\$URL_ORIGEN" --destino "\$DESTINO"/);
  });
  it("prueba que no se escribió plata ni socios", () => {
    expect(codigo).toContain("conteo-antes.txt");
    expect(codigo).toContain("conteo-despues.txt");
  });
});
