import { describe, expect, it, test } from "vitest";
import { aplicarCupon, armarItems, conRecargoLineas, descuentoConvenio, lineasIniciales, precioUnitario, totalCarrito, type Linea, type PreciosVenta } from "./tipos";

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

test("convenio (VEN-3): solo la cuota, por unidad, igual que la base", () => {
  const est = { nombre: "Estudiantes", tipo: "porcentaje" as const, valor: 20 };
  expect(descuentoConvenio(cuota, "efectivo", est)).toBe(8800);          // 22000 × 20% × 2
  expect(descuentoConvenio(agua, "efectivo", est)).toBe(0);
  expect(totalCarrito([cuota, agua], "efectivo", est)).toBe(44000 - 8800 + 4500);
  expect(descuentoConvenio({ ...cuota, cantidad: 1 }, "efectivo", { nombre: "Fijo", tipo: "monto", valor: 30000 })).toBe(22000);   // nunca más que la cuota
});

describe("COM-9: aplicarCupon", () => {
  const precios = { lista: 20000, efectivo: 18000, transferencia: 20000, debito: 20000, credito: 22000, mercadopago: 20000 } as unknown as Linea["precios"];
  const cuota: Linea = { clave: "c", tipo: "cuota", nombre: "Cuota Full", cantidad: 1, precios };
  const agua: Linea = { clave: "a", tipo: "producto", nombre: "Agua", cantidad: 2, precio_fijo: 1500, producto_id: "agua" };
  const pack: Linea = { clave: "p", tipo: "pack", nombre: "Pack 8", cantidad: 1, precios, plan_id: "pack8" };
  it("porcentaje en la cuota del plan del cupón, nunca en productos", () => {
    const r = aplicarCupon([cuota, agua], { cupon_id: "x", codigo: "VERANO", tipo: "porcentaje", valor: 25, planes: ["full"] }, "efectivo", "full");
    expect(r.aplicadas).toBe(1);
    expect(r.lineas[0].descuento).toBe(4500);
    expect(r.lineas[0].descuento_motivo).toBe("Cupón VERANO");
    expect(r.lineas[1].descuento).toBeUndefined();
  });
  it("monto fijo una sola vez, y no supera el precio", () => {
    const r = aplicarCupon([cuota, pack], { cupon_id: "x", codigo: "MIL", tipo: "monto", valor: 50000, planes: [] }, "transferencia", "full");
    expect(r.aplicadas).toBe(1);
    expect(r.lineas[0].descuento).toBe(20000);
    expect(r.lineas[1].descuento).toBeUndefined();
  });
  it("si el cupón es de otro plan, no aplica a nada", () => {
    expect(aplicarCupon([cuota], { cupon_id: "x", codigo: "OTRO", tipo: "porcentaje", valor: 10, planes: ["otro"] }, "efectivo", "full").aplicadas).toBe(0);
  });
});

// VD-5 · lo que comparten Vender y la hoja Cobrar
const preciosVenta = (extra: Partial<PreciosVenta> = {}): PreciosVenta => ({
  tope_descuento: null, medios: ["efectivo"], pases: [], packs: [], productos: [],
  cuota: { plan_id: "p1", plan: "Full", duracion_meses: 1, precios: cuota.precios! }, ...extra,
});

test("lineasIniciales: la cuota de su plan, con la matrícula y el recargo si los debe", () => {
  expect(lineasIniciales(preciosVenta({ cuota: null }))).toEqual([]);
  expect(lineasIniciales(preciosVenta()).map((l) => l.tipo)).toEqual(["cuota"]);
  const todo = lineasIniciales(preciosVenta({ matricula: { plan_id: "p1", plan: "Full", monto: 5000, anual: false }, recargo: { monto: 800, atraso: 4, dias: 3 } }));
  expect(todo.map((l) => l.tipo)).toEqual(["cuota", "matricula", "recargo"]);
  expect(totalCarrito(todo, "transferencia")).toBe(25000 + 5000 + 800);
});

test("conRecargoLineas: el recargo entra con la cuota y sale sin ella", () => {
  const recargo = { monto: 800, atraso: 4, dias: 3 };
  const con = conRecargoLineas([{ ...cuota, cantidad: 1 }], recargo);
  expect(con.map((l) => l.tipo)).toEqual(["cuota", "recargo"]);
  expect(conRecargoLineas(con, recargo)).toBe(con);
  expect(conRecargoLineas([agua], recargo)).toEqual([agua]);
  expect(conRecargoLineas(con.filter((l) => l.tipo !== "cuota"), recargo)).toEqual([]);
});

test("VD-17: los servicios del socio acompañan a la cuota por los mismos meses y se van con ella", () => {
  const locker = [{ producto_id: "p1", nombre: "Locker", precio: 3000 }];
  const con = conRecargoLineas([cuota], undefined, locker);
  expect(con.map((l) => l.tipo)).toEqual(["cuota", "servicio"]);
  expect(con[1]).toMatchObject({ nombre: "Locker (servicio)", producto_id: "p1", precio_fijo: 3000, cantidad: 2 });
  // Cambia la cantidad de cuotas: el servicio la sigue y conserva su descuento.
  const tres = conRecargoLineas([{ ...con[0], cantidad: 3 }, { ...con[1], descuento: 500, descuento_motivo: "Amigo" }], undefined, locker);
  expect(tres[1]).toMatchObject({ cantidad: 3, descuento: 500 });
  // Sin cuota no hay servicio; y un producto común no lo lleva.
  expect(conRecargoLineas(con.filter((l) => l.tipo !== "cuota"), undefined, locker)).toEqual([]);
  expect(conRecargoLineas([agua], undefined, locker)).toEqual([agua]);
});

test("armarItems: lo que recibe vender() en la base", () => {
  const [item, otra] = armarItems([{ ...cuota, descuento: 1000, descuento_motivo: "Amigo" }, { clave: "o", tipo: "otro", nombre: "Candado", cantidad: 1, precio_fijo: 4000 }]);
  expect(item).toMatchObject({ tipo: "cuota", cantidad: 2, descuento: 1000, descuento_motivo: "Amigo" });
  expect(item.descripcion).toBeUndefined();
  expect(otra).toMatchObject({ tipo: "otro", descripcion: "Candado", precio_unitario: 4000 });
});
