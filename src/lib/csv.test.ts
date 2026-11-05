import { expect, test } from "vitest";
import { aCsv } from "./csv";

test("punto y coma, BOM, comillas y sin fórmulas inyectadas", () => {
  const c = aCsv(["Nombre", "Notas"], [["Pérez; Ana", 'dijo "hola"'], ["=HYPERLINK(1)", null], ["+5493875551234", 3]]);
  expect(c).toBe('﻿Nombre;Notas\r\n"Pérez; Ana";"dijo ""hola"""\r\n"\'=HYPERLINK(1)";\r\n"+5493875551234";3\r\n');
});
