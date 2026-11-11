import { expect, test } from "vitest";
import { adivinarColumnas, armarFilas, celda, leerCsv } from "./importar";

test("CSV con punto y coma, comillas y saltos de Windows", () => {
  const f = leerCsv('﻿Nombre;Apellido;DNI;Observación\r\n"Pérez, Ana";Gómez;20.111.222;"dijo ""hola"""\r\n\r\nBeto;;30111222;\r\n');
  expect(f).toEqual([["Nombre", "Apellido", "DNI", "Observación"], ["Pérez, Ana", "Gómez", "20.111.222", 'dijo "hola"'], ["Beto", "", "30111222", ""]]);
});

test("adivina columnas por el título, sin acentos y sin repetir", () => {
  expect(adivinarColumnas(["Nombre y apellido", "Documento", "Celular", "E-mail", "Fecha nac.", "Plan", "Vencimiento", "Notas"]))
    .toEqual(["nombre", "dni", "telefono", "email", "nacimiento", "plan", "vence", null]);
  expect(adivinarColumnas(["Apellido", "Nombre", "Teléfono", "Teléfono 2"])).toEqual(["apellido", "nombre", "telefono", null]);
});

test("celdas: fechas del Excel a AAAA-MM-DD, números a texto; filas vacías afuera", () => {
  expect(celda(new Date(Date.UTC(2026, 10, 5)))).toBe("2026-11-05");
  expect(celda(20111222)).toBe("20111222");
  expect(armarFilas([["Ana", 1], ["", ""]], ["nombre", "dni"])).toEqual([{ nombre: "Ana", dni: "1" }]);
});

test("mapeo por nombre en otro orden, con tildes y mayúsculas: alta y pagó hasta", () => {
  expect(adivinarColumnas(["PAGÓ HASTA", "fecha de alta", "TELÉFONO", "Mail", "dni", "Plan", "Nombre del socio"]))
    .toEqual(["vence", "alta", "telefono", "email", "dni", "plan", "nombre"]);
  expect(adivinarColumnas(["Fecha de ingreso", "Fecha de nacimiento", "Cuota hasta", "Apellido", "Nombre"]))
    .toEqual(["alta", "nacimiento", "vence", "apellido", "nombre"]);
});

test("armarFilas respeta el orden de las columnas del archivo", () => {
  const mapa = adivinarColumnas(["Pagó hasta", "Alta", "DNI", "Nombre"]);
  expect(armarFilas([[new Date(Date.UTC(2026, 11, 31)), "05/01/2025", 20111222, "Ana Gómez"]], mapa))
    .toEqual([{ vence: "2026-12-31", alta: "05/01/2025", dni: "20111222", nombre: "Ana Gómez" }]);
});
