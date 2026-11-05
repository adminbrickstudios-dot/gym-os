export type Precios = { lista: number | null; efectivo: number | null; transferencia: number | null; debito: number | null; credito: number | null };
export type Medio = "efectivo" | "transferencia" | "debito" | "credito" | "cuenta_corriente";
export type PreciosVenta = {
  tope_descuento: number | null;
  /** Medios que acepta el gimnasio para cobrar acá (sin Caja, sin efectivo). */
  medios: Medio[];
  cuota: { plan_id: string; plan: string; duracion_meses: number; precios: Precios } | null;
  /** La matrícula de su plan, si la debe (PLA-3). Se calcula en la base de lo cobrado. */
  matricula?: { plan_id: string; plan: string; monto: number; anual: boolean } | null;
  /** Recargo por pagar tarde, si corresponde hoy (PLA-7). Va siempre con la cuota. */
  recargo?: { monto: number; atraso: number; dias: number } | null;
  /** Convenio vigente del socio (VEN-3): la base lo descuenta solo de la cuota. */
  convenio?: Convenio | null;
  /** VEN-5: lo que debe a cuenta, y cuánto más se le puede fiar (si el gimnasio fía). */
  deuda?: number | null;
  fiado?: { tope: number; disponible: number } | null;
  pases: { plan_id: string; nombre: string; precios: Precios }[];
  packs: { plan_id: string; nombre: string; cantidad_clases: number; precios: Precios }[];
  productos: { producto_id: string; nombre: string; precio: number }[];
};
export type Linea = {
  clave: string;
  tipo: "cuota" | "pase" | "pack" | "producto" | "matricula" | "recargo" | "deuda" | "otro";
  nombre: string;
  plan_id?: string;
  producto_id?: string;
  cantidad: number;
  precios?: Precios;       // planes: el precio depende del medio
  precio_fijo?: number;    // productos y "otro"
  descuento?: number;
  descuento_texto?: string;  // lo que se escribió ("1.500"), para no perder el punto mientras se tipea
  descuento_motivo?: string;
};

/** Precio unitario de una línea con el medio elegido. Con pago mixto (medio null) rige el de lista, como en la base. */
export function precioUnitario(l: Linea, medio: Medio | null): number | null {
  if (l.precio_fijo != null) return l.precio_fijo;
  if (!l.precios) return null;
  // "A cuenta" no tiene precio propio: rige el de lista.
  return (medio && medio !== "cuenta_corriente" ? l.precios[medio] : null) ?? l.precios.lista;
}

export type Convenio = { nombre: string; tipo: "porcentaje" | "monto"; valor: number };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Lo que descuenta el convenio en una línea de cuota: la misma cuenta que vender() en la base. */
export function descuentoConvenio(l: Linea, medio: Medio | null, c: Convenio | null | undefined): number {
  if (!c || l.tipo !== "cuota") return 0;
  const p = precioUnitario(l, medio);
  if (p == null) return 0;
  const unidad = c.tipo === "porcentaje" ? r2((p * Number(c.valor)) / 100) : r2(Number(c.valor));
  return Math.max(0, Math.min(r2(p * l.cantidad - (l.descuento ?? 0)), r2(unidad * l.cantidad)));
}

export function totalCarrito(lineas: Linea[], medio: Medio | null, convenio?: Convenio | null): number | null {
  let t = 0;
  for (const l of lineas) {
    const p = precioUnitario(l, medio);
    if (p == null) return null;
    t += r2(p * l.cantidad - (l.descuento ?? 0) - descuentoConvenio(l, medio, convenio));
  }
  return r2(t);
}

/** La línea del recargo por pagar tarde (PLA-7): la base la exige junto con la cuota. */
export function lineaRecargo(r: NonNullable<PreciosVenta["recargo"]>): Linea {
  return { clave: "recargo", tipo: "recargo", nombre: `Recargo por pagar tarde (${r.atraso} días)`, precio_fijo: Number(r.monto), cantidad: 1 };
}

/** COM-9: un cupón válido (lo dice la base) y cómo descuenta. */
export type Cupon = { cupon_id: string; codigo: string; tipo: "porcentaje" | "monto"; valor: number; planes: string[] };

/**
 * Carga el descuento del cupón en las líneas que corresponde: cuotas, pases y
 * packs de los planes del cupón (todos si no tiene planes); nunca productos,
 * recargos, matrículas ni deudas. El porcentaje va en cada línea; el monto
 * fijo, una sola vez (en la primera que corresponde). El motivo es "Cupón X":
 * es un descuento como cualquier otro (vale el tope de la recepción).
 */
export function aplicarCupon(lineas: Linea[], c: Cupon, medio: Medio | null, cuotaPlanId: string | null): { lineas: Linea[]; aplicadas: number } {
  let aplicadas = 0;
  const corresponde = (l: Linea) => {
    const plan = l.tipo === "cuota" ? cuotaPlanId : l.tipo === "pase" || l.tipo === "pack" ? l.plan_id ?? null : null;
    return plan != null && (!c.planes.length || c.planes.includes(plan));
  };
  const nuevas = lineas.map((l) => {
    if (!corresponde(l)) return l;
    const p = precioUnitario(l, medio);
    if (p == null || p <= 0) return l;
    const bruto = p * l.cantidad;
    let d: number;
    if (c.tipo === "porcentaje") d = Math.round(bruto * Number(c.valor)) / 100;
    else if (aplicadas === 0) d = Math.min(Number(c.valor), bruto);
    else return l;
    aplicadas++;
    return { ...l, descuento: d, descuento_texto: undefined, descuento_motivo: `Cupón ${c.codigo}` };
  });
  return { lineas: nuevas, aplicadas };
}
