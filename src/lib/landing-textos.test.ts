import { expect, test } from "vitest";
import { condicionesPlan, iniciales, linkWhatsapp, textoSobre, unidadPlan, variantesPlan } from "./landing-textos";

test("link de WhatsApp con el mensaje codificado", () => {
  expect(linkWhatsapp("+54 9 000 111-222", "Hola! Quiero info")).toBe("https://wa.me/549000111222?text=Hola!%20Quiero%20info");
  expect(linkWhatsapp(null, "x")).toBeNull();
  expect(linkWhatsapp("123", "x")).toBeNull();
});

test("unidad del plan", () => {
  expect(unidadPlan({ nombre: "a", tipo: "membresia", descripcion: null, duracion_meses: 1 })).toBe("por mes");
  expect(unidadPlan({ nombre: "a", tipo: "membresia", descripcion: null, duracion_meses: 3 })).toBe("por 3 meses");
  expect(unidadPlan({ nombre: "a", tipo: "pase_diario", descripcion: null })).toBe("por día");
  expect(unidadPlan({ nombre: "a", tipo: "pack", descripcion: null, cantidad_clases: 10 })).toBe("10 clases");
});

test("condiciones del plan", () => {
  expect(condicionesPlan({ nombre: "a", tipo: "membresia", descripcion: null, hora_desde: "07:00", hora_hasta: "12:00", max_ingresos_semana: 3 }))
    .toEqual(["De 7:00 a 12:00", "3 veces por semana"]);
});

test("variantes: solo las más baratas que la lista, en castellano", () => {
  expect(variantesPlan({
    nombre: "a", tipo: "membresia", descripcion: null, precio: "25000.00",
    variantes: [
      { monto: "22000.00", medio_pago: "efectivo", pago_hasta_dia: null },
      { monto: "20000", medio_pago: "efectivo", pago_hasta_dia: 10 },
      { monto: "27000", medio_pago: "credito", pago_hasta_dia: null },
    ],
  })).toEqual(["$22.000 pagando en efectivo", "$20.000 pagando en efectivo hasta el día 10"]);
});

test("iniciales", () => {
  expect(iniciales("Profe Demo Uno")).toBe("PD");
  expect(iniciales("  caro ")).toBe("C");
});

test("texto legible sobre el color de la marca", () => {
  expect(textoSobre("#16a34a")).toBe("#ffffff");
  expect(textoSobre("#7c3aed")).toBe("#ffffff");
  expect(textoSobre("#facc15")).toBe("#1c1917");
  expect(textoSobre("rojo")).toBe("#ffffff");
});
