// E5: ningún pedido periódico del panel va más seguido que cada 30 s (con 20 gimnasios y 2 o 3 compus por gimnasio, cada pedido cuenta).
// Lo que sí corre más seguido está en la lista, con su motivo: relojes de pantalla que no piden nada, o pedidos que corren SOLO sin internet o con base local.
import { expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAICES = ["src/components/panel", "src/components/ui", "src/app/panel"];
/** archivo → motivo por el que puede ir más seguido. */
const EXCEPCIONES: Record<string, string> = {
  "src/app/panel/pin/CierreInactividad.tsx": "reloj local de inactividad: no pide nada a la red",
  "src/components/panel/AvisosEntrada.tsx": "tiempos de animación del aviso (1,5 s y 8 s): no piden nada",
  "src/components/panel/entradas-vivo.ts": "el oído de la puerta: con Realtime no hay pedidos periódicos; el 4 s es SOLO contra una base local (sin Realtime) y lo dice su estado",
  "src/components/panel/entrada/conexion.tsx": "mientras no hay internet, cada 4 s mira si volvió: corre solo en ese estado",
  "src/app/panel/entrada/SinInternet.tsx": "la prueba de conexión cada 20 s corre solo cuando está prendida la entrada sin internet y no hay red",
  "src/components/panel/entrada/Barrita.tsx": "pausas de tipeo de la barrita (ms), no pedidos periódicos",
  "src/app/panel/entrada/lector.ts": "tiempos entre teclas del lector USB, no pedidos periódicos",
};
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [r] : [];
  });
}

test("ningún setInterval del panel pide algo más seguido que cada 30 s (salvo la lista con motivo)", () => {
  const malos: string[] = [];
  for (const f of RAICES.flatMap(archivos)) {
    const norm = f.replaceAll("\\", "/");
    const t = readFileSync(f, "utf8");
    if (!/setInterval\(/.test(t) || EXCEPCIONES[norm]) continue;
    // Constantes de tiempo del archivo (CADA_*_MS = 20_000) y literales de setInterval(…, 20000).
    const ms = [...t.matchAll(/(?:CADA\w*_MS|\w*REINTENTO\w*)\s*=\s*([\d_]+(?:\s*\*\s*[\d_]+)*)/g)].map((m) => Function(`return ${m[1].replace(/_/g, "")}`)() as number);
    for (const m of t.matchAll(/setInterval\([^;]*?,\s*([\d_]+(?:\s*\*\s*[\d_]+)*)\)/g)) ms.push(Function(`return ${m[1].replace(/_/g, "")}`)() as number);
    if (ms.some((x) => x < 30_000)) malos.push(`${norm}: ${ms.filter((x) => x < 30_000).join(", ")} ms`);
  }
  expect(malos, "pedidos periódicos de menos de 30 s en el panel (si no piden nada a la red, anotalo en EXCEPCIONES con su motivo)").toEqual([]);
});
