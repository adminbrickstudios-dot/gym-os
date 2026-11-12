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

test("C10: columnas de pagos pasados por nombre, sin pisar alta ni pagó hasta", () => {
  expect(adivinarColumnas(["Nombre", "Fecha de alta", "Fecha de pago 1", "Monto 1", "Medio de pago 1", "Fecha de pago 2", "Monto 2", "Medio de pago 2", "Plan"]))
    .toEqual(["nombre", "alta", "pago1_fecha", "pago1_monto", "pago1_medio", "pago2_fecha", "pago2_monto", "pago2_medio", "plan"]);
  // Un solo pago, sin número: es el pago 1.
  expect(adivinarColumnas(["Nombre", "Plan", "Fecha de pago", "Importe", "Forma de pago"])).toEqual(["nombre", "plan", "pago1_fecha", "pago1_monto", "pago1_medio"]);
});

test("C10: armarFilas junta cada grupo de pago en una lista y no deja las columnas sueltas", () => {
  const mapa = adivinarColumnas(["Nombre", "Plan", "Fecha de pago 1", "Monto 1", "Medio 1", "Fecha de pago 2", "Monto 2", "Medio 2"]);
  const filas = armarFilas([
    ["Ana", "Plan Full", new Date(Date.UTC(2026, 9, 1)), 25000, "Efectivo", "", "", ""],
    ["Beto", "Plan Full", "", "", "", "", "", ""],
    ["Cami", "Plan Full", "05/10/2026", "", "", "", 25000, "Transferencia"],
  ], mapa);
  expect(filas).toEqual([
    { nombre: "Ana", plan: "Plan Full", pagos: [{ fecha: "2026-10-01", monto: "25000", medio: "Efectivo" }] },
    { nombre: "Beto", plan: "Plan Full" },
    { nombre: "Cami", plan: "Plan Full", pagos: [{ fecha: "05/10/2026", monto: "", medio: "" }, { fecha: "", monto: "25000", medio: "Transferencia" }] },
  ]);
});
