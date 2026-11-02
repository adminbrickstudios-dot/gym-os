import { expect, test } from "vitest";
import { precioUnitario, totalCarrito, type Linea } from "./tipos";

const cuota: Linea = { clave: "c", tipo: "cuota", nombre: "Cuota", cantidad: 2, precios: { lista: 25000, efectivo: 22000, transferencia: null, debito: null, credito: 27000 } };
const agua: Linea = { clave: "a", tipo: "producto", nombre: "Agua", cantidad: 3, precio_fijo: 1500 };

test("con un solo medio rige su precio; si el medio no tiene precio propio, el de lista", () => {
  expect(precioUnitario(cuota, "efectivo")).toBe(22000);
  expect(precioUnitario(cuota, "transferencia")).toBe(25000);
  expect(precioUnitario(cuota, "credito")).toBe(27000);
});

test("con pago mixto rige el de lista, como en vender()", () => {
  expect(precioUnitario(cuota, null)).toBe(25000);
  expect(totalCarrito([cuota, agua], null)).toBe(54500);
});

test("el descuento se resta de la línea", () => {
  expect(totalCarrito([{ ...agua, descuento: 1500 }], "efectivo")).toBe(3000);
});

test("una línea sin precio deja el total sin calcular (no se cobra cero)", () => {
  expect(totalCarrito([{ ...cuota, precios: { lista: null, efectivo: null, transferencia: null, debito: null, credito: null } }], "efectivo")).toBeNull();
});
