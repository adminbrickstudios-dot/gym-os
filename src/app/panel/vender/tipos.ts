export type Precios = { lista: number | null; efectivo: number | null; transferencia: number | null; debito: number | null; credito: number | null };
/** VD-7 (D18): la primera cuota con día fijo cuando es parcial. Los precios de `cuota.precios` ya vienen escalados por la base. */
export type PrimeraCuota = {
  modo: "proporcional" | "mes_entero" | "gratis"; dias: number; dias_ciclo: number; desde: string; hasta: string;
  /** "11 días de 30", "gratis hasta el 01/12", "mes entero, cubre hasta el 01/01". */
  texto: string; lista_entera: number | null;
};
export type Medio ="efectivo" | "transferencia" | "debito" | "credito" | "cuenta_corriente";
export type PreciosVenta = {
  tope_descuento: number | null;
  /** Medios que acepta el gimnasio para cobrar acá (sin Caja, sin efectivo). */
  medios: Medio[];
  cuota: { plan_id: string; plan: string; duracion_meses: number; precios: Precios; parcial?: PrimeraCuota | null } | null;
  /** La matrícula de su plan, si la debe (PLA-3). Se calcula en la base de lo cobrado. */
  matricula?: { plan_id: string; plan: string; monto: number; anual: boolean } | null;
  /** Recargo por pagar tarde, si corresponde hoy (PLA-7). Va siempre con la cuota. */
  recargo?: { monto: number; atraso: number; dias: number } | null;
  /** Convenio vigente del socio (VEN-3): la base lo descuenta solo de la cuota. */
  convenio?: Convenio | null;
  /** VEN-5: lo que debe a cuenta, y cuánto más se le puede fiar (si el gimnasio fía). */
  deuda?: number | null;
  fiado?: { tope: number; disponible: number } | null;
  /** VD-17: los servicios adicionales (locker, toalla…) que tiene contratados: van con la cuota, mes a mes. */
  servicios?: { producto_id: string; nombre: string; precio: number }[];
  pases: { plan_id: string; nombre: string; precios: Precios }[];
  packs: { plan_id: string; nombre: string; cantidad_clases: number; precios: Precios }[];
  productos: { producto_id: string; nombre: string; precio: number; foto_path?: string | null; categoria?: string | null }[];
};
export type Linea = {
  clave: string;
  tipo: "cuota" | "pase" | "pack" | "producto" | "matricula" | "recargo" | "servicio" | "deuda" | "otro";
  nombre: string;
  plan_id?: string;
  producto_id?: string;
  cantidad: number;
  precios?: Precios;       // planes: el precio depende del medio
  precio_fijo?: number;    // productos y "otro"
  descuento?: number;
  descuento_texto?: string;  // lo que se escribió ("1.500"), para no perder el punto mientras se tipea
  descuento_motivo?: string;
  /** H2c: fechas elegidas de lo que cubre la cuota (YYYY-MM-DD, hasta inclusive). Solo dueño y encargado; la base las valida. */
  cubre?: { desde: string; hasta: string };
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

/** El recargo por pagar tarde acompaña a la cuota: entra y sale con ella (PLA-7). */
export function conRecargoLineas(ls: Linea[], recargo: PreciosVenta["recargo"] | undefined, servicios?: PreciosVenta["servicios"]): Linea[] {
  const hayCuota = ls.some((l) => l.tipo === "cuota");
  const sin = ls.filter((l) => l.tipo !== "recargo");
  const conRec = !hayCuota || !recargo ? sin : ls.some((l) => l.tipo === "recargo") ? ls : [...ls, lineaRecargo(recargo)];
  return conServiciosLineas(conRec, servicios);
}

/** VD-17: los servicios del socio acompañan a la cuota, por los mismos meses (la base lo exige igual). */
export function conServiciosLineas(ls: Linea[], servicios: PreciosVenta["servicios"] | undefined): Linea[] {
  const meses = ls.filter((l) => l.tipo === "cuota").reduce((n, l) => n + l.cantidad, 0);
  if ((meses === 0 || !servicios?.length) && !ls.some((l) => l.tipo === "servicio")) return ls;
  const sin = ls.filter((l) => l.tipo !== "servicio");
  if (meses === 0 || !servicios?.length) return sin;
  return [...sin, ...servicios.map((s): Linea => {
    const previa = ls.find((l) => l.tipo === "servicio" && l.producto_id === s.producto_id);
    return { ...(previa ?? { clave: `servicio-${s.producto_id}`, tipo: "servicio", nombre: `${s.nombre} (servicio)`, producto_id: s.producto_id, precio_fijo: Number(s.precio) }), cantidad: meses };
  })];
}

/** Lo que arranca en el carrito de quien debe su cuota: la cuota de su plan, su matrícula si la debe y el recargo si corresponde. */
export function lineasIniciales(p: PreciosVenta): Linea[] {
  if (!p.cuota) return [];
  return conServiciosLineas([
    { clave: "cuota-inicial", tipo: "cuota", nombre: `Cuota ${p.cuota.plan}`, precios: p.cuota.precios, cantidad: 1 },
    ...(p.matricula ? [{ clave: "matricula-inicial", tipo: "matricula" as const, nombre: `Matrícula ${p.matricula.plan}`, precio_fijo: Number(p.matricula.monto), cantidad: 1 }] : []),
    ...(p.recargo ? [lineaRecargo(p.recargo)] : []),
  ], p.servicios);
}

/** Las líneas del carrito como las recibe vender() en la base. */
export function armarItems(lineas: Linea[]): Record<string, unknown>[] {
  return lineas.map((l) => ({
    tipo: l.tipo, cantidad: l.cantidad, plan_id: l.plan_id, producto_id: l.producto_id,
    descripcion: l.tipo === "otro" ? l.nombre : undefined, precio_unitario: l.tipo === "otro" || l.tipo === "deuda" ? l.precio_fijo : undefined,
    descuento: l.descuento || undefined, descuento_motivo: l.descuento_motivo || undefined,
    cubre_desde: l.tipo === "cuota" && l.cantidad === 1 ? l.cubre?.desde : undefined, cubre_hasta: l.tipo === "cuota" && l.cantidad === 1 ? l.cubre?.hasta : undefined,
  }));
}
