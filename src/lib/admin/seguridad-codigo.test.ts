import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// SEG-02 y SEG-07: la clave de servicio solo vive en el servidor y ninguna contraseña demo ni clave real está escrita en el código de la app.
const RAIZ = join(process.cwd(), "src");

function archivos(dir: string, salida: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, salida);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n)) salida.push(p);
  }
  return salida;
}
const TODOS = archivos(RAIZ).map((p) => ({ p: p.replace(RAIZ, "src").replace(/\\/g, "/"), t: readFileSync(p, "utf8") }));
const esCliente = (t: string) => /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(t);

describe("SEG-02 · la clave de servicio no sale del servidor", () => {
  it("ningún archivo de navegador ('use client') toca la clave de servicio ni el cliente de servicio", () => {
    const malos = TODOS.filter((a) => esCliente(a.t) && /SERVICE_ROLE|supabase\/servicio|clienteServicio/.test(a.t)).map((a) => a.p);
    expect(malos).toEqual([]);
  });
  it("la clave de servicio no está en una variable NEXT_PUBLIC_ (se mandaría al navegador)", () => {
    const malos = TODOS.filter((a) => /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(a.t)).map((a) => a.p);
    expect(malos).toEqual([]);
  });
  it("no hay claves escritas en el código (JWT de Supabase ni sb_secret_)", () => {
    const malos = TODOS.filter((a) => /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9]{10,}/.test(a.t)).map((a) => a.p);
    expect(malos).toEqual([]);
  });
});

describe("SEG-07 · ninguna contraseña demo en el código de la app", () => {
  it("la contraseña de los usuarios demo solo existe en scripts, nunca en src", () => {
    const malos = TODOS.filter((a) => /demo-gymos/.test(a.t)).map((a) => a.p);
    expect(malos).toEqual([]);
  });
});
