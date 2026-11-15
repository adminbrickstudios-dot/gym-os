import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Pase 1.0: en la página del gimnasio el botón y los textos dicen "Probá una clase", en todos lados, nunca "Probá gratis". */
function archivos(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) acc.push(p);
  }
  return acc;
}

describe("la página del gimnasio dice “Probá una clase”", () => {
  it("ningún texto de la página, de sus valores por defecto ni del editor dice “Probá gratis” o “Probá una clase gratis”", () => {
    const donde = [...archivos("src/components/landing"), "src/lib/landing-defaults.ts", "src/app/panel/pagina/Editor.tsx", "src/app/hacete-socio/page.tsx"];
    const malos = donde.filter((f) => /Prob[aá] (una clase )?gratis/i.test(readFileSync(f, "utf8")));
    expect(malos).toEqual([]);
  });
  it("la portada tiene el botón “Probá una clase”", () => {
    expect(readFileSync("src/components/landing/Landing.tsx", "utf8")).toMatch(/>Probá una clase<\/span>/);
  });
});
