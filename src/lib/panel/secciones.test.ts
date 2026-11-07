import { expect, test } from "vitest";
import { accesosElegidos, principalesCelular, seccionesPara } from "./secciones";

test("el profe ve clases, tareas y rutinas; la recepción ve retención (D2) pero no configuración ni rutinas", () => {
  expect(seccionesPara("profe", []).map((s) => s.clave)).toEqual(["tareas", "fichar", "clases", "incidentes", "maquinas", "rutinas", "pt"]);   // VD-11: Para hacer hoy va antes de Clases; VD-46I: Incidentes lo anota todo el equipo; VD-54: Máquinas también; VD-58: el PT ve su agenda
  expect(seccionesPara("profe", ["rutinas"]).map((s) => s.clave)).toEqual(["tareas", "fichar", "clases", "incidentes", "maquinas", "pt"]);
  const rec = seccionesPara("recepcion", []).map((s) => s.clave);
  expect(rec).toContain("retencion");
  expect(rec).not.toContain("configuracion");
  expect(rec).not.toContain("rutinas");
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

test("EQU-1: el Resultado mandado apagado para el encargado no aparece en su menú ni en sus accesos", () => {
  expect(seccionesPara("encargado", ["resultado"]).map((s) => s.clave)).not.toContain("resultado");
  expect(seccionesPara("encargado", []).map((s) => s.clave)).toContain("resultado");
});
