import { expect, test } from "vitest";
import { accesosElegidos, principalesCelular, seccionesPara } from "./secciones";

test("el profe solo ve clases; la recepción ve retención (D2) pero no configuración", () => {
  expect(seccionesPara("profe", []).map((s) => s.clave)).toEqual(["clases"]);
  const rec = seccionesPara("recepcion", []).map((s) => s.clave);
  expect(rec).toContain("retencion");
  expect(rec).not.toContain("configuracion");
  expect(rec).toContain("entrada");
});

test("una sección apagada por el gimnasio desaparece del menú y de los accesos", () => {
  expect(seccionesPara("dueno", ["clases"]).map((s) => s.clave)).not.toContain("clases");
  expect(accesosElegidos("recepcion", ["clases"], null).elegidos.map((a) => a.clave)).not.toContain("clases");
});

test("accesos guardados que ya no existen se informan, no desaparecen en silencio", () => {
  const r = accesosElegidos("recepcion", [], ["entrada", "planes", "inventado"]);
  expect(r.elegidos.map((a) => a.clave)).toEqual(["entrada"]);
  expect(r.perdidos).toEqual(["planes", "inventado"]);
});

test("en el celular hay cuatro principales, Inicio primero", () => {
  const p = principalesCelular("dueno", []);
  expect(p).toHaveLength(4);
  expect(p[0].clave).toBe("inicio");
});
