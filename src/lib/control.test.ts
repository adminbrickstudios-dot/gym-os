import { describe, expect, it } from "vitest";
import { detalleControl, enlaceControl, filaCsv, tituloControl, TIPOS_CONTROL, META_TIPO, type ItemControl } from "./control";
import { rutaDisponible } from "./panel/secciones";

const ZONA = "America/Argentina/Buenos_Aires";
const base: ItemControl = { tipo: "cobro", clave: "x", en: "2026-11-06T15:30:00+00:00", quien_id: "q", quien: "Ana", monto: 25000, socio_id: "s", socio: "Lu Pérez", detalle: "Cuota Full", extra: {} };

describe("Control", () => {
  it("cada tipo tiene su emoji y su etiqueta", () => {
    for (const t of TIPOS_CONTROL) expect(META_TIPO[t].etiqueta.length).toBeGreaterThan(2);
  });
  it("cuenta cada movimiento con la plata y la persona", () => {
    expect(tituloControl(base, ZONA)).toMatch(/Ana cobró .*25\.000.* a Lu Pérez/);
    expect(tituloControl({ ...base, tipo: "anulacion", quien: "Martín" }, ZONA)).toMatch(/Martín anuló una venta/);
    expect(tituloControl({ ...base, tipo: "descuento", extra: { porcentaje: 33 } }, ZONA)).toMatch(/descuento de .* \(33 %\)/);
    expect(tituloControl({ ...base, tipo: "otro_dia", extra: { cobrado_el: "2026-11-01T15:00:00+00:00" } }, ZONA)).toMatch(/fecha del 0?1\/11/);
    expect(tituloControl({ ...base, tipo: "caja", monto: -50, detalle: "Recepción", extra: { evento: "cerro" } }, ZONA)).toMatch(/cerró la Recepción con .*50.* de menos/);
    expect(tituloControl({ ...base, tipo: "caja", monto: 0, detalle: "Recepción", extra: { evento: "cerro" } }, ZONA)).toMatch(/justa/);
    expect(tituloControl({ ...base, tipo: "caja", quien: null, detalle: "Recepción", extra: { evento: "sin_contar" } }, ZONA)).toMatch(/quedó sin contar/);
  });
  it("el detalle explica el medio, el motivo y quién aprobó", () => {
    expect(detalleControl({ ...base, extra: { medios: "efectivo, transferencia" } })).toBe("Cuota Full · efectivo + transferencia");
    expect(detalleControl({ ...base, tipo: "anulacion", detalle: "Error", extra: { pidio: "Ana", aprobo: "Sofía" } })).toBe("Motivo: Error · pidió Ana · aprobó Sofía");
    expect(detalleControl({ ...base, tipo: "configuracion", detalle: "descuento_max_recepcion", extra: { antes: 10, despues: 50 } })).toBe("10 → 50");
  });
  it("lleva a la ficha, a la caja o a la configuración", () => {
    expect(enlaceControl(base)).toBe("/panel/socios/s");
    expect(enlaceControl({ ...base, tipo: "caja", socio_id: null })).toBe("/panel/caja/historial");
    expect(enlaceControl({ ...base, tipo: "configuracion", socio_id: null })).toBe("/panel/configuracion");
  });
  it("una fila del CSV lleva la plata con coma y la hora del gimnasio", () => {
    const f = filaCsv(base, ZONA);
    expect(f[0]).toMatch(/^0?6\/0?11\/2026,? 12:30$/);
    expect(f[1]).toBe("Cobros");
    expect(f[4]).toBe("25000,00");
  });
  it("el Control es de dueño y encargado, y se apaga", () => {
    expect(rutaDisponible("/panel/control", "dueno", [])).toBe(true);
    expect(rutaDisponible("/panel/control?tipos=otro_dia", "encargado", [])).toBe(true);
    expect(rutaDisponible("/panel/control", "encargado", ["control"])).toBe(false);
    expect(rutaDisponible("/panel/control", "recepcion", [])).toBe(false);
    expect(rutaDisponible("/panel/control", "dueno", ["control"])).toBe(false);
  });
});
